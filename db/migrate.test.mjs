// node --test db/migrate.test.mjs   (needs DATABASE_URL pointing at a disposable database server)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { loadMigrations, migrate } from './migrate.mjs';

const base = process.env.DATABASE_URL;
if (!base) throw new Error('DATABASE_URL is required');
const dbName = `migrate_test_${process.pid}`;
const url = Object.assign(new URL(base), { pathname: `/${dbName}` }).toString();
const quiet = () => {};

const admin = new pg.Client({ connectionString: base });
before(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
});
after(async () => {
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.end();
});

const dirWith = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'mig-'));
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
};

test('the real migrations apply to an empty database and are idempotent', async () => {
  const first = await migrate({ connectionString: url, log: quiet });
  assert.ok(first.applied.includes('0001_baseline.sql'));
  const second = await migrate({ connectionString: url, log: quiet });
  assert.deepEqual(second.applied, []);
});

test('rejects duplicate versions and bad file names', () => {
  assert.throws(() => loadMigrations(dirWith({ '0001_a.sql': '', '0001_b.sql': '' })), /Duplicate migration version 0001/);
  assert.throws(() => loadMigrations(dirWith({ 'V1__x.sql': '' })), /Invalid migration file names/);
});

test('a failing migration is rolled back and not recorded', async () => {
  const dir = dirWith({
    '0001_ok.sql': 'CREATE TABLE t_ok (id int);',
    '0002_bad.sql': 'CREATE TABLE t_partial (id int); SELECT * FROM does_not_exist;',
  });
  const db = `${dbName}_rb`;
  await admin.query(`CREATE DATABASE ${db}`);
  const target = Object.assign(new URL(base), { pathname: `/${db}` }).toString();
  try {
    await assert.rejects(migrate({ connectionString: target, dir, log: quiet }), /0002_bad.sql failed/);
    const c = new pg.Client({ connectionString: target });
    await c.connect();
    const { rows } = await c.query("SELECT to_regclass('t_partial') AS partial, to_regclass('t_ok') AS ok");
    const versions = (await c.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version);
    await c.end();
    assert.equal(rows[0].partial, null);
    assert.equal(rows[0].ok, 't_ok');
    assert.deepEqual(versions, ['0001']);
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
  }
});

test('refuses to run when an applied migration was edited', async () => {
  const db = `${dbName}_cs`;
  await admin.query(`CREATE DATABASE ${db}`);
  const target = Object.assign(new URL(base), { pathname: `/${db}` }).toString();
  try {
    await migrate({ connectionString: target, dir: dirWith({ '0001_a.sql': 'CREATE TABLE a (id int);' }), log: quiet });
    await assert.rejects(
      migrate({ connectionString: target, dir: dirWith({ '0001_a.sql': 'CREATE TABLE a (id bigint);' }), log: quiet }),
      /modified after being applied/,
    );
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
  }
});
