/**
 * Normalize SEO frontmatter across docs for even SERP/AEO quality.
 *
 * - Keyword-leading seoTitle (no brand suffix; SeoHead appends | docs.jmeter.ai)
 * - description 120–155 chars when we set it; always keep 80–160
 * - keywords array (3–6 terms)
 * - difficulty, guideType, estimatedReadTime, lastVerified
 * - canonicalTopic for /topics/*
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DOCS = path.join(ROOT, 'src/content/docs');
const LAST_VERIFIED = 'JMeter 5.6';

/** @type {Record<string, { seoTitle: string, description: string, keywords: string[], difficulty: string, guideType: string, estimatedReadTime: string, canonicalTopic?: string }>} */
const TOPIC_SEO = {
  'topics/jmeter-for-beginners.mdx': {
    seoTitle: 'JMeter for Beginners Tutorial (2026)',
    description:
      'Learn JMeter from scratch in 2026: install, build your first API test plan, run non-GUI CLI load, generate an HTML dashboard, and plan next steps.',
    keywords: ['JMeter for beginners', 'JMeter tutorial', 'learn JMeter', 'JMeter first test', 'JMeter getting started'],
    difficulty: 'beginner',
    guideType: 'tutorial',
    estimatedReadTime: '12 min read',
    canonicalTopic: 'jmeter-for-beginners',
  },
  'topics/api-load-testing.mdx': {
    seoTitle: 'JMeter API Load Testing Guide',
    description:
      'Complete JMeter API load testing guide: HTTP Request setup, headers and auth, CSV parameterization, correlation, assertions, CLI runs, and dashboards.',
    keywords: ['JMeter API testing', 'API load testing', 'REST API performance testing', 'JMeter HTTP sampler', 'JMeter JSON'],
    difficulty: 'intermediate',
    guideType: 'how-to',
    estimatedReadTime: '14 min read',
    canonicalTopic: 'api-load-testing',
  },
  'topics/jwt-oauth-sso.mdx': {
    seoTitle: 'JMeter JWT OAuth SSO Load Testing',
    description:
      'Load test JWT, OAuth2, and SSO APIs in JMeter: token endpoints, Bearer headers, refresh flows, Cookie Manager, CSV users, and fixing 401 failures.',
    keywords: ['JMeter JWT', 'JMeter OAuth', 'JMeter SSO', 'Bearer token load testing', 'JMeter authentication'],
    difficulty: 'intermediate',
    guideType: 'how-to',
    estimatedReadTime: '12 min read',
    canonicalTopic: 'jwt-oauth-sso',
  },
  'topics/correlation-dynamic-values.mdx': {
    seoTitle: 'JMeter Correlation and Dynamic Values',
    description:
      'End-to-end JMeter correlation: extract CSRF tokens, session IDs, and JSON fields with Regex and JSON extractors, chain requests, and debug replays.',
    keywords: ['JMeter correlation', 'JMeter extractor', 'dynamic values JMeter', 'CSRF token JMeter', 'JSON Extractor'],
    difficulty: 'intermediate',
    guideType: 'how-to',
    estimatedReadTime: '12 min read',
    canonicalTopic: 'correlation-dynamic-values',
  },
  'topics/http-recorder.mdx': {
    seoTitle: 'JMeter HTTP(S) Test Script Recorder',
    description:
      'Record browser traffic with the JMeter HTTP(S) Test Script Recorder: proxy port 8888, SSL root CA, include/exclude filters, and post-record cleanup.',
    keywords: ['JMeter proxy recorder', 'HTTP Test Script Recorder', 'JMeter script recording', 'JMeter HTTPS recording'],
    difficulty: 'beginner',
    guideType: 'tutorial',
    estimatedReadTime: '12 min read',
    canonicalTopic: 'http-recorder',
  },
  'topics/functions-and-variables.mdx': {
    seoTitle: 'JMeter Functions and Variables Guide',
    description:
      'Master JMeter functions and variables: syntax rules, thread-local vars vs properties, CSV Data Set, __P for CLI, and common parameterization patterns.',
    keywords: ['JMeter functions', 'JMeter variables', 'JMeter parameterization', 'JMeter __P', 'CSV Data Set Config'],
    difficulty: 'intermediate',
    guideType: 'reference',
    estimatedReadTime: '12 min read',
    canonicalTopic: 'functions-and-variables',
  },
  'topics/plugins-essentials.mdx': {
    seoTitle: 'JMeter Plugins Essentials Guide',
    description:
      'Essential JMeter plugins: Plugins Manager install, custom thread groups, Parallel Controller, version pinning, and keeping distributed workers in sync.',
    keywords: ['JMeter plugins', 'JMeter Plugins Manager', 'Custom Thread Group', 'Parallel Controller JMeter'],
    difficulty: 'intermediate',
    guideType: 'how-to',
    estimatedReadTime: '11 min read',
    canonicalTopic: 'plugins-essentials',
  },
  'topics/websocket-load-testing.mdx': {
    seoTitle: 'JMeter WebSocket Load Testing',
    description:
      'Load test WebSocket APIs with JMeter plugins: install options, open/message/close flows, auth tickets, CLI runs, and injector sizing for long-lived sockets.',
    keywords: ['JMeter WebSocket', 'WebSocket load testing', 'JMeter WebSocket plugin', 'wss performance test'],
    difficulty: 'advanced',
    guideType: 'how-to',
    estimatedReadTime: '11 min read',
    canonicalTopic: 'websocket-load-testing',
  },
  'topics/grpc-kafka-mqtt.mdx': {
    seoTitle: 'JMeter gRPC Kafka MQTT Testing',
    description:
      'Test gRPC, Kafka, and MQTT with JMeter via plugins: what core includes, install discipline, plan patterns, observability, and when other tools fit better.',
    keywords: ['JMeter gRPC', 'JMeter Kafka', 'JMeter MQTT', 'JMeter protocol plugins'],
    difficulty: 'advanced',
    guideType: 'how-to',
    estimatedReadTime: '11 min read',
    canonicalTopic: 'grpc-kafka-mqtt',
  },
  'topics/grafana-influx-backend-listener.mdx': {
    seoTitle: 'JMeter Grafana InfluxDB Backend Listener',
    description:
      'Stream live JMeter metrics to InfluxDB and Grafana with Backend Listener: Influx clients, Graphite, metric prefixes, cardinality tips, and CLI setup.',
    keywords: ['JMeter Backend Listener', 'JMeter InfluxDB', 'JMeter Grafana', 'real-time JMeter metrics'],
    difficulty: 'intermediate',
    guideType: 'how-to',
    estimatedReadTime: '12 min read',
    canonicalTopic: 'grafana-influx-backend-listener',
  },
  'topics/apdex-slo-percentiles.mdx': {
    seoTitle: 'JMeter APDEX Percentiles and SLOs',
    description:
      'Map performance SLOs to JMeter dashboards: APDEX thresholds, p90/p95/p99 percentiles, error rates, reportgenerator properties, and CI performance gates.',
    keywords: ['JMeter APDEX', 'JMeter percentiles', 'performance SLO', 'JMeter dashboard metrics', 'p95 latency'],
    difficulty: 'intermediate',
    guideType: 'concept',
    estimatedReadTime: '12 min read',
    canonicalTopic: 'apdex-slo-percentiles',
  },
  'topics/docker-kubernetes.mdx': {
    seoTitle: 'JMeter Docker and Kubernetes Guide',
    description:
      'Run JMeter in Docker and Kubernetes: non-GUI CLI, heap limits, volume mounts for reports, qainsights/jmeter image, Jobs, and distributed worker patterns.',
    keywords: ['JMeter Docker', 'JMeter Kubernetes', 'JMeter container', 'JMeter K8s', 'qainsights/jmeter'],
    difficulty: 'advanced',
    guideType: 'how-to',
    estimatedReadTime: '12 min read',
    canonicalTopic: 'docker-kubernetes',
  },
  'topics/ci-cd-load-testing.mdx': {
    seoTitle: 'JMeter CI/CD Load Testing Guide',
    description:
      'Integrate JMeter into CI/CD: non-GUI flags, property overrides, HTML reports, performance gates, GitHub Actions, Jenkins, and containerized runs.',
    keywords: ['JMeter CI/CD', 'JMeter Jenkins', 'JMeter GitHub Actions', 'automated load testing', 'JMeter non-GUI'],
    difficulty: 'advanced',
    guideType: 'how-to',
    estimatedReadTime: '13 min read',
    canonicalTopic: 'ci-cd-load-testing',
  },
  'topics/distributed-testing.mdx': {
    seoTitle: 'JMeter Distributed Testing Guide',
    description:
      'Scale JMeter with distributed testing: controller and workers, RMI SSL, ports, -R CLI, data files on each engine, and result aggregation pitfalls.',
    keywords: ['JMeter distributed testing', 'JMeter remote testing', 'JMeter master slave', 'jmeter-server', 'JMeter RMI'],
    difficulty: 'advanced',
    guideType: 'how-to',
    estimatedReadTime: '13 min read',
    canonicalTopic: 'distributed-testing',
  },
  'topics/programmatic-dsl-plans.mdx': {
    seoTitle: 'JMeter Programmatic DSL Test Plans',
    description:
      'Build JMeter plans as code with the 5.6 Java and Kotlin DSL: ListedHashTree, Copy Code from GUI, CI-friendly workflows, and code-first vs k6 trade-offs.',
    keywords: ['JMeter DSL', 'JMeter programmatic test plan', 'JMeter Kotlin DSL', 'JMeter as code', 'ListedHashTree'],
    difficulty: 'advanced',
    guideType: 'how-to',
    estimatedReadTime: '12 min read',
    canonicalTopic: 'programmatic-dsl-plans',
  },
  'topics/troubleshooting.mdx': {
    seoTitle: 'JMeter Troubleshooting Common Errors',
    description:
      'Fix common JMeter failures: connection reset, 401 after recording, low throughput, OutOfMemoryError, SSL handshake errors, and GUI vs CLI differences.',
    keywords: ['JMeter troubleshooting', 'JMeter connection reset', 'JMeter OutOfMemoryError', 'JMeter SSL handshake', 'JMeter 401'],
    difficulty: 'intermediate',
    guideType: 'troubleshooting',
    estimatedReadTime: '12 min read',
    canonicalTopic: 'troubleshooting',
  },
  'topics/interview-questions.mdx': {
    seoTitle: 'JMeter Interview Questions and Answers',
    description:
      'JMeter interview questions with grounded answers and deep-doc links: thread groups, correlation, CLI mode, distributed testing, listeners, and APDEX.',
    keywords: ['JMeter interview questions', 'JMeter interview', 'performance testing interview', 'JMeter Q&A'],
    difficulty: 'beginner',
    guideType: 'concept',
    estimatedReadTime: '14 min read',
    canonicalTopic: 'interview-questions',
  },
  'topics/jmeter-vs-alternatives.mdx': {
    seoTitle: 'JMeter vs k6 Locust Gatling',
    description:
      'Compare Apache JMeter with k6, Locust, and Gatling: architecture, protocols, scripting, distributed load, licensing, reporting, and when to choose each tool.',
    keywords: ['JMeter vs k6', 'JMeter vs Locust', 'JMeter vs Gatling', 'load testing tool comparison', 'open source load testing'],
    difficulty: 'beginner',
    guideType: 'concept',
    estimatedReadTime: '12 min read',
    canonicalTopic: 'jmeter-vs-alternatives',
  },
};

