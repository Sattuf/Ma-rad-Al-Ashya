import { HttpStatus } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from '../../src/redis/redis.service';
import { OtpService, OTP_MAX_ATTEMPTS } from '../../src/otp/otp.service';

/**
 * Exercises the Redis primitives the security fixes depend on (SET NX, INCR + EXPIRE NX,
 * GETDEL, SCAN) against a real server, where unit-test mocks cannot prove atomicity.
 */
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is required for integration tests');
}
const { hostname, port } = new URL(redisUrl);

describe('RedisService + OtpService against real Redis', () => {
  let raw: Redis;
  let redis: RedisService;

  beforeAll(async () => {
    raw = new Redis(redisUrl);
    const config = { get: (key: string) => ({ REDIS_HOST: hostname, REDIS_PORT: Number(port) } as any)[key] };
    redis = new RedisService(config as any);
    redis.onModuleInit();
  });

  beforeEach(async () => {
    await raw.flushdb();
  });

  afterAll(async () => {
    await redis.onModuleDestroy();
    await raw.quit();
  });

  it('setIfAbsent lets exactly one of many concurrent callers win', async () => {
    const results = await Promise.all(Array.from({ length: 50 }, () => redis.setIfAbsent('k', '1', 60)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await raw.ttl('k')).toBeGreaterThan(0);
  });

  it('incrWithTtl counts every concurrent call and sets the TTL only once', async () => {
    await Promise.all(Array.from({ length: 100 }, () => redis.incrWithTtl('c', 900)));
    expect(await raw.get('c')).toBe('100');
    await raw.expire('c', 5);
    await redis.incrWithTtl('c', 900);
    expect(await raw.ttl('c')).toBeLessThanOrEqual(5); // window not extended by later hits
  });

  it('getAndDelete consumes a value exactly once under concurrency', async () => {
    await raw.set('refresh:u:1', 'valid');
    const results = await Promise.all(Array.from({ length: 20 }, () => redis.getAndDelete('refresh:u:1')));
    expect(results.filter((r) => r === 'valid')).toHaveLength(1);
  });

  it('deleteByPattern removes every matching key across SCAN pages, and nothing else', async () => {
    const pipeline = raw.pipeline();
    for (let i = 0; i < 1000; i++) pipeline.set(`refresh:victim:${i}`, 'valid');
    pipeline.set('refresh:other:1', 'valid');
    await pipeline.exec();

    expect(await redis.deleteByPattern('refresh:victim:*')).toBe(1000);
    expect(await raw.exists('refresh:other:1')).toBe(1);
  });

  it('parallel OTP guesses cannot exceed the attempt limit', async () => {
    const config = { get: (key: string) => ({ NODE_ENV: 'development', OTP_MOCK_ENABLED: 'true' } as any)[key] };
    const authService = { loginWithoutPassword: jest.fn() };
    const otp = new OtpService(config as any, redis, {} as any, authService as any);
    const phone = '+966500000001';
    await raw.set(`otp_code:${phone}`, '482913');

    const guesses = Array.from({ length: 30 }, (_, i) => String(100000 + i));
    const outcomes = await Promise.allSettled(guesses.map((g) => otp.verifyOtp(phone, g)));

    const statuses = outcomes.map((o) => (o.status === 'rejected' ? (o.reason as any).status : 200));
    expect(statuses.filter((s) => s === HttpStatus.BAD_REQUEST).length).toBeLessThanOrEqual(OTP_MAX_ATTEMPTS - 1);
    expect(await raw.exists(`otp_lock:${phone}`)).toBe(1);

    // Even the correct code is refused while locked.
    await expect(otp.verifyOtp(phone, '482913')).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(authService.loginWithoutPassword).not.toHaveBeenCalled();
  });
});
