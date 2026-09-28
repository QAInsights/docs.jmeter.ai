/**
 * Shared zero-shot classifier client for classifier.dev (Jev).
 *
 * Used by the MCP tools for semantic error-playbook matching and batch
 * triage. Keyless calls use the anonymous fast tier; callers can supply
 * their own key (per-call arg > CLASSIFIER_API_KEY env > anonymous).
 *
 * Failure policy: never throw. Rate limiting (429 + Retry-After) pauses
 * subsequent calls via a module-level `pausedUntil`; 5xx, timeouts, and
 * network errors all return null so callers can degrade to keyword-only
 * behaviour.
 */

export const CLASSIFIER_BASE_URL_DEFAULT = 'https://classifier.dev';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5000;
const INPUT_MAX_CHARS = 2000;
const BODY_MAX_BYTES = 900 * 1024;
const RETRY_AFTER_DEFAULT_S = 60;
const RETRY_AFTER_MAX_S = 15 * 60;

/** @type {Map<string, { result: unknown, expiresAt: number }>} */
const cache = new Map();
let pausedUntil = 0;

/**
 * Normalize error text so cosmetic differences (digits, hex ids, UUIDs,
 * timestamps, ports) share a cache entry.
 * @param {string} text
 */
export function normalizeErrorText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '#')
    .replace(/\b[0-9a-f]{8,}\b/g, '#')
    .replace(/\b\d+[a-z]*\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Redact obvious secrets before error text leaves the server: Bearer
 * headers, password/token/api_key style assignments, and JWTs.
 * @param {string} text
 */
export function redactSecrets(text) {
  return String(text || '')
    .replace(/(authorization\s*:\s*bearer)\s+\S+/gi, '$1 [redacted]')
    .replace(/(password|passwd|pwd|token|api_key|apikey)(\s*[=:]\s*)\S+/gi, '$1$2[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]');
}

async function sha1Hex(text) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function cacheGet(key, now) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }
  return entry.result;
}

function cacheSet(key, result, now) {
  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(key)) {
    // Map iterates in insertion order, so the first key is the oldest.
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { result, expiresAt: now + CACHE_TTL_MS });
}

function logMetric(fields) {
  console.log(JSON.stringify({ event: 'classifier', ...fields }));
}

