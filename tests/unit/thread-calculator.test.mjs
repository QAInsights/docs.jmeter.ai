import { describe, it, expect } from 'vitest';
import {
  LIMITS,
  clampToRange,
  cycleTimeMs,
  threadsForRps,
  rpsForThreads,
  suggestRampUpSeconds,
  estimateHeapMb,
  formatThreadGroupSettings,
  parseCalculatorParams,
  serializeCalculatorParams,
} from '../../src/lib/thread-calculator.mjs';

describe('threadsForRps', () => {
  it('uses Little-style concurrency rounding up', () => {
    expect(threadsForRps(50, 200)).toBe(10);
    expect(threadsForRps(100, 500)).toBe(50);
    expect(threadsForRps(10, 150)).toBe(2);
  });

  it('returns 0 for invalid input', () => {
    expect(threadsForRps(0, 200)).toBe(0);
    expect(threadsForRps(50, 0)).toBe(0);
  });

  it('caps recommended threads at LIMITS.threads.max', () => {
    expect(threadsForRps(LIMITS.rps.max, LIMITS.responseTimeMs.max)).toBe(LIMITS.threads.max);
  });
});

describe('cycleTimeMs / think time', () => {
  it('adds think time to response time', () => {
    expect(cycleTimeMs(200, 800)).toBe(1000);
    expect(cycleTimeMs(200, 0)).toBe(200);
    expect(cycleTimeMs(200, -10)).toBe(200);
  });

  it('increases recommended threads when think time is set', () => {
    expect(threadsForRps(50, 200)).toBe(10);
    expect(threadsForRps(50, 200, { thinkTimeMs: 800 })).toBe(50);
  });

  it('lowers estimated RPS when think time is set', () => {
    expect(rpsForThreads(10, 200)).toBeCloseTo(50);
    expect(rpsForThreads(10, 200, { thinkTimeMs: 800 })).toBeCloseTo(10);
  });
});

describe('formatThreadGroupSettings', () => {
  it('includes a timer hint when think time is set', () => {
    const text = formatThreadGroupSettings({ threads: 50, rampUpSeconds: 50, thinkTimeMs: 800 });
    expect(text).toContain('Number of Threads (users): 50');
    expect(text).toContain('Ramp-up period (seconds): 50');
    expect(text).toContain('Think time: 800 ms');
    expect(text).toContain('Constant Timer');
  });
});

describe('rpsForThreads', () => {
  it('estimates busy-thread RPS', () => {
    expect(rpsForThreads(10, 200)).toBeCloseTo(50);
  });

  it('caps estimated RPS at LIMITS.rps.max', () => {
    expect(rpsForThreads(LIMITS.threads.max, 1)).toBe(LIMITS.rps.max);
  });
});

describe('suggestRampUpSeconds', () => {
  it('defaults to one second per thread', () => {
    expect(suggestRampUpSeconds(25)).toBe(25);
    expect(suggestRampUpSeconds(10, 0.5)).toBe(5);
  });
});

describe('estimateHeapMb', () => {
  it('returns rounded heap with floor of 512', () => {
    const small = estimateHeapMb(10);
    expect(small.heapMb).toBeGreaterThanOrEqual(512);
    expect(small.heapMb % 128).toBe(0);
  });
});

describe('clampToRange / LIMITS', () => {
  it('clamps above max and below min', () => {
    expect(clampToRange(999999, LIMITS.rps)).toBe(LIMITS.rps.max);
    expect(clampToRange(0.01, LIMITS.rps)).toBe(LIMITS.rps.min);
    expect(clampToRange(999999, LIMITS.threads)).toBe(LIMITS.threads.max);
    expect(clampToRange(0, LIMITS.responseTimeMs, 200)).toBe(LIMITS.responseTimeMs.min);
  });
});

describe('parse/serialize calculator params', () => {
  it('round-trips via URLSearchParams', () => {
    const qs = serializeCalculatorParams({
      mode: 'threads',
      rps: 80,
      threads: 40,
      responseTimeMs: 250,
      rampPerThread: 1.5,
      thinkTimeMs: 400,
    });
    const parsed = parseCalculatorParams(new URLSearchParams(qs));
    expect(parsed.mode).toBe('threads');
    expect(parsed.threads).toBe(40);
    expect(parsed.responseTimeMs).toBe(250);
    expect(parsed.thinkTimeMs).toBe(400);
  });

  it('keeps think time of 0 instead of falling back', () => {
    const parsed = parseCalculatorParams(new URLSearchParams('think=0'));
    expect(parsed.thinkTimeMs).toBe(0);
  });

  it('clamps extreme query params to realistic limits', () => {
    const parsed = parseCalculatorParams(
      new URLSearchParams('mode=rps&rps=9999999&threads=9999999&rt=9999999&ramp=999'),
    );
    expect(parsed.rps).toBe(LIMITS.rps.max);
    expect(parsed.threads).toBe(LIMITS.threads.max);
    expect(parsed.responseTimeMs).toBe(LIMITS.responseTimeMs.max);
    expect(parsed.rampPerThread).toBe(LIMITS.rampPerThread.max);
  });
});
