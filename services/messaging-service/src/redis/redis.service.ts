import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

const PRESENCE_TTL_SECONDS = 10 * 60;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  onModuleInit() {
    const url =
      process.env.REDIS_URL ||
      process.env.REDIS_URI ||
      `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;
    this.redisClient = new Redis(url);
  }

  onModuleDestroy() {
    this.redisClient.quit();
  }

  /**
   * Presence is tracked per connection (a set of socket ids), so closing one of two tabs
   * does not mark the user offline. The TTL is refreshed on every connect and heartbeat
   * so a crashed instance cannot leave users online forever.
   */
  async addConnection(userId: string, socketId: string): Promise<void> {
    await this.redisClient
      .multi()
      .sadd(`presence:${userId}`, socketId)
      .expire(`presence:${userId}`, PRESENCE_TTL_SECONDS)
      .exec();
  }

  /** Returns true when the user still has other live connections. */
  async removeConnection(userId: string, socketId: string): Promise<boolean> {
    const [, [, remaining]] = (await this.redisClient
      .multi()
      .srem(`presence:${userId}`, socketId)
      .scard(`presence:${userId}`)
      .exec()) as [[Error | null, number], [Error | null, number]];
    return remaining > 0;
  }

  async refreshPresence(userId: string): Promise<void> {
    await this.redisClient.expire(`presence:${userId}`, PRESENCE_TTL_SECONDS);
  }

  async incr(key: string): Promise<number> {
    return this.redisClient.incr(key);
  }

  async getUserPresence(userId: string): Promise<'online' | 'offline'> {
    const connections = await this.redisClient.scard(`presence:${userId}`);
    return connections > 0 ? 'online' : 'offline';
  }
}
