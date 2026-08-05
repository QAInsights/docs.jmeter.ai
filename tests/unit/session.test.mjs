import { describe, it, expect } from 'vitest';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionCookie,
  verifySessionCookie,
  parseCookies,
} from '../../src/lib/session.mjs';

const KEY = 'test-signing-key';

describe('session cookie', () => {
  it('round-trips: a fresh cookie verifies', () => {
    const value = createSessionCookie(KEY);
    expect(verifySessionCookie(value, KEY)).toBe(true);
  });

  it('rejects cookies signed with a different key', () => {
    const value = createSessionCookie(KEY);
    expect(verifySessionCookie(value, 'other-key')).toBe(false);
  });

  it('rejects tampered payloads and malformed values', () => {
    const value = createSessionCookie(KEY);
    const [payload, sig] = value.split('.');
    expect(verifySessionCookie(`${Number(payload) + 1000}.${sig}`, KEY)).toBe(false);
    expect(verifySessionCookie('garbage', KEY)).toBe(false);
    expect(verifySessionCookie('', KEY)).toBe(false);
    expect(verifySessionCookie(null, KEY)).toBe(false);
  });

  it('rejects expired cookies', async () => {
    const { createHmac } = await import('node:crypto');
    const expiredPayload = String(Date.now() - 1000);
    const sig = createHmac('sha256', KEY).update(expiredPayload).digest('base64url');
    expect(verifySessionCookie(`${expiredPayload}.${sig}`, KEY)).toBe(false);
  });

  it('cookie name and TTL match the chat endpoint contract', () => {
    expect(SESSION_COOKIE_NAME).toBe('jmeter-ai-session');
    expect(SESSION_TTL_MS).toBe(30 * 60 * 1000);
  });

  it('verifies the exact value createSessionCookie emits via a Cookie header', () => {
    // The endpoints set `name=value; HttpOnly; ...` and later parse the
    // browser's `Cookie: name=value; other=1` header back. Guard the
    // round-trip so the two formats never drift apart.
    const value = createSessionCookie(KEY);
    const header = `other=1; ${SESSION_COOKIE_NAME}=${value}; third=x`;
    const cookies = parseCookies(header);
    expect(cookies[SESSION_COOKIE_NAME]).toBe(value);
    expect(verifySessionCookie(cookies[SESSION_COOKIE_NAME], KEY)).toBe(true);
  });

  it('fails closed when the signing key is missing', () => {
    const value = createSessionCookie(KEY);
    expect(verifySessionCookie(value, null)).toBe(false);
    expect(verifySessionCookie(value, undefined)).toBe(false);
    expect(verifySessionCookie(value, '')).toBe(false);
    expect(() => createSessionCookie(null)).toThrow();
  });
});

describe('parseCookies', () => {
  it('parses a standard cookie header', () => {
    const cookies = parseCookies('a=1; b=two; jmeter-ai-session=abc.def');
    expect(cookies.a).toBe('1');
    expect(cookies.b).toBe('two');
    expect(cookies['jmeter-ai-session']).toBe('abc.def');
  });

  it('handles empty and null headers', () => {
    expect(parseCookies('')).toEqual({});
    expect(parseCookies(null)).toEqual({});
  });
});
