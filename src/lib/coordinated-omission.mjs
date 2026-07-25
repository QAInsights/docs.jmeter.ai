/**
 * Pure math for the Coordinated Omission calculator.
 *
 * Coordinated Omission occurs when a load generator fails to account for
 * the time spent processing a request when scheduling the next one. When
 * the server degrades, throughput drops below the target, and the "missing"
 * requests are silently dropped - producing artificially low response times
 * and high percentiles.
 *
 * Correction formulas follow Gil Tene's "How NOT to Measure Latency" (2015).
 */

import { COORDINATED_OMISSION } from './tools-config.mjs';
import { clampToRange, readPositiveNumber } from './tools-utils.mjs';

const { limits, defaults } = COORDINATED_OMISSION;

/**
 * Compute the correction factor: how much the intended load exceeds the
 * achieved load. A factor > 1 indicates coordinated omission.
 * @param {number} targetRps
 * @param {number} actualRps
 * @returns {number}
 */
export function correctionFactor(targetRps, actualRps) {
  const t = Number(targetRps);
  const a = Number(actualRps);
  if (!Number.isFinite(t) || !Number.isFinite(a) || a <= 0) return 1;
  return t / a;
}

/**
 * Number of requests that were silently dropped due to coordinated omission.
 * @param {number} targetRps
 * @param {number} actualRps
 * @param {number} durationSeconds
 * @returns {number}
 */
export function lostRequests(targetRps, actualRps, durationSeconds) {
  const t = Number(targetRps);
  const a = Number(actualRps);
  const d = Number(durationSeconds);
  if (!Number.isFinite(t) || !Number.isFinite(a) || !Number.isFinite(d) || d <= 0) return 0;
  return Math.max(0, (t - a) * d);
}

/**
 * Corrected average response time using the queue-depth approach.
 *
 * When the server can't keep up, pending requests queue up. Real users
 * would experience the queue wait plus the service time. We estimate the
 * queue depth as (target - actual) * response_time, then add the
 * cumulative wait to the measured response time.
 *
 * @param {number} actualRps
 * @param {number} targetRps
 * @param {number} avgResponseTimeMs
 * @returns {number} corrected response time in ms
 */
export function correctedResponseTime(actualRps, targetRps, avgResponseTimeMs) {
  const a = Number(actualRps);
  const t = Number(targetRps);
  const rt = Number(avgResponseTimeMs);
  if (!Number.isFinite(a) || !Number.isFinite(t) || !Number.isFinite(rt) || rt <= 0) return 0;
  if (t <= a) return rt;

  // Queue depth: how many requests were "in flight" but not started
  const queueDepth = (t - a) * (rt / 1000);
  // Each queued request adds roughly the service time as wait
  const correction = queueDepth * rt;
  return Math.round(rt + correction);
}

/**
 * Threads needed to sustain target RPS at a given response time
 * (Little's Law: concurrency = arrival_rate × service_time).
 * @param {number} targetRps
 * @param {number} avgResponseTimeMs
 * @returns {number}
 */
export function neededThreads(targetRps, avgResponseTimeMs) {
  const t = Number(targetRps);
  const rt = Number(avgResponseTimeMs);
  if (!Number.isFinite(t) || !Number.isFinite(rt) || t <= 0 || rt <= 0) return 0;
  return Math.max(1, Math.ceil(t * (rt / 1000)));
}

/**
 * Classify the severity of coordinated omission.
 * @param {number} targetRps
 * @param {number} actualRps
 * @returns {'none'|'low'|'moderate'|'severe'}
 */
export function overloadSeverity(targetRps, actualRps) {
  const t = Number(targetRps);
  const a = Number(actualRps);
  if (!Number.isFinite(t) || !Number.isFinite(a) || t <= 0 || a <= 0) return 'none';
  const ratio = t / a;
  if (ratio <= 1.05) return 'none';
  if (ratio <= 1.25) return 'low';
  if (ratio <= 2) return 'moderate';
  return 'severe';
}

/**
 * Run the full coordinated omission analysis.
 * @param {{ targetRps: number, actualRps: number, avgResponseTimeMs: number, durationSeconds: number }} input
 * @returns {{ correctionFactor: number, lostRequests: number, correctedResponseTimeMs: number, neededThreads: number, severity: string, actualThroughput: number }}
 */
export function analyzeCoordinatedOmission(input) {
  const targetRps = clampToRange(input.targetRps, limits.targetRps, defaults.targetRps);
  const actualRps = clampToRange(input.actualRps, limits.actualRps, defaults.actualRps);
  const avgResponseTimeMs = clampToRange(input.avgResponseTimeMs, limits.avgResponseTimeMs, defaults.avgResponseTimeMs);
  const durationSeconds = clampToRange(input.durationSeconds, limits.durationSeconds, defaults.durationSeconds);

  const factor = correctionFactor(targetRps, actualRps);
  const lost = lostRequests(targetRps, actualRps, durationSeconds);
  const corrected = correctedResponseTime(actualRps, targetRps, avgResponseTimeMs);
  const threads = neededThreads(targetRps, avgResponseTimeMs);
  const severity = overloadSeverity(targetRps, actualRps);

  return {
    correctionFactor: factor,
    lostRequests: lost,
    correctedResponseTimeMs: corrected,
    neededThreads: threads,
    severity,
    actualThroughput: actualRps,
    targetThroughput: targetRps,
    avgResponseTimeMs,
    durationSeconds,
  };
}

/**
 * @param {URLSearchParams | Record<string, string>} params
 */
export function parseCoordinatedOmissionParams(params, config = COORDINATED_OMISSION) {
  const lim = config.limits;
  const def = config.defaults;
  return {
    targetRps: readPositiveNumber(params, 'target', def.targetRps),
    actualRps: readPositiveNumber(params, 'actual', def.actualRps),
    avgResponseTimeMs: readPositiveNumber(params, 'rt', def.avgResponseTimeMs),
    durationSeconds: readPositiveNumber(params, 'dur', def.durationSeconds),
  };
}

/**
 * @param {{ targetRps: number, actualRps: number, avgResponseTimeMs: number, durationSeconds: number }} state
 */
export function serializeCoordinatedOmissionParams(state, config = COORDINATED_OMISSION) {
  const lim = config.limits;
  const def = config.defaults;
  const p = new URLSearchParams();
  p.set('target', String(clampToRange(state.targetRps, lim.targetRps, def.targetRps)));
  p.set('actual', String(clampToRange(state.actualRps, lim.actualRps, def.actualRps)));
  p.set('rt', String(Math.round(clampToRange(state.avgResponseTimeMs, lim.avgResponseTimeMs, def.avgResponseTimeMs))));
  p.set('dur', String(Math.round(clampToRange(state.durationSeconds, lim.durationSeconds, def.durationSeconds))));
  return p.toString();
}
