/**
 * السجلات المنظمة ومعرّف الطلب — Structured logs and request IDs
 *
 * - Every log line is one JSON object: time, level, service, context, requestId, msg, fields.
 * - Every HTTP request gets an ID (X-Request-ID): taken from the caller when valid (the gateway
 *   forwards its own), otherwise generated. It is returned to the client, attached to every log
 *   line written while handling the request, forwarded on calls to other services, and tagged
 *   on Sentry events. Searching one ID shows a request's whole path through the services.
 * - Secrets and personal data are masked before anything is written or sent to Sentry.
 *
 * NOTE: this file is intentionally duplicated in every NestJS service until
 * the shared `packages/common` workspace lands (see docs/REBUILD_PLAN.md, phase 1).
 * Keep all copies identical.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
/** Accepted incoming IDs: long enough to be unique, nothing that could forge a log line. */
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

// ─── Request context ────────────────────────────────────────────────────────

const requestContext = new AsyncLocalStorage<{ requestId: string }>();

/** The ID of the request being handled, if any (undefined in cron jobs, startup, sockets). */
export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return requestContext.run({ requestId }, fn);
}

/** The caller's ID when it is valid, a new one otherwise. */
export function resolveRequestId(incoming: unknown): string {
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  return typeof value === 'string' && VALID_REQUEST_ID.test(value) ? value : randomUUID();
}

// ─── Redaction ──────────────────────────────────────────────────────────────

/** Field names (lower case, without separators) whose values are never logged. */
const SENSITIVE_KEYS = new Set([
  'password', 'otp', 'otpcode', 'pin', 'token', 'authorization', 'cookie', 'setcookie',
  'apikey', 'phone', 'phonenumber', 'mobile', 'nationalid', 'documentnumber', 'idnumber',
  'cardnumber', 'cvc', 'cvv', 'iban', 'xinternalsecret', 'xapikey', 'stripesignature',
  'xsignature', 'xdiditsignature',
]);
const SENSITIVE_SUFFIX = /(password|secret|token)$/;

export function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_KEYS.has(k) || SENSITIVE_SUFFIX.test(k);
}

const TEXT_PATTERNS: [RegExp, string][] = [
  // JWTs (access/refresh tokens, identity provider tokens)
  [/\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g, '[redacted-jwt]'],
  // Authorization header values
  [/\b(Bearer|Basic)\s+[\w.~+/-]+=*/gi, '$1 [redacted]'],
  // Secrets in query strings (?token=..., &code=... from OAuth)
  [/([?&](?:token|access_token|refresh_token|id_token|code|otp|password|secret|key|signature)=)[^&\s"']+/gi, '$1[redacted]'],
  // International numbers (+963 9xx..., 00963...) and Syrian mobiles (09xxxxxxxx). Kept narrow
  // on purpose: IDs (UUIDs, order numbers) are long digit runs too and must stay readable.
  [/(?<![\w+])\+\d{1,3}[\s-]?\d[\d\s-]{6,13}\d\b/g, '[redacted-phone]'],
  [/\b00963\d{8,9}\b/g, '[redacted-phone]'],
  [/\b09\d{8}\b/g, '[redacted-phone]'],
  // E-mail addresses keep their first letter and domain: s***@example.com
  [/\b([A-Za-z0-9])[A-Za-z0-9._%+-]*@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g, '$1***@$2'],
];

export function redactText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of TEXT_PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

const MAX_DEPTH = 6;

/** A copy of `value` safe to log: sensitive fields masked, strings scrubbed, cycles cut. */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return `[binary ${value.length} bytes]`;
  if (value instanceof Date) return value;
  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[truncated]';
  seen.add(value);
  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message), stack: value.stack && redactText(value.stack) };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) && v !== undefined && v !== null && v !== '' ? '[redacted]' : redact(v, depth + 1, seen);
  }
  return out;
}

