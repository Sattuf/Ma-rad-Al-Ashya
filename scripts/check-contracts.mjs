#!/usr/bin/env node
/**
 * فحص العقود بين الواجهات والخادم — API contract check.
 *
 * Extracts every HTTP call made by the web (axios `api.*`) and mobile (Dio `dio.*`) clients,
 * resolves it through the gateway map (services/api-gateway/src/proxy/services.config.ts),
 * and verifies that the target service declares a matching route (NestJS decorators or
 * FastAPI routers). Any client call with no server route is a bug waiting in production.
 *
 *   node scripts/check-contracts.mjs            # report, exit 1 on mismatch
 *   node scripts/check-contracts.mjs --json     # machine-readable
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const walk = (dir, exts) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (['node_modules', 'dist', 'build', '.dart_tool', 'test', '__tests__'].includes(name)) return [];
    if (statSync(full).isDirectory()) return walk(full, exts);
    return exts.some((e) => name.endsWith(e)) && !/\.(spec|test)\./.test(name) ? [full] : [];
  });
const norm = (p) => '/' + p.split('/').filter(Boolean).join('/');
const segments = (p) => p.split('/').filter(Boolean);

// ── Server routes ─────────────────────────────────────────────
const METHODS = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'All'];
function nestRoutes(serviceDir) {
  const routes = [];
  for (const file of walk(join(serviceDir, 'src'), ['.controller.ts'])) {
    const src = readFileSync(file, 'utf8');
    // Split per class so each method uses its own @Controller prefix.
    for (const cls of src.split(/(?=@Controller\()/).slice(1)) {
      const base = cls.match(/@Controller\(\s*(?:'([^']*)'|"([^"]*)")?\s*\)/);
      const prefix = base ? base[1] ?? base[2] ?? '' : '';
      const rx = new RegExp(`@(${METHODS.join('|')})\\(\\s*(\\[[^\\]]*\\]|'[^']*'|"[^"]*")?\\s*\\)`, 'g');
      for (const m of cls.matchAll(rx)) {
        const paths = m[2] ? [...m[2].matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] ?? x[2]) : [''];
        for (const p of paths) {
          routes.push({ method: m[1].toUpperCase(), path: norm(`${prefix}/${p}`), file: relative(root, file) });
        }
      }
    }
  }
  return routes;
}

function fastapiRoutes(serviceDir) {
  const routes = [];
  for (const file of walk(serviceDir, ['.py'])) {
    const src = readFileSync(file, 'utf8');
    const prefix = src.match(/APIRouter\([^)]*prefix\s*=\s*["']([^"']*)["']/)?.[1] ?? '';
    for (const m of src.matchAll(/@(?:router|app)\.(get|post|put|patch|delete)\(\s*["']([^"']*)["']/g)) {
      routes.push({ method: m[1].toUpperCase(), path: norm(`${prefix}/${m[2].replace(/\{[^}]+\}/g, ':p')}`), file: relative(root, file) });
    }
  }
  return routes;
}

// ── Gateway map ───────────────────────────────────────────────
const ENV_TO_SERVICE = {
  AUTH_SERVICE_URL: 'auth-service',
  LISTINGS_SERVICE_URL: 'listings-service',
  SEARCH_SERVICE_URL: 'search-service',
  MESSAGING_SERVICE_URL: 'messaging-service',
  TRANSACTIONS_SERVICE_URL: 'transactions-service',
  IDENTITY_SERVICE_URL: 'identity-service',
  USERS_SERVICE_URL: 'users-service',
  MODERATION_SERVICE_URL: 'moderation-service',
  FRAUD_SERVICE_URL: 'fraud-service',
  PERSONALIZATION_SERVICE_URL: 'personalization-service',
};
function gatewayMap() {
  const src = readFileSync(join(root, 'services/api-gateway/src/proxy/services.config.ts'), 'utf8');
  const body = src.slice(src.indexOf('SERVICES_CONFIG'));
  const map = new Map();
  for (const block of body.split(/\n  \{/).slice(1)) {
    const prefix = block.match(/prefix:\s*'([^']+)'/)?.[1];
    const env = block.match(/process\.env\.(\w+)/)?.[1];
    if (!prefix || !env) continue;
    map.set(prefix, { service: ENV_TO_SERVICE[env], stripPrefix: !/stripPrefix:\s*false/.test(block) });
  }
  return map;
}

/** ROUTE_OVERRIDES: client paths forwarded, full path kept, to another service. */
function gatewayOverrides() {
  const src = readFileSync(join(root, 'services/api-gateway/src/proxy/services.config.ts'), 'utf8');
  const block = src.slice(src.indexOf('ROUTE_OVERRIDES'), src.indexOf('SERVICES_CONFIG: ServiceConfig'));
  return [...block.matchAll(/pattern:\s*\/(.+?)\/([a-z]*),\s*service:\s*'([^']+)'/g)].map((m) => ({
    pattern: new RegExp(m[1], m[2]),
    service: m[3],
  }));
}

