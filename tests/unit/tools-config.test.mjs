import { describe, it, expect } from 'vitest';
import {
  EMPTY_VALUE,
  THREAD_CALCULATOR,
  HEAP_ESTIMATOR,
  REGEX_EXTRACTOR,
  buildDynamicKeyRegex,
} from '../../src/lib/tools-config.mjs';
import {
  clampToRange,
  formatBytes,
  utf8ByteLength,
  readClampedNumber,
  escapeRegExp,
} from '../../src/lib/tools-utils.mjs';
import { analyzeResponseBody, validateBody } from '../../src/lib/regex-extractor-builder.mjs';

describe('tools-config', () => {
  it('exposes empty placeholder without em dash', () => {
    expect(EMPTY_VALUE).toBe('-');
    expect(EMPTY_VALUE).not.toMatch(/[—–]/);
  });

  it('has realistic thread calculator limits', () => {
    expect(THREAD_CALCULATOR.limits.rps.max).toBe(100_000);
    expect(THREAD_CALCULATOR.limits.threads.max).toBe(50_000);
    expect(THREAD_CALCULATOR.limits.responseTimeMs.max).toBe(120_000);
    expect(THREAD_CALCULATOR.limits.rampPerThread.max).toBe(60);
  });

  it('configures regex extractor at 1 MB', () => {
    expect(REGEX_EXTRACTOR.maxBodyBytes).toBe(1 * 1024 * 1024);
    expect(REGEX_EXTRACTOR.maxBodyLabel).toBe('1 MB');
  });

  it('builds dynamic key regex from configurable names', () => {
    const re = buildDynamicKeyRegex(['csrf_token', 'access_token']);
    expect(re.test('csrf_token')).toBe(true);
    expect(re.test('ACCESS_TOKEN')).toBe(true);
    expect(re.test('unrelated')).toBe(false);
  });
});

describe('tools-utils', () => {
  it('clamps and formats sizes', () => {
    expect(clampToRange(999, { min: 1, max: 10 })).toBe(10);
    expect(formatBytes(500)).toBe('500 B');
    expect(utf8ByteLength('abc')).toBe(3);
  });

  it('reads clamped numbers from URLSearchParams', () => {
    const p = new URLSearchParams('rps=999999');
    expect(readClampedNumber(p, 'rps', THREAD_CALCULATOR.limits.rps, 50)).toBe(
      THREAD_CALCULATOR.limits.rps.max,
    );
  });

  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('a.b')).toBe('a\\.b');
  });
});

describe('regex extractor config overrides', () => {
  it('respects custom maxBodyBytes', () => {
    const result = validateBody('x'.repeat(100), { maxBodyBytes: 10, maxBodyLabel: '10 B' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/10 B/);
  });

  it('analyzes sample body with defaults', () => {
    const sample = '{"csrf":"abc12345tokenvalue","status":"ok"}';
    const result = analyzeResponseBody(sample);
    expect(result.ok).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);
  });
});

describe('heap config', () => {
  it('exposes engine and heap caps', () => {
    expect(HEAP_ESTIMATOR.limits.engines.max).toBe(500);
    expect(HEAP_ESTIMATOR.limits.heapMb.max).toBe(16_384);
  });
});
