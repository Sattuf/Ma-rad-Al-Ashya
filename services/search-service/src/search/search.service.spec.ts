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

  it('should return cached search results if available', async () => {
    const cachedResult = { total: 1, hits: [{ id: '1', title: 'Test' }] };
    jest.spyOn(service['redisClient'], 'get').mockResolvedValue(JSON.stringify(cachedResult));
    
    const result = await service.search({ q: 'Test' });
    expect(result).toEqual(cachedResult);
    expect(esService.client.search).not.toHaveBeenCalled();
  });

  it('should perform ES search and cache result if not cached', async () => {
    jest.spyOn(service['redisClient'], 'get').mockResolvedValue(null);
    const esResponse = {
      hits: {
        total: 1,
        hits: [{ _id: '1', _source: { title: 'Test' } }]
      }
    };
    (esService.client.search as jest.Mock).mockResolvedValue(esResponse);

    const result = await service.search({ q: 'Test' });
    expect(result).toEqual({ total: 1, data: [{ id: '1', title: 'Test' }], variant: 'A' });
    expect(esService.client.search).toHaveBeenCalled();
    expect(service['redisClient'].set).toHaveBeenCalled();
  });

  it('should delete listing from ES and invalidate cache on delete action', async () => {
    (esService.client.delete as jest.Mock).mockResolvedValue({});
    jest.spyOn(service as any, 'invalidateCache').mockResolvedValue(undefined);

    await service.indexListing('delete', { id: '123' });
    
    expect(esService.client.delete).toHaveBeenCalledWith({
      index: 'marad_listings',
      id: '123'
    });
    expect(service['invalidateCache']).toHaveBeenCalledWith('search:*');
    expect(service['invalidateCache']).toHaveBeenCalledWith('autocomplete:*');
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
