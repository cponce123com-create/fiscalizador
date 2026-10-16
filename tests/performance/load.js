import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
if (__ENV.K6_ALLOW_LOAD !== '1') throw new Error('Carga bloqueada. Usa K6_ALLOW_LOAD=1 únicamente sobre un entorno autorizado.');
if (!BASE_URL) throw new Error('Define BASE_URL con la URL del entorno aislado.');
if (/fiscalizador\.onrender\.com/i.test(BASE_URL)) throw new Error('La prueba de carga no puede ejecutarse contra producción.');

export const options = {
  stages: [
    { duration: '15s', target: Number(__ENV.TARGET_VUS || 5) },
    { duration: '30s', target: Number(__ENV.TARGET_VUS || 5) },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
};

const consultas = ['galarza', 'ipad', 'mantenimiento', 'publicidad', 'combustible'];

export default function load() {
  const termino = consultas[__ITER % consultas.length];
  const respuesta = http.get(`${BASE_URL}/api/public/search/global?texto=${encodeURIComponent(termino)}`);
  check(respuesta, { 'búsqueda responde': r => r.status === 200 || r.status === 429 });
  sleep(0.5);
}

