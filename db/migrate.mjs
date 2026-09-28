#!/usr/bin/env node
/**
 * مشغّل ترحيلات قاعدة البيانات — Database migration runner.
 *
 *   DATABASE_URL=postgres://... node db/migrate.mjs            apply pending migrations
 *   DATABASE_URL=postgres://... node db/migrate.mjs --status   list applied / pending
 *
 * - Files: db/migrations/NNNN_description.sql, applied in lexical order.
 * - Each file runs in its own transaction and is recorded in schema_migrations with a
 *   SHA-256 checksum. Editing an applied file is refused: add a new migration instead.
 * - A Postgres advisory lock makes concurrent runners (several pods starting) safe.
 * - A file whose first line is `-- no-transaction` runs outside a transaction
 *   (needed for CREATE INDEX CONCURRENTLY on large tables).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const LOCK_KEY = 727_001; // arbitrary, constant across runners
const FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;

export function loadMigrations(dir = MIGRATIONS_DIR) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const invalid = files.filter((f) => !FILE_PATTERN.test(f));
  if (invalid.length) throw new Error(`Invalid migration file names: ${invalid.join(', ')}`);
  const versions = files.map((f) => f.slice(0, 4));
  const dup = versions.find((v, i) => versions.indexOf(v) !== i);
  if (dup) throw new Error(`Duplicate migration version ${dup}`);
  return files.map((file) => {
    const sql = readFileSync(join(dir, file), 'utf8');
    return {
      version: file.slice(0, 4),
      file,
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
      transactional: !sql.startsWith('-- no-transaction'),
    };
  });
}

export async function migrate({ connectionString, dir = MIGRATIONS_DIR, log = console.log, statusOnly = false }) {
  const migrations = loadMigrations(dir);
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      file       TEXT NOT NULL,
      checksum   TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query('SELECT version, file, checksum FROM schema_migrations');
    const applied = new Map(rows.map((r) => [r.version, r]));

    for (const m of migrations) {
      const prev = applied.get(m.version);
      if (prev && prev.checksum !== m.checksum) {
        throw new Error(`${m.file} was modified after being applied (checksum mismatch). Add a new migration instead.`);
      }
    }
    const pending = migrations.filter((m) => !applied.has(m.version));
    if (statusOnly) {
      for (const m of migrations) log(`${applied.has(m.version) ? 'applied' : 'pending'}  ${m.file}`);
      return { applied: [], pending: pending.map((m) => m.file) };
    }

    for (const m of pending) {
      log(`applying ${m.file}`);
      try {
        if (m.transactional) await client.query('BEGIN');
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, file, checksum) VALUES ($1, $2, $3)', [
          m.version,
          m.file,
          m.checksum,
        ]);
        if (m.transactional) await client.query('COMMIT');
      } catch (err) {
        if (m.transactional) await client.query('ROLLBACK').catch(() => undefined);
        throw new Error(`${m.file} failed: ${err.message}`);
      }
    }
    log(pending.length ? `applied ${pending.length} migration(s)` : 'database is up to date');
    return { applied: pending.map((m) => m.file), pending: [] };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  migrate({ connectionString, statusOnly: process.argv.includes('--status') }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