function env(name) {
  return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

/** Split inputs into request chunks capped by count and serialized size. */
function chunkInputs(inputs, maxPerRequest) {
  const chunks = [];
  let current = [];
  for (const input of inputs) {
    current.push(input);
    const oversized =
      current.length > 1 &&
      JSON.stringify(current).length > BODY_MAX_BYTES;
    if (current.length >= maxPerRequest || oversized) {
      if (oversized) {
        chunks.push(current.slice(0, -1));
        current = [input];
      } else {
        chunks.push(current);
        current = [];
      }
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function parseRetryAfterMs(header, now) {
  if (!header) return RETRY_AFTER_DEFAULT_S * 1000;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(seconds, 1), RETRY_AFTER_MAX_S) * 1000;
  }
  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    return Math.min(Math.max(date - now, 1000), RETRY_AFTER_MAX_S * 1000);
  }
  return RETRY_AFTER_DEFAULT_S * 1000;
}

/**
 * Classify inputs against labels via POST {base}/v1/classify.
 *
 * @param {string[]} inputs
 * @param {string[]} labels
 * @param {object} [opts]
 * @param {string} [opts.instructions]
 * @param {'fast'|'smart'} [opts.tier='fast']
 * @param {number} [opts.timeoutMs=4000]
 * @param {string} [opts.apiKey]
 * @param {Function} [opts.fetchImpl=globalThis.fetch]
 * @param {Function} [opts.now=Date.now]
 * @param {string} [opts.cacheKeySuffix=''] e.g. the label-set version
 * @returns {Promise<{
 *   results: Array<{label: string, confidence: number|null, scores: Record<string,number>|null}>,
 *   model: string|null, cached: number, sent: number
 * } | null>} null when the classifier is unavailable
 */
export async function classify(inputs, labels, opts = {}) {
  const {
    instructions,
    tier = 'fast',
    timeoutMs = 4000,
    apiKey,
    fetchImpl = globalThis.fetch,
    now = Date.now,
    cacheKeySuffix = '',
  } = opts;

  const nInputs = inputs.length;
  if (nInputs === 0) {
    return { results: [], model: null, cached: 0, sent: 0 };
  }

  // Cache lookup; misses are sent in position order.
  const results = new Array(nInputs);
  const missIndexes = [];
  const missKeys = new Map();
  let nCached = 0;
  for (let i = 0; i < nInputs; i++) {
    const key = await sha1Hex(`${normalizeErrorText(inputs[i])}|${cacheKeySuffix}`);
    const hit = cacheGet(key, now());
    if (hit !== undefined) {
      results[i] = hit;
      nCached++;
    } else {
      missIndexes.push(i);
      missKeys.set(i, key);
    }
  }

  if (missIndexes.length === 0) {
    logMetric({ n_inputs: nInputs, n_cached: nCached, n_sent: 0, status: 'cache', ms: 0, tier, model: null });
    return { results, model: null, cached: nCached, sent: 0 };
  }

  if (now() < pausedUntil) {
    logMetric({ n_inputs: nInputs, n_cached: nCached, n_sent: 0, status: 'paused', ms: 0, tier, model: null });
    return null;
  }

  const base = env('CLASSIFIER_BASE_URL') || CLASSIFIER_BASE_URL_DEFAULT;
  const key = apiKey || env('CLASSIFIER_API_KEY') || undefined;
  const headers = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;

  const maxPerRequest = tier === 'smart' ? 200 : 1000;
  const misses = missIndexes.map((i) => redactSecrets(inputs[i]).slice(0, INPUT_MAX_CHARS));
  const chunks = chunkInputs(misses, maxPerRequest);

  const started = now();
  let model = null;
  let chunkOffset = 0;
  try {
    for (const chunk of chunks) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetchImpl(`${base}/v1/classify`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ inputs: chunk, labels, ...(instructions ? { instructions } : {}), tier }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 429) {
        pausedUntil = now() + parseRetryAfterMs(response.headers?.get?.('retry-after'), now());
        logMetric({ n_inputs: nInputs, n_cached: nCached, n_sent: chunk.length, status: 429, ms: now() - started, tier, model });
        return null;
      }
      if (!response.ok) {
        logMetric({ n_inputs: nInputs, n_cached: nCached, n_sent: chunk.length, status: response.status, ms: now() - started, tier, model });
        return null;
      }
      const body = await response.json();
      if (body?.model) model = body.model;
      const chunkResults = Array.isArray(body?.results) ? body.results : null;
      if (!chunkResults || chunkResults.length !== chunk.length) {
        logMetric({ n_inputs: nInputs, n_cached: nCached, n_sent: chunk.length, status: 'bad_response', ms: now() - started, tier, model });
        return null;
      }
      for (let j = 0; j < chunk.length; j++) {
        const idx = missIndexes[chunkOffset + j];
        const r = chunkResults[j];
        const result = {
          label: r?.label ?? null,
          confidence: typeof r?.confidence === 'number' ? r.confidence : null,
          scores: r?.scores && typeof r.scores === 'object' ? r.scores : null,
        };
        results[idx] = result;
        cacheSet(missKeys.get(idx), result, now());
      }
      chunkOffset += chunk.length;
    }
  } catch {
    logMetric({ n_inputs: nInputs, n_cached: nCached, n_sent: misses.length, status: 'error', ms: now() - started, tier, model });
    return null;
  }

  logMetric({ n_inputs: nInputs, n_cached: nCached, n_sent: misses.length, status: 200, ms: now() - started, tier, model });
  return { results, model, cached: nCached, sent: misses.length };
}

/** Clear the in-module cache and 429 pause (tests). */
export function resetClassifierState() {
  cache.clear();
  pausedUntil = 0;
}
