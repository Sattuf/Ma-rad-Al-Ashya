import { Pool } from 'pg';

/**
 * One connection pool per process. Opening a new Client per request (as click tracking
 * did) costs a TCP + auth handshake each time and, under load, exhausts Postgres'
 * max_connections for every other service. PG_POOL_MAX bounds this service's share.
 */
let pool: Pool | undefined;

export function pgPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/marad_db',
      max: parseInt(process.env.PG_POOL_MAX || '5', 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closePgPool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
