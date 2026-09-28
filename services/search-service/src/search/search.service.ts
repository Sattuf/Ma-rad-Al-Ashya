import { Injectable, Logger, HttpException, HttpStatus, OnModuleDestroy } from '@nestjs/common';
import { closePgPool, pgPool } from './pg-pool';
import { ElasticsearchService } from './elasticsearch.service';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { RankingService } from '../ranking/ranking.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { TrackClickDto } from './dto/track-click.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SEARCH_PAGE = 50;
const SEARCH_CACHE_VERSION_KEY = 'search:cache:version';
/** Clicks keep influencing ranking for 30 days. */
const CLICK_SIGNAL_TTL = 30 * 24 * 3600;

const toPositiveNumber = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

@Injectable()
export class SearchService implements OnModuleDestroy {
  private rankingStatsCache?: { at: number; value: unknown };

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

  /**
   * Cached results are namespaced by a version that every index write bumps (O(1)),
   * instead of SCAN-deleting keys across all of Redis on each listing change.
   */
  private async searchCacheVersion(): Promise<string> {
    return (await this.redisClient.get(SEARCH_CACHE_VERSION_KEY)) ?? '0';
  }

  /**
   * Text search for the A/B ranking experiment. Each visitor is assigned a sticky variant
   * (per user, else per session) that decides the ranking; the client cannot choose it.
   * Only first-page requests count as a "search" so paging does not dilute the CTR.
   * Returns ids and ranking only; the caller hydrates full listings from listings-service.
   */
  async search(dto: SearchQueryDto, userId?: string) {
    const query = typeof dto.q === 'string' ? dto.q.trim().slice(0, 100) : '';
    const categoryId = typeof dto.categoryId === 'string' && UUID.test(dto.categoryId) ? dto.categoryId : undefined;
    const minPrice = toPositiveNumber(dto.minPrice);
    const maxPrice = toPositiveNumber(dto.maxPrice);
    const page = Math.max(1, Math.floor(Number(dto.page)) || 1);
    const limit = Math.min(MAX_SEARCH_PAGE, Math.max(1, Math.floor(Number(dto.limit)) || 20));
    const sessionId = typeof dto.session_id === 'string' ? dto.session_id.slice(0, 64) : undefined;

    const variant = await this.rankingService.getABVariant(userId, sessionId);
    const version = await this.searchCacheVersion();
    const cacheKey = this.generateCacheKey(`search_v3:${version}`, { query, categoryId, minPrice, maxPrice, page, limit, variant });
    const countSearch = () => (page === 1 ? this.redisClient.incr(`search:ab:${variant}:total`) : Promise.resolve(0));

    const cached = await this.redisClient.get(cacheKey);
    if (cached) {
      await countSearch();
      return { ...JSON.parse(cached), variant };
    }

    const must: any[] = [];
    // Sold, expired and deleted listings never appear; documents indexed before the
    // status field existed still do (must_not instead of a term on "active").
    const filter: any[] = [];
    const mustNot: any[] = [{ terms: { status: ['sold', 'expired', 'deleted'] } }];
    if (query) {
      must.push({ multi_match: { query, fields: ['title^3', 'description', 'tags'], fuzziness: 'AUTO' } });
    }
    // A parent category matches its subcategories (category_ids holds [id, parentId]).
    if (categoryId) filter.push({ term: { category_ids: categoryId } });
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.push({ range: { price: { ...(minPrice !== undefined && { gte: minPrice }), ...(maxPrice !== undefined && { lte: maxPrice }) } } });
    }

