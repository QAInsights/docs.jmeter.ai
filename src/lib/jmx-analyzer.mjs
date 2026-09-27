const CONFIG_ELEMENTS = new Set([
  'ConfigTestElement',
  'CSVDataSet',
  'HeaderManager',
  'CookieManager',
  'CacheManager',
  'Arguments',
  'AuthManager',
  'DNSCacheManager',
  'KeystoreConfig',
  'JavaConfig',
  'RandomVariableConfig',
  'CounterConfig',
]);

const STANDARD_THREAD_GROUPS = new Set(['ThreadGroup', 'SetupThreadGroup', 'PostThreadGroup']);
const SCRIPT_SUFFIXES = '(?:Sampler|PreProcessor|PostProcessor|Assertion|Timer|Listener)';

function readAttribute(attributes, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(attributes);
  return match ? match[1] : '';
}

function isDisabled(attributes) {
  return /^false$/i.test(readAttribute(attributes, 'enabled'));
}

function readProperty(body, name, tags = 'stringProp|intProp|boolProp') {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<(?:${tags})\\s+[^>]*name\\s*=\\s*["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/(?:${tags})>`, 'i').exec(body);
  return match ? match[1].trim() : '';
}

function numericValue(value) {
  const trimmed = String(value || '').trim();
  return /^-?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : null;
}

function findElementBody(content, tagName, openingEnd) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const close = new RegExp(`<\\/${escaped}\\s*>`, 'gi');
  close.lastIndex = openingEnd;
  const match = close.exec(content);
  return match ? content.slice(openingEnd, match.index) : '';
}

function isThreadGroup(testclass) {
  return STANDARD_THREAD_GROUPS.has(testclass) || /(?:^|\.)[^.]*ThreadGroup$/i.test(testclass);
}

/**
 * Analyze the structure of JMeter JMX XML using regexes that work in browsers and Node.
 * This is intentionally a best-effort inventory, not an XML validity check.
 * @param {string} jmxContent
 */
