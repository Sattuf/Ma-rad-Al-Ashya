/**
 * يتحقق من تطابق كيانات TypeORM مع مخطط قاعدة البيانات الفعلي.
 * Verifies that every column declared by each service's TypeORM entities exists in the
 * migrated database with a compatible type. Catches the drift that silently broke
 * moderation (users-service wrote a `status` column its entity never declared).
 *
 *   DATABASE_URL=postgres://... npx ts-node --transpile-only scripts/check-entity-schema.ts
 *
 * Run against a database migrated with db/migrate.mjs.
 */
import 'reflect-metadata';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

const SERVICES = [
  'auth-service',
  'users-service',
  'listings-service',
  'transactions-service',
  'moderation-service',
  'identity-service',
];

// Postgres data_type values accepted for each TypeORM column type.
const COMPATIBLE: Record<string, string[]> = {
  uuid: ['uuid'],
  varchar: ['character varying', 'text', 'USER-DEFINED', 'character'],
  'character varying': ['character varying', 'text', 'USER-DEFINED', 'character'],
  text: ['text', 'character varying'],
  int: ['integer', 'smallint', 'bigint'],
  integer: ['integer', 'smallint', 'bigint'],
  number: ['integer', 'smallint', 'bigint', 'numeric', 'double precision', 'real'],
  decimal: ['numeric'],
  numeric: ['numeric'],
  boolean: ['boolean'],
  bool: ['boolean'],
  enum: ['USER-DEFINED', 'character varying'],
  timestamp: ['timestamp without time zone', 'timestamp with time zone'],
  timestamptz: ['timestamp with time zone', 'timestamp without time zone'],
  jsonb: ['jsonb'],
  json: ['json', 'jsonb'],
  bytea: ['bytea'],
  smallint: ['smallint', 'integer'],
  float: ['double precision', 'real'],
};

function entityFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : entityFiles(full);
    return name.endsWith('.entity.ts') ? [full] : [];
  });
}

function typeName(type: unknown): string {
  if (typeof type === 'string') return type.toLowerCase();
  if (type === String) return 'varchar';
  if (type === Number) return 'number';
  if (type === Boolean) return 'boolean';
  if (type === Date) return 'timestamp';
  return String((type as { name?: string })?.name ?? type).toLowerCase();
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const problems: string[] = [];

  for (const service of SERVICES) {
    const files = entityFiles(join(__dirname, '..', 'services', service, 'src'));
    const entities = files.flatMap((f) => Object.values(require(f)).filter((v) => typeof v === 'function'));
    const ds = new DataSource({ type: 'postgres', url, entities: entities as any[] });
    await ds.initialize();
    try {
      for (const meta of ds.entityMetadatas) {
        const rows: { column_name: string; data_type: string }[] = await ds.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
          [meta.tableName],
        );
        if (!rows.length) {
          problems.push(`${service}: table "${meta.tableName}" (${meta.name}) does not exist`);
          continue;
        }
        const actual = new Map(rows.map((r) => [r.column_name, r.data_type]));
        for (const col of meta.columns) {
          const dbType = actual.get(col.databaseName);
          if (!dbType) {
            problems.push(`${service}: ${meta.tableName}.${col.databaseName} (${meta.name}.${col.propertyName}) is missing`);
            continue;
          }
          const declared = typeName(col.type);
          const allowed = COMPATIBLE[declared];
          if (allowed && !allowed.includes(dbType)) {
            problems.push(`${service}: ${meta.tableName}.${col.databaseName} is ${dbType}, entity declares ${declared}`);
          }
        }
      }
      console.log(`✓ ${service}: ${ds.entityMetadatas.map((m) => m.tableName).join(', ')}`);
    } finally {
      await ds.destroy();
    }
  }

  if (problems.length) {
    console.error(`\nEntity/schema drift (${problems.length}):\n  ` + problems.join('\n  '));
    process.exit(1);
  }
  console.log('\nAll entity columns exist in the database with compatible types.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