/** Sentry `beforeSend`: scrubs request data and extras, tags the request ID. */
export function scrubSentryEvent<T extends Record<string, any>>(event: T): T {
  const e = event as Record<string, any>;
  if (e.request) {
    e.request = redact(e.request);
    if (typeof e.request.url === 'string') e.request.url = e.request.url.split('?')[0];
    delete e.request.query_string;
    delete e.request.cookies;
  }
  if (e.extra) e.extra = redact(e.extra);
  if (e.user) e.user = { id: e.user.id };
  if (typeof e.message === 'string') e.message = redactText(e.message);
  for (const ex of e.exception?.values ?? []) if (typeof ex.value === 'string') ex.value = redactText(ex.value);
  for (const crumb of e.breadcrumbs ?? []) {
    if (typeof crumb.message === 'string') crumb.message = redactText(crumb.message);
    if (crumb.data) crumb.data = redact(crumb.data);
  }
  const requestId = e.request?.headers?.[REQUEST_ID_HEADER] ?? currentRequestId();
  if (requestId) e.tags = { ...e.tags, request_id: requestId };
  return event;
}

// ─── Logger ─────────────────────────────────────────────────────────────────

type Level = 'verbose' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
const LEVEL_ORDER: Record<Level, number> = { verbose: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 };

function minLevel(): number {
  const configured = (process.env.LOG_LEVEL || '').toLowerCase();
  if (configured in LEVEL_ORDER) return LEVEL_ORDER[configured as Level];
  return process.env.NODE_ENV === 'production' ? LEVEL_ORDER.info : LEVEL_ORDER.debug;
}

const looksLikeStack = (v: unknown): v is string => typeof v === 'string' && /\n\s+at /.test(v);

/**
 * Nest logger writing one JSON object per line (LOG_FORMAT=pretty for readable local output).
 * Existing `new Logger('Context').log(...)` calls keep working unchanged.
 * An object message adds its fields: logger.log({ msg: 'listing published', listingId }).
 */
export class JsonLogger implements LoggerService {
  private readonly threshold = minLevel();
  private readonly pretty = process.env.LOG_FORMAT === 'pretty';

  constructor(private readonly service: string) {}

  log(message: unknown, ...params: unknown[]) { this.write('info', message, params); }
  warn(message: unknown, ...params: unknown[]) { this.write('warn', message, params); }
  debug(message: unknown, ...params: unknown[]) { this.write('debug', message, params); }
  verbose(message: unknown, ...params: unknown[]) { this.write('verbose', message, params); }
  fatal(message: unknown, ...params: unknown[]) { this.write('fatal', message, params); }
  error(message: unknown, ...params: unknown[]) { this.write('error', message, params); }

  private write(level: Level, message: unknown, params: unknown[]) {
    if (LEVEL_ORDER[level] < this.threshold) return;
    const rest = [...params];
    // Nest appends the logger's context as the last argument (and an undefined stack before it
    // for error()); Logger instances without a context append nothing.
    const context = rest.length > 0 && typeof rest[rest.length - 1] === 'string' && !looksLikeStack(rest[rest.length - 1])
      ? (rest.pop() as string) : undefined;

    let msg: unknown;
    let err: unknown;
    const fields: Record<string, unknown> = {};
    if (message instanceof Error) {
      msg = message.message;
      err = message;
    } else if (message && typeof message === 'object') {
      const { msg: m, message: text, ...rest } = message as Record<string, unknown>;
      msg = m ?? text;
      Object.assign(fields, rest);
    } else {
      msg = String(message);
    }
    for (const p of rest) {
      if (p === undefined) continue;
      if (p instanceof Error || looksLikeStack(p)) err = err ?? p;
      else if (p && typeof p === 'object') Object.assign(fields, p);
      else fields.detail = p;
    }
    // The core keys come last so a field can never overwrite them (requestId may be given explicitly).
    const { time: _t, level: _l, service: _s, context: _c, requestId, err: fieldErr, ...extra } = fields;
    const entry = {
      time: new Date().toISOString(),
      level,
      service: this.service,
      context,
      requestId: requestId ?? currentRequestId(),
      msg,
      ...extra,
      err: err === undefined ? fieldErr : err instanceof Error ? err : { stack: err },
    };

    const safe = redact(entry) as Record<string, unknown>;
    let line: string;
    try {
      line = this.pretty ? formatPretty(safe) : JSON.stringify(safe);
    } catch {
      line = JSON.stringify({ time: entry.time, level, service: this.service, context, msg: redactText(String(msg)) });
    }
    process.stdout.write(line + '\n');
  }
}

