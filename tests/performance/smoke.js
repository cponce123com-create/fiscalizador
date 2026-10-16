import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

export const options = {
  vus: Number(__ENV.VUS || 1),
  duration: __ENV.DURATION || '10s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function smoke() {
  const respuestas = http.batch([
    ['GET', `${BASE_URL}/`],
    ['GET', `${BASE_URL}/api/public/search/global?texto=galarza`],
    ['GET', `${BASE_URL}/ranking`],
    ['GET', `${BASE_URL}/prensa`],
  ]);
  respuestas.forEach((respuesta) => check(respuesta, { 'respuesta válida': r => r.status === 200 || r.status === 429 }));
  sleep(1);
}

