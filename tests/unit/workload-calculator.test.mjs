import { describe, it, expect } from 'vitest';
import { calculateWorkloadModel } from '../../src/lib/mcp/workload-calculator.mjs';

describe('workload-calculator', () => {
  it('computes Little\'s Law concurrency correctly', () => {
    // 500 RPS, 200ms latency -> 500 * 0.2 = 100 threads baseline. With 1.25 buffer -> 125 threads.
    const res = calculateWorkloadModel({
      targetRps: 500,
      avgResponseTimeMs: 200,
      safetyFactor: 1.25,
    });

    expect(res.summary.targetRps).toBe(500);
    expect(res.summary.theoreticalMinThreads).toBe(100);
    expect(res.summary.recommendedThreads).toBe(125);
    expect(res.jmeterConfig.constantThroughputTimer.targetThroughputPerMin).toBe(30000);
    expect(res.jmeterConfig.jvmFlags).toContain('-XX:+UseG1GC');
  });

  it('incorporates think time into Little\'s Law calculation', () => {
    // 100 RPS, 500ms latency + 500ms think time = 1000ms iteration. 100 * 1s = 100 threads.
    const res = calculateWorkloadModel({
      targetRps: 100,
      avgResponseTimeMs: 500,
      thinkTimeMs: 500,
      safetyFactor: 1.0,
    });

    expect(res.summary.theoreticalMinThreads).toBe(100);
    expect(res.summary.recommendedThreads).toBe(100);
  });

  it('scales ramp-up time smoothly for small thread counts', () => {
    const res = calculateWorkloadModel({
      targetRps: 1,
      avgResponseTimeMs: 1000,
      safetyFactor: 1.0,
    });
    expect(res.summary.recommendedThreads).toBe(1);
    expect(res.summary.recommendedRampUpSeconds).toBe(2);
  });

  it('validates required positive arguments', () => {
    expect(() => calculateWorkloadModel({ targetRps: 0, avgResponseTimeMs: 100 })).toThrow();
    expect(() => calculateWorkloadModel({ targetRps: 100, avgResponseTimeMs: 0 })).toThrow();
  });
});