function formatPretty(e: Record<string, unknown>): string {
  const { time, level, service, context, requestId, msg, err, ...fields } = e;
  const extras = Object.entries(fields).filter(([, v]) => v !== undefined);
  const stack = (err as { stack?: string } | undefined)?.stack;
  return [
    `${String(time).slice(11, 23)} ${String(level).toUpperCase().padEnd(5)} [${context ?? service}]`,
    msg,
    extras.length ? JSON.stringify(Object.fromEntries(extras)) : '',
    requestId ? `(req ${String(requestId).slice(0, 8)})` : '',
  ].filter(Boolean).join(' ') + (stack ? `\n${stack}` : '');
}

// ─── HTTP wiring ────────────────────────────────────────────────────────────

/** Paths too frequent and uninteresting for the access log. */
const QUIET_PATHS = /^\/(health|metrics)(\/|$)/;

/**
 * Express middleware, registered first: assigns the request ID (also set on the request
 * headers, so the gateway's proxy forwards it), returns it to the client, runs the rest of the
 * request inside its context, and writes one access line when the response ends.
 * The context survives body parsers and Nest's FileInterceptor (tested in logging.spec.ts).
 */
export function requestContextMiddleware(logger: LoggerService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader('X-Request-ID', requestId);

    const path = (req.originalUrl || req.url).split('?')[0];
    if (!QUIET_PATHS.test(path)) {
      const started = process.hrtime.bigint();
      res.once('close', () => {
        // Closed before the response was sent = the client gave up (logged as 499, like nginx).
        const status = res.writableFinished ? res.statusCode : 499;
        const durationMs = Math.round(Number(process.hrtime.bigint() - started) / 1e5) / 10;
        const line = { msg: 'request', requestId, method: req.method, path, status, durationMs };
        if (status >= 500) logger.warn(line, 'HTTP');
        else logger.log(line, 'HTTP');
      });
    }
    runWithRequestId(requestId, next);
  };
}

/** Only calls to other services of ours carry the ID; third parties (Google, Stripe) do not. */
export function isInternalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return !hostname.includes('.') || hostname === '127.0.0.1' || hostname.endsWith('.svc.cluster.local') || hostname.endsWith('.internal');
  } catch {
    return false;
  }
}

let propagationInstalled = false;

/** Adds X-Request-ID to outgoing fetch and axios (incl. Nest HttpService) calls to our services. */
export function installRequestIdPropagation(): void {
  if (propagationInstalled) return;
  propagationInstalled = true;

  const originalFetch = globalThis.fetch;
  if (typeof originalFetch === 'function') {
    globalThis.fetch = ((input: any, init?: any) => {
      const requestId = currentRequestId();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
      if (!requestId || !url || !isInternalUrl(url)) return originalFetch(input, init);
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has(REQUEST_ID_HEADER)) headers.set(REQUEST_ID_HEADER, requestId);
      return originalFetch(input, { ...init, headers });
    }) as typeof fetch;
  }

  let axios: any;
  try {
    // Not every service depends on axios; the ones that do share its default instance with HttpService.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    axios = require('axios');
  } catch {
    return;
  }
  (axios.default ?? axios).interceptors.request.use((config: any) => {
    const requestId = currentRequestId();
    const url = config.baseURL && !/^https?:/i.test(config.url ?? '') ? `${config.baseURL}${config.url ?? ''}` : config.url;
    if (requestId && url && isInternalUrl(url)) {
      if (typeof config.headers?.set === 'function') config.headers.set(REQUEST_ID_HEADER, requestId, false);
      else config.headers = { [REQUEST_ID_HEADER]: requestId, ...config.headers };
    }
    return config;
  });
}
