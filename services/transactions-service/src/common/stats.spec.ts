import { TtlCache, dailySeries, sumLast, windowStart } from './stats';

describe('common/stats', () => {
  const now = new Date('2026-03-10T15:30:00Z');

  it('windowStart is UTC midnight of the first day in the window', () => {
    expect(windowStart(30, now).toISOString()).toBe('2026-02-09T00:00:00.000Z');
    expect(windowStart(1, now).toISOString()).toBe('2026-03-10T00:00:00.000Z');
  });

  it('dailySeries fills missing days with zeros, in order, ending today', () => {
    const series = dailySeries([{ day: '2026-03-10', count: '4' }, { day: new Date('2026-03-08T00:00:00Z'), count: 2 }], 4, now);
    expect(series).toEqual([
      { day: '2026-03-07', count: 0 },
      { day: '2026-03-08', count: 2 },
      { day: '2026-03-09', count: 0 },
      { day: '2026-03-10', count: 4 },
    ]);
  });

  it('dailySeries ignores rows outside the window', () => {
    expect(dailySeries([{ day: '2025-01-01', count: 99 }], 2, now).map((p) => p.count)).toEqual([0, 0]);
  });

  it('sumLast adds the most recent n days', () => {
    const series = dailySeries([{ day: '2026-03-09', count: 3 }, { day: '2026-03-10', count: 4 }, { day: '2026-03-01', count: 10 }], 10, now);
    expect(sumLast(series, 2)).toBe(7);
    expect(sumLast(series.slice(0, -2), 8)).toBe(10);
  });

  describe('TtlCache', () => {
    it('computes once per TTL and shares the in-flight promise', async () => {
      const cache = new TtlCache<number>(1000);
      const compute = jest.fn().mockResolvedValue(1);
      await Promise.all([cache.get(compute, 0), cache.get(compute, 10)]);
      await cache.get(compute, 999);
      expect(compute).toHaveBeenCalledTimes(1);
      await cache.get(compute, 1000);
      expect(compute).toHaveBeenCalledTimes(2);
    });

    it('never caches a failure', async () => {
      const cache = new TtlCache<number>(1000);
      const compute = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue(2);
      await expect(cache.get(compute, 0)).rejects.toThrow('db down');
      await expect(cache.get(compute, 1)).resolves.toBe(2);
    });
  });
});
