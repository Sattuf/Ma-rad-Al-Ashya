import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { MAX_MESSAGE_LENGTH } from '../entities/message.entity';
import { StorageService } from './storage.service';

const MAX_PAGE_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGE_ID_PATTERN = /^[1-9][0-9]{0,18}$/;
const DELETE_WINDOW_MS = 5 * 60 * 1000;
export const IMAGE_MESSAGE_TEXT = 'صورة';

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image';
  imageUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ConversationDto {
  id: string;
  participants: string[];
  otherUserId: string;
  listingId: string | null;
  lastMessage: MessageDto | null;
  lastMessageAt: string | null;
  unreadCount: number;
  unreadCounts: Record<string, number>;
  blocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  data: T[];
  /** Pass back as `cursor` for the next (older) page; null when there is none. */
  nextCursor: string | null;
}

/** A sent message plus what the realtime layer needs, from the same statement. */
export interface SentMessage {
  message: MessageDto;
  recipientIds: string[];
  listingId: string | null;
}

export function clampLimit(limit: unknown, fallback = 50): number {
  const parsed = Number(limit);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), MAX_PAGE_SIZE) : fallback;
}

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_PATTERN.test(value);

/** Inbox cursor: the exact (last_activity_at, conversation_id) of the last row, opaque to clients. */
export function encodeInboxCursor(activityAt: string, conversationId: string): string {
  return Buffer.from(`${activityAt}|${conversationId}`, 'utf8').toString('base64url');
}

export function decodeInboxCursor(cursor: unknown): { activityAt: string; conversationId: string } | null {
  if (typeof cursor !== 'string' || !cursor) return null;
  const [activityAt, conversationId] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (!isUuid(conversationId) || !activityAt || Number.isNaN(Date.parse(activityAt))) {
    throw new BadRequestException('Invalid cursor');
  }
  return { activityAt, conversationId };
}

const iso = (value: Date | string | null): string | null =>
  value === null ? null : (value instanceof Date ? value : new Date(value)).toISOString();

function toMessage(row: any, isRead: boolean): MessageDto {
  return {
    id: String(row.id),
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    type: row.image_url ? 'image' : 'text',
    imageUrl: row.image_url ?? null,
    isRead,
    createdAt: iso(row.created_at)!,
  };
}

/**
 * Conversations and messages on Postgres (db/migrations/0003).
 *
 * Every endpoint is a bounded number of statements whose cost does not grow with the
 * size of a conversation or of the inbox:
 *  - inbox and history page by keyset (never OFFSET);
 *  - sending a message is ONE statement that checks membership and blocking, inserts the
 *    message, updates the conversation summary and both members' counters;
 *  - "mark as read" moves a read position on one row instead of updating every message.
 */
@Injectable()
export class MessagingService {
  constructor(
    private readonly db: DataSource,
    private readonly storageService: StorageService,
  ) {}

  /** A conversation is between the caller and exactly one other user; one per pair. */
  async createOrGetConversation(userId: string, otherUserIds: unknown, listingId?: unknown): Promise<ConversationDto> {
    if (!isUuid(userId)) throw new BadRequestException('Invalid user id');
    const others = Array.isArray(otherUserIds) ? otherUserIds.filter(isUuid).map((id) => id.toLowerCase()) : [];
    const participants = Array.from(new Set([userId.toLowerCase(), ...others]));
    if (participants.length !== 2) {
      throw new BadRequestException('A conversation needs exactly one other participant');
    }
    const [low, high] = participants.sort();
    const listing = isUuid(listingId) ? listingId : null;

    let id: string | undefined;
    try {
      // Inserts the conversation and both member rows in one statement, or does nothing if
      // the pair already has a conversation (UNIQUE (user_low, user_high)).
      const rows: { id: string }[] = await this.db.query(
        `WITH created AS (
           INSERT INTO conversations (user_low, user_high, listing_id)
           VALUES ($1, $2, $3)
           ON CONFLICT ON CONSTRAINT conversations_pair_unique DO NOTHING
           RETURNING id
         ), members AS (
           INSERT INTO conversation_members (conversation_id, user_id)
           SELECT created.id, u FROM created, unnest(ARRAY[$1, $2]::uuid[]) AS u
         )
         SELECT id FROM created
         UNION ALL
         SELECT id FROM conversations WHERE user_low = $1 AND user_high = $2
         LIMIT 1`,
        [low, high, listing],
      );
      id = rows[0]?.id;
    } catch (err: any) {
      if (err?.code === '23503') throw new NotFoundException('User or listing not found');
      throw err;
    }
    // A concurrent request created the pair after this statement's snapshot was taken: it
    // is committed now, so a fresh statement sees it.
    if (!id) {
      const rows: { id: string }[] = await this.db.query(
        'SELECT id FROM conversations WHERE user_low = $1 AND user_high = $2',
        [low, high],
      );
      id = rows[0]?.id;
    }
    if (!id) throw new NotFoundException('Conversation not found');
    return this.getConversation(id, userId);
  }

