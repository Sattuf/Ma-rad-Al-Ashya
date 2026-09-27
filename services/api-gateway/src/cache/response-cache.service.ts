import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export interface CachedResponse {
  status: number;
  contentType: string;
  body: string;
}

/**
 * Short-lived Redis cache for anonymous public GETs (listings, categories, search).
 * It absorbs read spikes before they reach the services and Postgres.
 * Cache failures never fail a request: the gateway just goes to the service.
 */
@Injectable()
export class ResponseCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(ResponseCacheService.name);
  private readonly client: Redis;

  constructor() {
    const url =
      process.env.REDIS_URL ||
      `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
    });
    this.client.on('error', (err) => this.logger.warn(`Redis cache unavailable: ${err.message}`));
    this.client.connect().catch(() => undefined);
  }

  async get(key: string): Promise<CachedResponse | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as CachedResponse) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: CachedResponse, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // best effort
    }
  }

  async onModuleDestroy() {
    this.client.disconnect();
  }
}
