import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { RANKING_WEIGHTS, AB_VARIANT_TTL } from './ranking.config';

// REDIS_URL, or REDIS_HOST/REDIS_PORT as docker-compose passes them (like the other services).
const redisUrl = () =>
  process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;

@Injectable()
export class RankingService {
  private readonly redisClient: Redis;

  constructor() {
    this.redisClient = new Redis(redisUrl());
  }

  private variantKey(userId?: string, sessionId?: string) {
    return userId ? `ab:user:${userId}` : sessionId ? `ab:session:${sessionId}` : undefined;
  }

  /**
   * Sticky, race-free assignment: SET NX means concurrent first requests (two tabs, a retry)
   * agree on one variant instead of each drawing and overwriting.
   */
  async getABVariant(userId?: string, sessionId?: string): Promise<'A' | 'B'> {
    const key = this.variantKey(userId, sessionId);
    const draw: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
    if (!key) return draw;
    await this.redisClient.set(key, draw, 'EX', AB_VARIANT_TTL, 'NX');
    const stored = await this.redisClient.get(key);
    return stored === 'A' || stored === 'B' ? stored : draw;
  }

  /** The variant already assigned to this visitor, if any (never assigns). */
  async assignedVariant(userId?: string, sessionId?: string): Promise<'A' | 'B' | null> {
    const key = this.variantKey(userId, sessionId);
    if (!key) return null;
    const stored = await this.redisClient.get(key);
    return stored === 'A' || stored === 'B' ? stored : null;
  }

  async getEngagementScores(listingIds: string[]): Promise<Map<string, { views: number; messages: number }>> {
    const scores = new Map<string, { views: number; messages: number }>();
    if (listingIds.length === 0) {
      return scores;
    }

    // Search clicks (persistent, 30-day TTL). listing:views is drained into the database by
    // listings-service every few minutes, so it would reset the signal to ~0 each cycle.
    const viewKeys = listingIds.map(id => `search:clicks:${id}`);
    const messageKeys = listingIds.map(id => `listing:messages:${id}`);

    const [viewsData, messagesData] = await Promise.all([
      this.redisClient.mget(viewKeys),
      this.redisClient.mget(messageKeys),
    ]);

    for (let i = 0; i < listingIds.length; i++) {
      const id = listingIds[i];
      const views = parseInt(viewsData[i] || '0', 10);
      const messages = parseInt(messagesData[i] || '0', 10);
      scores.set(id, { views, messages });
    }

    return scores;
  }

  buildFunctionScore(params: any, engagementScores: Map<string, { views: number; messages: number }>, variant: 'A' | 'B'): any {
    if (variant === 'B') {
      return {
        sort: [{ createdAt: 'desc' }]
      };
    }

    const functions: any[] = [];

    functions.push({
      gauss: {
        createdAt: {
          origin: 'now',
          scale: '7d',
          offset: '1d',
          decay: 0.5
        }
      },
      weight: RANKING_WEIGHTS.RECENCY
    });

    if (params.lat !== undefined && params.lon !== undefined) {
      functions.push({
        gauss: {
          location: {
            origin: { lat: params.lat, lon: params.lon },
            scale: '10km',
            offset: '1km',
            decay: 0.5
          }
        },
        weight: RANKING_WEIGHTS.DISTANCE
      });
    }

    functions.push({
      script_score: {
        script: {
          source: `
            double score = 0;
            if (doc.containsKey('images_count') && doc['images_count'].size() > 0) {
              score += doc['images_count'].value * 0.1;
            }
            if (doc.containsKey('description_length') && doc['description_length'].size() > 0) {
              score += Math.min(doc['description_length'].value / 100.0, 1.0) * 0.1;
            }
            return score;
          `
        }
      },
      weight: RANKING_WEIGHTS.QUALITY
    });

    const engagementParams: Record<string, { views: number; messages: number }> = {};
    for (const [id, stats] of engagementScores.entries()) {
      engagementParams[id] = stats;
    }

    functions.push({
      script_score: {
        script: {
          // The indexed "id" keyword, not _id: Elasticsearch 8 refuses doc-value access to
          // _id, which failed every variant A search (found running against a real cluster).
          source: `
            if (doc['id'].size() == 0) { return 0; }
            String id = doc['id'].value;
            if (params.engagement.containsKey(id)) {
              def stats = params.engagement[id];
              return (stats.views * 0.1) + (stats.messages * 0.5);
            }
            return 0;
          `,
          params: { engagement: engagementParams }
        }
      },
      weight: RANKING_WEIGHTS.ENGAGEMENT
    });

    functions.push({
      script_score: {
        script: {
          source: `
            if (doc.containsKey('seller_average_rating') && doc['seller_average_rating'].size() > 0) {
              return doc['seller_average_rating'].value / 5.0;
            }
            return 0;
          `
        }
      },
      weight: RANKING_WEIGHTS.SELLER_RATING
    });

    functions.push({
      field_value_factor: {
        field: 'price',
        modifier: 'reciprocal',
        missing: 1
      },
      weight: RANKING_WEIGHTS.PRICE_COMPETITIVENESS
    });

    functions.push({
      field_value_factor: {
        field: 'boost_multiplier',
        modifier: 'none',
        missing: 1.0
      }
    });

    return {
      function_score: {
        score_mode: 'sum',
        boost_mode: 'multiply',
        functions
      }
    };
  }
}
