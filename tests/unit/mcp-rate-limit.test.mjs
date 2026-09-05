import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkMcpRateLimit,
  MCP_RETRY_AFTER_SECONDS,
} from '../../src/lib/mcp-rate-limit.mjs';

function makeFakeLimiter(success = true) {
  return {
    keys: [],
    async limit({ key }) {
      this.keys.push(key);
      return { success };
    },
  };
}

describe('checkMcpRateLimit', () => {
  let limiter;
  beforeEach(() => {
    limiter = makeFakeLimiter();
  });

  it('maps an allowed binding result', async () => {
    expect(await checkMcpRateLimit('203.0.113.7', limiter)).toEqual({ allowed: true });
    expect(limiter.keys).toEqual(['mcp:203.0.113.7']);
  });

  it('maps a denied binding result to the production retry policy', async () => {
    const deniedLimiter = makeFakeLimiter(false);
    expect(await checkMcpRateLimit('203.0.113.7', deniedLimiter)).toEqual({
      allowed: false,
      retryAfter: MCP_RETRY_AFTER_SECONDS,
    });
    expect(deniedLimiter.keys).toEqual(['mcp:203.0.113.7']);
  });

  it('fails open when the binding throws', async () => {
    const brokenLimiter = {
      async limit() { throw new Error('binding unavailable'); },
    };
    expect(await checkMcpRateLimit('203.0.113.7', brokenLimiter)).toEqual({ allowed: true });
  });

  it('sanitizes hostile IPs in the binding key', async () => {
    await checkMcpRateLimit('1.2.3.4"; DROP TABLE--', limiter);
    expect(limiter.keys[0]).toMatch(/^mcp:[a-zA-Z0-9.:_-]+$/);
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
  }, 15000);

  it('passes through when the limiter allows, including fail-open results', async () => {
    vi.doMock('../../src/lib/mcp-rate-limit.mjs', () => ({
      checkMcpRateLimit: async () => ({ allowed: true }),
    }));
    const { POST } = await import('../../src/pages/api/mcp.ts');
    const res = await POST({ request: makeMcpRequest() });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe('jmeter-docs');
    vi.doUnmock('../../src/lib/mcp-rate-limit.mjs');
  }, 15000);

  it('applies the same limiter to GET requests', async () => {
    vi.doMock('../../src/lib/mcp-rate-limit.mjs', () => ({
      checkMcpRateLimit: async () => ({ allowed: false, retryAfter: 60 }),
    }));
    const { GET } = await import('../../src/pages/api/mcp.ts');
    const request = new Request('https://docs.jmeter.ai/api/mcp', {
      headers: { Accept: 'text/event-stream' },
    });
    const res = await GET({ request });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    vi.doUnmock('../../src/lib/mcp-rate-limit.mjs');
  }, 15000);
});