  /** The caller's inbox, most recent activity first. */
  async getConversations(userId: string, limit: unknown = 20, cursor?: unknown): Promise<Page<ConversationDto>> {
    const size = clampLimit(limit, 20);
    const after = decodeInboxCursor(cursor);
    const rows: any[] = await this.db.query(
      `${INBOX_SELECT}
       WHERE me.user_id = $1
         AND ($2::timestamptz IS NULL OR (me.last_activity_at, me.conversation_id) < ($2::timestamptz, $3::uuid))
       ORDER BY me.last_activity_at DESC, me.conversation_id DESC
       LIMIT $4`,
      [userId, after?.activityAt ?? null, after?.conversationId ?? null, size + 1],
    );
    const page = rows.slice(0, size);
    const last = page[page.length - 1];
    return {
      data: page.map((r) => this.toConversation(r, userId)),
      nextCursor: rows.length > size ? encodeInboxCursor(last.cursor_ts, last.id) : null,
    };
  }

  async getConversation(conversationId: string, userId: string): Promise<ConversationDto> {
    if (!isUuid(conversationId)) throw new NotFoundException('Conversation not found');
    const rows: any[] = await this.db.query(`${INBOX_SELECT} WHERE me.conversation_id = $1 AND me.user_id = $2`, [
      conversationId,
      userId,
    ]);
    if (!rows.length) await this.assertParticipant(conversationId, userId);
    return this.toConversation(rows[0], userId);
  }

  /** Throws NotFound (no such conversation) or Forbidden (caller is not a member). */
  async assertParticipant(conversationId: string, userId: string): Promise<void> {
    if (!isUuid(conversationId)) throw new NotFoundException('Conversation not found');
    const rows: { member: boolean }[] = await this.db.query(
      `SELECT EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $2) AS member
       FROM conversations c WHERE c.id = $1`,
      [conversationId, userId],
    );
    if (!rows.length) throw new NotFoundException('Conversation not found');
    if (!rows[0].member) throw new ForbiddenException('You are not a participant in this conversation');
  }

  /** History, newest first; `cursor` is the id of the oldest message already shown. */
  async getMessages(conversationId: string, userId: string, limit: unknown = 50, cursor?: unknown): Promise<Page<MessageDto>> {
    if (!isUuid(conversationId)) throw new NotFoundException('Conversation not found');
    if (cursor !== undefined && cursor !== null && cursor !== '' && !MESSAGE_ID_PATTERN.test(String(cursor))) {
      throw new BadRequestException('Invalid cursor');
    }
    const size = clampLimit(limit);
    // The member CTE doubles as the access check: no member row, no messages. The read
    // positions of both members are read once, not per message.
    const rows: any[] = await this.db.query(
      `WITH members AS (
         SELECT user_id, last_read_message_id FROM conversation_members WHERE conversation_id = $1
       )
       SELECT m.id, m.conversation_id, m.sender_id, m.content, m.image_url, m.created_at,
              m.id <= COALESCE((SELECT max(last_read_message_id) FROM members WHERE user_id <> m.sender_id), 0) AS is_read
       FROM messages m
       WHERE m.conversation_id = $1
         AND EXISTS (SELECT 1 FROM members WHERE user_id = $2)
         AND ($3::bigint IS NULL OR m.id < $3::bigint)
       -- A backward range scan of the primary key (conversation_id, id).
       ORDER BY m.id DESC
       LIMIT $4`,
      [conversationId, userId, cursor ? String(cursor) : null, size + 1],
    );
    if (!rows.length) await this.assertParticipant(conversationId, userId);
    const page = rows.slice(0, size);
    return {
      data: page.map((r) => toMessage(r, r.is_read)),
      nextCursor: rows.length > size ? String(page[page.length - 1].id) : null,
    };
  }

  async sendMessage(conversationId: string, senderId: string, content: unknown): Promise<SentMessage> {
    if (typeof content !== 'string' || !content.trim()) {
      throw new BadRequestException('Message content is required');
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(`Message is longer than ${MAX_MESSAGE_LENGTH} characters`);
    }
    return this.insertMessage(conversationId, senderId, content, null);
  }

