/**
 * Prueba de pico (spike) — GET /api/companies
 * Sube de 50 a 150 VUs y vuelve a 0. Verifica que la API soporta
 * picos bruscos de tráfico sin degradación severa.
 *
 * Ejecutar:
 *   k6 run -e TEST_EMAIL=admin@clientmanager.local \
 *           -e TEST_PASSWORD=Admin123! \
 *           -e MFA_TYPE=totp \
 *           -e TOTP_SECRET=<base32-secret> \
 *           test-pico.js
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { authenticate, authParams, API_URL } from './helpers.js';

export const options = {
  stages: [
    { duration: '1m', target: 50  }, // ramp-up a carga normal
    { duration: '2m', target: 150 }, // pico de tráfico
    { duration: '1m', target: 50  }, // vuelta a carga normal
    { duration: '1m', target: 0   }, // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],  // umbral más permisivo durante pico
    http_req_failed:   ['rate<0.05'],
  },
};

export function setup() {
  return { cookies: authenticate() };
}

export default function (data) {
  const res = http.get(
    `${API_URL}/api/companies?page=1&pageSize=10`,
    authParams(data.cookies)
  );

  check(res, {
    'status 200':        r => r.status === 200,
    'respuesta < 800ms': r => r.timings.duration < 800,
  });

  sleep(1);
}
