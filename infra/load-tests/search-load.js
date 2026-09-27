import http from 'k6/http';
import { check, sleep } from 'k6';
import { API, DEFAULT_THRESHOLDS } from './config.js';

const TERMS = ['سيارة', 'ايفون', 'شقة', 'laptop', 'كنبة', 'دراجة', 'playstation'];

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 150 },
    { duration: '30s', target: 0 },
  ],
  thresholds: DEFAULT_THRESHOLDS,
};

export default function () {
  const q = encodeURIComponent(TERMS[Math.floor(Math.random() * TERMS.length)]);
  const res = http.get(`${API}/search?q=${q}`, { tags: { name: 'GET /search' } });
  check(res, { 'search 200': (r) => r.status === 200 });
  sleep(1);
}
