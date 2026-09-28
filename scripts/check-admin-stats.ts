/**
 * Runs every admin dashboard aggregate (GET …/admin/stats) against the migrated schema.
 * Unit tests mock the database, so a renamed column or a type mismatch in the raw SQL
 * would only surface in production; this makes it fail CI instead.
 *
 *   DATABASE_URL=postgres://… npx ts-node -P scripts/tsconfig.json scripts/check-admin-stats.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AdminStatsService as ListingsStats } from '../services/listings-service/src/admin-stats/admin-stats.service';
import { AdminStatsService as TransactionsStats } from '../services/transactions-service/src/admin-stats/admin-stats.service';
import { AdminStatsService as UsersStats } from '../services/auth-service/src/admin-stats/admin-stats.service';
import { ReportsService } from '../services/moderation-service/src/reports/reports.service';

async function main() {
  const db = await new DataSource({ type: 'postgres', url: process.env.DATABASE_URL }).initialize();
  // Services may resolve their own typeorm copy; they only call db.query(), so pass it untyped.
  const conn = db as any;
  const query = (sql: string, params?: unknown[]) => db.query(sql, params);
  const reports = new ReportsService({ query } as any, { find: async () => [] } as any, {} as any, {} as any);

  const checks: Array<[string, () => Promise<unknown>]> = [
    ['listings-service', () => new ListingsStats(conn).getStats()],
    ['transactions-service', () => new TransactionsStats(conn).getStats()],
    ['auth-service', () => new UsersStats(conn).getStats()],
    ['moderation-service', () => reports.getAdminStats()],
  ];
  let failed = false;
  for (const [name, run] of checks) {
    try {
      const result = (await run()) as Record<string, unknown>;
      console.log(`✓ ${name}: ${Object.keys(result).length} fields`);
    } catch (err) {
      failed = true;
      console.error(`✗ ${name}: ${(err as Error).message}`);
    }
  }
  await db.destroy();
  process.exit(failed ? 1 : 0);
}

main();
