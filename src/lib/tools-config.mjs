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
 * Linux Kernel / OS Tuning Configurator bounds and defaults.
 */
export const OS_TUNING = {
  limits: {
    concurrency: { min: 100, max: 500_000 },
    ramGb: { min: 2, max: 512 },
  },
  defaults: {
    concurrency: 10_000,
    ramGb: 16,
    trafficType: 'http_churn',
    targetDistro: 'ubuntu_debian',
    role: 'injector',
  },
  concurrencyPresets: [
    { label: '5,000 (Standard)', value: 5000 },
    { label: '20,000 (High Scale)', value: 20000 },
    { label: '50,000 (Extreme)', value: 50000 },
    { label: '100,000 (Mega Load)', value: 100000 },
  ],
  ramOptions: [
    { label: '4 GB (Small VM / Agent)', value: 4 },
    { label: '8 GB (Standard VM)', value: 8 },
    { label: '16 GB (Recommended Load Injector)', value: 16 },
    { label: '32 GB (High Performance)', value: 32 },
    { label: '64 GB (Bare Metal / Enterprise)', value: 64 },
    { label: '128 GB (Multi-Engine Node)', value: 128 },
    { label: '256 GB (High-Memory Node)', value: 256 },
    { label: '512 GB (Ultra-Scale Cluster / Bare Metal)', value: 512 },
  ],
  trafficTypes: [
    { id: 'http_churn', label: 'HTTP/1.1 Short-Lived (High Connection Churn)' },
    { id: 'http_keepalive', label: 'HTTP/1.1 Keep-Alive / Standard REST API' },
    { id: 'streaming_ws_grpc', label: 'WebSockets / gRPC / HTTP/2 (Persistent Streams)' },
  ],
  targetDistros: [
    { id: 'ubuntu_debian', label: 'Ubuntu / Debian' },
    { id: 'rhel_rocky', label: 'RHEL / Rocky Linux / CentOS' },
    { id: 'amazon_linux', label: 'Amazon Linux 2023 / AL2' },
    { id: 'docker_k8s', label: 'Docker / Kubernetes Pod' },
  ],
  roles: [
    { id: 'injector', label: 'JMeter Load Generator (Client Injector)' },
    { id: 'target_sut', label: 'Target System Under Test (SUT Server)' },
  ],
};

/**
 * cURL & HAR to JMX Converter bounds, defaults, and samples.
 */
export const CURL_TO_JMX = {
  limits: {
    threads: { min: 1, max: 50_000 },
    rampUp: { min: 0, max: 3_600 },
    duration: { min: 0, max: 86_400 },
    loopCount: { min: -1, max: 1_000_000 },
  },
  defaults: {
    threads: 10,
    rampUp: 5,
    duration: 0,
    loopCount: 1,
    parameterizeHost: true,
    parameterizeAuth: true,
    includeAssertions: true,
    includeCookieManager: true,
    filterStaticAssets: true,
  },
  samples: {
    queryMethod: `curl -X QUERY "https://api.example.com/v1/catalog/search" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sample-jwt-token-xyz" \\
  -d '{
    "filter": {
      "status": "in_stock",
      "price": { "lte": 150 }
    },
    "sort": "price:asc",
    "limit": 20
  }'`,
    restAuth: `curl -X POST "https://api.example.com/v1/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"username": "load_test_user", "password": "SecretPassword123!"}'`,
    crudSequence: `curl -X POST "https://api.example.com/v1/orders" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer eyJhbGciOi..." \\
  -d '{"itemId": "SKU-9921", "quantity": 2}'

curl -X GET "https://api.example.com/v1/orders/10293" \\
  -H "Authorization: Bearer eyJhbGciOi..."

curl -X QUERY "https://api.example.com/v1/orders/search" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer eyJhbGciOi..." \\
  -d '{"status": "processing"}'`,
  },
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
