import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { ElasticsearchService } from './elasticsearch.service';
import { RankingService } from '../ranking/ranking.service';

jest.mock('ioredis', () => {
  const mRedis = jest.fn().mockImplementation(() => {
    return {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn().mockResolvedValue('1'),
      scan: jest.fn().mockResolvedValue(['0', []]),
      ping: jest.fn().mockResolvedValue('PONG'),
    };
  });
  return { __esModule: true, default: mRedis };
});

const mockPgQuery = jest.fn();
const mockPoolCtor = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation((opts) => {
    mockPoolCtor(opts);
    return { query: mockPgQuery, end: jest.fn() };
  }),
}));

describe('SearchService', () => {
  let service: SearchService;
  let esService: ElasticsearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ElasticsearchService,
          useValue: {
            client: {
              search: jest.fn(),
              index: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              cluster: { health: jest.fn().mockResolvedValue({ status: 'green' }) },
            },
          },
        },
        {
          provide: RankingService,
          useValue: {
            getABVariant: jest.fn().mockResolvedValue('A'),
            getEngagementScores: jest.fn().mockResolvedValue(new Map()),
            buildFunctionScore: jest.fn().mockReturnValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    esService = module.get<ElasticsearchService>(ElasticsearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search (A/B experiment)', () => {
    const redis = () => service['redisClient'] as any;

    it('serves cached ids with the visitor variant and still counts the search', async () => {
      jest.spyOn(redis(), 'get').mockImplementation(async (key: string) =>
        key === 'search:cache:version' ? '4' : JSON.stringify({ ids: ['a'], total: 1, page: 1, limit: 20 }),
      );
      const result = await service.search({ q: 'جوال', session_id: 's1' });
      expect(result).toEqual({ ids: ['a'], total: 1, page: 1, limit: 20, variant: 'A' });
      expect(esService.client.search).not.toHaveBeenCalled();
      expect(redis().incr).toHaveBeenCalledWith('search:ab:A:total');
    });

    it('queries ES with pagination, hides sold listings, and returns ids only', async () => {
      jest.spyOn(redis(), 'get').mockResolvedValue(null);
      (esService.client.search as jest.Mock).mockResolvedValue({ hits: { total: { value: 42 }, hits: [{ _id: 'x' }, { _id: 'y' }] } });

      const result = await service.search({ q: 'جوال', page: '3' as any, limit: '500' as any, categoryId: 'not-a-uuid' });

      expect(result).toEqual({ ids: ['x', 'y'], total: 42, page: 3, limit: 50, variant: 'A' });
      const finalCall = (esService.client.search as jest.Mock).mock.calls.at(-1)[0];
      expect(finalCall).toMatchObject({ from: 100, size: 50 });
      expect(JSON.stringify(finalCall)).toContain('"must_not":[{"terms":{"status":["sold","expired","deleted"]}}]');
      expect(JSON.stringify(finalCall)).not.toContain('category_ids'); // invalid id ignored
      expect(redis().incr).not.toHaveBeenCalledWith('search:ab:A:total'); // page 3 is not a new search
    });

    it('ignores any variant the client tries to force', async () => {
      jest.spyOn(redis(), 'get').mockResolvedValue(null);
      (esService.client.search as jest.Mock).mockResolvedValue({ hits: { total: 0, hits: [] } });
      const result = await service.search({ q: 'x', ab_variant: 'B' } as any);
      expect(result.variant).toBe('A');
    });
  });

  it('removes a deleted listing from ES and bumps the search cache version (no SCAN)', async () => {
    (esService.client.delete as jest.Mock).mockResolvedValue({});
    jest.spyOn(service as any, 'invalidateCache').mockResolvedValue(undefined);

    await service.indexListing('delete', { id: '123' });

    expect(esService.client.delete).toHaveBeenCalledWith({ index: 'marad_listings', id: '123' });
    expect(service['redisClient'].incr).toHaveBeenCalledWith('search:cache:version');
    expect(service['invalidateCache']).not.toHaveBeenCalledWith('search:*');
  });

  it('indexes status and category ids so sold listings drop out and parents match children', async () => {
    (esService.client.index as jest.Mock).mockResolvedValue({});
    await service.indexListing('create', { id: 'l1', title: 't', status: 'sold', categoryId: 'c-child', category_ids: ['c-child', 'c-parent'] });
    expect((esService.client.index as jest.Mock).mock.calls[0][0].document).toMatchObject({ status: 'sold', category_ids: ['c-child', 'c-parent'] });
  });

  it('counts a click as a search signal, never as a page view', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const multi = { incr: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec };
    (service['redisClient'] as any).multi = jest.fn().mockReturnValue(multi);
    mockPgQuery.mockReset().mockResolvedValue({ rows: [] });
    const id = '3f2b8c1e-8a1d-4c55-9a7e-0b6f1f0e2d11';

    await service.trackClick({ variant: 'A', session_id: 's', query: 'q', listing_id: id, position: 2 } as any);

    expect(multi.incr).toHaveBeenCalledWith(`search:clicks:${id}`);
    expect(service['redisClient'].incr).not.toHaveBeenCalledWith(`listing:views:${id}`);
    await expect(service.trackClick({ variant: 'C', session_id: 's', query: 'q' } as any)).rejects.toThrow();
  });

  it('should return health status correctly', async () => {
    const result = await service.getHealth();
    expect(result).toEqual({
      status: 'ok',
      elasticsearch: 'green',
      redis: 'ok'
    });
  });

  it('should perform map search', async () => {
    jest.spyOn(service['redisClient'], 'get').mockResolvedValue(null);
    const esResponse = {
      hits: {
        hits: [{ _id: '1', _source: { title: 'Test' } }]
      },
      aggregations: {
        grid: { buckets: [] }
      }
    };
    (esService.client.search as jest.Mock).mockResolvedValue(esResponse);

    const result = await service.mapSearch(10, 10, 0, 0, 5);
    expect(result).toEqual({
      hits: [{ id: '1', title: 'Test' }],
      grid: { buckets: [] }
    });
    expect(esService.client.search).toHaveBeenCalled();
  });

  it('should get category stats', async () => {
    jest.spyOn(service['redisClient'], 'get').mockResolvedValue(null);
    const esResponse = {
      aggregations: {
        categories: { buckets: [{ key: 'cars', doc_count: 5 }] }
      }
    };
    (esService.client.search as jest.Mock).mockResolvedValue(esResponse);

    const result = await service.categoryStats();
    expect(result).toEqual({ buckets: [{ key: 'cars', doc_count: 5 }] });
    expect(esService.client.search).toHaveBeenCalled();
  });

  it('should get related search', async () => {
    jest.spyOn(service['redisClient'], 'get').mockResolvedValue(null);
    const esResponse = {
      hits: {
        hits: [{ _id: '2', _source: { title: 'Related' } }]
      }
    };
    (esService.client.search as jest.Mock).mockResolvedValue(esResponse);

    const result = await service.relatedSearch('1');
    expect(result).toEqual([{ id: '2', title: 'Related' }]);
    expect(esService.client.search).toHaveBeenCalled();
  });

  it('should get suggestions', async () => {
    jest.spyOn(service['redisClient'], 'get').mockResolvedValue(null);
    const esResponse = {
      suggest: {
        simple_phrase: [{ options: [{ text: 'suggestion 1' }] }]
      }
    };
    (esService.client.search as jest.Mock).mockResolvedValue(esResponse);

    const result = await service.suggestions('sug');
    expect(result).toEqual([{ text: 'suggestion 1' }]);
    expect(esService.client.search).toHaveBeenCalled();
  });

  describe('database access', () => {
    beforeEach(() => {
      mockPgQuery.mockReset().mockResolvedValue({ rows: [] });
    });

    it('reuses one connection pool for every click instead of a connection per request', async () => {
      const before = mockPoolCtor.mock.calls.length;
      await service.trackClick({ variant: 'A', session_id: 's', query: 'q', listing_id: undefined } as any);
      await service.trackClick({ variant: 'B', session_id: 's', query: 'q', listing_id: undefined } as any);
      expect(mockPoolCtor.mock.calls.length - before).toBeLessThanOrEqual(1);
      expect(mockPgQuery).toHaveBeenCalledTimes(2);
      expect(mockPoolCtor.mock.calls.at(-1)?.[0]).toMatchObject({ max: expect.any(Number) });
    });

    it('bounds ranking stats to a window and caches them', async () => {
      await service.getRankingStats();
      await service.getRankingStats();
      expect(mockPgQuery).toHaveBeenCalledTimes(3); // second call served from cache
      for (const [sql, params] of mockPgQuery.mock.calls) {
        expect(sql).toContain('created_at >= $1');
        expect(params).toHaveLength(1);
      }
    });
  });
});
