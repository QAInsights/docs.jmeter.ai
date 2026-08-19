/**
 * Pure math for the JMeter Thread / RPS calculator.
 * Little's Law style sizing: concurrency ≈ arrival_rate × service_time.
 */

import { THREAD_CALCULATOR } from './tools-config.mjs';
import { clampToRange, readClampedNumber, readNonNegativeClampedNumber } from './tools-utils.mjs';

/** @deprecated Prefer THREAD_CALCULATOR.limits; kept for existing imports/tests. */
export const LIMITS = THREAD_CALCULATOR.limits;

export { clampToRange };

const { limits, defaults } = THREAD_CALCULATOR;

/**
 * Cycle time for Little's Law: response time plus optional think time.
 * @param {number} responseTimeMs
 * @param {number} [thinkTimeMs=0]
 * @returns {number}
 */
export function cycleTimeMs(responseTimeMs, thinkTimeMs = 0) {
  const rt = Number(responseTimeMs);
  if (!Number.isFinite(rt) || rt <= 0) return 0;
  const think = Number(thinkTimeMs);
  const pause = Number.isFinite(think) && think > 0 ? think : 0;
  return rt + pause;
}

/**
 * @param {number} rps
 * @param {number} responseTimeMs
 * @param {{ maxThreads?: number, thinkTimeMs?: number }} [opts]
 * @returns {number}
 */
export function threadsForRps(rps, responseTimeMs, opts = {}) {
  const r = Number(rps);
  const cycleMs = cycleTimeMs(responseTimeMs, opts.thinkTimeMs);
  if (!Number.isFinite(r) || r <= 0 || cycleMs <= 0) return 0;
  const maxThreads = opts.maxThreads ?? limits.threads.max;
  const threads = Math.max(1, Math.ceil(r * (cycleMs / 1000)));
  return Math.min(threads, maxThreads);
}

/**
 * @param {number} threads
 * @param {number} responseTimeMs
 * @param {{ maxRps?: number, thinkTimeMs?: number }} [opts]
 * @returns {number}
 */
export function rpsForThreads(threads, responseTimeMs, opts = {}) {
  const t = Number(threads);
  const cycleMs = cycleTimeMs(responseTimeMs, opts.thinkTimeMs);
  if (!Number.isFinite(t) || t <= 0 || cycleMs <= 0) return 0;
  const maxRps = opts.maxRps ?? limits.rps.max;
  return Math.min(t / (cycleMs / 1000), maxRps);
}

/**
 * Copy-ready Thread Group fields (plus a timer hint when think time is set).
 * @param {{ threads: number, rampUpSeconds: number, thinkTimeMs?: number }} state
 * @returns {string}
 */
export function formatThreadGroupSettings(state) {
  const threads = Math.max(0, Math.round(Number(state.threads) || 0));
  const ramp = Math.max(0, Math.round(Number(state.rampUpSeconds) || 0));
  const think = Math.max(0, Math.round(Number(state.thinkTimeMs) || 0));
  const lines = [
    `Number of Threads (users): ${threads}`,
    `Ramp-up period (seconds): ${ramp}`,
  ];
  if (think > 0) {
    lines.push(`Think time: ${think} ms (add a Constant Timer after each sampler)`);
  } else {
    lines.push('Think time: 0 ms (busy threads)');
  }
  return lines.join('\n');
}

/**
 * @param {number} threads
 * @param {number} [secondsPerThread=1]
 * @returns {number}
 */
export function suggestRampUpSeconds(threads, secondsPerThread = 1) {
  const t = Number(threads);
  const s = Number(secondsPerThread);
  if (!Number.isFinite(t) || t <= 0) return 0;
  const per = Number.isFinite(s) && s > 0 ? s : 1;
  const total = Math.max(1, Math.round(t * per));
  return Math.min(total, limits.threads.max * limits.rampPerThread.max);
}

/**
 * @param {number} threads
 * @param {{ withViewResultsTree?: boolean }} [opts]
 * @returns {{ heapMb: number, note: string }}
 */
export function estimateHeapMb(threads, opts = {}) {
  const t = Math.max(0, Math.min(Number(threads) || 0, limits.threads.max));
  let heap = 512 + t * 1.0;
  if (opts.withViewResultsTree) {
    heap += 512 + t * 0.5;
  }
  heap = Math.ceil(heap / 128) * 128;
  heap = Math.max(512, Math.min(heap, 16384));
  const note = opts.withViewResultsTree
    ? 'Includes headroom for View Results Tree (not recommended for load runs).'
    : 'Assumes CLI mode with minimal listeners. Measure with -Xlog:gc* in production.';
  return { heapMb: heap, note };
}

/**
 * @param {URLSearchParams | Record<string, string>} params
 * @param {typeof THREAD_CALCULATOR} [config]
 */
export function parseCalculatorParams(params, config = THREAD_CALCULATOR) {
  const lim = config.limits;
  const def = config.defaults;
  const modeRaw =
    typeof params.get === 'function'
      ? params.get('mode')
      : /** @type {Record<string, string>} */ (params).mode;
  return {
    mode: modeRaw === 'threads' ? 'threads' : 'rps',
    rps: readClampedNumber(params, 'rps', lim.rps, def.rps),
    threads: readClampedNumber(params, 'threads', lim.threads, def.threads),
    responseTimeMs: readClampedNumber(params, 'rt', lim.responseTimeMs, def.responseTimeMs),
    rampPerThread: readClampedNumber(params, 'ramp', lim.rampPerThread, def.rampPerThread),
    thinkTimeMs: readNonNegativeClampedNumber(
      params,
      'think',
      lim.thinkTimeMs,
      def.thinkTimeMs,
    ),
  };
}

/**
 * @param {{
 *   mode: string,
 *   rps: number,
 *   threads: number,
 *   responseTimeMs: number,
 *   rampPerThread: number,
 *   thinkTimeMs?: number,
 * }} state
 * @param {typeof THREAD_CALCULATOR} [config]
 */
export function serializeCalculatorParams(state, config = THREAD_CALCULATOR) {
  const lim = config.limits;
  const def = config.defaults;
  const p = new URLSearchParams();
  p.set('mode', state.mode === 'threads' ? 'threads' : 'rps');
  p.set('rps', String(Math.round(clampToRange(state.rps, lim.rps, def.rps))));
  p.set('threads', String(Math.round(clampToRange(state.threads, lim.threads, def.threads))));
  p.set(
    'rt',
    String(Math.round(clampToRange(state.responseTimeMs, lim.responseTimeMs, def.responseTimeMs))),
  );
  p.set(
    'ramp',
    String(Number(clampToRange(state.rampPerThread, lim.rampPerThread, def.rampPerThread).toFixed(2))),
  );
  p.set(
    'think',
    String(Math.round(clampToRange(state.thinkTimeMs ?? 0, lim.thinkTimeMs, def.thinkTimeMs))),
  );
  return p.toString();
}
