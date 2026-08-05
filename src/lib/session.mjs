/**
 * Signed session cookie helpers for the Ask AI endpoints (/api/chat and
 * /api/share).
 *
 * After a visitor passes Cloudflare Turnstile once, the server sets a
 * signed HttpOnly cookie (30 min). Subsequent requests verify the cookie
 * instead of re-running Turnstile. The cookie value is `<expiry>.<hmac>`
 * where the HMAC is derived from the expiry + a server secret (the Gemini
 * API key doubles as the signing key so no extra env vars are needed).
 */

import { createHmac } from 'node:crypto';

/** Cookie name shared by /api/chat and /api/share. */
export const SESSION_COOKIE_NAME = 'jmeter-ai-session';

/** Session lifetime after first Turnstile verification: 30 minutes. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Create a signed session cookie value valid for SESSION_TTL_MS.
 * @param {string} signingKey
 * @returns {string} `<expiry>.<base64url-hmac>`
 */
export function createSessionCookie(signingKey) {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = String(expiry);
  const sig = createHmac('sha256', signingKey)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify a session cookie value: signature matches and expiry is in the
 * future. Never throws.
 * @param {string | null | undefined} value
 * @param {string} signingKey
 * @returns {boolean}
 */
export function verifySessionCookie(value, signingKey) {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac('sha256', signingKey)
    .update(payload)
    .digest('base64url');
  if (sig !== expected) return false;
  const expiry = Number(payload);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  return true;
}

/**
 * Parse a Cookie request header into a plain object.
 * @param {string | null} cookieHeader
 * @returns {Record<string, string>}
 */
export function parseCookies(cookieHeader) {
  const header = cookieHeader || '';
  /** @type {Record<string, string>} */
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      const key = part.slice(0, eq).trim();
      const val = part.slice(eq + 1).trim();
      out[key] = val;
    }
  }
  return out;
}

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Validate a Cloudflare Turnstile token server-side. Returns true when no
 * secret is configured (dev mode) so local flows are never blocked.
 *
 * @param {string} token
 * @param {string | undefined} secret
 * @param {string} [remoteip]
 * @returns {Promise<boolean>}
 */
export async function verifyTurnstileToken(token, secret, remoteip) {
  if (!secret) return true; // dev mode — no secret configured
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token);
    if (remoteip) body.append('remoteip', remoteip);
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body,
    });
    const data = /** @type {{ success?: boolean }} */ (await res.json());
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * Extract the client IP from a request's forwarding headers.
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  const headers = request.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
