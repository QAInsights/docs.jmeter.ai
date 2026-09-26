/**
 * Related-links data for the split component/function reference pages
 * (scripts/generate-reference-pages.mjs). Two layers:
 *   - Category/function-wide defaults, so every one of the ~180 generated
 *     pages gets a sensible related topic + tool even without hand-written
 *     overrides.
 *   - Per-slug overrides, seeded for the highest-demand components and
 *     functions, adding a specific error playbook or a second guide.
 */

/** One related link per JMeter component-reference category (18.1–18.9). */
export const CATEGORY_RELATED = {
  Samplers: {
    topic: { title: 'API Load Testing Guide', href: '/topics/api-load-testing/' },
    tool: { title: 'cURL & HAR to JMX Converter', href: '/tools/curl-to-jmx/' },
  },
  'Logic Controllers': {
    topic: { title: 'Logic Controllers & Flow Control', href: '/topics/logic-controllers-flow-control/' },
  },
  Listeners: {
    topic: { title: 'Grafana / InfluxDB / Backend Listener', href: '/topics/grafana-influx-backend-listener/' },
    tool: { title: 'Coordinated Omission Calculator', href: '/tools/coordinated-omission/' },
  },
  'Configuration Elements': {
    topic: { title: 'CSV Data Set & Parameterization', href: '/topics/csv-data-set-config-guide/' },
    tool: { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
  },
  Assertions: {
    topic: { title: 'Assertions & SLA Validation', href: '/topics/jmeter-assertions-guide/' },
  },
  Timers: {
    topic: { title: 'Timers, Think Time & Pacing', href: '/topics/timers-pacing-throughput-modeling/' },
    tool: { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
  },
  'Pre Processors': {
    topic: { title: 'Correlation & Dynamic Values', href: '/topics/correlation-dynamic-values/' },
    tool: { title: 'Regex Extractor Builder', href: '/tools/regex-tester/' },
  },
  'Post-Processors': {
    topic: { title: 'Correlation & Dynamic Values', href: '/topics/correlation-dynamic-values/' },
    tool: { title: 'Regex Extractor Builder', href: '/tools/regex-tester/' },
  },
  'Miscellaneous Features': {
    topic: { title: 'Plugins Essentials', href: '/topics/plugins-essentials/' },
  },
};

/** Default related links for every function page. */
export const FUNCTION_RELATED = {
  topic: { title: 'Functions and Variables Guide', href: '/topics/functions-and-variables/' },
  tool: { title: 'Regex Extractor Builder', href: '/tools/regex-tester/' },
};

/**
 * Per-slug overrides for the highest search-demand components. Keyed by
 * `referenceSlug(name)`. Each entry can add extra `related` links (error
 * playbooks, a second topic guide) on top of the category defaults.
 */
export const COMPONENT_OVERRIDES = {
  'http-request': {
    related: [
      { title: 'ConnectException Playbook', href: '/topics/errors/connect-exception/' },
      { title: 'HTTP 429 & WAF Rate Limits', href: '/topics/errors/http-429-rate-limited/' },
    ],
  },
  'json-extractor': {
    related: [
      { title: 'Extractor Default Value (NOT_FOUND)', href: '/topics/errors/extractor-not-found-default-value/' },
      { title: 'Correlation & Dynamic Values', href: '/topics/correlation-dynamic-values/' },
    ],
  },
  'regular-expression-extractor': {
    related: [
      { title: 'Extractor Default Value (NOT_FOUND)', href: '/topics/errors/extractor-not-found-default-value/' },
      { title: 'Regular Expressions Reference', href: '/user-manual/regular-expressions/' },
    ],
  },
  'csv-data-set-config': {
    related: [
      { title: 'CSV Data Set & Sharing Issues', href: '/topics/errors/csv-data-set-file-not-found-sharing/' },
    ],
  },
  'thread-group': {
    related: [
      { title: 'Thread Groups & Workload Modeling', href: '/topics/thread-groups-workload-modeling/' },
    ],
  },
  'throughput-controller': {
    related: [
      { title: 'Throughput stuck', href: '/topics/errors/throughput-stuck/' },
    ],
  },
  'constant-throughput-timer': {
    related: [
      { title: 'Throughput stuck', href: '/topics/errors/throughput-stuck/' },
    ],
  },
  'jsr223-sampler': {
    related: [
      { title: 'JSR223 Groovy Scripting Guide', href: '/topics/jsr223-groovy-scripting-guide/' },
      { title: 'JSR223 Groovy Script Errors', href: '/topics/errors/jsr223-groovy-script-errors/' },
    ],
  },
  'jsr223-preprocessor': {
    related: [
      { title: 'JSR223 Groovy Scripting Guide', href: '/topics/jsr223-groovy-scripting-guide/' },
    ],
  },
  'jsr223-postprocessor': {
    related: [
      { title: 'JSR223 Groovy Scripting Guide', href: '/topics/jsr223-groovy-scripting-guide/' },
    ],
  },
  'response-assertion': {
    related: [
      { title: 'Assertions & SLA Validation', href: '/topics/jmeter-assertions-guide/' },
    ],
  },
  'transaction-controller': {
    related: [
      { title: 'Logic Controllers & Flow Control', href: '/topics/logic-controllers-flow-control/' },
    ],
  },
  'if-controller': {
    related: [
      { title: 'Logic Controllers & Flow Control', href: '/topics/logic-controllers-flow-control/' },
    ],
  },
  'while-controller': {
    related: [
      { title: 'Logic Controllers & Flow Control', href: '/topics/logic-controllers-flow-control/' },
    ],
  },
  'loop-controller': {
    related: [
      { title: 'Logic Controllers & Flow Control', href: '/topics/logic-controllers-flow-control/' },
    ],
  },
  'http-cookie-manager': {
    related: [
      { title: 'HTTP(S) Test Script Recorder', href: '/topics/http-recorder/' },
    ],
  },
  'http-header-manager': {
    related: [
      { title: 'JWT, OAuth & SSO Authentication', href: '/topics/jwt-oauth-sso/' },
    ],
  },
  'http-request-defaults': {
    related: [
      { title: 'API Load Testing Guide', href: '/topics/api-load-testing/' },
    ],
  },
  'backend-listener': {
    related: [
      { title: 'Grafana / InfluxDB / Backend Listener', href: '/topics/grafana-influx-backend-listener/' },
    ],
  },
  'simple-data-writer': {
    related: [
      { title: 'HTML Dashboard Errors', href: '/topics/errors/html-dashboard-generation-errors/' },
    ],
  },
};

/**
 * Per-slug overrides for the highest search-demand functions. Keyed by
 * `referenceSlug(name)` (leading/trailing underscores stripped).
 */
export const FUNCTION_OVERRIDES = {
  time: {
    related: [
      { title: 'Timers, Think Time & Pacing', href: '/topics/timers-pacing-throughput-modeling/' },
    ],
  },
  random: {
    related: [
      { title: 'CSV Data Set & Parameterization', href: '/topics/csv-data-set-config-guide/' },
    ],
  },
  randomstring: {
    related: [
      { title: 'CSV Data Set & Parameterization', href: '/topics/csv-data-set-config-guide/' },
    ],
  },
  property: {
    related: [
      { title: 'Properties Reference', href: '/user-manual/properties-reference/' },
      { title: 'Properties Cheatsheet', href: '/tools/properties-cheatsheet/' },
    ],
  },
  p: {
    related: [
      { title: 'Properties Reference', href: '/user-manual/properties-reference/' },
      { title: 'CLI Command Builder', href: '/tools/cli-builder/' },
    ],
  },
  groovy: {
    related: [
      { title: 'JSR223 Groovy Scripting Guide', href: '/topics/jsr223-groovy-scripting-guide/' },
    ],
  },
  counter: {
    related: [
      { title: 'Thread Groups & Workload Modeling', href: '/topics/thread-groups-workload-modeling/' },
    ],
  },
  uuid: {
    related: [
      { title: 'Correlation & Dynamic Values', href: '/topics/correlation-dynamic-values/' },
    ],
  },
  threadnum: {
    related: [
      { title: 'Thread Groups & Workload Modeling', href: '/topics/thread-groups-workload-modeling/' },
    ],
  },
  csvread: {
    related: [
      { title: 'CSV Data Set & Parameterization', href: '/topics/csv-data-set-config-guide/' },
      { title: 'CSV Data Set & Sharing Issues', href: '/topics/errors/csv-data-set-file-not-found-sharing/' },
    ],
  },
  v: {
    related: [
      { title: 'Correlation & Dynamic Values', href: '/topics/correlation-dynamic-values/' },
    ],
  },
};
