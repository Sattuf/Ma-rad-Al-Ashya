/**
 * إعدادات اتصال Postgres المشتركة — Shared Postgres connection options
 *
 * Duplicated per service until `packages/common` exists (docs/REBUILD_PLAN.md, phase 1).
 * Prefers DATABASE_URL; falls back to DB_* / DATABASE_* variables.
 * The pool is bounded and every statement has a timeout so a traffic spike
 * queues in the service instead of exhausting Postgres connections.
 */
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
    extra: {
      max: intEnv('DB_POOL_MAX', 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: intEnv('DB_STATEMENT_TIMEOUT_MS', 5_000),
    },
  };
}
