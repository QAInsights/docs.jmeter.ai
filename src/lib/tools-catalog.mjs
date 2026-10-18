/**
 * Shared catalog of the 13 interactive tools shown in the Tools Hub
 * (/tools/) and the homepage showcase section.
 *
 * @typedef {Object} ToolItem
 * @property {string} id
 * @property {string} title
 * @property {string} href
 * @property {'converters'|'sizing'|'scripting'|'infrastructure'|'quality'} category
 * @property {string} categoryLabel
 * @property {string} badge
 * @property {string} desc
 * @property {string[]} specs
 */

/** @type {ToolItem[]} */
export const TOOLS = [
  {
    id: 'correlation-sandbox',
    title: 'Correlation & Practice Sandbox',
    href: '/tools/correlation-sandbox/',
    category: 'quality',
    categoryLabel: 'Interactive Sandbox',
    badge: 'Live Edge Ready',
    desc: 'Practice dynamic value extraction (CSRF tokens, session cookies, JWT Bearer, and ASP.NET __VIEWSTATE) against live edge endpoints or a local high-concurrency server.',
    specs: ['Edge + Local Server', 'JMX Challenges', 'Visual Pipeline'],
  },
  {
    id: 'curl-to-jmx',
    title: 'cURL & HAR to JMX Converter',
    href: '/tools/curl-to-jmx/',
    category: 'converters',
    categoryLabel: 'Converter',
    badge: 'RFC 9838 QUERY',
    desc: 'Convert raw terminal cURL commands and browser HAR network exports into structured, production-ready Apache JMeter .jmx test plans with headers, cookies, and assertions.',
    specs: ['cURL & HAR 1.2', 'Bearer Auth', 'Config Defaults'],
  },
  {
    id: 'openapi-to-jmx',
    title: 'OpenAPI / Swagger to JMX Converter',
    href: '/tools/openapi-to-jmx/',
    category: 'converters',
    categoryLabel: 'Converter',
    badge: 'OpenAPI 3.1 & Swagger 2.0',
    desc: 'Convert OpenAPI 3.x or Swagger 2.0 JSON and YAML API specifications into parameterized JMeter test plans with sample payloads, path variables, and SLA assertions.',
    specs: ['JSON & YAML', 'Path Variables', 'Mock Payloads'],
  },
  {
    id: 'jmx-linter',
    title: 'JMX Linter & Health Analyzer',
    href: '/tools/jmx-linter/',
    category: 'quality',
    categoryLabel: 'QA & Linter',
    badge: 'Health Score 0–100',
    desc: 'Scan JMeter .jmx files for performance anti-patterns, active GUI listeners, uncached Groovy scripts, and compute an objective 0–100 health score with fix playbooks.',
    specs: ['12 Heuristic Checks', 'Local Browser-Only', 'JMX Inspector'],
  },
  {
    id: 'groovy-builder',
    title: 'JSR223 Groovy Playground & Builder',
    href: '/tools/groovy-builder/',
    category: 'scripting',
    categoryLabel: 'Code & Scripting',
    badge: 'Cache Validated',
    desc: 'Lint JMeter Groovy code for common pitfalls (vars vs props, logging, thread sleep), inspect variable bindings, and generate ready-to-paste JMX elements from curated recipes.',
    specs: ['Static Linter', 'JMeter Bindings', 'Recipe Library'],
  },
  {
    id: 'thread-calculator',
    title: 'Thread Group Concurrency Calculator',
    href: '/tools/thread-calculator/',
    category: 'sizing',
    categoryLabel: 'Sizing & Capacity',
    badge: "Little's Law Engine",
    desc: 'Calculate concurrent virtual users, target throughput (RPS), think time, ramp-up schedules, and estimated JVM heap memory for your thread groups.',
    specs: ['RPS ↔ Threads', 'Cycle Time', 'Ramp-up Sizing'],
  },
  {
    id: 'heap-estimator',
    title: 'JMeter Heap Memory Estimator',
    href: '/tools/heap-estimator/',
    category: 'sizing',
    categoryLabel: 'Sizing & Capacity',
    badge: 'JVM Tuning',
    desc: 'Estimate required -Xms and -Xmx injector heap allocations based on concurrency, sampler payload sizes, and active listeners to prevent OutOfMemoryError crashes.',
    specs: ['-Xmx Calculation', 'GC Headroom', 'Payload Buffer'],
  },
  {
    id: 'cli-builder',
    title: 'JMeter CLI Command Builder',
    href: '/tools/cli-builder/',
    category: 'scripting',
    categoryLabel: 'Code & Scripting',
    badge: 'CI/CD & Docker',
    desc: 'Assemble clean non-GUI JMeter CLI execution strings (-n -t -l -e -o) with property overrides, dashboard generation, heap environment flags, and Docker snippets.',
    specs: ['Non-GUI Mode', 'HTML Report Flags', '-J Overrides'],
  },
  {
    id: 'distributed-planner',
    title: 'Distributed Testing Port & Firewall Planner',
    href: '/tools/distributed-planner/',
    category: 'infrastructure',
    categoryLabel: 'Infrastructure',
    badge: 'Cloud Firewall Ready',
    desc: 'Plan pinned Java RMI ports, client/server return channels, firewall ingress/egress rules, and cluster properties for AWS, Azure, GCP, Docker, and Kubernetes.',
    specs: ['RMI Port Pinning', 'Cloud Security Groups', 'jmeter.properties'],
  },
  {
    id: 'os-tuning',
    title: 'Linux Kernel & OS Tuning Configurator',
    href: '/tools/os-tuning/',
    category: 'infrastructure',
    categoryLabel: 'Infrastructure',
    badge: 'Kernel 4.x–6.x',
    desc: 'Generate production sysctl.conf, limits.conf, and systemd service configurations to prevent TCP port exhaustion (TIME_WAIT) and ulimit open files crashes under load.',
    specs: ['sysctl.conf', 'limits.conf', 'TCP Port Reuse'],
  },
  {
    id: 'coordinated-omission',
    title: 'Coordinated Omission Calculator',
    href: '/tools/coordinated-omission/',
    category: 'quality',
    categoryLabel: 'QA & Linter',
    badge: 'Measurement Bias',
    desc: 'Detect and quantify measurement bias, unqueued requests, and latency distortion when actual throughput drops below scheduled arrival rates.',
    specs: ['Bias Correction', 'True P99 Latency', 'Lost Requests'],
  },
  {
    id: 'properties-cheatsheet',
    title: 'JMeter Properties Cheat Sheet',
    href: '/tools/properties-cheatsheet/',
    category: 'quality',
    categoryLabel: 'Reference',
    badge: 'Instant Filter',
    desc: 'Searchable, filterable reference of high-impact JMeter user.properties and system.properties for HTTPClient, SSL, results logging, and remote engines.',
    specs: ['Domain Filters', 'user.properties', 'Default Values'],
  },
  {
    id: 'regex-tester',
    title: 'Regex Extractor Builder',
    href: '/tools/regex-tester/',
    category: 'quality',
    categoryLabel: 'QA & Linter',
    badge: 'Browser-Only Max 1MB',
    desc: 'Paste raw HTTP response bodies and extract proposed Regular Expression Extractor settings (regex, template, match number) for dynamic session tokens.',
    specs: ['Token Extraction', 'Regex Tester', 'Zero Server Upload'],
  },
];