  async sendImageMessage(conversationId: string, senderId: string, file: Express.Multer.File): Promise<SentMessage> {
    if (!file) throw new BadRequestException('Image file is required');
    // Check access before paying for the upload.
    await this.assertParticipant(conversationId, senderId);
    const imageUrl = await this.storageService.uploadImage(file);
    return this.insertMessage(conversationId, senderId, IMAGE_MESSAGE_TEXT, imageUrl);
  }

  /**
   * One statement, one round trip. The conversation row is locked first (FOR NO KEY
   * UPDATE, which does not block the messages FK check), so concurrent sends to the same
   * conversation serialize in a fixed lock order (conversation → members): no lost
   * unread increments, no deadlock with markRead, and the summary always points at the
   * newest message.
   */
  private async insertMessage(
    conversationId: string,
    senderId: string,
    content: string,
    imageUrl: string | null,
  ): Promise<SentMessage> {
    if (!isUuid(conversationId)) throw new NotFoundException('Conversation not found');
    const rows: any[] = await this.db.query(
      `WITH conv AS (
         SELECT c.id, c.listing_id, cardinality(c.blocked_by) > 0 AS blocked,
                EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = $2) AS member
         FROM conversations c WHERE c.id = $1
         FOR NO KEY UPDATE
       ), msg AS (
         INSERT INTO messages (conversation_id, sender_id, content, image_url)
         SELECT id, $2, $3, $4 FROM conv WHERE member AND NOT blocked
         RETURNING id, conversation_id, sender_id, content, image_url, created_at
       ), summary AS (
         UPDATE conversations c
         SET last_message_id = msg.id, last_message_at = msg.created_at, last_sender_id = msg.sender_id,
             last_message_preview = left(msg.content, 200), last_message_image = msg.image_url IS NOT NULL,
             updated_at = msg.created_at
         FROM msg
         WHERE c.id = msg.conversation_id AND (c.last_message_id IS NULL OR c.last_message_id < msg.id)
       ), counters AS (
         UPDATE conversation_members m
         SET last_activity_at = GREATEST(m.last_activity_at, msg.created_at),
             unread_count = m.unread_count + (m.user_id <> msg.sender_id)::int
         FROM msg
         WHERE m.conversation_id = msg.conversation_id
         RETURNING m.user_id
       )
       SELECT conv.listing_id, conv.blocked, conv.member,
              msg.id, msg.conversation_id, msg.sender_id, msg.content, msg.image_url, msg.created_at,
              (SELECT coalesce(array_agg(user_id), '{}') FROM counters WHERE user_id <> $2) AS recipients
       FROM conv LEFT JOIN msg ON true`,
      [conversationId, senderId, content, imageUrl],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Conversation not found');
    if (!row.member) throw new ForbiddenException('You are not a participant in this conversation');
    if (row.blocked) throw new ForbiddenException('Conversation is blocked');
    return {
      message: toMessage(row, false),
      recipientIds: pgArray(row.recipients),
      listingId: row.listing_id ?? null,
    };
  }

  /**
   * Moves the caller's read position to the newest message and zeroes the unread count:
   * one row, whatever the number of unread messages. Locks the conversation row first,
   * like sending, so a message committed concurrently is either counted as read or left
   * unread — never zeroed without being read.
   */
  async markRead(conversationId: string, userId: string): Promise<{ lastReadMessageId: string }> {
    if (!isUuid(conversationId)) throw new NotFoundException('Conversation not found');
    const rows: any[] = await this.db.query(
      `WITH conv AS (
         SELECT id, coalesce(last_message_id, 0) AS last_id FROM conversations WHERE id = $1 FOR SHARE
       ), updated AS (
         UPDATE conversation_members m
         SET unread_count = 0, last_read_message_id = GREATEST(m.last_read_message_id, conv.last_id)
         FROM conv
         WHERE m.conversation_id = conv.id AND m.user_id = $2
         RETURNING m.last_read_message_id
       )
       SELECT last_read_message_id FROM updated`,
      [conversationId, userId],
    );
    if (!rows.length) await this.assertParticipant(conversationId, userId);
    return { lastReadMessageId: String(rows[0]?.last_read_message_id ?? 0) };
  }

  async blockConversation(conversationId: string, userId: string): Promise<ConversationDto> {
    await this.assertParticipant(conversationId, userId);
    await this.db.query(
      `UPDATE conversations SET blocked_by = array_append(blocked_by, $2::uuid), updated_at = now()
       WHERE id = $1 AND NOT ($2::uuid = ANY (blocked_by))`,
      [conversationId, userId],
    );
    return this.getConversation(conversationId, userId);
  }

  /** Senders may delete their own message within 5 minutes. Returns the recipients to notify. */
  async deleteMessage(conversationId: string, messageId: string, userId: string): Promise<{ recipientIds: string[] }> {
    if (!isUuid(conversationId) || !MESSAGE_ID_PATTERN.test(String(messageId))) {
      throw new NotFoundException('Message not found');
    }
    return this.db.transaction(async (tx: EntityManager) => {
      // Same lock order as sending: conversation first.
      const conv = await tx.query('SELECT id FROM conversations WHERE id = $1 FOR NO KEY UPDATE', [conversationId]);
      if (!conv.length) throw new NotFoundException('Message not found');

      const found: any[] = await tx.query(
        'SELECT id, sender_id, created_at FROM messages WHERE id = $1 AND conversation_id = $2',
        [messageId, conversationId],
      );
      const message = found[0];
      if (!message) throw new NotFoundException('Message not found');
      if (message.sender_id !== userId) throw new ForbiddenException('You can only delete your own messages');
      if (Date.now() - new Date(message.created_at).getTime() > DELETE_WINDOW_MS) {
        throw new BadRequestException('Can only delete messages within 5 minutes of sending');
      }

      await tx.query('DELETE FROM messages WHERE conversation_id = $1 AND id = $2', [conversationId, messageId]);
      // A recipient who had not read it yet has one unread message less.
      const recipients: { user_id: string }[] = await tx.query(
        `WITH updated AS (
           UPDATE conversation_members
           SET unread_count = GREATEST(unread_count - (last_read_message_id < $2)::int, 0)
           WHERE conversation_id = $1 AND user_id <> $3
           RETURNING user_id
         )
         SELECT user_id FROM updated`,
        [conversationId, messageId, userId],
      );
      // If it was the latest message, the summary falls back to the previous one
      // (one probe of the primary key (conversation_id, id)).
      await tx.query(
        `UPDATE conversations c
         SET last_message_id = prev.id, last_message_at = prev.created_at, last_sender_id = prev.sender_id,
             last_message_preview = left(prev.content, 200), last_message_image = coalesce(prev.image_url IS NOT NULL, false)
         FROM (SELECT NULL) AS dummy
         LEFT JOIN LATERAL (
           SELECT id, created_at, sender_id, content, image_url FROM messages
           WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1
         ) prev ON true
         WHERE c.id = $1 AND c.last_message_id = $2`,
        [conversationId, messageId],
      );
      return { recipientIds: recipients.map((r) => r.user_id) };
    });
  }

  private toConversation(row: any, userId: string): ConversationDto {
    const otherUserId: string = row.other_user_id;
    const lastMessage: MessageDto | null = row.last_message_id
      ? {
          id: String(row.last_message_id),
          conversationId: row.id,
          senderId: row.last_sender_id,
          content: row.last_message_preview,
          type: row.last_message_image ? 'image' : 'text',
          imageUrl: null,
          // Read when the member who did not send it has read up to it.
          isRead:
            BigInt(row.last_message_id) <=
            BigInt(row.last_sender_id === userId ? row.other_last_read : row.my_last_read),
          createdAt: iso(row.last_message_at)!,
        }
      : null;
    return {
      id: row.id,
      participants: [userId, otherUserId],
      otherUserId,
      listingId: row.listing_id ?? null,
      lastMessage,
      lastMessageAt: iso(row.last_message_at),
      unreadCount: row.unread_count,
      unreadCounts: { [userId]: row.unread_count, [otherUserId]: row.other_unread },
      blocked: row.blocked,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }
}

/**
 * The inbox row: the caller's member row, the conversation summary and the other member.
 * Driven by idx_conversation_members_inbox, then two primary-key lookups per row.
 * cursor_ts is the exact timestamp as text (microseconds kept; a JS Date would truncate
 * to milliseconds and make the keyset skip or repeat rows).
 */
const INBOX_SELECT = `
  SELECT c.id, c.listing_id, c.created_at, c.updated_at,
         c.last_message_id, c.last_message_at, c.last_sender_id, c.last_message_preview, c.last_message_image,
         cardinality(c.blocked_by) > 0 AS blocked,
         me.unread_count, me.last_read_message_id AS my_last_read, me.last_activity_at::text AS cursor_ts,
         other.user_id AS other_user_id, other.unread_count AS other_unread,
         other.last_read_message_id AS other_last_read
  FROM conversation_members me
  JOIN conversations c ON c.id = me.conversation_id
  JOIN conversation_members other ON other.conversation_id = me.conversation_id AND other.user_id <> me.user_id`;

// Statements whose rows are read are always SELECTs (data-modifying CTE + SELECT): for a
// top-level UPDATE … RETURNING, TypeORM's query() returns [rows, rowCount] instead of rows.

/** node-postgres returns uuid[] as a Postgres array literal ("{a,b}"). */
function pgArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value === '{}') return [];
  return value.slice(1, -1).split(',');
}
