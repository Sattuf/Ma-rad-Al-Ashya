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
      sadd: jest.fn(),
      expire: jest.fn(),
      sismember: jest.fn().mockResolvedValue(0),
      multi: jest.fn().mockImplementation(() => {
        const chain: any = { sadd: jest.fn(() => chain), expire: jest.fn(() => chain), incr: jest.fn(() => chain), exec: jest.fn().mockResolvedValue([]) };
        return chain;
      }),
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
            assignedVariant: jest.fn().mockResolvedValue('A'),
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
      jest.spyOn(redis(), 'set').mockResolvedValue('OK');
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
    const scan = jest.spyOn(service['redisClient'], 'scan');

    await service.indexListing('delete', { id: '123' });

    // Waits until the deletion is searchable before bumping the version, so no stale page
    // can be cached under the new version.
    expect(esService.client.delete).toHaveBeenCalledWith({ index: 'marad_listings', id: '123', refresh: 'wait_for' });
    expect(service['redisClient'].incr).toHaveBeenCalledWith('search:cache:version');
    expect(scan).not.toHaveBeenCalled();
  });

  it('indexes status and category ids so sold listings drop out and parents match children', async () => {
    (esService.client.index as jest.Mock).mockResolvedValue({});
    await service.indexListing('create', { id: 'l1', title: 't', status: 'sold', categoryId: 'c-child', category_ids: ['c-child', 'c-parent'] });
    expect((esService.client.index as jest.Mock).mock.calls[0][0].document).toMatchObject({ status: 'sold', category_ids: ['c-child', 'c-parent'] });
  });

  describe('click validation', () => {
    const id = '3f2b8c1e-8a1d-4c55-9a7e-0b6f1f0e2d11';
    const redis = () => service['redisClient'] as any;
    const ranking = () => (service as any).rankingService;
    const click = (over: Record<string, unknown> = {}) =>
      service.trackClick({ variant: 'A', session_id: 's1', query: 'q', listing_id: id, position: 2, ...over } as any);
    let multi: any;

    beforeEach(() => {
      mockPgQuery.mockReset().mockResolvedValue({ rows: [] });
      multi = { incr: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]) };
      redis().multi = jest.fn().mockReturnValue(multi);
      redis().sismember = jest.fn().mockResolvedValue(1);
      redis().set = jest.fn().mockResolvedValue('OK');
      ranking().assignedVariant = jest.fn().mockResolvedValue('A');
    });

    it('counts a valid click as a search signal, never as a page view', async () => {
      await expect(click()).resolves.toEqual({ tracked: true });
      expect(multi.incr).toHaveBeenCalledWith(`search:clicks:${id}`);
      expect(redis().incr).not.toHaveBeenCalledWith(`listing:views:${id}`);
      expect(mockPgQuery).toHaveBeenCalledTimes(1);
    });

    it('ignores a click claiming a variant the visitor was not assigned', async () => {
      await expect(click({ variant: 'B' })).resolves.toEqual({ tracked: false });
      expect(mockPgQuery).not.toHaveBeenCalled();
    });

    it('ignores a click on a listing that was never shown to the visitor', async () => {
      redis().sismember = jest.fn().mockResolvedValue(0);
      await expect(click()).resolves.toEqual({ tracked: false });
      expect(multi.incr).not.toHaveBeenCalled();
    });

    it('counts one click per visitor per listing (no boosting by repetition)', async () => {
      redis().set = jest.fn().mockResolvedValue(null);
      await expect(click()).resolves.toEqual({ tracked: false });
      expect(mockPgQuery).not.toHaveBeenCalled();
    });

    it('rejects unknown variants and ignores anonymous clicks', async () => {
      await expect(click({ variant: 'C' })).rejects.toThrow();
      await expect(click({ session_id: undefined })).resolves.toEqual({ tracked: false });
    });
  });

  it('counts a repeated identical search once per visitor', async () => {
    const redis = service['redisClient'] as any;
    jest.spyOn(redis, 'get').mockResolvedValue(null);
    (esService.client.search as jest.Mock).mockResolvedValue({ hits: { total: 1, hits: [{ _id: 'x' }] } });
    redis.set = jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce('OK').mockResolvedValueOnce('OK').mockResolvedValue(null);
    redis.incr = jest.fn();

    await service.search({ q: 'جوال', session_id: 's9' });
    await service.search({ q: 'جوال', session_id: 's9' });

    expect(redis.incr.mock.calls.filter((c: string[]) => c[0] === 'search:ab:A:total')).toHaveLength(1);
  });

  it('stops paging at the Elasticsearch result window', async () => {
    jest.spyOn(service['redisClient'], 'get').mockResolvedValue(null);
    (esService.client.search as jest.Mock).mockResolvedValue({ hits: { total: { value: 50000 }, hits: [] } });
    const result = await service.search({ q: 'a', page: '100000' as any, limit: '20' as any });
    const call = (esService.client.search as jest.Mock).mock.calls.at(-1)[0];
    expect(call.from + call.size).toBeLessThanOrEqual(10000);
    expect(result.total).toBe(10000);
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
      const redis = service['redisClient'] as any;
      redis.sismember = jest.fn().mockResolvedValue(1);
      redis.set = jest.fn().mockResolvedValue('OK');
      (service as any).rankingService.assignedVariant = jest.fn().mockResolvedValue('A');
      const listing = '3f2b8c1e-8a1d-4c55-9a7e-0b6f1f0e2d11';
      await service.trackClick({ variant: 'A', session_id: 's1', query: 'q', listing_id: listing } as any);
      await service.trackClick({ variant: 'A', session_id: 's2', query: 'q', listing_id: listing } as any);
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
