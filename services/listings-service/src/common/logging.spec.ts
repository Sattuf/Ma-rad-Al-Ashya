import { Controller, Get, INestApplication, Logger, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import {
  JsonLogger,
  currentRequestId,
  isInternalUrl,
  redact,
  redactText,
  requestContextMiddleware,
  resolveRequestId,
  runWithRequestId,
  scrubSentryEvent,
} from './logging';

/** Captures what the logger writes to stdout, one parsed object per line. */
function captureStdout() {
  const lines: Record<string, any>[] = [];
  const spy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    for (const line of String(chunk).split('\n').filter(Boolean)) lines.push(JSON.parse(line));
    return true;
  });
  return { lines, restore: () => spy.mockRestore() };
}

describe('redaction', () => {
  it('masks sensitive fields at any depth, keeps the rest', () => {
    const out = redact({
      email: 'sara@example.com',
      password: 'hunter2',
      user: { phone: '+963944123456', refreshToken: 'abc', name: 'سارة' },
      headers: { authorization: 'Bearer x', 'x-internal-secret': 's', accept: 'json' },
      items: [{ otp: '123456', listingId: '00000000-0000-4000-8000-000000000000' }],
      empty: { password: '' },
    });
    expect(out).toEqual({
      email: 's***@example.com',
      password: '[redacted]',
      user: { phone: '[redacted]', refreshToken: '[redacted]', name: 'سارة' },
      headers: { authorization: '[redacted]', 'x-internal-secret': '[redacted]', accept: 'json' },
      items: [{ otp: '[redacted]', listingId: '00000000-0000-4000-8000-000000000000' }],
      empty: { password: '' },
    });
  });

  it('scrubs secrets and personal data inside free text', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(redactText(`token ${jwt} rejected`)).toBe('token [redacted-jwt] rejected');
    expect(redactText('Authorization: Bearer abc.def-123')).toBe('Authorization: Bearer [redacted]');
    expect(redactText('GET /auth/google/callback?state=1&code=4/0AQl')).toBe('GET /auth/google/callback?state=1&code=[redacted]');
    expect(redactText('OTP sent to +963 944 123 456 and 0944123456 and 00963944123456')).toBe(
      'OTP sent to [redacted-phone] and [redacted-phone] and [redacted-phone]',
    );
    expect(redactText('login failed for ahmad.k@mail.sy')).toBe('login failed for a***@mail.sy');
  });

  it('leaves IDs, dates and prices readable', () => {
    const text = 'listing 00000000-0000-4000-8000-000000000000 order 100963944123 at 2026-09-30T00:00:00.000Z price 650';
    expect(redactText(text)).toBe(text);
  });

  it('handles cycles, errors, buffers and bigints', () => {
    const a: any = { name: 'a' };
    a.self = a;
    const out: any = redact({ a, err: new Error('bad token eyJaaaaaa.bbbbbbb.ccccccc'), buf: Buffer.alloc(3), n: 10n });
    expect(out.a.self).toBe('[circular]');
    expect(out.err.message).toBe('bad token [redacted-jwt]');
    expect(out.buf).toBe('[binary 3 bytes]');
    expect(out.n).toBe('10');
  });

  it('scrubs Sentry events and tags the request ID', () => {
    const event = scrubSentryEvent({
      message: 'failed for +963944123456',
      request: { url: 'http://x/auth/reset?token=abc', query_string: 'token=abc', cookies: { s: '1' }, data: { password: 'p' }, headers: { 'x-request-id': 'req-12345678', authorization: 'Bearer z' } },
      user: { id: 'u1', email: 'a@b.co', ip_address: '1.2.3.4' },
    });
    expect(event).toEqual({
      message: 'failed for [redacted-phone]',
      request: { url: 'http://x/auth/reset', data: { password: '[redacted]' }, headers: { 'x-request-id': 'req-12345678', authorization: '[redacted]' } },
      user: { id: 'u1' },
      tags: { request_id: 'req-12345678' },
    });
  });
});

