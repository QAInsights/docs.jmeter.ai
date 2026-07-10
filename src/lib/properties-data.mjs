/**
 * Curated high-value JMeter properties for the filterable cheat sheet.
 * Not a full dump of jmeter.properties; links to the full reference.
 */

/** @typedef {{ name: string, category: string, defaultValue: string, summary: string, tags: string[] }} JmeterProperty */

/** @type {JmeterProperty[]} */
export const propertiesCheatsheet = [
  {
    name: 'jmeter.save.saveservice.output_format',
    category: 'Results',
    defaultValue: 'csv',
    summary: 'Result file format. Prefer csv for load tests to reduce I/O and memory.',
    tags: ['results', 'csv', 'jtl', 'performance'],
  },
  {
    name: 'jmeter.save.saveservice.response_data',
    category: 'Results',
    defaultValue: 'false',
    summary: 'Save full response bodies. Keep false under load unless debugging.',
    tags: ['results', 'response', 'memory'],
  },
  {
    name: 'jmeter.save.saveservice.samplerData',
    category: 'Results',
    defaultValue: 'false',
    summary: 'Save request payload data. Disable for high-volume runs.',
    tags: ['results', 'request', 'memory'],
  },
  {
    name: 'jmeter.save.saveservice.autoflush',
    category: 'Results',
    defaultValue: 'false',
    summary: 'Flush after each sample. Safer on crash, slower at high throughput.',
    tags: ['results', 'jtl', 'io'],
  },
  {
    name: 'httpclient4.retrycount',
    category: 'HTTP',
    defaultValue: '0',
    summary: 'Automatic HTTP retries. Usually 0 so failures reflect true error rates.',
    tags: ['http', 'retry', 'errors'],
  },
  {
    name: 'httpclient4.request_sent_retry_enabled',
    category: 'HTTP',
    defaultValue: 'false',
    summary: 'Retry idempotent requests already sent. Leave false unless you understand impact.',
    tags: ['http', 'retry'],
  },
  {
    name: 'httpclient.timeout',
    category: 'HTTP',
    defaultValue: '0',
    summary: 'Default socket timeout (ms). 0 means no timeout; set a real value in production tests.',
    tags: ['http', 'timeout'],
  },
  {
    name: 'https.sessioncontext.shared',
    category: 'SSL',
    defaultValue: 'false',
    summary: 'Share SSL session context across threads. Default per-thread is safer for realism.',
    tags: ['ssl', 'https', 'threads'],
  },
  {
    name: 'https.use.cached.ssl.context',
    category: 'SSL',
    defaultValue: 'true',
    summary: 'Reuse cached SSL context between iterations. Related to reset-on-iteration behavior.',
    tags: ['ssl', 'https', 'iterations'],
  },
  {
    name: 'httpclient.reset_state_on_thread_group_iteration',
    category: 'HTTP',
    defaultValue: 'true',
    summary: 'Reset HTTP/SSL state each iteration (new user). false keeps cookies/connections as same user.',
    tags: ['http', 'cookies', 'iterations', 'ssl'],
  },
  {
    name: 'CookieManager.save.cookies',
    category: 'HTTP',
    defaultValue: 'false',
    summary: 'Store cookies as variables. Useful for debugging cookie flows.',
    tags: ['cookies', 'variables'],
  },
  {
    name: 'CookieManager.check.cookies',
    category: 'HTTP',
    defaultValue: 'true',
    summary: 'Validate cookie path/domain rules before storing.',
    tags: ['cookies'],
  },
  {
    name: 'server.rmi.ssl.disable',
    category: 'Distributed',
    defaultValue: 'false',
    summary: 'Disable RMI SSL for distributed testing. Only for isolated lab networks.',
    tags: ['distributed', 'rmi', 'ssl', 'security'],
  },
  {
    name: 'remote_hosts',
    category: 'Distributed',
    defaultValue: '127.0.0.1',
    summary: 'Comma-separated engine hosts for distributed mode.',
    tags: ['distributed', 'remote'],
  },
  {
    name: 'client.rmi.localport',
    category: 'Distributed',
    defaultValue: '0',
    summary: 'Local port for RMI client. Fix when firewalls require a known range.',
    tags: ['distributed', 'rmi', 'firewall'],
  },
  {
    name: 'server_port',
    category: 'Distributed',
    defaultValue: '1099',
    summary: 'RMI registry port on engines.',
    tags: ['distributed', 'rmi'],
  },
  {
    name: 'mode',
    category: 'Distributed',
    defaultValue: 'StrippedBatch',
    summary: 'Sample sending mode between controller and engines. StrippedBatch balances detail vs network load.',
    tags: ['distributed', 'results', 'network'],
  },
  {
    name: 'jmeterengine.force.system.exit',
    category: 'Engine',
    defaultValue: 'false',
    summary: 'Force System.exit after non-GUI test. Helps CI processes that hang on non-daemon threads.',
    tags: ['cli', 'ci', 'engine'],
  },
  {
    name: 'jmeterengine.stopfail.system.exit',
    category: 'Engine',
    defaultValue: 'true',
    summary: 'Exit process if stop fails; useful for automation.',
    tags: ['cli', 'ci', 'engine'],
  },
  {
    name: 'jmeterengine.nongui.port',
    category: 'Engine',
    defaultValue: '4445',
    summary: 'Port for shutdown client messages in non-GUI mode.',
    tags: ['cli', 'shutdown'],
  },
  {
    name: 'summariser.name',
    category: 'CLI',
    defaultValue: 'summary',
    summary: 'Name of automatic summariser printed during non-GUI runs.',
    tags: ['cli', 'summary'],
  },
  {
    name: 'summariser.interval',
    category: 'CLI',
    defaultValue: '30',
    summary: 'Seconds between summariser lines in CLI mode.',
    tags: ['cli', 'summary'],
  },
  {
    name: 'beanshell.server.port',
    category: 'Scripting',
    defaultValue: '9000',
    summary: 'BeanShell server port when enabled. Prefer JSR223 + Groovy for load.',
    tags: ['scripting', 'beanshell'],
  },
  {
    name: 'groovy.utilities',
    category: 'Scripting',
    defaultValue: '',
    summary: 'Path to utility Groovy script loaded for JSR223 elements.',
    tags: ['scripting', 'groovy', 'jsr223'],
  },
  {
    name: 'jmeter.reportgenerator.overall_granularity',
    category: 'Dashboard',
    defaultValue: '60000',
    summary: 'Time bucket size (ms) for HTML dashboard series.',
    tags: ['dashboard', 'report'],
  },
  {
    name: 'jmeter.reportgenerator.apdex_satisfied_threshold',
    category: 'Dashboard',
    defaultValue: '500',
    summary: 'Apdex satisfied threshold in milliseconds.',
    tags: ['dashboard', 'apdex'],
  },
  {
    name: 'jmeter.reportgenerator.apdex_tolerated_threshold',
    category: 'Dashboard',
    defaultValue: '1500',
    summary: 'Apdex tolerated threshold in milliseconds.',
    tags: ['dashboard', 'apdex'],
  },
  {
    name: 'jmeter.hidpi.mode',
    category: 'GUI',
    defaultValue: 'false',
    summary: 'HiDPI mode for GUI (Java 8 era). Prefer modern Java scaling when possible.',
    tags: ['gui', 'hidpi'],
  },
  {
    name: 'not_in_menu',
    category: 'GUI',
    defaultValue: '',
    summary: 'Comma-separated class names to hide from the Add menus.',
    tags: ['gui', 'menus'],
  },
  {
    name: 'jmeter.gui.action.save.backup_on_save',
    category: 'GUI',
    defaultValue: 'true',
    summary: 'Auto-backup .jmx files on save into the backups folder.',
    tags: ['gui', 'backup', 'jmx'],
  },
  {
    name: 'httpsampler.ignore_failed_embedded_resources',
    category: 'HTTP',
    defaultValue: 'false',
    summary: 'Whether failed embedded resources fail the parent sample.',
    tags: ['http', 'embedded', 'errors'],
  },
  {
    name: 'http.max_redirects',
    category: 'HTTP',
    defaultValue: '20',
    summary: 'Maximum redirects followed by the HTTP Request sampler.',
    tags: ['http', 'redirect'],
  },
];

/**
 * Case-insensitive filter over name, category, summary, and tags.
 * @param {JmeterProperty[]} items
 * @param {string} query
 * @returns {JmeterProperty[]}
 */
export function filterProperties(items, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return items.slice();
  return items.filter((p) => {
    const hay = [p.name, p.category, p.defaultValue, p.summary, ...(p.tags || [])]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

/**
 * @param {JmeterProperty[]} items
 * @returns {string[]}
 */
export function listPropertyCategories(items) {
  return [...new Set(items.map((p) => p.category))].sort();
}
