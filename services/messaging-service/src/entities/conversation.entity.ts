import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Table shape for db/migrations/0003 (checked by scripts/check-entity-schema.ts).
 * MessagingService runs hand-written SQL against these tables; see the migration for the
 * indexes each query relies on.
 */
@Entity('conversations')
export class ConversationEntity {
  @PrimaryColumn('uuid')
  id: string;

  /** The pair is stored ordered (user_low < user_high) under a UNIQUE constraint. */
  @Column('uuid', { name: 'user_low' })
  userLow: string;

  @Column('uuid', { name: 'user_high' })
  userHigh: string;

  @Column('uuid', { name: 'listing_id', nullable: true })
  listingId: string | null;

  @Column('bigint', { name: 'last_message_id', nullable: true })
  lastMessageId: string | null;

  @Column('timestamptz', { name: 'last_message_at', nullable: true })
  lastMessageAt: Date | null;

  @Column('uuid', { name: 'last_sender_id', nullable: true })
  lastSenderId: string | null;

  @Column('varchar', { name: 'last_message_preview', length: 200, nullable: true })
  lastMessagePreview: string | null;

  @Column('boolean', { name: 'last_message_image', default: false })
  lastMessageImage: boolean;

  @Column('uuid', { name: 'blocked_by', array: true, default: () => "'{}'" })
  blockedBy: string[];

  @Column('timestamptz', { name: 'created_at' })
  createdAt: Date;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt: Date;
}

@Entity('conversation_members')
export class ConversationMemberEntity {
  @PrimaryColumn('uuid', { name: 'conversation_id' })
  conversationId: string;

  @PrimaryColumn('uuid', { name: 'user_id' })
  userId: string;

  @Column('timestamptz', { name: 'last_activity_at' })
  lastActivityAt: Date;

  @Column('int', { name: 'unread_count', default: 0 })
  unreadCount: number;

  /** Read position: every message with id ≤ this one has been read by this member. */
  @Column('bigint', { name: 'last_read_message_id', default: 0 })
  lastReadMessageId: string;
}
