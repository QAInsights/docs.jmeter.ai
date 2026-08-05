import { describe, it, expect } from 'vitest';
import {
  validateSharePayload,
  generateShareId,
  checkShareRateLimit,
  SHARE_RATE_MAX,
  SHARE_RATE_WINDOW_SECONDS,
  MAX_SHARED_MESSAGES,
  MAX_SHARED_MESSAGE_CHARS,
} from '../../src/lib/share-store.mjs';

describe('validateSharePayload', () => {
  const validThread = [
    { role: 'user', content: 'How do I size threads?' },
    { role: 'assistant', content: 'Use Little\'s law: threads = RPS x response time.' },
  ];

  it('accepts a valid conversation', () => {
    const result = validateSharePayload(validThread);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.messages).toHaveLength(2);
  });

  it('rejects empty or non-array payloads', () => {
    expect(validateSharePayload([]).ok).toBe(false);
    expect(validateSharePayload(null).ok).toBe(false);
    expect(validateSharePayload({ messages: [] }).ok).toBe(false);
    expect(validateSharePayload('not an array').ok).toBe(false);
  });

  it('rejects threads with no assistant answer', () => {
    const result = validateSharePayload([{ role: 'user', content: 'hello?' }]);
    expect(result.ok).toBe(false);
  });

  it('rejects invalid roles and empty content', () => {
    expect(
      validateSharePayload([
        { role: 'system', content: 'x' },
        { role: 'assistant', content: 'y' },
      ]).ok,
    ).toBe(false);
    expect(
      validateSharePayload([
        { role: 'user', content: '   ' },
        { role: 'assistant', content: 'y' },
      ]).ok,
    ).toBe(false);
  });

  it('rejects oversized threads and messages', () => {
    const tooMany = Array.from({ length: MAX_SHARED_MESSAGES + 1 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }));
    expect(validateSharePayload(tooMany).ok).toBe(false);

    const tooLong = [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a'.repeat(MAX_SHARED_MESSAGE_CHARS + 1) },
    ];
    expect(validateSharePayload(tooLong).ok).toBe(false);
  });

  it('strips extra fields from messages', () => {
    const result = validateSharePayload([
      { role: 'user', content: 'q', id: 'x', injected: true },
      { role: 'assistant', content: 'a', sources: [] },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.messages[0])).toEqual(['role', 'content']);
      expect(Object.keys(result.messages[1])).toEqual(['role', 'content']);
    }
  });
});

describe('generateShareId', () => {
  it('returns URL-safe 10-char ids', () => {
    for (let i = 0; i < 50; i++) {
      const id = generateShareId();
      expect(id).toMatch(/^[A-Za-z2-9]{10}$/);
    }
  });

  it('does not repeat ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateShareId()));
    expect(ids.size).toBe(500);
  });

  it('spreads ids across the alphabet (rejection sampling, not modulo bias)', () => {
    // With an unbiased generator, drawing 10 chars x 2000 ids should touch
    // most of the 57-char alphabet. A heavily biased generator would leave
    // large gaps. This is a loose sanity check, not a statistical proof.
    const seen = new Set();
    for (let i = 0; i < 2000; i++) {
      for (const ch of generateShareId()) seen.add(ch);
    }
    expect(seen.size).toBeGreaterThan(50);
  });
});

describe('checkShareRateLimit', () => {
  function fakeRedis() {
    const store = new Map();
    return {
      store,
      async incr(key) {
        const next = (store.get(key) ?? 0) + 1;
        store.set(key, next);
        return next;
      },
      async expire(key, seconds) {
        store.set(`ttl:${key}`, seconds);
        return 1;
      },
    };
  }

  it('allows up to the cap, then blocks', async () => {
    const redis = fakeRedis();
    for (let i = 0; i < SHARE_RATE_MAX; i++) {
      expect(await checkShareRateLimit('1.2.3.4', redis)).toEqual({ allowed: true });
    }
    expect(await checkShareRateLimit('1.2.3.4', redis)).toEqual({ allowed: false });
  });

  it('sets the window TTL on the first hit only', async () => {
    const redis = fakeRedis();
    await checkShareRateLimit('1.2.3.4', redis);
    expect(redis.store.get('ttl:share:rate:1.2.3.4')).toBe(SHARE_RATE_WINDOW_SECONDS);
  });

  it('sanitizes unusual ip strings into the key', async () => {
    const redis = fakeRedis();
    await checkShareRateLimit('weird ip/../with spaces', redis);
    expect([...redis.store.keys()].some((k) => k.startsWith('share:rate:') && !k.includes(' '))).toBe(true);
  });

  it('returns null when there is no client', async () => {
    expect(await checkShareRateLimit('1.2.3.4', null)).toBeNull();
  });

  it('returns null when the client throws', async () => {
    const broken = {
      async incr() {
        throw new Error('down');
      },
      async expire() {
        return 1;
      },
    };
    expect(await checkShareRateLimit('1.2.3.4', broken)).toBeNull();
  });
});
