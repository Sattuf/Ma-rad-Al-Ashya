// Shared settings. Override the target with: k6 run -e BASE_URL=https://staging.example.com script.js
export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const API = `${BASE_URL}/api/v1`;

// Targets from docs/REBUILD_PLAN.md (phase 2): p95 < 300ms, < 1% errors.
export const DEFAULT_THRESHOLDS = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<300', 'p(99)<800'],
};
