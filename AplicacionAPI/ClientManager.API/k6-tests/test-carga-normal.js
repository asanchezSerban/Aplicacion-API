/**
 * Prueba de carga normal — GET /api/companies + GET /api/users
 * 50 VUs durante 5 minutos. Simula uso concurrente sostenido típico.
 *
 * Ejecutar:
 *   k6 run -e TEST_EMAIL=admin@clientmanager.local \
 *           -e TEST_PASSWORD=Admin123! \
 *           -e MFA_TYPE=totp \
 *           -e TOTP_SECRET=<base32-secret> \
 *           test-carga-normal.js
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { authenticate, authParams, API_URL } from './helpers.js';

export const options = {
  vus:      50,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed:   ['rate<0.01'],
  },
};

export function setup() {
  return { cookies: authenticate() };
}

export default function (data) {
  const params = authParams(data.cookies);

  const companiesRes = http.get(`${API_URL}/api/companies?page=1&pageSize=10`, params);
  check(companiesRes, {
    'companies 200':        r => r.status === 200,
    'companies < 500ms':    r => r.timings.duration < 500,
  });

  sleep(1);

  const usersRes = http.get(`${API_URL}/api/users?page=1&pageSize=10`, params);
  check(usersRes, {
    'users 200':     r => r.status === 200,
    'users < 500ms': r => r.timings.duration < 500,
  });

  sleep(1);
}
