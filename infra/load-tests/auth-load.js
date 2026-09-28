import http from 'k6/http';
import { check, sleep } from 'k6';
import { API } from './config.js';

// Verifies the auth rate limit under load: wrong credentials must be answered with
// 401 (bad password) or 429 (limited) — never 5xx — and bcrypt must not starve the service.
export const options = {
  vus: 20,
  duration: '1m',
  thresholds: {
    'checks{check:no 5xx}': ['rate==1'],
    http_req_duration: ['p(95)<1000'], // bcrypt cost 12 is intentionally slow
  },
};

export default function () {
  const payload = JSON.stringify({ identifier: `load-${__VU}@example.com`, password: 'wrong-password' });
  const res = http.post(`${API}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /auth/login' },
  });
  check(res, {
    'no 5xx': (r) => r.status < 500,
    'rejected or limited': (r) => r.status === 401 || r.status === 429,
  });
  sleep(1);
}
