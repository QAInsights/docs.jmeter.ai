/**
 * Rough JVM heap sizing for JMeter injectors.
 * Heuristic only; always validate with GC logs under real load.
 */

import { HEAP_ESTIMATOR } from './tools-config.mjs';
import { clampToRange, readBoolFlag, readClampedNumber } from './tools-utils.mjs';

/**
 * @param {{
 *   threads: number,
 *   engines?: number,
 *   scripting?: boolean,
 *   heavyListeners?: boolean,
 *   largeResponses?: boolean,
 * }} opts
 * @param {typeof HEAP_ESTIMATOR} [config]
 */
export function estimateInjectorHeap(opts, config = HEAP_ESTIMATOR) {
  const lim = config.limits;
  const rawThreads = Number(opts.threads) || 0;
  const threads =
    rawThreads <= 0 ? 0 : clampToRange(rawThreads, lim.threads, lim.threads.min);
  const engines = Math.max(1, Math.floor(Number(opts.engines) || 1));
  const cappedEngines = Math.min(engines, lim.engines.max);
  const perEngineThreads =
    threads <= 0 ? 0 : Math.max(1, Math.ceil(threads / cappedEngines));

  let heap = config.baseHeapMb;
  const perThread = opts.scripting ? config.mbPerThread.scripting : config.mbPerThread.base;
  heap += perEngineThreads * perThread;
  if (opts.heavyListeners) heap += 768 + perEngineThreads * 0.75;
  if (opts.largeResponses) heap += 256 + perEngineThreads * 0.25;

  const step = config.heapStepMb;
  heap = Math.ceil(heap / step) * step;
  heap = clampToRange(heap, lim.heapMb, lim.heapMb.min);

  const xmsMb = Math.min(heap, Math.max(256, Math.round(heap / 2 / step) * step));
  const notes = [
    `Split ${threads || 0} total threads across ${cappedEngines} engine(s) (~${perEngineThreads} threads/engine).`,
    'Prefer CLI mode (-n) and disable View Results Tree / Table during load.',
    'Set the same -Xmx on every engine; controllers need less heap than injectors.',
  ];
  if (opts.scripting) {
    notes.push('JSR223/Groovy with compiled-cache still allocates; keep scripts lean.');
  }
  if (opts.heavyListeners) {
    notes.push('Heavy listeners inflate memory; use Backend Listener or simple data writer instead.');
  }
  if (opts.largeResponses) {
    notes.push('Large bodies: save only needed fields or use smart response saving.');
  }

  return {
    heapMb: heap,
    xmsMb,
    xmxFlag: `-Xms${xmsMb}m -Xmx${heap}m`,
    perEngineThreads,
    notes,
  };
}

/**
 * @param {URLSearchParams | Record<string, string>} params
 * @param {typeof HEAP_ESTIMATOR} [config]
 */
export function parseHeapParams(params, config = HEAP_ESTIMATOR) {
  const lim = config.limits;
  const def = config.defaults;
  return {
    threads: readClampedNumber(params, 'threads', lim.threads, def.threads),
    engines: readClampedNumber(params, 'engines', lim.engines, def.engines),
    scripting: readBoolFlag(params, 'scripting'),
    heavyListeners: readBoolFlag(params, 'listeners'),
    largeResponses: readBoolFlag(params, 'large'),
  };
}

/**
 * @param {ReturnType<typeof parseHeapParams>} state
 */
export function serializeHeapParams(state) {
  const p = new URLSearchParams();
  p.set('threads', String(Math.round(state.threads)));
  p.set('engines', String(Math.round(state.engines)));
  if (state.scripting) p.set('scripting', '1');
  if (state.heavyListeners) p.set('listeners', '1');
  if (state.largeResponses) p.set('large', '1');
  return p.toString();
}
