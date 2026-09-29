import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  MessagingService,
  clampLimit,
  decodeInboxCursor,
  encodeInboxCursor,
} from './messaging.service';

/**
 * Input validation and error mapping. Everything here must be decided before a query runs,
 * so the data source fails the test if it is touched. The SQL itself is covered by
 * test/integration/messaging.int-spec.ts against a real Postgres.
 */
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';
const CONV = '44444444-4444-4444-8444-444444444444';

describe('MessagingService', () => {
  const untouchable = {
    query: jest.fn(() => {
      throw new Error('the database must not be queried for invalid input');
    }),
    transaction: jest.fn(() => {
      throw new Error('the database must not be queried for invalid input');
    }),
  };
  const service = new MessagingService(untouchable as any, { uploadImage: jest.fn() } as any);

  afterEach(() => {
    expect(untouchable.query).not.toHaveBeenCalled();
    expect(untouchable.transaction).not.toHaveBeenCalled();
  });

  it('refuses anything but exactly one other valid participant', async () => {
    await expect(service.createOrGetConversation(ALICE, [BOB, CAROL])).rejects.toThrow(BadRequestException);
    await expect(service.createOrGetConversation(ALICE, [ALICE])).rejects.toThrow(BadRequestException);
    await expect(service.createOrGetConversation(ALICE, ['$where'])).rejects.toThrow(BadRequestException);
    await expect(service.createOrGetConversation(ALICE, 'bob')).rejects.toThrow(BadRequestException);
    await expect(service.createOrGetConversation('not-a-uuid', [BOB])).rejects.toThrow(BadRequestException);
  });

  it('treats malformed conversation and message ids as not found', async () => {
    await expect(service.getMessages('not-an-id', ALICE)).rejects.toThrow(NotFoundException);
    await expect(service.sendMessage('1; DROP TABLE messages', ALICE, 'hi')).rejects.toThrow(NotFoundException);
    await expect(service.markRead('x', ALICE)).rejects.toThrow(NotFoundException);
    await expect(service.deleteMessage(CONV, 'abc', ALICE)).rejects.toThrow(NotFoundException);
    await expect(service.deleteMessage(CONV, '0', ALICE)).rejects.toThrow(NotFoundException);
  });

  it('rejects empty and oversized messages', async () => {
    await expect(service.sendMessage(CONV, ALICE, '   ')).rejects.toThrow(BadRequestException);
    await expect(service.sendMessage(CONV, ALICE, 42)).rejects.toThrow(BadRequestException);
    await expect(service.sendMessage(CONV, ALICE, 'x'.repeat(2001))).rejects.toThrow(BadRequestException);
  });

  it('rejects malformed cursors instead of scanning from an arbitrary point', async () => {
    await expect(service.getMessages(CONV, ALICE, 20, '-5')).rejects.toThrow(BadRequestException);
    await expect(service.getMessages(CONV, ALICE, 20, '99999999999999999999')).rejects.toThrow(BadRequestException);
    await expect(service.getConversations(ALICE, 20, 'garbage')).rejects.toThrow(BadRequestException);
  });

  it('bounds page sizes', () => {
    expect(clampLimit('1000')).toBe(100);
    expect(clampLimit('-1')).toBe(50);
    expect(clampLimit(undefined, 20)).toBe(20);
    expect(clampLimit('7.9')).toBe(7);
  });

  it('keeps the inbox cursor timestamp exact (microseconds) through the round trip', () => {
    const ts = '2026-09-29 10:15:30.123456+00';
    expect(decodeInboxCursor(encodeInboxCursor(ts, CONV))).toEqual({ activityAt: ts, conversationId: CONV });
    expect(decodeInboxCursor(undefined)).toBeNull();
  });
});

describe('MessagingService error mapping', () => {
  it('maps a missing conversation to 404 and a non-member to 403', async () => {
    const db = { query: jest.fn() };
    const service = new MessagingService(db as any, {} as any);

    db.query.mockResolvedValueOnce([]); // no such conversation
    await expect(service.assertParticipant(CONV, ALICE)).rejects.toThrow(NotFoundException);

    db.query.mockResolvedValueOnce([{ member: false }]);
    await expect(service.assertParticipant(CONV, ALICE)).rejects.toThrow(ForbiddenException);
  });

  it('reports why a message was not stored', async () => {
    const db = { query: jest.fn() };
    const service = new MessagingService(db as any, {} as any);

    db.query.mockResolvedValueOnce([{ member: false, blocked: false }]);
    await expect(service.sendMessage(CONV, ALICE, 'hi')).rejects.toThrow(ForbiddenException);

    db.query.mockResolvedValueOnce([{ member: true, blocked: true }]);
    await expect(service.sendMessage(CONV, ALICE, 'hi')).rejects.toThrow('Conversation is blocked');
  });

  it('maps an unknown other user to 404 rather than a 500', async () => {
    const db = { query: jest.fn().mockRejectedValueOnce(Object.assign(new Error('fk'), { code: '23503' })) };
    const service = new MessagingService(db as any, {} as any);
    await expect(service.createOrGetConversation(ALICE, [BOB])).rejects.toThrow(NotFoundException);
  });
});
