import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ElasticsearchService } from './elasticsearch.service';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { RankingService } from '../ranking/ranking.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { TrackClickDto } from './dto/track-click.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly redisClient: Redis;
  private readonly indexName = 'marad_listings';

  constructor(
    private readonly esService: ElasticsearchService,
    private readonly rankingService: RankingService
  ) {
    this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  private generateCacheKey(prefix: string, params: any): string {
    const hash = crypto.createHash('md5').update(JSON.stringify(params)).digest('hex');
    return `${prefix}:${hash}`;
  }

  private async invalidateCache(pattern: string) {
    let cursor = '0';
    do {
      const result = await this.redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } while (cursor !== '0');
  }

  async search(dto: SearchQueryDto, userId?: string) {
    const { q: query, category, minPrice, maxPrice, lat, lon, radius, session_id } = dto;
    const params = { query, category, minPrice, maxPrice, lat, lon, radius, session_id, userId };
    const cacheKey = this.generateCacheKey('search_v2', params);

    const cachedResult = await this.redisClient.get(cacheKey);
    if (cachedResult) {
      const parsed = JSON.parse(cachedResult);
      await this.redisClient.incr(`search:ab:${parsed.variant}:total`);
      return parsed;
    }

    const variant = dto.ab_variant || await this.rankingService.getABVariant(userId, session_id);

    const must: any[] = [];
    const filter: any[] = [];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['title^3', 'description', 'category', 'tags'],
          fuzziness: 'AUTO'
        }
      });
    }

    if (category) {
      filter.push({ term: { category } });
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const range: any = {};
      if (minPrice !== undefined) range.gte = minPrice;
      if (maxPrice !== undefined) range.lte = maxPrice;
      filter.push({ range: { price: range } });
    }

    if (lat !== undefined && lon !== undefined && radius) {
      filter.push({
        geo_distance: {
          distance: radius,
          location: { lat, lon }
        }
      });
    }

    try {
      const baseQuery: any = { bool: {} };
      if (must.length > 0) baseQuery.bool.must = must;
      if (filter.length > 0) baseQuery.bool.filter = filter;
      if (must.length === 0 && filter.length === 0) {
        baseQuery.bool.must = { match_all: {} };
      }

      // First pass: get IDs for engagement scores
      const initialResponse = await this.esService.client.search({
        index: this.indexName,
        body: { query: baseQuery },
        size: 200,
        _source: false
      });

      const listingIds = initialResponse.hits.hits.map((hit: any) => hit._id);
      const engagementScores = await this.rankingService.getEngagementScores(listingIds);

      // Build function score
      const rankingObj = this.rankingService.buildFunctionScore({ query, lat, lon }, engagementScores, variant);

      const finalBody: any = { query: {} };
      if (rankingObj.function_score) {
        finalBody.query = {
          function_score: {
            query: baseQuery,
            ...rankingObj.function_score
          }
        };
      } else {
        finalBody.query = baseQuery;
        if (rankingObj.sort) {
          finalBody.sort = rankingObj.sort;
        }
      }

      const response = await this.esService.client.search({
        index: this.indexName,
        body: finalBody
      });

      const hits = response.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source
      }));

      const result = { data: hits, total: response.hits.total, variant };
      await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 300);
      
      await this.redisClient.incr(`search:ab:${variant}:total`);

      return result;
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`);
      throw new HttpException('Search failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async mapSearch(topLeftLat: number, topLeftLon: number, bottomRightLat: number, bottomRightLon: number, zoom?: number) {
    const precision = 4;
    const cacheKey = this.generateCacheKey('mapSearch', { topLeftLat, topLeftLon, bottomRightLat, bottomRightLon, zoom });
    const cachedResult = await this.redisClient.get(cacheKey);
    if (cachedResult) return JSON.parse(cachedResult);

    try {
      const response = await this.esService.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              filter: {
                geo_bounding_box: {
                  location: {
                    top_left: { lat: topLeftLat, lon: topLeftLon },
                    bottom_right: { lat: bottomRightLat, lon: bottomRightLon }
                  }
                }
              }
            }
          },
          aggs: {
            grid: {
              geohash_grid: {
                field: 'location',
                precision: precision
              }
            }
          },
          size: 100
        }
      });

      const result = {
        hits: response.hits.hits.map((hit: any) => ({ id: hit._id, ...hit._source })),
        grid: (response.aggregations as any)?.grid
      };

      await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 300);
      return result;
    } catch (error) {
      this.logger.error(`Map search failed: ${error.message}`);
      throw new HttpException('Map search failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async categoryStats() {
    const cacheKey = this.generateCacheKey('categoryStats', {});
    const cachedResult = await this.redisClient.get(cacheKey);
    if (cachedResult) return JSON.parse(cachedResult);

    try {
      const response = await this.esService.client.search({
        index: this.indexName,
        body: {
          size: 0,
          aggs: {
            categories: {
              terms: {
                field: 'category',
                size: 50
              }
            }
          }
        }
      });

      const result = (response.aggregations as any)?.categories;
      await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 600);
      return result;
    } catch (error) {
      this.logger.error(`Category stats failed: ${error.message}`);
      throw new HttpException('Category stats failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async relatedSearch(id: string) {
    const cacheKey = this.generateCacheKey('relatedSearch', { id });
    const cachedResult = await this.redisClient.get(cacheKey);
    if (cachedResult) return JSON.parse(cachedResult);

    try {
      const response = await this.esService.client.search({
        index: this.indexName,
        body: {
          query: {
            more_like_this: {
              fields: ['title', 'description'],
              like: [{ _index: this.indexName, _id: id }],
              min_term_freq: 1,
              max_query_terms: 12
            }
          },
          size: 10
        }
      });

      const result = response.hits.hits.map((hit: any) => ({ id: hit._id, ...hit._source }));
      await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 300);
      return result;
    } catch (error) {
      this.logger.error(`Related search failed: ${error.message}`);
      throw new HttpException('Related search failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async suggestions(q: string) {
    if (!q || q.length < 2) return [];

    const cacheKey = this.generateCacheKey('suggestions', { q });
    const cachedResult = await this.redisClient.get(cacheKey);
    if (cachedResult) return JSON.parse(cachedResult);

    try {
      const response = await this.esService.client.search({
        index: this.indexName,
        body: {
          suggest: {
            text: q,
            simple_phrase: {
              phrase: {
                field: 'title',
                size: 5,
                gram_size: 2,
                direct_generator: [{
                  field: 'title',
                  suggest_mode: 'always'
                }]
              }
            }
          }
        }
      });

      const result = (response.suggest as any)?.simple_phrase?.[0]?.options || [];
      await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 600);
      return result;
    } catch (error) {
      this.logger.error(`Suggestions failed: ${error.message}`);
      return [];
    }
  }

  async autocomplete(query: string) {
    if (!query || query.length < 2) return [];

    const cacheKey = this.generateCacheKey('autocomplete', { query });
    const cachedResult = await this.redisClient.get(cacheKey);
    if (cachedResult) return JSON.parse(cachedResult);

    try {
      const response = await this.esService.client.search({
        index: this.indexName,
        body: {
          query: {
            multi_match: {
              query,
              type: 'bool_prefix',
              fields: [
                'title',
                'title._2gram',
                'title._3gram'
              ]
            }
          },
          size: 5
        }
      });

      const suggestions = response.hits.hits.map((hit: any) => hit._source.title);
      const uniqueSuggestions = [...new Set(suggestions)];
      
      await this.redisClient.set(cacheKey, JSON.stringify(uniqueSuggestions), 'EX', 600);

      return uniqueSuggestions;
    } catch (error) {
      this.logger.error(`Autocomplete failed: ${error.message}`);
      return [];
    }
  }

  async indexListing(action: 'create' | 'update' | 'delete', listing: any) {
    try {
      if (action === 'delete') {
        await this.esService.client.delete({
          index: this.indexName,
          id: listing.id.toString(),
        });
      } else {
        const document = {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          price: listing.price,
          location: (listing.location && listing.location.lat !== undefined && listing.location.lng !== undefined) 
            ? { lat: listing.location.lat, lon: listing.location.lng } 
            : undefined,
          category: listing.category,
          tags: listing.tags || [],
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
          images_count: listing.images_count || 0,
          description_length: listing.description_length || 0,
          seller_average_rating: listing.seller_average_rating || 0,
        };

        if (action === 'create') {
          await this.esService.client.index({
            index: this.indexName,
            id: listing.id.toString(),
            document,
          });
        } else {
          await this.esService.client.update({
            index: this.indexName,
            id: listing.id.toString(),
            doc: document,
            doc_as_upsert: true,
          });
        }
      }

      await this.invalidateCache('search:*');
      await this.invalidateCache('autocomplete:*');

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to index listing ${listing.id}: ${error.message}`);
      throw new HttpException('Indexing failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getHealth() {
    try {
      const esHealth = await this.esService.client.cluster.health();
      const redisPing = await this.redisClient.ping();
      return {
        status: 'ok',
        elasticsearch: esHealth.status,
        redis: redisPing === 'PONG' ? 'ok' : 'error'
      };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  }

  async trackClick(body: TrackClickDto) {
    try {
      const { Client } = require('pg');
      const pgClient = new Client({
        connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/marad_db',
      });
      await pgClient.connect();

      await pgClient.query(
        `INSERT INTO ab_test_results (variant, session_id, query, clicked_listing_id, click_position, results_count) VALUES ($1, $2, $3, $4, $5, $6)`,
        [body.variant, body.session_id, body.query, body.listing_id || null, body.position || null, body.listing_id ? 1 : 0]
      );
      await pgClient.end();

      if (body.listing_id) {
        await this.redisClient.incr(`listing:views:${body.listing_id}`);
      }
      return { tracked: true };
    } catch (error) {
      this.logger.error(`Failed to track click: ${error.message}`);
      throw new HttpException('Tracking failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getRankingStats() {
    try {
      const { Client } = require('pg');
      const pgClient = new Client({
        connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/marad_db',
      });
      await pgClient.connect();

      const [totalA, totalB] = await Promise.all([
        this.redisClient.get('search:ab:A:total'),
        this.redisClient.get('search:ab:B:total'),
      ]);

      const searchesA = parseInt(totalA || '0', 10);
      const searchesB = parseInt(totalB || '0', 10);

      const clickResult = await pgClient.query(`
        SELECT variant, COUNT(clicked_listing_id) as clicks
        FROM ab_test_results
        GROUP BY variant
      `);
      
      let clicksA = 0;
      let clicksB = 0;
      for (const row of clickResult.rows) {
        if (row.variant === 'A') clicksA = parseInt(row.clicks, 10);
        if (row.variant === 'B') clicksB = parseInt(row.clicks, 10);
      }

      const zeroResults = await pgClient.query(`
        SELECT query FROM ab_test_results
        WHERE results_count = 0
        ORDER BY created_at DESC LIMIT 10
      `);

      const topRanked = await pgClient.query(`
        SELECT clicked_listing_id as id, COUNT(*) as clicks
        FROM ab_test_results
        WHERE clicked_listing_id IS NOT NULL
        GROUP BY clicked_listing_id
        ORDER BY clicks DESC
        LIMIT 10
      `);

      const avgRes = await pgClient.query(`
        SELECT AVG(results_count) as avg
        FROM ab_test_results
      `);

      await pgClient.end();

      return {
        ab_test: {
          variant_a: {
            total_searches: searchesA,
            total_clicks: clicksA,
            ctr: searchesA > 0 ? (clicksA / searchesA) : 0
          },
          variant_b: {
            total_searches: searchesB,
            total_clicks: clicksB,
            ctr: searchesB > 0 ? (clicksB / searchesB) : 0
          }
        },
        top_ranked_listings: topRanked.rows,
        avg_results_per_search: parseFloat(avgRes.rows[0]?.avg || '0'),
        zero_results_queries: zeroResults.rows.map((r: any) => r.query)
      };
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      throw new HttpException('Stats failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
