/**
 * Internal Linking Taxonomy & Registry
 * Maps relationships between:
 * - Synced Manual Pages -> Practical Guide Topic + Related Tool
 * - Hub-and-Spoke Pillar Topics -> 5-10 Recipe Spokes -> Tools -> Reference
 */

export const SYNCED_MANUAL_MAPPINGS = {
  '/user-manual/component-reference': {
    practicalGuide: { title: 'JMeter API Load Testing Guide', href: '/topics/api-load-testing/' },
    relatedTool: { title: 'Properties Cheatsheet', href: '/tools/properties-cheatsheet/' },
  },
  '/user-manual/build-web-test-plan': {
    practicalGuide: { title: 'HTTP(S) Test Script Recorder', href: '/topics/http-recorder/' },
    relatedTool: { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
  },
  '/user-manual/build-adv-web-test-plan': {
    practicalGuide: { title: 'Correlation & Dynamic Values', href: '/topics/correlation-dynamic-values/' },
    relatedTool: { title: 'Regex Extractor Builder', href: '/tools/regex-tester/' },
  },
  '/user-manual/build-db-test-plan': {
    practicalGuide: { title: 'JMeter for Beginners Tutorial', href: '/topics/jmeter-for-beginners/' },
    relatedTool: { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
  },
  '/user-manual/build-ftp-test-plan': {
    practicalGuide: { title: 'JMeter for Beginners Tutorial', href: '/topics/jmeter-for-beginners/' },
    relatedTool: { title: 'Heap & Memory Estimator', href: '/tools/heap-estimator/' },
  },
  '/user-manual/build-jms-point-to-point-test-plan': {
    practicalGuide: { title: 'gRPC, Kafka & MQTT Load Testing', href: '/topics/grpc-kafka-mqtt/' },
    relatedTool: { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
  },
  '/user-manual/build-jms-topic-test-plan': {
    practicalGuide: { title: 'gRPC, Kafka & MQTT Load Testing', href: '/topics/grpc-kafka-mqtt/' },
    relatedTool: { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
  },
  '/user-manual/build-ldap-test-plan': {
    practicalGuide: { title: 'JWT, OAuth & SSO Authentication', href: '/topics/jwt-oauth-sso/' },
    relatedTool: { title: 'Properties Cheatsheet', href: '/tools/properties-cheatsheet/' },
  },
  '/user-manual/build-ldapext-test-plan': {
    practicalGuide: { title: 'JWT, OAuth & SSO Authentication', href: '/topics/jwt-oauth-sso/' },
    relatedTool: { title: 'Properties Cheatsheet', href: '/tools/properties-cheatsheet/' },
  },
  '/user-manual/build-ws-test-plan': {
    practicalGuide: { title: 'WebSocket Load Testing Guide', href: '/topics/websocket-load-testing/' },
    relatedTool: { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
  },
  '/user-manual/build-programmatic-test-plan': {
    practicalGuide: { title: 'Programmatic & DSL Test Plans', href: '/topics/programmatic-dsl-plans/' },
    relatedTool: { title: 'Properties Cheatsheet', href: '/tools/properties-cheatsheet/' },
  },
  '/user-manual/build-test-plan': {
    practicalGuide: { title: 'JMeter for Beginners Tutorial', href: '/topics/jmeter-for-beginners/' },
    relatedTool: { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
  },
  '/user-manual/functions': {
    practicalGuide: { title: 'Functions and Variables Guide', href: '/topics/functions-and-variables/' },
    relatedTool: { title: 'Regex Extractor Builder', href: '/tools/regex-tester/' },
  },
  '/user-manual/properties-reference': {
    practicalGuide: { title: 'Functions and Variables Guide', href: '/topics/functions-and-variables/' },
    relatedTool: { title: 'Properties Cheatsheet', href: '/tools/properties-cheatsheet/' },
  },
  '/user-manual/listeners': {
    practicalGuide: { title: 'Grafana & InfluxDB Real-Time Results', href: '/topics/grafana-influx-backend-listener/' },
    relatedTool: { title: 'Coordinated Omission Calculator', href: '/tools/coordinated-omission/' },
  },
  '/user-manual/remote-test': {
    practicalGuide: { title: 'Distributed Load Testing Guide', href: '/topics/distributed-testing/' },
    relatedTool: { title: 'Heap & Memory Estimator', href: '/tools/heap-estimator/' },
  },
  '/user-manual/best-practices': {
    practicalGuide: { title: 'JMeter for Beginners Tutorial', href: '/topics/jmeter-for-beginners/' },
    relatedTool: { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
  },
  '/getting-started/get-started': {
    practicalGuide: { title: 'JMeter for Beginners Tutorial', href: '/topics/jmeter-for-beginners/' },
    relatedTool: { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
  },
  '/user-manual/generating-dashboard': {
    practicalGuide: { title: 'APDEX & Percentile Sizing', href: '/topics/apdex-slo-percentiles/' },
    relatedTool: { title: 'Coordinated Omission Calculator', href: '/tools/coordinated-omission/' },
  },
  '/user-manual/realtime-results': {
    practicalGuide: { title: 'Grafana & InfluxDB Real-Time Results', href: '/topics/grafana-influx-backend-listener/' },
    relatedTool: { title: 'Coordinated Omission Calculator', href: '/tools/coordinated-omission/' },
  },
  '/user-manual/regular-expressions': {
    practicalGuide: { title: 'Correlation & Dynamic Values', href: '/topics/correlation-dynamic-values/' },
    relatedTool: { title: 'Regex Extractor Builder', href: '/tools/regex-tester/' },
  },
  '/user-manual/jmeter-proxy-step-by-step': {
    practicalGuide: { title: 'HTTP(S) Test Script Recorder', href: '/topics/http-recorder/' },
    relatedTool: { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
  },
  '/user-manual/jmeter-distributed-testing-step-by-step': {
    practicalGuide: { title: 'Distributed Load Testing Guide', href: '/topics/distributed-testing/' },
    relatedTool: { title: 'Heap & Memory Estimator', href: '/tools/heap-estimator/' },
  },
};

export const HUB_AND_SPOKE_TAXONOMY = {
  'api-load-testing': {
    type: 'pillar',
    title: 'API Load Testing',
    recipes: [
      { title: 'JWT, OAuth & SSO Auth', href: '/topics/jwt-oauth-sso/' },
      { title: 'Correlation & Dynamic Values', href: '/topics/correlation-dynamic-values/' },
      { title: 'HTTP(S) Test Script Recorder', href: '/topics/http-recorder/' },
      { title: 'WebSocket Load Testing', href: '/topics/websocket-load-testing/' },
      { title: 'gRPC, Kafka & MQTT', href: '/topics/grpc-kafka-mqtt/' },
      { title: 'Functions & Variables', href: '/topics/functions-and-variables/' },
    ],
    tools: [
      { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
      { title: 'Regex Extractor Builder', href: '/tools/regex-tester/' },
    ],
    reference: [
      { title: 'Component Reference', href: '/user-manual/component-reference/' },
      { title: 'Building Web Test Plan', href: '/user-manual/build-web-test-plan/' },
    ],
  },
  'distributed-testing': {
    type: 'pillar',
    title: 'Distributed Load Testing',
    recipes: [
      { title: 'Docker & Kubernetes Setup', href: '/topics/docker-kubernetes/' },
      { title: 'CI/CD Pipeline Integration', href: '/topics/ci-cd-load-testing/' },
      { title: 'Plugins Essentials', href: '/topics/plugins-essentials/' },
      { title: 'Troubleshooting Common Errors', href: '/topics/troubleshooting/' },
    ],
    tools: [
      { title: 'Heap & Memory Estimator', href: '/tools/heap-estimator/' },
      { title: 'Coordinated Omission Calculator', href: '/tools/coordinated-omission/' },
    ],
    reference: [
      { title: 'Remote Testing Manual', href: '/user-manual/remote-test/' },
      { title: 'Distributed Step-by-Step', href: '/user-manual/jmeter-distributed-testing-step-by-step/' },
    ],
  },
  'ci-cd-load-testing': {
    type: 'pillar',
    title: 'CI/CD Pipeline Load Testing',
    recipes: [
      { title: 'GUI vs Code-First JMeter', href: '/topics/gui-vs-code-first/' },
      { title: 'Programmatic & DSL Test Plans', href: '/topics/programmatic-dsl-plans/' },
      { title: 'Docker & Kubernetes Setup', href: '/topics/docker-kubernetes/' },
      { title: 'Troubleshooting Common Errors', href: '/topics/troubleshooting/' },
    ],
    tools: [
      { title: 'Properties Cheatsheet', href: '/tools/properties-cheatsheet/' },
      { title: 'Heap & Memory Estimator', href: '/tools/heap-estimator/' },
    ],
    reference: [
      { title: 'Properties Reference', href: '/user-manual/properties-reference/' },
      { title: 'Generating HTML Dashboard', href: '/user-manual/generating-dashboard/' },
    ],
  },
  'jmeter-for-beginners': {
    type: 'pillar',
    title: 'JMeter for Beginners',
    recipes: [
      { title: 'API Load Testing Guide', href: '/topics/api-load-testing/' },
      { title: 'HTTP(S) Test Script Recorder', href: '/topics/http-recorder/' },
      { title: 'Functions & Variables', href: '/topics/functions-and-variables/' },
      { title: 'JMeter vs Alternatives', href: '/topics/jmeter-vs-alternatives/' },
    ],
    tools: [
      { title: 'Thread Calculator', href: '/tools/thread-calculator/' },
      { title: 'Regex Extractor Builder', href: '/tools/regex-tester/' },
    ],
    reference: [
      { title: 'Getting Started Guide', href: '/getting-started/get-started/' },
      { title: 'Best Practices', href: '/user-manual/best-practices/' },
    ],
  },
};

/**
 * Get taxonomy mapping for a path.
 * @param {string} pathname
 */
export function getInternalLinksForPath(pathname) {
  const cleanPath = pathname.replace(/\/$/, '');
  if (SYNCED_MANUAL_MAPPINGS[cleanPath]) {
    return SYNCED_MANUAL_MAPPINGS[cleanPath];
  }
  const slug = cleanPath.split('/').pop();
  if (HUB_AND_SPOKE_TAXONOMY[slug]) {
    return HUB_AND_SPOKE_TAXONOMY[slug];
  }
  return null;
}
