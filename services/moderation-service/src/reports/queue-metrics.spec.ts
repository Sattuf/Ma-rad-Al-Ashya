import { register } from 'prom-client';
import { QueueMetrics } from './queue-metrics';

function repoReturning(row: unknown, calls = { n: 0 }) {
  const qb: any = {
    select: () => qb,
    addSelect: () => qb,
    where: () => qb,
    getRawOne: async () => {
      calls.n += 1;
      if (row instanceof Error) throw row;
      return row;
    },
  };
  return { createQueryBuilder: () => qb } as any;
}

describe('QueueMetrics', () => {
  afterEach(() => register.clear());

  it('exposes the open count and the age of the oldest open report', async () => {
    const metrics = new QueueMetrics(repoReturning({ open: '7', oldest: new Date(Date.now() - 3 * 3600_000) }));
    metrics.onModuleInit();
    const text = await register.metrics();
    expect(text).toMatch(/^moderation_open_reports 7$/m);
    const age = Number(/^moderation_oldest_open_report_age_seconds (\d+)$/m.exec(text)?.[1]);
    expect(age).toBeGreaterThanOrEqual(3 * 3600 - 5);
    expect(age).toBeLessThanOrEqual(3 * 3600 + 5);
  });

  it('reports age 0 for an empty queue', async () => {
    const metrics = new QueueMetrics(repoReturning({ open: '0', oldest: null }));
    expect(await metrics.snapshot()).toEqual({ open: 0, oldestAgeSeconds: 0 });
  });

  it('queries the database at most once per 30s', async () => {
    const calls = { n: 0 };
    const metrics = new QueueMetrics(repoReturning({ open: '1', oldest: new Date() }, calls));
    metrics.onModuleInit();
    await register.metrics();
    await register.metrics();
    expect(calls.n).toBe(1);
  });

  it('reports NaN, not an empty queue, when the database fails', async () => {
    const metrics = new QueueMetrics(repoReturning(new Error('db down')));
    jest.spyOn((metrics as any).logger, 'warn').mockImplementation(() => undefined);
    metrics.onModuleInit();
    const text = await register.metrics();
    expect(text).toMatch(/^moderation_open_reports NaN$/im);
    expect(text).toMatch(/^moderation_oldest_open_report_age_seconds NaN$/im);
  });
});
