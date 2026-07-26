/**
 * Canonical sidebar navigation, shared by astro.config.mjs and
 * scripts/generate-llms-full.mjs so the two never drift apart.
 *
 * Shape matches Starlight's sidebar config:
 *   - leaf:  { label, link }
 *   - group: { label, collapsed?, items: [...] }
 */

export const sidebar = [
  {
    label: 'Overview',
    link: '/',
  },
  {
    label: 'Getting Started',
    items: [
      { label: 'Get Started', link: '/getting-started/get-started' },
    ],
  },
  {
    label: 'Interactive Tools',
    collapsed: true,
    items: [
      { label: 'Tools Hub', link: '/tools' },
      { label: 'Thread Calculator', link: '/tools/thread-calculator' },
      { label: 'Heap Estimator', link: '/tools/heap-estimator' },
      { label: 'Coordinated Omission', link: '/tools/coordinated-omission' },
      { label: 'Properties Cheat Sheet', link: '/tools/properties-cheatsheet' },
      { label: 'Regex Extractor Builder', link: '/tools/regex-tester' },
    ],
  },
  {
    label: 'Topic Guides',
    collapsed: true,
    items: [
      { label: 'JMeter for Beginners', link: '/topics/jmeter-for-beginners' },
      { label: 'API Load Testing', link: '/topics/api-load-testing' },
      { label: 'JWT / OAuth / SSO', link: '/topics/jwt-oauth-sso' },
      { label: 'Correlation & Dynamic Values', link: '/topics/correlation-dynamic-values' },
      { label: 'HTTP Recorder', link: '/topics/http-recorder' },
      { label: 'Functions & Variables', link: '/topics/functions-and-variables' },
      { label: 'Plugins Essentials', link: '/topics/plugins-essentials' },
      { label: 'WebSocket Load Testing', link: '/topics/websocket-load-testing' },
      { label: 'gRPC / Kafka / MQTT', link: '/topics/grpc-kafka-mqtt' },
      { label: 'Grafana / Influx / Backend Listener', link: '/topics/grafana-influx-backend-listener' },
      { label: 'APDEX / SLOs / Percentiles', link: '/topics/apdex-slo-percentiles' },
      { label: 'Docker / Kubernetes', link: '/topics/docker-kubernetes' },
      { label: 'CI/CD Load Testing', link: '/topics/ci-cd-load-testing' },
      { label: 'Distributed Testing', link: '/topics/distributed-testing' },
      { label: 'Programmatic / DSL Plans', link: '/topics/programmatic-dsl-plans' },
      { label: 'Troubleshooting', link: '/topics/troubleshooting' },
      {
        label: 'Error Playbooks',
        collapsed: true,
        items: [
          { label: 'Error Index', link: '/topics/errors' },
          { label: 'ConnectException', link: '/topics/errors/connect-exception' },
          { label: 'Non HTTP response code', link: '/topics/errors/non-http-response-code' },
          { label: 'SSLHandshakeException', link: '/topics/errors/ssl-handshake-exception' },
          { label: 'OutOfMemoryError heap', link: '/topics/errors/out-of-memory-heap' },
          { label: 'Socket closed / reset', link: '/topics/errors/socket-closed-connection-reset' },
          { label: 'Throughput stuck', link: '/topics/errors/throughput-stuck' },
          { label: 'GUI works, CLI fails', link: '/topics/errors/gui-works-cli-fails' },
          { label: '401/403 after recording', link: '/topics/errors/401-403-after-recording' },
        ],
      },
      { label: 'Interview Questions', link: '/topics/interview-questions' },
      {
        label: 'JMeter vs Alternatives',
        collapsed: true,
        items: [
          { label: 'Tool Comparison Hub', link: '/topics/jmeter-vs-alternatives' },
          { label: 'JMeter vs k6', link: '/topics/jmeter-vs-k6' },
          { label: 'JMeter vs Locust', link: '/topics/jmeter-vs-locust' },
          { label: 'JMeter vs Gatling', link: '/topics/jmeter-vs-gatling' },
          { label: 'JMeter vs LoadRunner / NeoLoad', link: '/topics/jmeter-vs-enterprise' },
          { label: 'GUI vs Code-First', link: '/topics/gui-vs-code-first' },
        ],
      },
    ],
  },
  {
    label: 'User Manual',
    collapsed: true,
    items: [
      { label: 'Building a Test Plan', link: '/user-manual/build-test-plan' },
      { label: 'Elements of a Test Plan', link: '/user-manual/test-plan' },
      { label: 'Building a Web Test Plan', link: '/user-manual/build-web-test-plan' },
      { label: 'Advanced Web Test Plan', link: '/user-manual/build-adv-web-test-plan' },
      { label: 'Database Test Plan', link: '/user-manual/build-db-test-plan' },
      { label: 'FTP Test Plan', link: '/user-manual/build-ftp-test-plan' },
      { label: 'LDAP Test Plan', link: '/user-manual/build-ldap-test-plan' },
      { label: 'Extended LDAP Test Plan', link: '/user-manual/build-ldapext-test-plan' },
      { label: 'Webservice Test Plan', link: '/user-manual/build-ws-test-plan' },
      { label: 'JMS Point-to-Point', link: '/user-manual/build-jms-point-to-point-test-plan' },
      { label: 'JMS Topic Test Plan', link: '/user-manual/build-jms-topic-test-plan' },
      { label: 'Programmatic Test Plan', link: '/user-manual/build-programmatic-test-plan' },
      { label: 'Listeners', link: '/user-manual/listeners' },
      { label: 'Remote Testing', link: '/user-manual/remote-test' },
      { label: 'Dashboard Report', link: '/user-manual/generating-dashboard' },
      { label: 'Real-time Results', link: '/user-manual/realtime-results' },
      { label: 'Best Practices', link: '/user-manual/best-practices' },
      { label: 'Boss', link: '/user-manual/boss' },
      { label: 'cURL', link: '/user-manual/curl' },
      { label: 'Hints and Tips', link: '/user-manual/hints-and-tips' },
      { label: 'Glossary', link: '/user-manual/glossary' },
      { label: 'Regular Expressions', link: '/user-manual/regular-expressions' },
      { label: 'Functions and Variables', link: '/user-manual/functions' },
      { label: 'Properties Reference', link: '/user-manual/properties-reference' },
      { label: 'Component Reference', link: '/user-manual/component-reference' },
    ],
  },
  {
    label: 'Extending JMeter',
    items: [
      { label: 'Extending JMeter', link: '/extending/extending-jmeter' },
      { label: 'Dashboard Generator', link: '/extending/devguide-dashboard' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { label: 'Changes', link: '/user-manual/changes' },
      { label: 'Changes History', link: '/user-manual/changes-history' },
      { label: 'History & Future', link: '/user-manual/history-future' },
      { label: 'Building JMeter', link: '/reference/building' },
      { label: 'Creating Templates', link: '/reference/creating-templates' },
      { label: 'Download JMeter', link: '/reference/download-jmeter' },
      { label: 'Security', link: '/reference/security' },
      { label: 'Issue Tracking', link: '/reference/issues' },
      { label: 'Mailing Lists', link: '/reference/mail' },
    ],
  },
  {
    label: 'Legal',
    items: [
      { label: 'Disclaimer', link: '/legal/disclaimer' },
      { label: 'NOTICE', link: '/legal/notice' },
    ],
  },
];

/** Flatten the sidebar into an ordered list of leaf entries: { label, link }. */
export function flattenSidebar(items = sidebar) {
  const out = [];
  for (const entry of items) {
    if (entry.link) {
      out.push({ label: entry.label, link: entry.link });
    } else if (entry.items) {
      out.push(...flattenSidebar(entry.items));
    }
  }
  return out;
}
