import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { SHARE_RATE_MAX } from '../../src/lib/share-store.mjs';

// In-memory Redis substitute, hoisted so the mocked module factory can see it.
const { redisStore, fakeRedis } = vi.hoisted(() => {
  const redisStore = new Map();
  const fakeRedis = {
    async set(key, value) {
      redisStore.set(key, value);
      return 'OK';
    },
    async get(key) {
      return redisStore.has(key) ? redisStore.get(key) : null;
    },
    async incr(key) {
      const current = typeof redisStore.get(key) === 'number' ? redisStore.get(key) : 0;
      const next = current + 1;
      redisStore.set(key, next);
      return next;
    },
    async expire() {
      return 1;
    },
  };
  return { redisStore, fakeRedis };
});

vi.mock('../../src/lib/redis.mjs', () => ({
  getRedisClient: () => fakeRedis,
}));

// Deterministic Turnstile: only the literal token "valid-token" passes.
// Everything else from session.mjs stays real (cookie signing, parsing).
vi.mock('../../src/lib/session.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifyTurnstileToken: async (token) => token === 'valid-token',
  };
});

const SIGNING_KEY = 'test-signing-key';
const validThread = [
  { role: 'user', content: 'How do I size threads?' },
  { role: 'assistant', content: "Use Little's law: threads = RPS x response time." },
];

let POST;
let createSessionCookie;
let SESSION_COOKIE_NAME;

beforeAll(async () => {
  vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', SIGNING_KEY);
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-turnstile-secret');
  ({ POST } = await import('../../src/pages/api/share.ts'));
  ({ createSessionCookie, SESSION_COOKIE_NAME } = await import('../../src/lib/session.mjs'));
});

beforeEach(() => {
  redisStore.clear();
});

function makeRequest({ messages = validThread, token = '', cookie, origin = 'http://localhost:4321', ip = '203.0.113.7' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (ip) headers['x-forwarded-for'] = ip;
  return new Request(`${origin}/api/share`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, turnstileToken: token }),
  });
}

describe('/api/share auth matrix', () => {
  it('saves a thread with a valid Turnstile token and issues a session cookie', async () => {
    const res = await POST({
      request: makeRequest({ token: 'valid-token', origin: 'https://preview-abc.example.com' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toMatch(/^[A-Za-z2-9]{10}$/);
    // URL must use the request's own origin, not hardcoded production.
    expect(data.url).toBe(`https://preview-abc.example.com/shared/${data.id}/`);
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE_NAME}=`);
    // The conversation landed in Redis under share:<id>.
    expect(redisStore.has(`share:${data.id}`)).toBe(true);
  });

  it('rejects requests with no cookie and no valid token', async () => {
    const res = await POST({ request: makeRequest({ token: '' }) });
    expect(res.status).toBe(403);
    const bad = await POST({ request: makeRequest({ token: 'forged' }) });
    expect(bad.status).toBe(403);
  });

  it('accepts a valid session cookie without any Turnstile token', async () => {
    const cookie = `${SESSION_COOKIE_NAME}=${createSessionCookie(SIGNING_KEY)}`;
    const res = await POST({ request: makeRequest({ cookie }) });
    expect(res.status).toBe(200);
    // An existing session is not re-issued a cookie.
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('rejects a cookie signed with a different key', async () => {
    const cookie = `${SESSION_COOKIE_NAME}=${createSessionCookie('attacker-key')}`;
    const res = await POST({ request: makeRequest({ cookie }) });
    expect(res.status).toBe(403);
  });

  it('rejects invalid payloads with 400', async () => {
    const res = await POST({
      request: makeRequest({
        token: 'valid-token',
        messages: [{ role: 'user', content: 'no answer yet' }],
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe('/api/share rate limiting', () => {
  it(`allows ${SHARE_RATE_MAX} shares per IP per window, then returns 429`, async () => {
    for (let i = 0; i < SHARE_RATE_MAX; i++) {
      const res = await POST({ request: makeRequest({ token: 'valid-token' }) });
      expect(res.status).toBe(200);
    }
    const blocked = await POST({ request: makeRequest({ token: 'valid-token' }) });
    expect(blocked.status).toBe(429);
  });

  it('tracks IPs independently', async () => {
    for (let i = 0; i < SHARE_RATE_MAX; i++) {
      await POST({ request: makeRequest({ token: 'valid-token', ip: '203.0.113.7' }) });
    }
    const other = await POST({
      request: makeRequest({ token: 'valid-token', ip: '198.51.100.9' }),
    });
    expect(other.status).toBe(200);
  });
});