const TOOL_SEO = {
  'tools/index.mdx': {
    seoTitle: 'Free JMeter Tools Hub',
    description:
      'Free interactive JMeter tools: thread and RPS calculator, heap estimator, coordinated omission calculator, properties cheat sheet, and Regex Extractor Builder.',
    keywords: ['JMeter tools', 'JMeter calculator', 'free JMeter utilities', 'JMeter thread calculator', 'JMeter heap calculator'],
    difficulty: 'beginner',
    guideType: 'reference',
    estimatedReadTime: '2 min read',
  },
  'tools/thread-calculator.mdx': {
    seoTitle: 'JMeter Thread Calculator (RPS to Users)',
    description:
      'Free JMeter thread and RPS calculator: estimate concurrent users, ramp-up, and injector heap from target throughput and average response time.',
    keywords: ['JMeter thread calculator', 'JMeter RPS calculator', 'how many threads JMeter', 'thread group sizing'],
    difficulty: 'beginner',
    guideType: 'how-to',
    estimatedReadTime: '3 min read',
  },
  'tools/heap-estimator.mdx': {
    seoTitle: 'JMeter Heap Size Calculator',
    description:
      'Estimate JMeter injector heap (-Xmx) from thread count, engine count, scripting, and listeners. Free client-side tool on docs.jmeter.ai.',
    keywords: ['JMeter heap size', 'JMeter Xmx', 'JMeter memory calculator', 'JMeter OutOfMemoryError'],
    difficulty: 'intermediate',
    guideType: 'how-to',
    estimatedReadTime: '3 min read',
  },
  'tools/coordinated-omission.mdx': {
    seoTitle: 'Coordinated Omission Calculator for JMeter',
    description:
      'Correct for coordinated omission in JMeter: correction factor, lost requests, adjusted response times, and required threads. Free client-side tool.',
    keywords: ['coordinated omission JMeter', 'JMeter throughput gap', 'load test measurement bias'],
    difficulty: 'advanced',
    guideType: 'how-to',
    estimatedReadTime: '4 min read',
  },
  'tools/properties-cheatsheet.mdx': {
    seoTitle: 'JMeter Properties Cheat Sheet',
    description:
      'Filterable cheat sheet of high-impact JMeter properties for results, HTTP, SSL, distributed testing, CLI mode, and HTML dashboard reports.',
    keywords: ['JMeter properties', 'user.properties', 'jmeter.properties', 'JMeter configuration'],
    difficulty: 'intermediate',
    guideType: 'reference',
    estimatedReadTime: '4 min read',
  },
  'tools/regex-tester.mdx': {
    seoTitle: 'JMeter Regex Extractor Builder',
    description:
      'Paste an HTTP response and get Regular Expression Extractor fields for tokens, CSRF, and UUIDs. Browser-only analysis; nothing is uploaded. Max 1 MB.',
    keywords: ['JMeter regex extractor', 'JMeter correlation tool', 'Regular Expression Extractor', 'CSRF extractor'],
    difficulty: 'beginner',
    guideType: 'how-to',
    estimatedReadTime: '3 min read',
  },
};

