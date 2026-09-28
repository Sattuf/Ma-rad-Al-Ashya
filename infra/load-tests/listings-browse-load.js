import http from 'k6/http';
import { check, sleep } from 'k6';
import { API, DEFAULT_THRESHOLDS } from './config.js';

// Anonymous browsing: list pages (gateway cache + indexed query) and listing details.
export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-arrival-rate',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { duration: '1m', target: 200 },
        { duration: '3m', target: 500 }, // phase 2 goal: 500 RPS
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: DEFAULT_THRESHOLDS,
};

export default function () {
  const page = 1 + Math.floor(Math.random() * 5);
  const list = http.get(`${API}/listings?page=${page}&limit=20`, { tags: { name: 'GET /listings' } });
  check(list, { 'list 200': (r) => r.status === 200 });

  const items = list.status === 200 ? list.json('data') || [] : [];
  if (items.length) {
    const id = items[Math.floor(Math.random() * items.length)].id;
    const detail = http.get(`${API}/listings/${id}`, { tags: { name: 'GET /listings/:id' } });
    check(detail, { 'detail 200': (r) => r.status === 200 });
  }
  sleep(Math.random());
}
