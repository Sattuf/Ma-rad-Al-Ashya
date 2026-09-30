import { register } from 'prom-client';
import { registerPoolMetrics } from './database';

describe('registerPoolMetrics', () => {
  afterEach(() => register.clear());

  it('reports connections in use, idle and waiting from the pg pool, and the pool size', async () => {
    const pool = { totalCount: 7, idleCount: 2, waitingCount: 3 };
    registerPoolMetrics({ driver: { master: pool } } as any);
    let text = await register.metrics();
    expect(text).toMatch(/^db_pool_connections\{state="in_use"\} 5$/m);
    expect(text).toMatch(/^db_pool_connections\{state="idle"\} 2$/m);
    expect(text).toMatch(/^db_pool_connections\{state="waiting"\} 3$/m);
    expect(text).toMatch(/^db_pool_max 10$/m);

    // Read live on each scrape.
    Object.assign(pool, { totalCount: 1, idleCount: 1, waitingCount: 0 });
    text = await register.metrics();
    expect(text).toMatch(/^db_pool_connections\{state="in_use"\} 0$/m);
  });

  it('reports nothing before the pool exists', async () => {
    registerPoolMetrics({ driver: {} } as any);
    expect(await register.metrics()).not.toMatch(/^db_pool_connections\{/m);
  });
});
