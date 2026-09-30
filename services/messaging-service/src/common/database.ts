/**
 * إعدادات اتصال Postgres المشتركة — Shared Postgres connection options
 *
 * Duplicated per service until `packages/common` exists (docs/REBUILD_PLAN.md, phase 1).
 * Prefers DATABASE_URL; falls back to DB_* / DATABASE_* variables.
 * The pool is bounded and every statement has a timeout so a traffic spike
 * queues in the service instead of exhausting Postgres connections.
 */
import { Logger as NestLogger } from '@nestjs/common';
import { Gauge } from 'prom-client';
import type { DataSource, Logger as TypeOrmLogger } from 'typeorm';

/**
 * Routes TypeORM through the service logger (JSON, request ID). Query parameters are never
 * logged: they hold e-mails, phone numbers and password hashes. Every statement is logged at
 * debug level only with LOG_SQL=true; failures and slow statements (DB_SLOW_QUERY_MS) always.
 */
export class SqlLogger implements TypeOrmLogger {
  private readonly logger = new NestLogger('SQL');
  private readonly logAll = process.env.LOG_SQL === 'true';

  logQuery(query: string) {
    if (this.logAll) this.logger.debug({ msg: 'query', query });
  }
  logQueryError(error: string | Error, query: string) {
    this.logger.error({ msg: `query failed: ${error instanceof Error ? error.message : error}`, query });
  }
  logQuerySlow(time: number, query: string) {
    this.logger.warn({ msg: 'slow query', durationMs: time, query });
  }
  logSchemaBuild(message: string) {
    this.logger.log(message);
  }
  logMigration(message: string) {
    this.logger.log(message);
  }
  log(level: 'log' | 'info' | 'warn', message: unknown) {
    if (level === 'warn') this.logger.warn(String(message));
    else this.logger.log(String(message));
  }
}

function intEnv(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function postgresConnectionOptions(defaultDatabase = 'marad_db') {
  const url = process.env.DATABASE_URL;
  const connection = url
    ? { url }
    : {
        host: process.env.DB_HOST ?? process.env.DATABASE_HOST ?? 'localhost',
        port: intEnv('DB_PORT', intEnv('DATABASE_PORT', 5432)),
        username: process.env.DB_USER ?? process.env.DATABASE_USER,
        password: process.env.DB_PASSWORD ?? process.env.DATABASE_PASSWORD,
        database: process.env.DB_NAME ?? process.env.DATABASE_NAME ?? defaultDatabase,
      };

  return {
    type: 'postgres' as const,
    ...connection,
    synchronize: false,
    logging: true,
    logger: new SqlLogger(),
    maxQueryExecutionTime: intEnv('DB_SLOW_QUERY_MS', 1_000),
    extra: {
      max: intEnv('DB_POOL_MAX', 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: intEnv('DB_STATEMENT_TIMEOUT_MS', 5_000),
    },
  };
}

interface PgPoolCounts {
  totalCount?: number;
  idleCount?: number;
  waitingCount?: number;
}

/**
 * Connection pool gauges, read from pg's pool on each scrape (call once, from main.ts):
 * db_pool_connections{state="in_use"|"idle"|"waiting"} and db_pool_max.
 * `waiting` above 0 means requests are queueing for a connection: the pool (DB_POOL_MAX)
 * or slow queries are the bottleneck, before it shows as latency or errors.
 */
export function registerPoolMetrics(dataSource: DataSource): void {
  const pool = () => (dataSource.driver as unknown as { master?: PgPoolCounts }).master;
  new Gauge({
    name: 'db_pool_connections',
    help: 'Postgres pool connections by state (in_use, idle, waiting = requests queued for a connection)',
    labelNames: ['state'] as const,
    collect() {
      const p = pool();
      if (!p) return;
      const total = p.totalCount ?? 0;
      const idle = p.idleCount ?? 0;
      this.set({ state: 'in_use' }, Math.max(0, total - idle));
      this.set({ state: 'idle' }, idle);
      this.set({ state: 'waiting' }, p.waitingCount ?? 0);
    },
  });
  new Gauge({ name: 'db_pool_max', help: 'Configured size of the Postgres pool (DB_POOL_MAX)' }).set(intEnv('DB_POOL_MAX', 10));
}
