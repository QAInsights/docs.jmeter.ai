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
    label: 'Topic Guides',
    collapsed: false,
    items: [
      { label: 'API Load Testing', link: '/topics/api-load-testing' },
      { label: 'Distributed Testing', link: '/topics/distributed-testing' },
      { label: 'HTTP Recorder', link: '/topics/http-recorder' },
      { label: 'Functions & Variables', link: '/topics/functions-and-variables' },
      { label: 'CI/CD Load Testing', link: '/topics/ci-cd-load-testing' },
      { label: 'JMeter vs Alternatives', link: '/topics/jmeter-vs-alternatives' },
    ],
  },
  {
    label: 'User Manual',
    collapsed: false,
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
