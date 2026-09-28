import axios from 'axios';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { register, resetProbeCache, serviceLabel, statusClass, upstreams } from './gateway-metrics';
import { SERVICES_CONFIG } from '../proxy/services.config';
import { MetricsTokenGuard } from './metrics.controller';
import { isBlockedRoute } from '../proxy/proxy.controller';

jest.mock('axios');

const ctx = (authorization?: string) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }) }) as unknown as ExecutionContext;

describe('gateway metrics', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    resetProbeCache();
  });

  it('classifies statuses without unbounded labels', () => {
    expect([statusClass(200), statusClass(404), statusClass(503), statusClass(undefined)]).toEqual(['2xx', '4xx', '5xx', 'error']);
  });

  it('probes each distinct upstream once, named after its main service', () => {
    const names = upstreams().map((u) => u.service);
    expect(new Set(upstreams().map((u) => u.url)).size).toBe(upstreams().length);
    expect(names).toEqual(expect.arrayContaining(['auth-service', 'listings-service', 'moderation-service', 'fraud-service']));
    expect(names).not.toContain('categories-service');
  });

  it('labels every route of a service with the same name as its health probe', () => {
    const admin = SERVICES_CONFIG.find((s) => s.name === 'moderation-service-admin')!;
    const categories = SERVICES_CONFIG.find((s) => s.name === 'categories-service')!;
    expect(serviceLabel(admin)).toBe('moderation-service');
    expect(serviceLabel(categories)).toBe('listings-service');
  });

  it('reports upstream_up from /health (down on error or 5xx)', async () => {
    (axios.get as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes(':3001')) throw new Error('ECONNREFUSED');
      return { status: url.includes(':3002') ? 503 : 200 };
    });
    const text = await register.getSingleMetricAsString('gateway_upstream_up');
    expect(text).toMatch(/gateway_upstream_up\{service="auth-service"\} 0/);
    expect(text).toMatch(/gateway_upstream_up\{service="listings-service"\} 0/);
    expect(text).toMatch(/gateway_upstream_up\{service="search-service"\} 1/);
  });

  describe('MetricsTokenGuard', () => {
    const guard = new MetricsTokenGuard();

    it('requires the bearer token when METRICS_TOKEN is set', () => {
      process.env.METRICS_TOKEN = 'scrape-token-123';
      expect(guard.canActivate(ctx('Bearer scrape-token-123'))).toBe(true);
      expect(() => guard.canActivate(ctx('Bearer wrong'))).toThrow(NotFoundException);
      expect(() => guard.canActivate(ctx())).toThrow(NotFoundException);
    });

    it('hides /metrics in production when no token is configured', () => {
      delete process.env.METRICS_TOKEN;
      process.env.NODE_ENV = 'production';
      expect(() => guard.canActivate(ctx())).toThrow(NotFoundException);
      process.env.NODE_ENV = 'development';
      expect(guard.canActivate(ctx())).toBe(true);
    });
  });

  it('never forwards /metrics to a service, whatever the prefix', () => {
    expect(isBlockedRoute('auth-service', 'GET', '/metrics')).toBe(true);
    expect(isBlockedRoute('moderation-service-admin', 'GET', '/Metrics/')).toBe(true);
    expect(isBlockedRoute('auth-service', 'GET', '/metrics-report')).toBe(false);
  });
});
