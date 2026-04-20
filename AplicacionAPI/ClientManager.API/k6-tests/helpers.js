/**
 * k6 auth helpers for ClientManager API.
 *
 * Usage in each test file:
 *   export function setup() { return { cookies: authenticate() }; }
 *   export default function (data) { http.get(url, authParams(data.cookies)); }
 *
 * Required env vars (pass with -e):
 *   TEST_EMAIL     - user email
 *   TEST_PASSWORD  - user password
 *   MFA_TYPE       - 'totp' or 'email' (default: 'email')
 *   TOTP_SECRET    - base32 TOTP secret (required when MFA_TYPE=totp)
 *   API_URL        - base URL (default: http://localhost:5000)
 *   SMTP4DEV_URL   - smtp4dev URL (default: http://localhost:5080)
 *
 * Example run:
 *   k6 run -e TEST_EMAIL=admin@example.com -e TEST_PASSWORD=Admin123! \
 *           -e MFA_TYPE=totp -e TOTP_SECRET=JBSWY3DPEHPK3PXP \
 *           test-carga-normal.js
 */

import http   from 'k6/http';
import crypto from 'k6/crypto';
import { sleep, fail } from 'k6';

export const API_URL      = __ENV.API_URL       || 'http://localhost:5000';
const        SMTP4DEV_URL = __ENV.SMTP4DEV_URL  || 'http://localhost:5080';
const        JSON_HDR     = { 'Content-Type': 'application/json' };

// ── TOTP — RFC 6238, SHA-1, 30 s step, 6 digits ──────────────────────────────

function base32Decode(s) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const input = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, val = 0;
  const out = [];
  for (let i = 0; i < input.length; i++) {
    val = (val << 5) | alpha.indexOf(input[i]);
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

/** Generate a 6-digit TOTP code from a base32 secret (current time window). */
export function generateTotp(secret) {
  let counter = Math.floor(Date.now() / 1000 / 30);
  const msg = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) { msg[i] = counter & 0xff; counter = Math.floor(counter / 256); }

  const key = base32Decode(secret);
  const hex = crypto.hmac('sha1', key.buffer, msg.buffer, 'hex');

  const h = [];
  for (let i = 0; i < hex.length; i += 2) h.push(parseInt(hex.slice(i, i + 2), 16));

  const off = h[h.length - 1] & 0x0f;
  const code = (
    ((h[off]     & 0x7f) << 24) |
    ((h[off + 1] & 0xff) << 16) |
    ((h[off + 2] & 0xff) <<  8) |
     (h[off + 3] & 0xff)
  ) % 1_000_000;
  return code.toString().padStart(6, '0');
}

// ── Email OTP — read from dev endpoint or smtp4dev ───────────────────────────

/** Try GET /api/dev/last-otp (only available when API runs in Development mode). */
function readOtpFromDevEndpoint(email) {
  const res = http.get(`${API_URL}/api/dev/last-otp?email=${encodeURIComponent(email)}`);
  if (res.status !== 200) return null;
  try { return JSON.parse(res.body).code || null; } catch (_) { return null; }
}

/** Fallback: read latest OTP from smtp4dev web UI (requires smtp4dev running). */
function readOtpFromSmtp4dev(recipientEmail) {
  const listRes = http.get(`${SMTP4DEV_URL}/api/messages`);
  if (listRes.status !== 200)
    fail(`smtp4dev not reachable at ${SMTP4DEV_URL} (status ${listRes.status}).`);

  const payload  = JSON.parse(listRes.body);
  // smtp4dev v3+ returns { results: [...], totalCount: N }; older versions return plain array
  const messages = Array.isArray(payload) ? payload : (payload.results || []);
  if (messages.length === 0)
    fail('No emails in smtp4dev — OTP email may not have arrived yet. Try increasing the sleep() delay.');

  const lower = recipientEmail.toLowerCase();
  const msg = messages.find(m => {
    const to = Array.isArray(m.to) ? m.to : [];
    return to.some(t => (typeof t === 'string' ? t : (t.address || '')).toLowerCase().includes(lower));
  }) || messages[0]; // fall back to latest message

  const srcRes = http.get(`${SMTP4DEV_URL}/api/messages/${msg.id}/source`);
  const match  = srcRes.body.match(/\b([0-9]{6})\b/);
  if (!match) fail('Could not find a 6-digit OTP in the email source. Check EmailService template.');
  return match[1];
}

