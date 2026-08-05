import { describe, it, expect } from 'vitest';
import {
  validateSharePayload,
  generateShareId,
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
});