const MANUAL_SEO = {
  'getting-started/get-started.mdx': {
    seoTitle: 'Getting Started with Apache JMeter',
    description:
      'Get started with Apache JMeter: install, build test plans in GUI mode, debug with View Results Tree, and run real load tests in non-GUI CLI mode.',
    keywords: ['JMeter getting started', 'install JMeter', 'JMeter tutorial', 'JMeter non-GUI'],
    difficulty: 'beginner',
    guideType: 'tutorial',
    estimatedReadTime: '10 min read',
  },
  'user-manual/best-practices.mdx': {
    seoTitle: 'JMeter Best Practices Guide',
    description:
      'JMeter best practices for reliable load tests: correct thread sizing, coordinated omission, CLI mode, lean listeners, CSV users, and Groovy scripting.',
    keywords: ['JMeter best practices', 'JMeter performance tips', 'coordinated omission', 'JMeter CLI mode'],
    difficulty: 'intermediate',
    guideType: 'reference',
    estimatedReadTime: '12 min read',
  },
  'user-manual/build-test-plan.mdx': {
    seoTitle: 'How to Build a JMeter Test Plan',
    description:
      'Learn how to build a JMeter test plan: add elements, configure Thread Groups, save plans, run and stop tests, and check error reporting.',
    keywords: ['JMeter test plan', 'build JMeter test', 'Thread Group JMeter'],
    difficulty: 'beginner',
    guideType: 'tutorial',
    estimatedReadTime: '8 min read',
  },
  'user-manual/build-web-test-plan.mdx': {
    seoTitle: 'Build a JMeter Web Test Plan',
    description:
      'Create a JMeter web test plan with Thread Groups, HTTP Request Defaults, Cookie Manager, sample requests, and listeners for multi-user HTTP load.',
    keywords: ['JMeter web test plan', 'JMeter HTTP test', 'Cookie Manager JMeter'],
    difficulty: 'beginner',
    guideType: 'tutorial',
    estimatedReadTime: '10 min read',
  },
  'user-manual/component-reference.mdx': {
    seoTitle: 'JMeter Component Reference',
    description:
      'Complete Apache JMeter component reference: samplers, controllers, listeners, timers, assertions, config elements, and post-processors explained.',
    keywords: ['JMeter component reference', 'JMeter samplers', 'JMeter listeners', 'JMeter assertions'],
    difficulty: 'intermediate',
    guideType: 'reference',
    estimatedReadTime: '30 min read',
  },
  'user-manual/functions.mdx': {
    seoTitle: 'JMeter Functions Reference',
    description:
      'Full JMeter functions and variables reference: ${__function()} syntax, information, calculation, scripting, and file input functions with parameters.',
    keywords: ['JMeter functions', 'JMeter variables reference', '__UUID', '__Random', '__P function'],
    difficulty: 'intermediate',
    guideType: 'reference',
    estimatedReadTime: '20 min read',
  },
  'user-manual/properties-reference.mdx': {
    seoTitle: 'JMeter Properties Reference',
    description:
      'Complete jmeter.properties and user.properties reference: results saving, HTTP, SSL, remote testing, report generator, and runtime configuration.',
    keywords: ['JMeter properties reference', 'user.properties', 'jmeter.properties'],
    difficulty: 'advanced',
    guideType: 'reference',
    estimatedReadTime: '20 min read',
  },
  'user-manual/generating-dashboard.mdx': {
    seoTitle: 'JMeter HTML Dashboard Report',
    description:
      'Generate JMeter HTML dashboard reports with APDEX, statistics, percentiles, error tables, and graphs from CSV results using -e -o or offline mode.',
    keywords: ['JMeter dashboard', 'JMeter HTML report', 'JMeter APDEX', 'jmeter -e -o'],
    difficulty: 'intermediate',
    guideType: 'how-to',
    estimatedReadTime: '12 min read',
  },
  'user-manual/remote-test.mdx': {
    seoTitle: 'JMeter Remote Distributed Testing',
    description:
      'Configure JMeter remote testing across engines: jmeter-server, RMI SSL keystores, remote_hosts, -R CLI, reverse ports, and aggregated results.',
    keywords: ['JMeter remote testing', 'JMeter distributed', 'jmeter-server', 'JMeter RMI SSL'],
    difficulty: 'advanced',
    guideType: 'how-to',
    estimatedReadTime: '14 min read',
  },
  'user-manual/listeners.mdx': {
    seoTitle: 'JMeter Listeners Guide',
    description:
      'Configure JMeter listeners for debugging and results: View Results Tree, summary reports, Backend Listener, and which listeners to disable under load.',
    keywords: ['JMeter listeners', 'View Results Tree', 'JMeter results', 'Backend Listener'],
    difficulty: 'intermediate',
    guideType: 'reference',
    estimatedReadTime: '10 min read',
  },
  'user-manual/regular-expressions.mdx': {
    seoTitle: 'JMeter Regular Expressions Guide',
    description:
      'Use regular expressions in JMeter extractors and assertions: capture groups, templates like $1$, Match No., and common correlation patterns.',
    keywords: ['JMeter regular expressions', 'JMeter regex extractor', 'JMeter template $1$'],
    difficulty: 'intermediate',
    guideType: 'how-to',
    estimatedReadTime: '10 min read',
  },
  'user-manual/glossary.mdx': {
    seoTitle: 'JMeter Glossary of Metrics',
    description:
      'JMeter glossary of performance metrics: elapsed time, latency, connect time, median, percentiles, standard deviation, and throughput definitions.',
    keywords: ['JMeter glossary', 'JMeter latency', 'JMeter throughput', 'JMeter percentiles'],
    difficulty: 'beginner',
    guideType: 'reference',
    estimatedReadTime: '6 min read',
  },
  'user-manual/test-plan.mdx': {
    seoTitle: 'Elements of a JMeter Test Plan',
    description:
      'Understand JMeter test plan elements: Thread Groups, samplers, logic controllers, listeners, timers, assertions, and configuration elements.',
    keywords: ['JMeter test plan elements', 'Thread Group', 'JMeter controllers', 'JMeter samplers'],
    difficulty: 'beginner',
    guideType: 'concept',
    estimatedReadTime: '12 min read',
  },
  'user-manual/realtime-results.mdx': {
    seoTitle: 'JMeter Real-Time Results Backend Listener',
    description:
      'Stream live JMeter statistics with Backend Listener to InfluxDB, Graphite, and Grafana: metrics prefixes, clients, and real-time monitoring setup.',
    keywords: ['JMeter real-time results', 'Backend Listener', 'JMeter InfluxDB', 'JMeter Grafana'],
    difficulty: 'intermediate',
    guideType: 'how-to',
    estimatedReadTime: '12 min read',
  },
  'user-manual/build-programmatic-test-plan.mdx': {
    seoTitle: 'Build JMeter Plans Programmatically',
    description:
      'Create JMeter test plans with the Java API and experimental Kotlin/Java DSL in 5.6: ListedHashTree, Copy Code, and programmatic builders.',
    keywords: ['JMeter programmatic test plan', 'JMeter DSL', 'ListedHashTree', 'JMeter Kotlin'],
    difficulty: 'advanced',
    guideType: 'how-to',
    estimatedReadTime: '12 min read',
  },
  'user-manual/jmeter-proxy-step-by-step.mdx': {
    seoTitle: 'JMeter Proxy Recorder Step by Step',
    description:
      'Step-by-step HTTP(S) Test Script Recorder tutorial: Recording template, port 8888, install ApacheJMeterTemporaryRootCA, and validate captured scripts.',
    keywords: ['JMeter proxy step by step', 'JMeter recorder tutorial', 'HTTP(S) Test Script Recorder'],
    difficulty: 'beginner',
    guideType: 'tutorial',
    estimatedReadTime: '12 min read',
  },
  'user-manual/jmeter-distributed-testing-step-by-step.mdx': {
    seoTitle: 'JMeter Distributed Testing Step by Step',
    description:
      'Hands-on distributed JMeter setup: start jmeter-server workers, configure the controller, run remote tests, and verify aggregated sample results.',
    keywords: ['JMeter distributed testing tutorial', 'jmeter-server setup', 'JMeter remote start'],
    difficulty: 'advanced',
    guideType: 'tutorial',
    estimatedReadTime: '12 min read',
  },
  'user-manual/hints-and-tips.mdx': {
    seoTitle: 'JMeter Hints and Tips',
    description:
      'Practical JMeter tips: share data across threads with properties, debug logging, search the test plan, HiDPI, autosave backups, and keyboard shortcuts.',
    keywords: ['JMeter tips', 'JMeter hints', 'JMeter debug logging', 'JMeter properties between threads'],
    difficulty: 'intermediate',
    guideType: 'reference',
    estimatedReadTime: '8 min read',
  },
  'extending/extending-jmeter.mdx': {
    seoTitle: 'Extending JMeter Developer Guide',
    description:
      'Developer guide to extending Apache JMeter: custom samplers, listeners, timers, config elements, and plugin packaging for lib/ext.',
    keywords: ['extending JMeter', 'JMeter plugin development', 'custom JMeter sampler'],
    difficulty: 'advanced',
    guideType: 'reference',
    estimatedReadTime: '15 min read',
  },
  'reference/download-jmeter.mdx': {
    seoTitle: 'Download Apache JMeter',
    description:
      'Find where to download official Apache JMeter releases, verify distributions, and choose the right package for your platform and Java version.',
    keywords: ['download JMeter', 'Apache JMeter download', 'JMeter release'],
    difficulty: 'beginner',
    guideType: 'reference',
    estimatedReadTime: '3 min read',
  },
};

