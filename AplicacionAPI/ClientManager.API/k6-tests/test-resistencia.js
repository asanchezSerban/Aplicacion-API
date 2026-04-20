/**
 * Prueba de resistencia (soak) — GET /api/companies
 * 50 VUs durante 1 hora. Detecta degradación lenta (memory leaks,
 * agotamiento de pool de conexiones, acumulación de refresh tokens).
 *
 * ⚠️  El access token expira según el TTL configurado en appsettings.json
 *     (Jwt:AccessTokenMinutes). Si es < 60 min, el test intentará un
 *     refresh automático usando el refresh token. Si el refresh también
 *     falla, el VU dejará de enviar peticiones autenticadas ese ciclo.
 *
 * Ejecutar:
 *   k6 run -e TEST_EMAIL=admin@clientmanager.local \
 *           -e TEST_PASSWORD=Admin123! \
 *           -e MFA_TYPE=totp \
 *           -e TOTP_SECRET=<base32-secret> \
 *           test-resistencia.js
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { authenticate, authParams, tryRefresh, API_URL } from './helpers.js';

export const options = {
  vus:      50,
  duration: '1h',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed:   ['rate<0.02'],
  },
};

export function setup() {
  return { cookies: authenticate() };
}

// Cookies por VU — persiste entre iteraciones del mismo VU
let vuCookies = null;

export default function (data) {
  if (!vuCookies) vuCookies = data.cookies;

  let res = http.get(`${API_URL}/api/companies?page=1&pageSize=10`, authParams(vuCookies));

  // Token expirado — intentar refresh silencioso
  if (res.status === 401) {
    const refreshed = tryRefresh(vuCookies);
    if (refreshed) {
      vuCookies = refreshed;
      res = http.get(`${API_URL}/api/companies?page=1&pageSize=10`, authParams(vuCookies));
    }
  }

  check(res, {
    'status 200':        r => r.status === 200,
    'respuesta < 500ms': r => r.timings.duration < 500,
  });

  sleep(1);
}