export function analyzeJmxStructure(jmxContent) {
  const content = String(jmxContent || '');
  const rootMatch = /<jmeterTestPlan\b([^>]*)>/i.exec(content);
  const testPlanMatch = /<TestPlan\b([^>]*)>/i.exec(content);
  const counts = {
    httpSamplers: 0,
    otherSamplers: 0,
    jsr223: 0,
    beanshell: 0,
    listeners: 0,
    assertions: 0,
    timers: 0,
    controllers: 0,
    configElements: 0,
    preProcessors: 0,
    postProcessors: 0,
    disabledElements: 0,
  };
  const threadGroups = [];
  const pluginClasses = new Set();
  let hasCsvDataSet = false;
  let hasHeaderManager = false;
  let hasCookieManager = false;
  let hasCacheManager = false;
  let hasHttpDefaults = false;
  let hasBackendListener = false;

  const elementRegex = /<([A-Za-z][\w.]*)\s+([^>]*\btestclass\s*=\s*["'][^"']+["'][^>]*)>/gi;
  let match;
  while ((match = elementRegex.exec(content)) !== null) {
    const tagName = match[1];
    if (/^elementProp$/i.test(tagName)) continue;
    const attributes = match[2];
    const testclass = readAttribute(attributes, 'testclass') || tagName;
    const disabled = isDisabled(attributes);
    const isJsr223 = new RegExp(`^JSR223${SCRIPT_SUFFIXES}$`, 'i').test(testclass);
    const isBeanshell = new RegExp(`^BeanShell${SCRIPT_SUFFIXES}$`, 'i').test(testclass);

    if (disabled) counts.disabledElements += 1;
    if (/^(?:kg\.apc\.|com\.blazemeter\.)/i.test(testclass)) pluginClasses.add(testclass);

    if (/^(?:HTTPSamplerProxy|AjpSampler)$/i.test(testclass)) counts.httpSamplers += 1;
    else if (!isJsr223 && !isBeanshell && /Sampler$/i.test(testclass)) counts.otherSamplers += 1;

    if (isJsr223) counts.jsr223 += 1;
    if (isBeanshell) counts.beanshell += 1;

    if (
      /^ResultCollector$/i.test(testclass) ||
      /^BackendListener$/i.test(testclass) ||
      /^kg\.apc\.jmeter\.vizualizers\./i.test(testclass) ||
      (!isJsr223 && !isBeanshell && /Listener$/i.test(testclass))
    ) counts.listeners += 1;

    if (!isJsr223 && !isBeanshell && /Assertion$/i.test(testclass)) counts.assertions += 1;
    if (!isJsr223 && !isBeanshell && /Timer$/i.test(testclass)) counts.timers += 1;
    if (/Controller$/i.test(testclass)) counts.controllers += 1;
    if (CONFIG_ELEMENTS.has(testclass)) counts.configElements += 1;
    if (!isJsr223 && !isBeanshell && /PreProcessor$/i.test(testclass)) counts.preProcessors += 1;
    if (!isJsr223 && !isBeanshell && /PostProcessor$/i.test(testclass)) counts.postProcessors += 1;

    if (testclass === 'CSVDataSet') hasCsvDataSet = true;
    if (testclass === 'HeaderManager') hasHeaderManager = true;
    if (testclass === 'CookieManager') hasCookieManager = true;
    if (testclass === 'CacheManager') hasCacheManager = true;
    if (testclass === 'BackendListener' && !disabled) hasBackendListener = true;
    if (testclass === 'ConfigTestElement' && /^HttpDefaultsGui$/i.test(readAttribute(attributes, 'guiclass'))) {
      hasHttpDefaults = true;
    }

    if (isThreadGroup(testclass)) {
      const body = findElementBody(content, tagName, elementRegex.lastIndex);
      let threads = null;
      let rampUp = null;
      let loops = null;
      let duration = null;

      if (/ConcurrencyThreadGroup$/i.test(testclass)) {
        threads = numericValue(readProperty(body, 'TargetLevel'));
        rampUp = numericValue(readProperty(body, 'RampUp'));
        duration = numericValue(readProperty(body, 'Hold'));
      } else {
        threads = numericValue(readProperty(body, 'ThreadGroup.num_threads'));
        rampUp = numericValue(readProperty(body, 'ThreadGroup.ramp_time'));
        const loopValue = numericValue(readProperty(body, 'LoopController.loops', 'stringProp|intProp'));
        const forever = /^true$/i.test(readProperty(body, 'LoopController.continue_forever', 'boolProp'));
        loops = forever || loopValue === -1 ? -1 : loopValue;
        const scheduled = /^true$/i.test(readProperty(body, 'ThreadGroup.scheduler', 'boolProp'));
        if (scheduled) duration = numericValue(readProperty(body, 'ThreadGroup.duration'));
      }

      threadGroups.push({
        name: readAttribute(attributes, 'testname'),
        enabled: !disabled,
        type: testclass,
        threads,
        rampUp,
        loops,
        duration,
      });
    }
  }

  const totalThreads = threadGroups.reduce(
    (total, group) => total + (group.enabled && STANDARD_THREAD_GROUPS.has(group.type) && group.threads !== null ? group.threads : 0),
    0,
  );

  return {
    isJmx: Boolean(rootMatch),
    jmeterVersion: rootMatch ? readAttribute(rootMatch[1], 'jmeter') : '',
    testPlanName: testPlanMatch ? readAttribute(testPlanMatch[1], 'testname') : '',
    threadGroups,
    totalThreads,
    counts,
    hasCsvDataSet,
    hasHeaderManager,
    hasCookieManager,
    hasCacheManager,
    hasHttpDefaults,
    hasBackendListener,
    pluginClasses: [...pluginClasses],
  };
}
