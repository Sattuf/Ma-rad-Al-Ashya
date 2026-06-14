import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  onModuleInit() {
    this.redisClient = new Redis(process.env.REDIS_URI || 'redis://localhost:6379');
  }

  onModuleDestroy() {
    this.redisClient.quit();
  }

  async setUserPresence(userId: string, status: 'online' | 'offline'): Promise<void> {
    if (status === 'online') {
      await this.redisClient.set(`presence:${userId}`, 'online');
    } else {
      await this.redisClient.del(`presence:${userId}`);
    }
  }

  async getUserPresence(userId: string): Promise<'online' | 'offline'> {
    const status = await this.redisClient.get(`presence:${userId}`);
    return status === 'online' ? 'online' : 'offline';
  }
}
