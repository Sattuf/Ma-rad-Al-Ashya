import { createHmac } from 'crypto';
import { verifyWebhookSignature } from './webhook-signature';

describe('verifyWebhookSignature', () => {
  const body = Buffer.from(JSON.stringify({ session_id: 's-1', status: 'Approved' }));
  const sign = (payload: Buffer, secret = process.env.DIDIT_WEBHOOK_SECRET!) =>
    createHmac('sha256', secret).update(payload).digest('hex');

  beforeAll(() => {
    process.env.DIDIT_WEBHOOK_SECRET = 'test-webhook-secret-not-for-production';
  });

  it('accepts a correctly signed body', () => {
    expect(verifyWebhookSignature(body, sign(body))).toBe(true);
  });

  it('rejects a missing signature (forged approval)', () => {
    expect(verifyWebhookSignature(body, undefined)).toBe(false);
  });

  it('rejects a signature made with another secret', () => {
    expect(verifyWebhookSignature(body, sign(body, 'attacker'))).toBe(false);
  });

  it('rejects a tampered body', () => {
    const tampered = Buffer.from(JSON.stringify({ session_id: 's-2', status: 'Approved' }));
    expect(verifyWebhookSignature(tampered, sign(body))).toBe(false);
  });

  it('rejects stale timestamps (replay)', () => {
    const now = Date.now();
    const old = String(Math.floor(now / 1000) - 3600);
    expect(verifyWebhookSignature(body, sign(body), old, now)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body), String(Math.floor(now / 1000)), now)).toBe(true);
  });
});
