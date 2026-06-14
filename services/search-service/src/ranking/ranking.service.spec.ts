import { Test, TestingModule } from '@nestjs/testing';
import { RankingService } from './ranking.service';

describe('RankingService', () => {
  let service: RankingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RankingService],
    }).compile();

    service = module.get<RankingService>(RankingService);
  });

  it('should return sort only for Variant B in buildFunctionScore', () => {
    const params = { query: 'test' };
    const engagementScores = new Map<string, { views: number; messages: number }>();
    const result = service.buildFunctionScore(params, engagementScores, 'B');

    expect(result).toHaveProperty('sort');
    expect(result).not.toHaveProperty('function_score');
  });

  it('should return function_score for Variant A in buildFunctionScore', () => {
    const params = { query: 'test', lat: 10, lon: 20 };
    const engagementScores = new Map<string, { views: number; messages: number }>();
    engagementScores.set('1', { views: 10, messages: 2 });
    
    const result = service.buildFunctionScore(params, engagementScores, 'A');

    expect(result).toHaveProperty('function_score');
    expect(result.function_score).toHaveProperty('functions');
  });

  it('should return same AB variant for same user', async () => {
    jest.spyOn(service['redisClient'], 'get').mockResolvedValue('A');
    jest.spyOn(service['redisClient'], 'set').mockResolvedValue('OK');
    const variant1 = await service.getABVariant('user123', null);
    expect(variant1).toBe('A');
  });

  it('should return engagement scores correctly from Redis', async () => {
    jest.spyOn(service['redisClient'], 'mget')
      .mockResolvedValueOnce(['10', '0'])
      .mockResolvedValueOnce(['2', '5']);

    const scores = await service.getEngagementScores(['listing1', 'listing2']);
    
    expect(scores.get('listing1')).toEqual({ views: 10, messages: 2 });
    expect(scores.get('listing2')).toEqual({ views: 0, messages: 5 });
  });
});
