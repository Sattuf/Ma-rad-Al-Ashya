import { INestApplication } from '@nestjs/common';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as express from 'express';
import * as request from 'supertest';

/**
 * Runs the real proxy controller against a fake upstream HTTP server, so routing,
 * header filtering and the route blocklist are exercised end to end.
 */
describe('ProxyController (e2e)', () => {
  let upstream: http.Server;
  let app: INestApplication;
  const seen: { method: string; url: string; headers: http.IncomingHttpHeaders; body: string }[] = [];

  beforeAll(async () => {
    upstream = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        seen.push({ method: req.method!, url: req.url!, headers: req.headers, body: Buffer.concat(chunks).toString() });
        res.setHeader('content-type', 'application/json');
        res.setHeader('set-cookie', 'internal=1');
        res.end(JSON.stringify({ ok: true, url: req.url }));
      });
    });
    await new Promise<void>((resolve) => upstream.listen(0, resolve));
    const base = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
    for (const name of ['AUTH', 'LISTINGS', 'USERS', 'SEARCH', 'IDENTITY', 'FRAUD', 'MESSAGING']) {
      process.env[`${name}_SERVICE_URL`] = base;
    }

    // services.config reads the URLs at import time, so load Nest modules after setting them.
    jest.resetModules();
    const { Test } = await import('@nestjs/testing');
    const { HttpModule } = await import('@nestjs/axios');
    const { ProxyController } = await import('./proxy.controller');
    const moduleRef = await Test.createTestingModule({
      imports: [HttpModule],
      controllers: [ProxyController],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use(['/api/v1/identity/kyc/webhook'], express.raw({ type: 'application/json' }));
    app.use(express.json());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => upstream.close(resolve));
  });

  beforeEach(() => {
    seen.length = 0;
  });

  it('routes nested paths and keeps the prefix for prefixed controllers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/listings/abc/images?page=2');
    expect(res.status).toBe(200);
    expect(seen[0].url).toBe('/listings/abc/images?page=2');
  });

  it('strips the prefix for root-mounted services', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({ identifier: 'a', password: 'b' });
    expect(seen[0].url).toBe('/login');
    expect(JSON.parse(seen[0].body)).toEqual({ identifier: 'a', password: 'b' });
  });

  it.each([
    ['post', '/api/v1/listings/batch'],
    ['put', '/api/v1/listings/abc/status'],
    ['put', '/api/v1/users/users/abc/verify'],
    ['put', '/api/v1/users/users/abc/status'],
    ['post', '/api/v1/search/index'],
    ['put', '/api/v1/search/listings/abc/boost'],
    ['post', '/api/v1/fraud/device/check'],
  ])('blocks internal route %s %s', async (method, url) => {
    const res = await (request(app.getHttpServer()) as any)[method](url).send({});
    expect(res.status).toBe(404);
    expect(seen).toHaveLength(0);
  });

  it('rejects dot segments that could bypass the blocklist', async () => {
    const res = await request(app.getHttpServer()).put('/api/v1/listings/x/%2e%2e/abc/status').send({});
    expect([400, 404]).toContain(res.status);
    expect(seen).toHaveLength(0);
  });

  it('never forwards x-internal-secret from clients', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/listings')
      .set('x-internal-secret', 'marad-internal-secret-for-webhooks')
      .set('authorization', 'Bearer t');
    expect(seen[0].headers['x-internal-secret']).toBeUndefined();
    expect(seen[0].headers.authorization).toBe('Bearer t');
  });

  it('does not leak upstream cookies', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/listings');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('forwards webhook bodies byte for byte with their signature', async () => {
    const raw = '{"session_id":"s-1",  "status":"Approved"}';
    await request(app.getHttpServer())
      .post('/api/v1/identity/kyc/webhook')
      .set('content-type', 'application/json')
      .set('x-signature', 'abc123')
      .send(raw);
    expect(seen[0].url).toBe('/identity/kyc/webhook');
    expect(seen[0].body).toBe(raw);
    expect(seen[0].headers['x-signature']).toBe('abc123');
  });

  it('streams multipart uploads through untouched', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/conversations/abc/messages/image')
      .attach('file', Buffer.from('fake-image-bytes'), 'a.png');
    expect(seen[0].headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(seen[0].body).toContain('fake-image-bytes');
  });

  it('returns 404 without listing internal services for unknown prefixes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/unknown');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('availableServices');
  });
});
