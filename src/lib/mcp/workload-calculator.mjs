/**
 * Workload Modeling and Little's Law Sizing Calculator.
 *
 * Computes exact thread concurrency, pacing delays, ramp-up schedules,
 * and JVM heap recommendations based on target throughput and latency SLAs.
 */

/**
 * @typedef {{
 *   targetRps: number,
 *   avgResponseTimeMs: number,
 *   thinkTimeMs?: number,
 *   testDurationMinutes?: number,
 *   safetyFactor?: number
 * }} WorkloadInput
 */

/**
 * Calculate full workload model from SLA targets.
 * @param {WorkloadInput} input
 */
export function calculateWorkloadModel(input) {
  const targetRps = Number(input.targetRps) || 0;
  const avgResponseTimeMs = Number(input.avgResponseTimeMs) || 0;
  const thinkTimeMs = Number(input.thinkTimeMs) || 0;
  const testDurationMinutes = Number(input.testDurationMinutes) || 10;
  const safetyFactor = Math.max(1.0, Number(input.safetyFactor) || 1.25);

  if (targetRps <= 0 || avgResponseTimeMs <= 0) {
    throw new Error('targetRps and avgResponseTimeMs must be greater than 0.');
  }

  const responseTimeSec = avgResponseTimeMs / 1000;
  const thinkTimeSec = thinkTimeMs / 1000;
  const totalIterationTimeSec = responseTimeSec + thinkTimeSec;

  // Little's Law: N = Throughput * Total Latency
  const theoreticalThreads = targetRps * totalIterationTimeSec;
  const recommendedThreads = Math.max(1, Math.ceil(theoreticalThreads * safetyFactor));

  // Pacing interval per iteration across the thread pool
  const pacingSec = recommendedThreads / targetRps;
  const pacingMs = Math.round(pacingSec * 1000);

  // Ramp-up calculation: proportional ramp-up (at least 2s per thread for small tests, up to 600s max)
  const rampUpSec =
    recommendedThreads <= 10
      ? Math.max(1, recommendedThreads * 2)
      : Math.max(15, Math.min(600, Math.round(recommendedThreads * 1.5)));

  // JVM Heap Sizing Estimate
  // Base 512MB + ~2MB per active thread for buffers/stacks, rounded to nearest 512MB
  const estimatedMemoryMb = 512 + recommendedThreads * 2.5;
  const recommendedHeapMb = Math.max(1024, Math.ceil(estimatedMemoryMb / 512) * 512);

  // Total samples expected in steady state run
  const steadyStateSec = testDurationMinutes * 60;
  const totalEstimatedSamples = Math.round(targetRps * steadyStateSec);

  return {
    summary: {
      targetRps,
      avgResponseTimeMs,
      thinkTimeMs,
      theoreticalMinThreads: Number(theoreticalThreads.toFixed(2)),
      recommendedThreads,
      safetyHeadroomPercent: Math.round((safetyFactor - 1) * 100),
      pacingIntervalMs: pacingMs,
      recommendedRampUpSeconds: rampUpSec,
      estimatedHeapMb: recommendedHeapMb,
      totalEstimatedSamples,
    },
    jmeterConfig: {
      threadGroup: {
        numThreads: recommendedThreads,
        rampTime: rampUpSec,
        sameUserOnNextIteration: true,
        durationSeconds: steadyStateSec + rampUpSec,
      },
      constantThroughputTimer: {
        targetThroughputPerMin: Math.round(targetRps * 60),
        calcMode: 'all active threads in all thread groups (shared)',
      },
      jvmFlags: `-Xms${recommendedHeapMb}m -Xmx${recommendedHeapMb}m -XX:+UseG1GC -XX:MaxGCPauseMillis=200`,
    },
    littlesLawExplanation: `Little's Law: Concurrency (N) = Throughput (RPS) × Total Response Time (${targetRps} req/s × ${(totalIterationTimeSec).toFixed(3)}s = ${theoreticalThreads.toFixed(2)} threads). With a ${Math.round((safetyFactor - 1) * 100)}% safety buffer to absorb latency spikes: ${recommendedThreads} threads.`,
  };
}