function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return null;
  return {
    fm: raw.slice(4, end),
    body: raw.slice(end + 4),
    end,
  };
}

function getTitle(fm) {
  const m = fm.match(/^title:\s*(?:"([^"]*)"|'([^']*)'|(.+))$/m);
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim();
}

function yamlQuote(s) {
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function yamlDesc(s) {
  // Prefer single quotes when ${ present; escape ' as ''
  if (s.includes('${') || s.includes("'")) {
    return `'${s.replace(/'/g, "''")}'`;
  }
  return yamlQuote(s);
}

function clampDesc(s, min = 80, max = 160) {
  let d = s.replace(/\s+/g, ' ').trim();
  if (d.length > max) {
    // Prefer word boundary without ellipsis first (ellipsis can push over max)
    d = d.slice(0, max).replace(/\s+\S*$/, '').trim();
    if (d.length > max) d = d.slice(0, max);
    if (d.length < min) d = s.replace(/\s+/g, ' ').trim().slice(0, max);
  }
  return d;
}

function assertDesc(pathRel, d) {
  const len = d.length;
  if (len < 80 || len > 160) {
    console.warn(`WARN ${pathRel}: description length ${len}`);
  }
}

function buildFrontmatter(title, seo, keepExtra = {}) {
  const lines = [];
  lines.push(`title: ${yamlQuote(title)}`);
  lines.push(`seoTitle: ${yamlQuote(seo.seoTitle)}`);
  const desc = clampDesc(seo.description);
  assertDesc(seo.seoTitle, desc);
  lines.push(`description: ${yamlDesc(desc)}`);
  lines.push('keywords:');
  for (const k of seo.keywords) {
    // Quote items that YAML would otherwise parse as maps/bools (colons, etc.)
    const needsQ =
      /[:#{}[\],&*!|>@`]/.test(k) ||
      /^(true|false|null)$/i.test(k) ||
      k.includes("'") ||
      k.includes('"');
    lines.push(needsQ ? `  - ${yamlQuote(k)}` : `  - ${k}`);
  }
  lines.push(`difficulty: ${seo.difficulty}`);
  lines.push(`guideType: ${seo.guideType}`);
  lines.push(`estimatedReadTime: ${yamlQuote(seo.estimatedReadTime)}`);
  lines.push(`lastVerified: ${yamlQuote(seo.lastVerified || LAST_VERIFIED)}`);
  if (seo.canonicalTopic) lines.push(`canonicalTopic: ${seo.canonicalTopic}`);
  // Preserve jsonLd if present in keepExtra
  if (keepExtra.jsonLd) {
    lines.push(`jsonLd: ${keepExtra.jsonLd}`);
  }
  return `---\n${lines.join('\n')}\n---`;
}

function applySeo(relPath, seo) {
  const abs = path.join(DOCS, relPath);
  if (!fs.existsSync(abs)) {
    console.warn('missing', relPath);
    return false;
  }
  const raw = fs.readFileSync(abs, 'utf8');
  const parts = splitFrontmatter(raw);
  if (!parts) {
    console.warn('no fm', relPath);
    return false;
  }
  const title = getTitle(parts.fm) || seo.seoTitle;
  // preserve template if splash etc
  const template = (parts.fm.match(/^template:\s*(.+)$/m) || [])[1];
  let fmBlock = buildFrontmatter(title, seo);
  if (template) {
    fmBlock = fmBlock.replace(/\n---\s*$/, `\ntemplate: ${template}\n---`);
  }
  const out = `${fmBlock}${parts.body.startsWith('\n') ? '' : '\n'}${parts.body.replace(/^\n?/, '\n')}`;
  // normalize: --- + body with single leading newline after ---
  const normalized = `${fmBlock}\n${parts.body.replace(/^\r?\n/, '')}`;
  fs.writeFileSync(abs, normalized.endsWith('\n') ? normalized : normalized + '\n');
  console.log('seo', relPath);
  return true;
}

function deriveGenericSeo(relPath, fm, body) {
  const title = getTitle(fm);
  const cleanTitle = title
    .replace(/^User's Manual:\s*/i, '')
    .replace(/^Apache JMeter\s*/i, '')
    .trim();
  let seoTitle = cleanTitle.length <= 55 ? cleanTitle : cleanTitle.slice(0, 52) + '…';
  if (!/^JMeter/i.test(seoTitle) && !/Apache/i.test(seoTitle)) {
    seoTitle = `JMeter ${seoTitle}`.slice(0, 55);
  }

  let descMatch = fm.match(/^description:\s*(?:"([^"]*)"|'((?:''|[^'])*)')/m);
  let description = (descMatch?.[1] ?? descMatch?.[2] ?? '').replace(/''/g, "'");
  if (!description || description === title || description.length < 80 || description.length > 160) {
    const text = body
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/import .+/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#>*`|_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const snippet = text.slice(0, 200);
    description = clampDesc(
      `${cleanTitle} in Apache JMeter. ${snippet}`.replace(/\s+/g, ' ').trim(),
    );
    // ensure min length
    if (description.length < 80) {
      description = clampDesc(
        `${cleanTitle}: Apache JMeter documentation on docs.jmeter.ai covering setup, configuration, and usage for performance testing teams.`,
      );
    }
  } else {
    description = clampDesc(description);
  }

  const baseKw = cleanTitle
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .join(' ');
  const keywords = [
    `JMeter ${baseKw}`.trim(),
    cleanTitle.slice(0, 40),
    'Apache JMeter documentation',
  ].filter(Boolean);

  let difficulty = (fm.match(/^difficulty:\s*["']?(\w+)/m) || [])[1] || 'intermediate';
  let guideType = (fm.match(/^guideType:\s*["']?([\w-]+)/m) || [])[1] || 'reference';
  let estimatedReadTime = (fm.match(/^estimatedReadTime:\s*["']?([^"'\n]+)/m) || [])[1] || '10 min read';
  estimatedReadTime = estimatedReadTime.replace(/['"]/g, '').trim();

  return {
    seoTitle,
    description,
    keywords: [...new Set(keywords)].slice(0, 5),
    difficulty,
    guideType,
    estimatedReadTime,
  };
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.mdx')) acc.push(p);
  }
  return acc;
}

// --- apply curated maps ---
let count = 0;
for (const [rel, seo] of Object.entries({ ...TOPIC_SEO, ...TOOL_SEO, ...MANUAL_SEO })) {
  if (applySeo(rel, seo)) count++;
}

// --- remaining docs: derive even SEO ---
const all = walk(DOCS);
for (const abs of all) {
  const rel = path.relative(DOCS, abs).replace(/\\/g, '/');
  if (TOPIC_SEO[rel] || TOOL_SEO[rel] || MANUAL_SEO[rel]) continue;
  // skip pure legal boilerplate optional - still SEO them lightly
  const raw = fs.readFileSync(abs, 'utf8');
  const parts = splitFrontmatter(raw);
  if (!parts) continue;
  if (/^seoTitle:/m.test(parts.fm) && /^keywords:/m.test(parts.fm)) {
    // already has both; still normalize description length if needed
    const d = (parts.fm.match(/^description:\s*(?:"([^"]*)"|'((?:''|[^'])*)')/m) || []);
    const desc = (d[1] ?? d[2] ?? '').replace(/''/g, "'");
    if (desc.length >= 80 && desc.length <= 160) continue;
  }
  const seo = deriveGenericSeo(rel, parts.fm, parts.body);
  if (applySeo(rel, seo)) count++;
}

console.log(`\nNormalized SEO on ${count} pages`);
