import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagingService } from '../../src/messaging/messaging.service';

/**
 * MessagingService against a real Postgres migrated with db/migrations (0003 holds the
 * messaging tables). Covers what mocks cannot: the single-statement send under
 * concurrency, keyset paging, read positions, and the query plans on a realistic volume.
 *
 *   DATABASE_URL=postgres://... npm run test:int
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');

const MIGRATIONS_DIR = join(__dirname, '../../../../db/migrations');
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';
const MALLORY = '99999999-9999-4999-8999-999999999999';

describe('MessagingService against real Postgres', () => {
  const schema = `it_msg_${process.pid}`;
  let db: DataSource;
  let service: MessagingService;

  beforeAll(async () => {
    const admin = new DataSource({ type: 'postgres', url: databaseUrl });
    await admin.initialize();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`);
    await admin.destroy();

    db = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      extra: { options: `-c search_path=${schema},public`, max: 20 },
    });
    await db.initialize();
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
      await db.query(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    }
    await db.query(
      `INSERT INTO users (id, full_name) VALUES ($1, 'Alice'), ($2, 'Bob'), ($3, 'Carol'), ($4, 'Mallory')`,
      [ALICE, BOB, CAROL, MALLORY],
    );
    service = new MessagingService(db, { uploadImage: jest.fn(async () => 'https://cdn.example/x.webp') } as any);
  });

  afterAll(async () => {
    await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await db.destroy();
  });

  it('creates one conversation per pair, even under concurrent requests from both sides', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        i % 2 ? service.createOrGetConversation(ALICE, [BOB]) : service.createOrGetConversation(BOB, [ALICE]),
      ),
    );
    expect(new Set(results.map((c) => c.id)).size).toBe(1);
    const [{ count }] = await db.query('SELECT count(*)::int AS count FROM conversations');
    expect(count).toBe(1);
    const [{ members }] = await db.query('SELECT count(*)::int AS members FROM conversation_members');
    expect(members).toBe(2);
    expect(results[0].otherUserId).toBeDefined();
  });

  it('answers 404 for an unknown user instead of failing', async () => {
    await expect(
      service.createOrGetConversation(ALICE, ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']),
    ).rejects.toThrow(NotFoundException);
  });

  it('counts every message under concurrent sends and keeps the newest as the summary', async () => {
    const conv = await service.createOrGetConversation(ALICE, [CAROL]);
    const sent = await Promise.all(
      Array.from({ length: 40 }, (_, i) => service.sendMessage(conv.id, i % 4 ? ALICE : CAROL, `m${i}`)),
    );
    const fromAlice = sent.filter((s) => s.message.senderId === ALICE).length;

    const forCarol = await service.getConversation(conv.id, CAROL);
    const forAlice = await service.getConversation(conv.id, ALICE);
    expect(forCarol.unreadCount).toBe(fromAlice);
    expect(forAlice.unreadCount).toBe(40 - fromAlice);

    const newest = sent.map((s) => BigInt(s.message.id)).reduce((a, b) => (a > b ? a : b));
    expect(forCarol.lastMessage?.id).toBe(String(newest));
    expect(sent[1].recipientIds).toEqual([CAROL]);
  });

  it('pages history by keyset with no gaps or repeats, and marks read by position', async () => {
    const conv = await service.createOrGetConversation(BOB, [CAROL]);
    for (let i = 0; i < 25; i++) await service.sendMessage(conv.id, BOB, `h${i}`);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await service.getMessages(conv.id, CAROL, 10, cursor ?? undefined);
      seen.push(...page.data.map((m) => m.content));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(Array.from({ length: 25 }, (_, i) => `h${24 - i}`));

    expect((await service.getMessages(conv.id, BOB, 5)).data.every((m) => !m.isRead)).toBe(true);
    await service.markRead(conv.id, CAROL);
    expect((await service.getMessages(conv.id, BOB, 50)).data.every((m) => m.isRead)).toBe(true);
    expect((await service.getConversation(conv.id, CAROL)).unreadCount).toBe(0);

    // A message after the read position is unread again, for that message only.
    await service.sendMessage(conv.id, BOB, 'after');
    const [latest, previous] = (await service.getMessages(conv.id, BOB, 2)).data;
    expect([latest.isRead, previous.isRead]).toEqual([false, true]);
  });

  it('pages the inbox by keyset even when activity timestamps tie', async () => {
    // Force identical last_activity_at for every row of Mallory's inbox.
    const partners = [ALICE, BOB, CAROL];
    for (const p of partners) await service.createOrGetConversation(MALLORY, [p]);
    await db.query(
      `UPDATE conversation_members SET last_activity_at = '2026-01-01T00:00:00.123456Z' WHERE user_id = $1`,
      [MALLORY],
    );
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await service.getConversations(MALLORY, 1, cursor ?? undefined);
      ids.push(...page.data.map((c) => c.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('enforces membership and blocking inside the send statement', async () => {
    const conv = await service.createOrGetConversation(ALICE, [BOB]);
    await expect(service.sendMessage(conv.id, MALLORY, 'hi')).rejects.toThrow(ForbiddenException);
    await expect(service.getMessages(conv.id, MALLORY)).rejects.toThrow(ForbiddenException);
    await expect(service.markRead(conv.id, MALLORY)).rejects.toThrow(ForbiddenException);
    await expect(
      service.sendMessage('55555555-5555-4555-8555-555555555555', ALICE, 'hi'),
    ).rejects.toThrow(NotFoundException);

    const blockedConv = await service.createOrGetConversation(CAROL, [MALLORY]);
    await service.blockConversation(blockedConv.id, MALLORY);
    await service.blockConversation(blockedConv.id, MALLORY); // idempotent
    const [{ blocked_by }] = await db.query('SELECT blocked_by FROM conversations WHERE id = $1', [blockedConv.id]);
    expect(blocked_by).toEqual([MALLORY]);
    await expect(service.sendMessage(blockedConv.id, CAROL, 'hi')).rejects.toThrow('Conversation is blocked');
  });

  it('deleting the latest unread message fixes the summary and the unread count', async () => {
    const conv = await service.createOrGetConversation(ALICE, [MALLORY]);
    const first = await service.sendMessage(conv.id, ALICE, 'keep');
    const second = await service.sendMessage(conv.id, ALICE, 'oops');
    expect((await service.getConversation(conv.id, MALLORY)).unreadCount).toBe(2);

    await expect(service.deleteMessage(conv.id, second.message.id, MALLORY)).rejects.toThrow(ForbiddenException);
    const { recipientIds } = await service.deleteMessage(conv.id, second.message.id, ALICE);
    expect(recipientIds).toEqual([MALLORY]);

    const after = await service.getConversation(conv.id, MALLORY);
    expect(after.unreadCount).toBe(1);
    expect(after.lastMessage?.id).toBe(first.message.id);
    expect(after.lastMessage?.content).toBe('keep');
  });

  describe('query plans on a realistic volume', () => {
    beforeAll(async () => {
      // 2,000 users in 20,000 conversations with 200,000 messages.
      await db.query(`
        INSERT INTO users (id, full_name)
        SELECT md5('u' || g)::uuid, 'load ' || g FROM generate_series(1, 2000) g;

        INSERT INTO conversations (user_low, user_high, last_message_at)
        SELECT DISTINCT ON (lo, hi) lo, hi, now() - (random() * interval '30 days')
        FROM (
          SELECT LEAST(a, b) AS lo, GREATEST(a, b) AS hi
          FROM (
            SELECT md5('u' || (1 + (g % 2000)))::uuid AS a,
                   md5('u' || (1 + ((g * 7919) % 1999)))::uuid AS b
            FROM generate_series(1, 20000) g
          ) pairs WHERE a <> b
        ) ordered;

        INSERT INTO conversation_members (conversation_id, user_id, last_activity_at)
        SELECT c.id, u.user_id, c.last_message_at
        FROM conversations c CROSS JOIN LATERAL (VALUES (c.user_low), (c.user_high)) AS u(user_id)
        WHERE NOT EXISTS (SELECT 1 FROM conversation_members m WHERE m.conversation_id = c.id);

        INSERT INTO messages (conversation_id, sender_id, content)
        SELECT c.id, c.user_low, 'load message ' || g
        FROM (SELECT id, user_low, row_number() OVER () AS rn FROM conversations) c
        JOIN generate_series(1, 200000) g ON c.rn = 1 + (g % (SELECT count(*) FROM conversations));

        -- Where a sort would hurt: one conversation with 20,000 messages (Alice–Bob) and
        -- one inbox with 3,000 conversations (Bob).
        INSERT INTO messages (conversation_id, sender_id, content)
        SELECT c.id, c.user_low, 'long ' || g
        FROM conversations c, generate_series(1, 20000) g
        WHERE c.user_low = '${ALICE}' AND c.user_high = '${BOB}';

        WITH created AS (
          INSERT INTO conversations (user_low, user_high, last_message_at)
          SELECT LEAST('${BOB}'::uuid, u.id), GREATEST('${BOB}'::uuid, u.id), now() - g * interval '1 minute'
          FROM generate_series(1, 2000) g JOIN users u ON u.id = md5('u' || g)::uuid
          ON CONFLICT DO NOTHING
          RETURNING id, last_message_at
        )
        INSERT INTO conversation_members (conversation_id, user_id, last_activity_at)
        SELECT id, '${BOB}', last_message_at FROM created;

        ANALYZE;
      `);
    });

    const plan = async (sql: string, params: unknown[]) =>
      (await db.query(`EXPLAIN ${sql}`, params)).map((r: any) => r['QUERY PLAN']).join('\n');

    it('reads history, even of a long conversation, as a range of the (conversation_id, id) key with no sort', async () => {
      const query = `SELECT id FROM messages WHERE conversation_id = $1 AND id < $2 ORDER BY id DESC LIMIT 51`;
      const [{ id: small }] = await db.query('SELECT conversation_id AS id FROM messages LIMIT 1');
      const smallPlan = await plan(query, [small, '9223372036854775807']);
      expect(smallPlan).toMatch(/messages_pkey/);
      expect(smallPlan).not.toMatch(/Seq Scan/);

      const [{ id: long }] = await db.query(
        'SELECT id FROM conversations WHERE user_low = $1 AND user_high = $2',
        [ALICE, BOB],
      );
      const longPlan = await plan(query, [long, '9223372036854775807']);
      // The conversation is an index condition (a bounded range), never a filter over a walk.
      expect(longPlan).toMatch(/Index (Only )?Scan Backward using messages_pkey/);
      expect(longPlan).toMatch(/Index Cond: \(\(conversation_id = /);
      expect(longPlan).not.toMatch(/Filter|Sort|Seq Scan/);
    });

    it('reads a busy inbox through the inbox index, in order, with no sort', async () => {
      const text = await plan(
        `SELECT conversation_id FROM conversation_members me
         WHERE me.user_id = $1 AND (me.last_activity_at, me.conversation_id) < ($2::timestamptz, $3::uuid)
         ORDER BY me.last_activity_at DESC, me.conversation_id DESC LIMIT 21`,
        [BOB, new Date().toISOString(), 'ffffffff-ffff-4fff-bfff-ffffffffffff'],
      );
      expect(text).toMatch(/Index (Only )?Scan using idx_conversation_members_inbox/);
      expect(text).not.toMatch(/Sort|Seq Scan/);
    });

    it('serves a deep history page as fast as the first (keyset, not OFFSET)', async () => {
      const [{ conversation_id, min_id }] = await db.query(
        `SELECT conversation_id, min(id) AS min_id FROM messages GROUP BY conversation_id ORDER BY count(*) DESC LIMIT 1`,
      );
      const [member] = await db.query('SELECT user_id FROM conversation_members WHERE conversation_id = $1 LIMIT 1', [
        conversation_id,
      ]);
      const time = async (cursor?: string) => {
        const start = process.hrtime.bigint();
        for (let i = 0; i < 20; i++) await service.getMessages(conversation_id, member.user_id, 50, cursor);
        return Number(process.hrtime.bigint() - start) / 20 / 1e6;
      };
      const first = await time();
      const deep = await time(String(BigInt(min_id) + 1n));
      expect(deep).toBeLessThan(Math.max(first * 3, 20));
    });
  });
});
