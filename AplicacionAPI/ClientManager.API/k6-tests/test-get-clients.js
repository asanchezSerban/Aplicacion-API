/**
 * Prueba de carga puntual — GET /api/companies
 * 200 VUs durante 30 s. Objetivo: verificar que el endpoint aguanta
 * alta concurrencia de lecturas y responde en < 500 ms.
 *
 * Ejecutar (SuperAdmin con TOTP):
 *   k6 run -e TEST_EMAIL=admin@clientmanager.local \
 *           -e TEST_PASSWORD=Admin123! \
 *           -e MFA_TYPE=totp \
 *           -e TOTP_SECRET=<base32-secret> \
 *           test-get-clients.js
 *
 * Ejecutar (Cliente con Email OTP — smtp4dev debe estar activo en :5080):
 *   k6 run -e TEST_EMAIL=cliente@ejemplo.com \
 *           -e TEST_PASSWORD=Pass123! \
 *           test-get-clients.js
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { authenticate, authParams, API_URL } from './helpers.js';

export const options = {
  vus:      200,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed:   ['rate<0.01'],
  },
};

export function setup() {
  return { cookies: authenticate() };
}

export default function (data) {
  const res = http.get(
    `${API_URL}/api/companies?page=1&pageSize=20`,
    authParams(data.cookies)
  );

  check(res, {
    'status 200':        r => r.status === 200,
    'respuesta < 500ms': r => r.timings.duration < 500,
  });

  sleep(1);
}
