import { describe, it, expect } from 'vitest';
import {
  estimateInjectorHeap,
  parseHeapParams,
  serializeHeapParams,
} from '../../src/lib/heap-estimator.mjs';

describe('estimateInjectorHeap', () => {
  it('scales with threads and engines', () => {
    const one = estimateInjectorHeap({ threads: 100, engines: 1 });
    const two = estimateInjectorHeap({ threads: 100, engines: 2 });
    expect(one.perEngineThreads).toBe(100);
    expect(two.perEngineThreads).toBe(50);
    expect(two.heapMb).toBeLessThanOrEqual(one.heapMb);
    expect(one.xmxFlag).toMatch(/-Xmx\d+m/);
  });

  it('increases heap for heavy listeners', () => {
    const base = estimateInjectorHeap({ threads: 200, engines: 1 });
    const heavy = estimateInjectorHeap({ threads: 200, engines: 1, heavyListeners: true });
    expect(heavy.heapMb).toBeGreaterThan(base.heapMb);
  });
});

describe('heap params', () => {
  it('round-trips', () => {
    const qs = serializeHeapParams({
      threads: 250,
      engines: 3,
      scripting: true,
      heavyListeners: false,
      largeResponses: true,
    });
    const parsed = parseHeapParams(new URLSearchParams(qs));
    expect(parsed.threads).toBe(250);
    expect(parsed.engines).toBe(3);
    expect(parsed.scripting).toBe(true);
    expect(parsed.largeResponses).toBe(true);
  });
});
