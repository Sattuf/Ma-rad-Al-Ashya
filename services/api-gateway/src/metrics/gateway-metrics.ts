import axios from 'axios';
import { Counter, Gauge, Histogram, register } from 'prom-client';
import { SERVICES_CONFIG } from '../proxy/services.config';

/**
 * Gateway metrics. Every client request passes through here, so these give request rate,
 * errors and latency per upstream service (the RED method) without instrumenting each
 * service. Labels are bounded sets (service name, method, status class): never the path
 * or user id, which would explode Prometheus cardinality.
 */

export const upstreamDuration = new Histogram({
  name: 'gateway_upstream_request_duration_seconds',
  help: 'Time from forwarding a request to receiving the upstream response',
  labelNames: ['service', 'method', 'status_class'] as const,
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const cacheRequests = new Counter({
  name: 'gateway_cache_requests_total',
  help: 'Cacheable GET requests by result (hit = served from Redis without calling the service)',
  labelNames: ['service', 'result'] as const,
});

/** "2xx".."5xx", or "error" when no response arrived (timeout, connection refused). */
export function statusClass(status?: number): string {
  return status ? `${Math.floor(status / 100)}xx` : 'error';
}

// ── Upstream health ──────────────────────────────────────────────────────────
const PROBE_TIMEOUT_MS = 1500;
const PROBE_CACHE_MS = 10_000;

/**
 * One probe per distinct upstream URL: several prefixes share a service (listings serves
 * categories and promotions). The first config per URL is the service's main entry.
 */
export function upstreams(): Array<{ service: string; url: string }> {
  const byUrl = new Map<string, string>();
  for (const s of SERVICES_CONFIG) if (!byUrl.has(s.url)) byUrl.set(s.url, s.name);
  return [...byUrl].map(([url, service]) => ({ service, url }));
}

/** Metric label for a route config: its service's main name (moderation-service-admin → moderation-service). */
const labelByUrl = new Map(upstreams().map((u) => [u.url, u.service]));
export function serviceLabel(config: { url: string; name: string }): string {
  return labelByUrl.get(config.url) ?? config.name;
}

let lastProbe: { at: number; results: Promise<Array<{ service: string; up: number }>> } | undefined;

async function probeAll(now = Date.now()) {
  // Scrapes can come from several Prometheus replicas: never probe more than every 10s.
  if (lastProbe && now - lastProbe.at < PROBE_CACHE_MS) return lastProbe.results;
  const results = Promise.all(
    upstreams().map(async ({ service, url }) => {
      try {
        const res = await axios.get(`${url}/health`, { timeout: PROBE_TIMEOUT_MS, validateStatus: () => true });
        return { service, up: res.status < 500 ? 1 : 0 };
      } catch {
        return { service, up: 0 };
      }
    }),
  );
  lastProbe = { at: now, results };
  return results;
}

export const upstreamUp = new Gauge({
  name: 'gateway_upstream_up',
  help: '1 if the upstream service answered its /health probe, else 0',
  labelNames: ['service'] as const,
  async collect() {
    for (const { service, up } of await probeAll()) this.set({ service }, up);
  },
});

/** For tests. */
export function resetProbeCache() {
  lastProbe = undefined;
}

export { register };