/** Get Email OTP: tries dev endpoint first, falls back to smtp4dev. */
function readOtpForEmail(email) {
  const devCode = readOtpFromDevEndpoint(email);
  if (devCode) return devCode;
  sleep(2); // wait for SMTP delivery before hitting smtp4dev
  return readOtpFromSmtp4dev(email);
}

// ── Cookie utilities ──────────────────────────────────────────────────────────

/** Build a Cookie header string from a k6 response's .cookies dict. */
export function cookieStrFromResponse(res) {
  return Object.entries(res.cookies)
    .filter(([, arr]) => arr && arr.length > 0)
    .map(([name, arr]) => `${name}=${arr[0].value}`)
    .join('; ');
}

/** Replace or add a single named cookie in an existing cookie string. */
export function updateCookie(cookieStr, name, value) {
  const re = new RegExp(`(?:^|; ?)${name}=[^;]*`);
  const pair = `${name}=${value}`;
  return re.test(cookieStr) ? cookieStr.replace(re, (m) => m.startsWith(';') ? `; ${pair}` : pair)
                            : (cookieStr ? `${cookieStr}; ${pair}` : pair);
}

/** Returns an http params object { headers: { Cookie: '...' } }. */
export function authParams(cookieStr) {
  return { headers: { Cookie: cookieStr } };
}

// ── Full auth flow ─────────────────────────────────────────────────────────────

/**
 * Perform login + MFA in one call. Returns a cookie string ready for use in
 * authParams(). Call this inside setup() so auth happens only once per test run.
 */
export function authenticate() {
  const email    = __ENV.TEST_EMAIL    || fail('Missing env var: TEST_EMAIL');
  const password = __ENV.TEST_PASSWORD || fail('Missing env var: TEST_PASSWORD');

  const loginRes = http.post(
    `${API_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: JSON_HDR }
  );
  if (loginRes.status !== 200)
    fail(`Login failed (${loginRes.status}): ${loginRes.body}`);

  const body = JSON.parse(loginRes.body);

  // No MFA required — cookies already set
  if (!body.requiresMfa) return cookieStrFromResponse(loginRes);

  let code;
  if (body.mfaType === 'totp') {
    const secret = __ENV.TOTP_SECRET || fail('Missing env var: TOTP_SECRET (required for mfaType=totp)');
    code = generateTotp(secret);
  } else {
    code = readOtpForEmail(body.mfaEmail || email);
  }

  const mfaRes = http.post(
    `${API_URL}/api/auth/mfa-verify`,
    JSON.stringify({ email, code }),
    { headers: JSON_HDR }
  );
  if (mfaRes.status !== 200)
    fail(`MFA verify failed (${mfaRes.status}): ${mfaRes.body}`);

  return cookieStrFromResponse(mfaRes);
}

/**
 * Attempt a token refresh using the current cookie string.
 * Returns the updated cookie string on success, or null on failure.
 */
export function tryRefresh(cookieStr) {
  const res = http.post(
    `${API_URL}/api/auth/refresh`,
    '{}',
    { headers: { ...JSON_HDR, Cookie: cookieStr } }
  );
  if (res.status !== 200) return null;
  // Merge new cookies into existing string (preserves refreshToken if not rotated)
  let updated = cookieStr;
  for (const [name, arr] of Object.entries(res.cookies)) {
    if (arr && arr.length > 0) updated = updateCookie(updated, name, arr[0].value);
  }
  return updated;
}
