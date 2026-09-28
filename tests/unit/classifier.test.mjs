import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  classify,
  normalizeErrorText,
  redactSecrets,
  resetClassifierState,
} from '../../src/lib/classifier.mjs';

function okResponse(results, model = 'jev-1.13.0') {
  return {
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => ({ tier: 'fast', model, results }),
  };
}

function labels() {
  return ['SocketTimeoutException: read or connect timed out', 'None of these'];
}

describe('normalizeErrorText', () => {
  it('lowercases, collapses whitespace, and masks digits/hex/UUIDs', () => {
    expect(normalizeErrorText('Read  TIMED out after 30000ms')).toBe('read timed out after #');
    expect(normalizeErrorText('HTTP 500 error')).toBe('http # error');
    expect(normalizeErrorText('user 550e8400-e29b-41d4-a716-446655440000 failed')).toBe(
      'user # failed',
    );
    expect(normalizeErrorText('conn id 0deadbeef1234 refused')).toBe('conn id # refused');
    expect(normalizeErrorText('  ')).toBe('');
  });
});

describe('redactSecrets', () => {
  it('redacts Bearer tokens, password assignments, and JWTs', () => {
    expect(redactSecrets('Authorization: Bearer abc123xyz')).toBe(
      'Authorization: Bearer [redacted]',
    );
    expect(redactSecrets('password=hunter2')).toBe('password=[redacted]');
    expect(redactSecrets('API_KEY: sekret')).toBe('API_KEY: [redacted]');
    expect(redactSecrets('token = tok123')).toBe('token = [redacted]');
    expect(
      redactSecrets('saw eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    ).toBe('saw [jwt]');
    expect(redactSecrets('plain error')).toBe('plain error');
  });
});

describe('classify', () => {
  beforeEach(() => {
    resetClassifierState();
    vi.restoreAllMocks();
  });

  it('maps API results in order', async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse([
        { label: 'SocketTimeoutException: read or connect timed out', confidence: 0.99, scores: {} },
        { label: 'None of these', confidence: 0.8, scores: {} },
      ]),
    );
    const res = await classify(['a', 'b'], labels(), { fetchImpl });
    expect(res.results).toHaveLength(2);
    expect(res.results[0].label).toContain('SocketTimeoutException');
    expect(res.results[1].label).toBe('None of these');
    expect(res.model).toBe('jev-1.13.0');
    expect(res.sent).toBe(2);
    expect(res.cached).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://classifier.dev/v1/classify');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).tier).toBe('fast');
    expect(init.headers.authorization).toBeUndefined();
  });

  it('sends Authorization header only when a key is present', async () => {
    const fetchImpl = vi.fn(async () => okResponse([{ label: 'x', confidence: 1, scores: {} }]));
    await classify(['hello'], labels(), { fetchImpl, apiKey: 'my-key' });
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe('Bearer my-key');
  });

  it('serves cache hits without fetching, normalizing digit differences', async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse([{ label: 'SocketTimeoutException: read or connect timed out', confidence: 0.9, scores: {} }]),
    );
    await classify(['Read timed out after 30000ms'], labels(), { fetchImpl });
    const res = await classify(['Read timed out after 60000ms'], labels(), { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(res.sent).toBe(0);
    expect(res.cached).toBe(1);
    expect(res.results[0].label).toContain('SocketTimeoutException');
  });

  it('returns null on 429 and pauses subsequent calls until Retry-After elapses', async () => {
    let t = 1_000_000;
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: new Map([['retry-after', '120']]),
      json: async () => ({}),
    }));
    const opts = { fetchImpl, now: () => t };
    expect(await classify(['boom'], labels(), opts)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Within the pause window: no fetch at all.
    t += 30_000;
    expect(await classify(['another'], labels(), opts)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns null on timeout (abort) and network errors', async () => {
    const hanging = vi.fn(
      (_url, init) =>
        new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    expect(await classify(['x'], labels(), { fetchImpl: hanging, timeoutMs: 20 })).toBeNull();

    resetClassifierState();
    const failing = vi.fn(async () => {
      throw new Error('network down');
    });
    expect(await classify(['x'], labels(), { fetchImpl: failing })).toBeNull();
  });

  it('returns null on 5xx and malformed JSON bodies', async () => {
    const fiveOh = vi.fn(async () => ({ ok: false, status: 502, headers: new Map() }));
    expect(await classify(['x'], labels(), { fetchImpl: fiveOh })).toBeNull();

    const bad = vi.fn(async () => ({ ok: true, status: 200, headers: new Map(), json: async () => ({ nope: true }) }));
    expect(await classify(['x'], labels(), { fetchImpl: bad })).toBeNull();
  });

  it('chunks fast-tier requests at 1000 inputs', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const n = JSON.parse(init.body).inputs.length;
      return okResponse(Array.from({ length: n }, () => ({ label: 'None of these', confidence: 0.5, scores: {} })));
    });
    const inputs = Array.from({ length: 1001 }, (_, i) => `err ${i}`);
    const res = await classify(inputs, labels(), { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(res.results).toHaveLength(1001);
    expect(res.sent).toBe(1001);
  });
});
