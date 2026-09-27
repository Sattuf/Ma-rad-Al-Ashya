#!/usr/bin/env node
/**
 * Shared helpers are copied into each service (every Docker build context is the service
 * folder, so a workspace package cannot be imported yet). This guard keeps the copies
 * identical, so a security fix can never land in one service and be forgotten in another.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const services = join(fileURLToPath(import.meta.url), '..', '..', 'services');
const SHARED = ['src/common/security.ts', 'src/common/database.ts'];
let failed = false;

for (const file of SHARED) {
  const copies = readdirSync(services)
    .map((svc) => join(services, svc, file))
    .filter(existsSync)
    .map((path) => ({ path, hash: createHash('sha256').update(readFileSync(path)).digest('hex') }));
  const hashes = new Set(copies.map((c) => c.hash));
  if (hashes.size > 1) {
    failed = true;
    console.error(`✗ ${file} differs between services:`);
    for (const c of copies) console.error(`   ${c.hash.slice(0, 12)}  ${c.path}`);
  } else {
    console.log(`✓ ${file}: ${copies.length} identical copies`);
  }
}
process.exit(failed ? 1 : 0);
