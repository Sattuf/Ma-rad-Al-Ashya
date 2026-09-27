import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

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

  async setUserPresence(userId: string, status: 'online' | 'offline'): Promise<void> {
    if (status === 'online') {
      // TTL so a crashed instance cannot leave users 'online' forever.
      await this.redisClient.set(`presence:${userId}`, 'online', 'EX', 3600);
    } else {
      await this.redisClient.del(`presence:${userId}`);
    }
  }

  async incr(key: string): Promise<number> {
    return this.redisClient.incr(key);
  }

  async getUserPresence(userId: string): Promise<'online' | 'offline'> {
    const status = await this.redisClient.get(`presence:${userId}`);
    return status === 'online' ? 'online' : 'offline';
  }
}
