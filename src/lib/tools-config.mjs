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
    thinkTimeMs: { min: 0, max: 300_000 },
  },
  defaults: {
    mode: 'rps',
    rps: 50,
    threads: 50,
    responseTimeMs: 200,
    rampPerThread: 1,
    thinkTimeMs: 0,
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
 * Coordinated Omission calculator bounds and defaults.
 */
export const COORDINATED_OMISSION = {
  limits: {
    targetRps: { min: 1, max: 100_000 },
    actualRps: { min: 1, max: 100_000 },
    avgResponseTimeMs: { min: 1, max: 120_000 },
    durationSeconds: { min: 1, max: 86_400 },
  },
  defaults: {
    targetRps: 50,
    actualRps: 20,
    avgResponseTimeMs: 5000,
    durationSeconds: 60,
  },
};

/**
 * CLI command builder bounds and defaults.
 * heapMb 0 means omit HEAP / JVM_ARGS from the generated command.
 */
export const CLI_BUILDER = {
  limits: {
    heapMb: { min: 0, max: 16_384 },
    pathMaxLen: 260,
    extraJMaxLen: 2000,
    remoteHostsMaxLen: 500,
  },
  defaults: {
    plan: 'plan.jmx',
    results: 'results.jtl',
    report: 'report',
    generateReport: true,
    force: false,
    heapMb: 0,
    propertiesFile: '',
    logFile: '',
    remoteHosts: '',
    exitRemote: false,
    extraJ: '',
    shell: 'bash',
  },
  dockerImage: 'justb4/jmeter:5.6.3',
};

/**
 * Distributed Testing Port & Firewall Planner bounds and defaults.
 */
export const DISTRIBUTED_PLANNER = {
  limits: {
    port: { min: 1024, max: 65535 },
    maxWorkers: 100,
    ipMaxLen: 64,
  },
  defaults: {
    controllerIp: '10.0.0.5',
    workerIps: '10.0.1.10, 10.0.1.11, 10.0.1.12',
    serverPort: 1099,
    serverRmiLocalPort: 50000,
    clientRmiLocalPort: 60000,
    disableSsl: false,
    mode: 'StrippedBatch',
    environment: 'aws',
  },
  transmissionModes: ['StrippedBatch', 'Statistical', 'Batch', 'Standard'],
  environments: [
    { id: 'aws', label: 'AWS VPC (Security Groups)' },
    { id: 'azure', label: 'Azure VNet (NSG)' },
    { id: 'gcp', label: 'GCP VPC (Cloud Firewall)' },
    { id: 'linux', label: 'Linux (iptables / UFW)' },
    { id: 'docker', label: 'Docker Compose' },
    { id: 'k8s', label: 'Kubernetes' },
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
