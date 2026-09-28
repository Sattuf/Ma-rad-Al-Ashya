import { createHmac, timingSafeEqual } from 'crypto';
import { requireSecret } from '../common/security';

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

/**
 * Verifies the HMAC-SHA256 signature (hex) the KYC vendor computes over the raw request body.
 * When the vendor sends a timestamp, stale deliveries are rejected to prevent replays.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  timestamp?: string,
  now: number = Date.now(),
): boolean {
  if (!rawBody || !signature) return false;

  if (timestamp !== undefined) {
    const sentAt = Number(timestamp);
    if (!Number.isFinite(sentAt) || Math.abs(now / 1000 - sentAt) > MAX_CLOCK_SKEW_SECONDS) {
      return false;
    }
  }

  const expected = createHmac('sha256', requireSecret('DIDIT_WEBHOOK_SECRET')).update(rawBody).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature.trim(), 'hex');
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
