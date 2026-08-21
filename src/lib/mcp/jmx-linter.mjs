/**
 * JMX Best-Practice and Anti-Pattern Linter.
 *
 * Scans JMX XML snippets or full test plan files for performance,
 * reliability, and scalability anti-patterns.
 */

/**
 * @typedef {{
 *   id: string,
 *   severity: 'error' | 'warning' | 'info',
 *   title: string,
 *   message: string,
 *   recommendation: string,
 *   matches?: string[]
 * }} LintFinding
 */

/**
 * Helper to check if an XML opening tag is disabled (contains enabled="false").
 * JMeter elements default to enabled if the enabled attribute is omitted or "true".
 * @param {string} tagAttributes
 * @returns {boolean}
 */
function isElementDisabled(tagAttributes) {
  return /\benabled\s*=\s*["']false["']/i.test(tagAttributes);
}

/**
 * Strip comments from script code so commented-out statements don't trigger false positives.
 * @param {string} code
 * @returns {string}
 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/**
 * Lint JMX XML string content for common anti-patterns.
 * @param {string} jmxContent
 * @returns {{ findings: LintFinding[], score: number, summary: string }}
 */
export function lintJmx(jmxContent) {
  const content = String(jmxContent || '').trim();
  /** @type {LintFinding[]} */
  const findings = [];

  if (!content) {
    return {
      findings: [
        {
          id: 'EMPTY_INPUT',
          severity: 'error',
          title: 'Empty JMX content',
          message: 'No JMX XML content was provided to lint.',
          recommendation: 'Provide valid JMX XML snippet or test plan content.',
        },
      ],
      score: 0,
      summary: 'No JMX content provided.',
    };
  }

  // 1. Check for Active GUI Listeners (attribute-order agnostic, deduplicated by listener type)
  const activeListeners = new Set();
  const listenerTagRegex = /<(?:ResultCollector|kg\.apc\.jmeter\.vizualizers\.[A-Za-z]+)\s+([^>]*?)>/gi;
  let tagMatch;

  while ((tagMatch = listenerTagRegex.exec(content)) !== null) {
    const attrs = tagMatch[1];
    if (isElementDisabled(attrs)) continue;

    if (/\bguiclass\s*=\s*["']ViewResultsFullVisualizer["']/i.test(attrs) || /\bname\s*=\s*["']View Results Tree["']/i.test(attrs)) {
      activeListeners.add('View Results Tree');
    } else if (/\bguiclass\s*=\s*["']TableVisualizer["']/i.test(attrs)) {
      activeListeners.add('View Results in Table');
    } else if (/\bguiclass\s*=\s*["']GraphVisualizer["']/i.test(attrs)) {
      activeListeners.add('Graph Results');
    } else if (/\bguiclass\s*=\s*["'](?:StatGraphVisualizer|StatVisualizer|SummaryReport)["']/i.test(attrs)) {
      activeListeners.add('Aggregate Graph / Report');
    }
  }

  for (const listenerName of activeListeners) {
    findings.push({
      id: 'ACTIVE_GUI_LISTENER',
      severity: 'error',
      title: `Active GUI Listener: ${listenerName}`,
      message: `Found enabled ${listenerName} in the test plan. GUI listeners store full sample data in memory and cause OutOfMemory errors during load runs.`,
      recommendation: 'Disable or remove all GUI listeners for load testing. Run in CLI mode (`jmeter -n -t test.jmx -l results.jtl -e -o report/`) or use Backend Listener with InfluxDB/Prometheus.',
    });
  }

  // 2. Legacy BeanShell Elements (ignoring disabled elements)
  const beanShellRegex = /<(BeanShell(?:Sampler|PreProcessor|PostProcessor|Assertion|Timer|Listener))\s+([^>]*?)>/gi;
  const activeBeanShell = [];
  while ((tagMatch = beanShellRegex.exec(content)) !== null) {
    const elementName = tagMatch[1];
    const attrs = tagMatch[2];
    if (!isElementDisabled(attrs)) {
      activeBeanShell.push(elementName);
    }
  }

  if (activeBeanShell.length > 0) {
    findings.push({
      id: 'LEGACY_BEANSHELL',
      severity: 'error',
      title: 'Legacy BeanShell Element Detected',
      message: `Detected ${activeBeanShell.length} active BeanShell element(s) (${[...new Set(activeBeanShell)].join(', ')}). BeanShell is single-threaded, deprecated, and 10x–50x slower than Groovy.`,
      recommendation: 'Replace BeanShell elements with JSR223 elements using Groovy 3+ with script compilation caching enabled.',
      matches: activeBeanShell,
    });
  }

  // 3. JSR223 Elements: Compilation Caching, Language, and Thread.sleep checks
  const jsr223BlockRegex = /<(JSR223(?:Sampler|PreProcessor|PostProcessor|Assertion|Timer))\s+([^>]*?)>([\s\S]*?)<\/\1>/gi;
  let jsr223Match;
  let hasUncachedJSR223 = false;
  const nonGroovyLangs = new Set();
  let hasActiveThreadSleep = false;

  while ((jsr223Match = jsr223BlockRegex.exec(content)) !== null) {
    const attrs = jsr223Match[2];
    const body = jsr223Match[3];

    // Skip disabled JSR223 elements
    if (isElementDisabled(attrs)) continue;

    // Check script language
    const langMatch = body.match(/<stringProp name="scriptLanguage">(.*?)<\/stringProp>/i);
    const lang = langMatch ? langMatch[1].trim().toLowerCase() : '';
    if (lang && lang !== 'groovy') {
      nonGroovyLangs.add(lang);
    }

    // Check compilation caching:
    // In JMeter JSR223, caching is enabled if cacheKey is non-empty string or bool true.
    // If cacheKey is absent, empty string, or false, caching is disabled.
    const hasCacheKeyProp = /<(?:stringProp|boolProp) name="cacheKey">([\s\S]*?)<\/(?:stringProp|boolProp)>/i.exec(body);
    if (!hasCacheKeyProp) {
      // Absent cacheKey property -> caching disabled by default
      hasUncachedJSR223 = true;
    } else {
      const val = hasCacheKeyProp[1].trim().toLowerCase();
      if (!val || val === 'false') {
        hasUncachedJSR223 = true;
      }
    }

    // Check for active Thread.sleep inside the script (excluding comments)
    const scriptPropMatch = body.match(/<stringProp name="script">([\s\S]*?)<\/stringProp>/i);
    if (scriptPropMatch) {
      const cleanCode = stripComments(scriptPropMatch[1]);
      if (/Thread\.sleep\s*\(/i.test(cleanCode)) {
        hasActiveThreadSleep = true;
      }
    }
  }

  if (hasUncachedJSR223) {
    findings.push({
      id: 'JSR223_NO_CACHE',
      severity: 'warning',
      title: 'JSR223 Compilation Caching Disabled or Omitted',
      message: 'One or more active JSR223 elements do not have compilation caching enabled. Groovy will recompile the script on every sample, consuming severe CPU.',
      recommendation: 'Check the "Cache compiled script if available" checkbox in JSR223 elements (`<boolProp name="cacheKey">true</boolProp>` or provide a non-empty cacheKey).',
    });
  }

  if (nonGroovyLangs.size > 0) {
    findings.push({
      id: 'JSR223_NON_GROOVY_LANGUAGE',
      severity: 'warning',
      title: 'Non-Groovy Language in JSR223',
      message: `Found active JSR223 element using slower engine: ${[...nonGroovyLangs].join(', ')}.`,
      recommendation: 'Switch the script language dropdown to `groovy` for maximum performance and JSR223 compilation cache support.',
    });
  }

  if (hasActiveThreadSleep) {
    findings.push({
      id: 'THREAD_SLEEP_IN_SCRIPT',
      severity: 'error',
      title: 'Thread.sleep() in Script Code',
      message: 'Found active `Thread.sleep()` inside script elements. Blocking worker threads directly degrades thread pool throughput and skews metrics.',
      recommendation: 'Use JMeter native Timers (Constant Timer, Uniform Random Timer, Flow Control Action) or Constant Throughput Timer for pacing.',
    });
  }

  // 4. Zero Ramp-Up with High Thread Counts (enabled thread groups)
  const threadGroupBlockRegex = /<ThreadGroup\s+([^>]*?)>([\s\S]*?)<\/ThreadGroup>/gi;
  let tgMatch;
  while ((tgMatch = threadGroupBlockRegex.exec(content)) !== null) {
    const attrs = tgMatch[1];
    const body = tgMatch[2];
    if (isElementDisabled(attrs)) continue;

    const numMatch = body.match(/<stringProp name="ThreadGroup\.num_threads">(\d+)<\/stringProp>/i);
    const rampMatch = body.match(/<stringProp name="ThreadGroup\.ramp_time">(\d+)<\/stringProp>/i);
    if (numMatch && rampMatch) {
      const numThreads = parseInt(numMatch[1], 10);
      const rampTime = parseInt(rampMatch[1], 10);
      if (numThreads >= 50 && rampTime <= 1) {
        findings.push({
          id: 'ZERO_RAMP_UP_HIGH_CONCURRENCY',
          severity: 'warning',
          title: `Instantaneous Ramp-Up (${numThreads} threads in ${rampTime}s)`,
          message: `Starting ${numThreads} concurrent threads in ${rampTime} second(s) may hammer the target system and client JVM with instant socket bursts.`,
          recommendation: `Set a gradual ramp-up period (e.g., at least ${Math.round(numThreads / 5)}–${numThreads} seconds, or use Concurrency Thread Group).`,
        });
      }
    }
  }

  // 5. Missing or Zero HTTP Timeouts on HTTP Request Samplers or Defaults
  const hasHttpSampler = /testclass="HTTPSamplerProxy"|guiclass="HttpTestSampleGui"/i.test(content);
  if (hasHttpSampler) {
    const hasConnectTimeout = /<stringProp name="HTTPSampler\.connect_timeout">\s*[1-9]\d*\s*<\/stringProp>/i.test(content);
    const hasResponseTimeout = /<stringProp name="HTTPSampler\.response_timeout">\s*[1-9]\d*\s*<\/stringProp>/i.test(content);
    if (!hasConnectTimeout || !hasResponseTimeout) {
      findings.push({
        id: 'MISSING_HTTP_TIMEOUTS',
        severity: 'warning',
        title: 'Missing HTTP Connect or Response Timeout',
        message: 'HTTP Request samplers or HTTP Request Defaults do not specify explicit connect/response timeouts (default is infinite/0).',
        recommendation: 'Configure Connect Timeout (e.g. 5000ms) and Response Timeout (e.g. 30000ms) in HTTP Request Defaults to prevent frozen threads during outages.',
      });
    }
  }

  // 6. Legacy Java HTTP Implementation
  if (/<stringProp name="HTTPSampler\.implementation">Java<\/stringProp>/i.test(content)) {
    findings.push({
      id: 'JAVA_HTTP_IMPLEMENTATION',
      severity: 'warning',
      title: 'Legacy Java HTTP Client Implementation',
      message: 'HTTP Sampler is configured to use the legacy Java implementation instead of HttpClient4.',
      recommendation: 'Change HTTP implementation to `HttpClient4` (or leave blank to inherit default HttpClient4) for connection pooling and TLS SNI support.',
    });
  }

  // Calculate Health Score (100 base)
  let score = 100;
  for (const f of findings) {
    if (f.severity === 'error') score -= 25;
    else if (f.severity === 'warning') score -= 10;
    else if (f.severity === 'info') score -= 5;
  }
  score = Math.max(0, score);

  let summary = `JMX Health Score: ${score}/100. `;
  if (findings.length === 0) {
    summary += 'No anti-patterns detected! The snippet follows JMeter best practices.';
  } else {
    const errors = findings.filter((f) => f.severity === 'error').length;
    const warnings = findings.filter((f) => f.severity === 'warning').length;
    summary += `Found ${errors} error(s) and ${warnings} warning(s).`;
  }

  return { findings, score, summary };
}