describe('request IDs', () => {
  it('accepts a valid incoming ID and replaces anything else', () => {
    expect(resolveRequestId('mobile-7f3a9c21')).toBe('mobile-7f3a9c21');
    expect(resolveRequestId(['abcdefgh-1', 'x'])).toBe('abcdefgh-1');
    for (const bad of [undefined, 'short', 'has space in it', 'line\nbreak-123', 'x'.repeat(200)]) {
      expect(resolveRequestId(bad)).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('only internal hosts get the ID', () => {
    expect(isInternalUrl('http://search-service:3003/search/index')).toBe(true);
    expect(isInternalUrl('http://fraud-service.marad.svc.cluster.local:8001/x')).toBe(true);
    expect(isInternalUrl('http://localhost:3002/x')).toBe(true);
    expect(isInternalUrl('https://www.googleapis.com/oauth2/v3/userinfo')).toBe(false);
    expect(isInternalUrl('not a url')).toBe(false);
  });
});

describe('JsonLogger', () => {
  let out: ReturnType<typeof captureStdout>;
  beforeEach(() => (out = captureStdout()));
  afterEach(() => out.restore());

  it('writes one JSON line with context, request ID, fields and a redacted stack', () => {
    const logger = new JsonLogger('listings-service');
    runWithRequestId('req-abcdef12', () => {
      logger.log('listing created', 'ListingsService');
      logger.log({ msg: 'photo stored', listingId: 'l1', level: 'hacked', token: 't' }, 'Storage');
      logger.error('upload failed for sara@example.com', 'Error: x\n    at f (a.ts:1)', 'Storage');
      logger.error('no stack', undefined, 'Storage');
    });
    expect(out.lines).toHaveLength(4);
    expect(out.lines[0]).toMatchObject({ level: 'info', service: 'listings-service', context: 'ListingsService', requestId: 'req-abcdef12', msg: 'listing created' });
    expect(new Date(out.lines[0].time).getTime()).not.toBeNaN();
    expect(out.lines[1]).toMatchObject({ level: 'info', context: 'Storage', msg: 'photo stored', listingId: 'l1', token: '[redacted]' });
    expect(out.lines[2]).toMatchObject({ level: 'error', msg: 'upload failed for s***@example.com', err: { stack: 'Error: x\n    at f (a.ts:1)' } });
    expect(out.lines[3]).toMatchObject({ level: 'error', context: 'Storage', msg: 'no stack' });
    expect(out.lines[3].err).toBeUndefined();
  });

  it('drops levels below LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'warn';
    try {
      const logger = new JsonLogger('s');
      logger.debug('d');
      logger.log('i');
      logger.warn('w');
    } finally {
      delete process.env.LOG_LEVEL;
    }
    expect(out.lines.map((l) => l.msg)).toEqual(['w']);
  });
});

@Controller()
class ProbeController {
  private readonly logger = new Logger('Probe');

  @Get('probe')
  async probe() {
    await new Promise((r) => setTimeout(r, 2));
    this.logger.log('inside handler');
    return { requestId: currentRequestId() };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: { size: number }) {
    await new Promise((r) => setTimeout(r, 2));
    return { requestId: currentRequestId(), size: file.size };
  }

  @Get('health')
  health() {
    return { ok: true };
  }
}

describe('request context through a Nest app', () => {
  let app: INestApplication;
  let out: ReturnType<typeof captureStdout>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    const logger = new JsonLogger('test-service');
    app.useLogger(logger);
    app.use(requestContextMiddleware(logger));
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => (out = captureStdout()));
  afterEach(() => out.restore());

  it('generates an ID, returns it, and stamps handler logs and the access line', async () => {
    const res = await request(app.getHttpServer()).get('/probe?token=secret').expect(200);
    const id = res.headers['x-request-id'];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.requestId).toBe(id);
    await new Promise((r) => setImmediate(r));
    expect(out.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ context: 'Probe', msg: 'inside handler', requestId: id }),
        expect.objectContaining({ context: 'HTTP', msg: 'request', requestId: id, method: 'GET', path: '/probe', status: 200 }),
      ]),
    );
    expect(JSON.stringify(out.lines)).not.toContain('secret');
  });

  it('keeps the caller ID', async () => {
    const res = await request(app.getHttpServer()).get('/probe').set('X-Request-ID', 'gateway-1234abcd').expect(200);
    expect(res.headers['x-request-id']).toBe('gateway-1234abcd');
    expect(res.body.requestId).toBe('gateway-1234abcd');
  });

  it('keeps the context after a multipart upload', async () => {
    const res = await request(app.getHttpServer())
      .post('/upload')
      .set('X-Request-ID', 'upload-1234abcd')
      .attach('file', Buffer.alloc(2_000_000, 1), 'photo.jpg')
      .expect(201);
    expect(res.body).toEqual({ requestId: 'upload-1234abcd', size: 2_000_000 });
  });

  it('does not log health checks', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await new Promise((r) => setImmediate(r));
    expect(out.lines.filter((l) => l.context === 'HTTP')).toHaveLength(0);
  });
});
