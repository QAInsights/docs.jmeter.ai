import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkMcpRateLimit,
  MCP_RATE_MAX,
  MCP_RATE_WINDOW_SECONDS,
} from '../../src/lib/mcp-rate-limit.mjs';

// In-memory Redis substitute matching the share-store test pattern.
function makeFakeRedis() {
  const store = new Map();
  return {
    store,
    async incr(key) {
      const next = (typeof store.get(key) === 'number' ? store.get(key) : 0) + 1;
      store.set(key, next);
      return next;
    },
    async expire(key, seconds) {
      store.set(`${key}:ttl`, seconds);
      return 1;
    },
  };
}

describe('checkMcpRateLimit', () => {
  let redis;
  beforeEach(() => {
    redis = makeFakeRedis();
  });

  it(`allows ${MCP_RATE_MAX} requests per IP per window, then blocks`, async () => {
    for (let i = 0; i < MCP_RATE_MAX; i++) {
      const res = await checkMcpRateLimit('203.0.113.7', redis);
      expect(res.allowed).toBe(true);
    }
    const blocked = await checkMcpRateLimit('203.0.113.7', redis);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(MCP_RATE_WINDOW_SECONDS);
  });

  it('sets the window TTL on the first request of a window', async () => {
    await checkMcpRateLimit('203.0.113.7', redis);
    const key = [...redis.store.keys()].find((k) => k.startsWith('mcp:rate:'));
    expect(redis.store.get(`${key}:ttl`)).toBe(MCP_RATE_WINDOW_SECONDS);
  });

  it('tracks IPs independently', async () => {
    for (let i = 0; i < MCP_RATE_MAX; i++) {
      await checkMcpRateLimit('203.0.113.7', redis);
    }
    const other = await checkMcpRateLimit('198.51.100.9', redis);
    expect(other.allowed).toBe(true);
  });

  it('sanitizes hostile IPs in the Redis key', async () => {
    await checkMcpRateLimit('1.2.3.4"; DROP TABLE--', redis);
    const key = [...redis.store.keys()].find((k) => k.startsWith('mcp:rate:'));
    expect(key).toMatch(/^mcp:rate:[a-zA-Z0-9.:_-]+$/);
  });

  it('returns null when Redis is unavailable (fail open)', async () => {
    expect(await checkMcpRateLimit('203.0.113.7', null)).toBeNull();
  });

  it('returns null when Redis throws (fail open)', async () => {
    const broken = { async incr() { throw new Error('redis down'); } };
    expect(await checkMcpRateLimit('203.0.113.7', broken)).toBeNull();
  });
});

describe('/api/mcp POST rate limiting', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function makeMcpRequest(ip = '203.0.113.7') {
    return new Request('https://docs.jmeter.ai/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'vitest', version: '1.0' },
        },
      }),
    });
  }

  it('returns 429 with Retry-After when the limiter blocks', async () => {
    vi.doMock('../../src/lib/mcp-rate-limit.mjs', () => ({
      checkMcpRateLimit: async () => ({ allowed: false, retryAfter: 60 }),
    }));
    const { POST } = await import('../../src/pages/api/mcp.ts');
    const res = await POST({ request: makeMcpRequest() });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    const body = await res.json();
    expect(body.error.message).toMatch(/rate limit/i);
    vi.doUnmock('../../src/lib/mcp-rate-limit.mjs');
  });

  it('passes through when the limiter allows (incl. fail-open null)', async () => {
    vi.doMock('../../src/lib/mcp-rate-limit.mjs', () => ({
      checkMcpRateLimit: async () => null,
    }));
    const { POST } = await import('../../src/pages/api/mcp.ts');
    const res = await POST({ request: makeMcpRequest() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe('jmeter-docs');
    vi.doUnmock('../../src/lib/mcp-rate-limit.mjs');
  });
});
