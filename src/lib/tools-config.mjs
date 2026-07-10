/**
 * Central configuration for interactive docs tools.
 * Pass partial overrides into pure functions (e.g. analyzeResponseBody(body, { maxBodyBytes })).
 */

/** Placeholder shown in metric cards before a value is computed. */
export const EMPTY_VALUE = '-';

/** Thread / RPS calculator bounds and defaults. */
export const THREAD_CALCULATOR = {
  limits: {
    rps: { min: 0.1, max: 100_000 },
    threads: { min: 1, max: 50_000 },
    responseTimeMs: { min: 1, max: 120_000 },
    rampPerThread: { min: 0.1, max: 60 },
  },
  defaults: {
    mode: 'rps',
    rps: 50,
    threads: 50,
    responseTimeMs: 200,
    rampPerThread: 1,
  },
};

/** Heap estimator bounds and defaults. */
export const HEAP_ESTIMATOR = {
  limits: {
    threads: { min: 1, max: 50_000 },
    engines: { min: 1, max: 500 },
    heapMb: { min: 512, max: 16_384 },
  },
  defaults: {
    threads: 100,
    engines: 1,
    scripting: false,
    heavyListeners: false,
    largeResponses: false,
  },
  mbPerThread: { base: 1.0, scripting: 1.5 },
  baseHeapMb: 512,
  heapStepMb: 128,
};

/**
 * Regex Extractor Builder (browser-only paste analysis).
 * maxBodyBytes: 1 MiB keeps scanning responsive on typical client devices.
 */
export const REGEX_EXTRACTOR = {
  maxBodyBytes: 1 * 1024 * 1024,
  maxBodyLabel: '1 MB',
  maxCandidates: 30,
  maxPreviewMatches: 20,
  maxJsonArrayItems: 20,
  maxShapeMatchesPerKind: 8,
  minValueLength: 4,
  maxValueLength: 2048,
  minShapeLength: 8,
  defaultTemplate: '$1$',
  defaultMatchNo: '1',
  defaultValue: 'NOT_FOUND',
  /** Names treated as high-confidence dynamic params (matched case-insensitively). */
  dynamicKeyNames: [
    'access_token',
    'access-token',
    'accesstoken',
    'refresh_token',
    'refresh-token',
    'id_token',
    'id-token',
    'auth_token',
    'auth-token',
    'api_key',
    'api-key',
    'apikey',
    'api_token',
    'csrf',
    'csrf_token',
    'csrf-token',
    'xsrf',
    'xsrf_token',
    'session',
    'session_id',
    'session-id',
    'sessionid',
    'jsessionid',
    'sid',
    'nonce',
    'request_id',
    'request-id',
    'correlation_id',
    'transaction_id',
    'client_id',
    'user_id',
    'account_id',
    'order_id',
    'trace_id',
    'jwt',
    'bearer',
    'authorization',
    'authenticity_token',
    '__requestverificationtoken',
    'viewstate',
    'eventvalidation',
  ],
};

/**
 * Build a case-insensitive exact-name regex from configurable key names.
 * @param {string[]} [names]
 * @returns {RegExp}
 */
export function buildDynamicKeyRegex(names = REGEX_EXTRACTOR.dynamicKeyNames) {
  const parts = names
    .map((n) => String(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean);
  if (parts.length === 0) return /(?!)/;
  return new RegExp(`^(?:${parts.join('|')})$`, 'i');
}