    try {
      const baseQuery: any = { bool: { must_not: mustNot } };
      if (must.length) baseQuery.bool.must = must;
      if (filter.length) baseQuery.bool.filter = filter;
      if (!must.length && !filter.length) baseQuery.bool.must = { match_all: {} };

      // First pass: candidate ids for engagement scores (bounded).
      const initial = await this.esService.client.search({ index: this.indexName, query: baseQuery, size: 200, _source: false });
      const engagement = await this.rankingService.getEngagementScores(initial.hits.hits.map((h: any) => h._id));
      const ranking = this.rankingService.buildFunctionScore({ query }, engagement, variant);

      const body: any = ranking.function_score
        ? { query: { function_score: { query: baseQuery, ...ranking.function_score } } }
        : { query: baseQuery, ...(ranking.sort && { sort: ranking.sort }) };
      const response = await this.esService.client.search({
        index: this.indexName,
        ...body,
        from: (page - 1) * limit,
        size: limit,
        _source: false,
        track_total_hits: true,
      });

      const total = typeof response.hits.total === 'number' ? response.hits.total : (response.hits.total?.value ?? 0);
      const result = { ids: response.hits.hits.map((h: any) => h._id as string), total, page, limit };
      await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 180);
      await countSearch();
      return { ...result, variant };
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`);
      throw new HttpException('Search failed', HttpStatus.SERVICE_UNAVAILABLE);
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
          category: listing.category?.name ?? undefined,
          category_ids: (listing.category_ids ?? [listing.categoryId]).filter(Boolean),
          status: listing.status ?? 'active',
          tags: listing.tags || [],
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
          images_count: listing.images_count || 0,
          description_length: listing.description_length || 0,
          seller_average_rating: listing.seller_average_rating || 0,
          boost_multiplier: listing.boost_multiplier !== undefined ? listing.boost_multiplier : 1.0,
          expires_at: listing.expires_at || null,
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

      await this.redisClient.incr(SEARCH_CACHE_VERSION_KEY);
      await this.invalidateCache('autocomplete:*');

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to index listing ${listing.id}: ${error.message}`);
      throw new HttpException('Indexing failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async boostListing(id: string, boostMultiplier: number, expiresAt: string) {
    try {
      await this.esService.client.update({
        index: this.indexName,
        id: id.toString(),
        body: {
          doc: {
            boost_multiplier: boostMultiplier,
            expires_at: expiresAt,
          },
        },
      });
      this.logger.log(`Updated boost multiplier to ${boostMultiplier} and expires_at to ${expiresAt} for document ${id}`);
      
      await this.invalidateCache('search:*');
      await this.invalidateCache('autocomplete:*');
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to boost listing ${id}: ${error.message}`);
      throw new HttpException('Failed to update boost in Elasticsearch', HttpStatus.INTERNAL_SERVER_ERROR);
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
    if (body.variant !== 'A' && body.variant !== 'B') throw new HttpException('Invalid variant', HttpStatus.BAD_REQUEST);
    const listingId = typeof body.listing_id === 'string' && UUID.test(body.listing_id) ? body.listing_id : null;
    const position = typeof body.position === 'number' && Number.isInteger(body.position) && body.position >= 0 && body.position < 1000 ? body.position : null;
    try {
      await pgPool().query(
        `INSERT INTO ab_test_results (variant, session_id, query, clicked_listing_id, click_position, results_count) VALUES ($1, $2, $3, $4, $5, $6)`,
        [body.variant, String(body.session_id ?? '').slice(0, 255), String(body.query ?? '').slice(0, 200), listingId, position, listingId ? 1 : 0],
      );
      // Engagement signal for ranking. Not listing:views — that key is the listing's page-view
      // counter (drained into viewsCount), and the detail page already counts the visit.
      if (listingId) {
        await this.redisClient.multi().incr(`search:clicks:${listingId}`).expire(`search:clicks:${listingId}`, CLICK_SIGNAL_TTL).exec();
      }
      return { tracked: true };
    } catch (error) {
      this.logger.error(`Failed to track click: ${error.message}`);
      throw new HttpException('Tracking failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** Admin A/B stats, cached 60s. Clicks are counted over the same 30 days as the dashboard. */
  async getRankingStats() {
    if (this.rankingStatsCache && Date.now() - this.rankingStatsCache.at < 60_000) return this.rankingStatsCache.value;
    try {
      const db = pgPool();
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const [[totalA, totalB], clicks, zeroResults, topRanked] = await Promise.all([
        Promise.all([this.redisClient.get('search:ab:A:total'), this.redisClient.get('search:ab:B:total')]),
        // idx_ab_test_variant_created serves the window filter.
        db.query(
          `SELECT variant, COUNT(clicked_listing_id)::int AS clicks FROM ab_test_results WHERE created_at >= $1 GROUP BY variant`,
          [since],
        ),
        db.query(
          `SELECT query, COUNT(*)::int AS count FROM ab_test_results
            WHERE results_count = 0 AND created_at >= $1 AND query <> ''
            GROUP BY query ORDER BY 2 DESC LIMIT 10`,
          [since],
        ),
        db.query(
          `SELECT clicked_listing_id AS id, COUNT(*)::int AS clicks FROM ab_test_results
            WHERE clicked_listing_id IS NOT NULL AND created_at >= $1
            GROUP BY clicked_listing_id ORDER BY clicks DESC LIMIT 10`,
          [since],
        ),
      ]);

      const clicksOf = (v: string) => clicks.rows.find((r) => r.variant === v)?.clicks ?? 0;
      const variant = (searches: number, c: number) => ({ total_searches: searches, total_clicks: c, ctr: searches > 0 ? c / searches : 0 });
      const searchesA = parseInt(totalA || '0', 10);
      const searchesB = parseInt(totalB || '0', 10);
      const value = {
        ab_test: { variant_a: variant(searchesA, clicksOf('A')), variant_b: variant(searchesB, clicksOf('B')) },
        top_ranked_listings: topRanked.rows,
        zero_results_queries: zeroResults.rows,
      };
      this.rankingStatsCache = { at: Date.now(), value };
      return value;
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      throw new HttpException('Stats failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async onModuleDestroy() {
    await closePgPool();
  }
}