// ── Client calls ──────────────────────────────────────────────
function toPath(literal) {
  return literal
    .replace(/\$\{[^}]*\}/g, ':p') // JS template / Dart ${...}
    .replace(/\$[A-Za-z_]\w*/g, ':p') // Dart $var
    .split('?')[0];
}
function clientCalls() {
  const calls = [];
  const scan = (dir, exts, rx, client) => {
    for (const file of walk(join(root, dir), exts)) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(rx)) {
        const lit = m[2];
        if (!lit.startsWith('/')) continue;
        const line = src.slice(0, m.index).split('\n').length;
        calls.push({ client, method: m[1] === 'return' ? 'GET' : m[1].toUpperCase(), path: norm(toPath(lit)), where: `${relative(root, file)}:${line}` });
      }
    }
  };
  scan('apps/web/src', ['.ts', '.tsx'], /\bapi\.(get|post|put|patch|delete)(?:<[^>]*>)?\(\s*[`'"]([^`'"]+)[`'"]/g, 'web');
  // SWR hooks build the URL as the cache key and fetch it with api.get(url).
  scan('apps/web/src/hooks', ['.ts', '.tsx'], /(return)\s+[`'"](\/[^`'"]+)[`'"]/g, 'web');
  scan('apps/mobile/lib', ['.dart'], /\bdio\.(get|post|put|patch|delete)(?:<[^>]*>)?\(\s*['"]([^'"]+)['"]/g, 'mobile');
  return calls;
}

// ── Match ─────────────────────────────────────────────────────
const matches = (routePath, path) => {
  const a = segments(routePath);
  const b = segments(path);
  // A route parameter accepts any client segment; a dynamic client segment (${id}) only
  // matches a route parameter, never a fixed word like "profile".
  return a.length === b.length && a.every((s, i) => s.startsWith(':') || s === b[i]);
};

const gateway = gatewayMap();
const overrides = gatewayOverrides();
const serverRoutes = {};
for (const service of new Set([...[...gateway.values()].map((g) => g.service), ...overrides.map((o) => o.service)])) {
  const dir = join(root, 'services', service);
  serverRoutes[service] = existsDir(join(dir, 'src')) ? nestRoutes(dir) : fastapiRoutes(dir);
}
function existsDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

const problems = [];
const calls = clientCalls();
for (const call of calls) {
  const [prefix, ...rest] = segments(call.path);
  // A dynamic client segment is checked against overrides as a sample value.
  const override = overrides.find((o) => o.pattern.test(call.path.replace(/:p/g, 'x')));
  const target = override ? { service: override.service, stripPrefix: false } : gateway.get(prefix);
  if (!target) {
    problems.push({ ...call, reason: `no gateway prefix "/${prefix}"` });
    continue;
  }
  const forwarded = norm((target.stripPrefix ? '' : `/${prefix}`) + '/' + rest.join('/'));
  const routes = serverRoutes[target.service] ?? [];
  const pathMatches = routes.filter((r) => matches(r.path, forwarded));
  if (!pathMatches.length) {
    problems.push({ ...call, reason: `${target.service} has no route ${forwarded}` });
  } else if (!pathMatches.some((r) => r.method === call.method || r.method === 'ALL')) {
    problems.push({
      ...call,
      reason: `${target.service} ${forwarded} accepts ${[...new Set(pathMatches.map((r) => r.method))].join('/')}, not ${call.method}`,
    });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ calls: calls.length, problems }, null, 2));
} else {
  console.log(`Checked ${calls.length} client calls against ${Object.values(serverRoutes).flat().length} server routes.`);
  for (const p of problems) console.log(`✗ [${p.client}] ${p.method} ${p.path}  →  ${p.reason}   (${p.where})`);
  console.log(problems.length ? `\n${problems.length} contract mismatch(es).` : '\nAll client calls have a matching server route.');
}
process.exit(problems.length ? 1 : 0);
