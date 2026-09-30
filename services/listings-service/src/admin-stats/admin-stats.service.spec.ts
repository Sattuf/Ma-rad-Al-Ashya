import { AdminStatsService } from './admin-stats.service';

describe('AdminStatsService (listings)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const db = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('to_char')) return [{ day: today, count: 5 }];
      if (sql.includes('GROUP BY status')) return [{ status: 'active', count: 7 }, { status: 'sold', count: 2 }];
      if (sql.includes('JOIN categories')) return [{ id: 'c1', name: 'أثاث', activeListings: 7 }];
      return [{ active: 1, paid: 3, revenue: 29.970000001 }];
    }),
  };

  it('shapes the aggregates and caches them', async () => {
    const service = new AdminStatsService(db as any);
    const stats = await service.getStats(30);
    await service.getStats(30);

    expect(db.query).toHaveBeenCalledTimes(4); // second call served from cache
    expect(stats.listings).toMatchObject({ active: 7, sold: 2, expired: 0, createdLast7Days: 5, createdPrevious7Days: 0 });
    expect(stats.listings.createdDaily).toHaveLength(30);
    expect(stats.listings.createdDaily.at(-1)).toEqual({ day: today, count: 5 });
    expect(stats.windowDays).toBe(30);
    expect(stats.promotions).toEqual({ active: 1, paidInWindow: 3, revenueInWindow: 29.97, currency: 'USD' });
  });

  it('follows the window: series length and promotion period; week-over-week still sees 14 days', async () => {
    const calls: [string, unknown[]][] = [];
    const recording = { query: jest.fn(async (sql: string, params: unknown[]) => (calls.push([sql, params]), (db.query as any)(sql, params))) };
    const service = new AdminStatsService(recording as any);
    const DAY = 24 * 3600 * 1000;

    const week = await service.getStats(7);
    expect(week.windowDays).toBe(7);
    expect(week.listings.createdDaily).toHaveLength(7);
    const dailyStart = calls.find(([sql]) => sql.includes('to_char'))![1][0] as Date;
    const promoStart = calls.find(([sql]) => sql.includes('promotions'))![1][0] as Date;
    expect(Math.round((Date.now() - dailyStart.getTime()) / DAY)).toBeGreaterThanOrEqual(13); // 14-day series
    expect(Math.round((Date.now() - promoStart.getTime()) / DAY)).toBeLessThanOrEqual(7); // 7-day promotions

    const quarter = await service.getStats(90);
    expect(quarter.listings.createdDaily).toHaveLength(90);
  });

  it('bounds every query: window parameter or LIMIT', () => {
    for (const [sql, params] of db.query.mock.calls as unknown as [string, unknown[]][]) {
      const bounded = /LIMIT \d+/.test(sql) || (params?.[0] instanceof Date) || /GROUP BY status/.test(sql);
      expect(bounded).toBe(true);
    }
  });
});
