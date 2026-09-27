import { GROOVY_BUILDER } from './tools-config.mjs';
import { escapeXml } from './mcp/request-normalization.mjs';

export const COMMON_BINDINGS = ['log', 'Label', 'FileName', 'Parameters', 'args', 'ctx', 'vars', 'props', 'OUT'];

export const BINDINGS_BY_ELEMENT = {
  JSR223Sampler: [...COMMON_BINDINGS, 'SampleResult', 'sampler'],
  JSR223PreProcessor: [...COMMON_BINDINGS, 'sampler'],
  JSR223PostProcessor: [...COMMON_BINDINGS, 'sampler', 'prev'],
  JSR223Assertion: [...COMMON_BINDINGS, 'SampleResult', 'AssertionResult', 'prev', 'sampler'],
  JSR223Timer: [...COMMON_BINDINGS, 'sampler'],
  JSR223Listener: [...COMMON_BINDINGS, 'sampleResult', 'prev', 'sampleEvent', 'sampler'],
};

const ALL_BINDINGS = [...new Set(Object.values(BINDINGS_BY_ELEMENT).flat())];

function whitespace(value) {
  return value.replace(/[^\r\n]/g, ' ');
}

function isSlashyStart(source, index) {
  const prefix = source.slice(0, index);
  const before = prefix.trimEnd();
  if (!before || '=(:,~['.includes(before.at(-1))) return true;
  return /(?:^|[;{}\r\n])\s*(?:return\s*)?$/.test(prefix);
}

function quotedEnd(source, start, delimiter) {
  let index = start + delimiter.length;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source.startsWith(delimiter, index)) return index + delimiter.length;
    index += 1;
  }
  return source.length;
}

function scanGroovy(code, stripStrings) {
  const source = String(code || '');
  let output = '';
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('/*', index)) {
      const close = source.indexOf('*/', index + 2);
      const end = close === -1 ? source.length : close + 2;
      output += whitespace(source.slice(index, end));
      index = end;
      continue;
    }
    if (source.startsWith('//', index)) {
      const newline = source.indexOf('\n', index + 2);
      const end = newline === -1 ? source.length : newline;
      output += whitespace(source.slice(index, end));
      index = end;
      continue;
    }

    const triple = source.startsWith('"""', index) ? '"""' : source.startsWith("'''", index) ? "'''" : '';
    if (triple) {
      const end = quotedEnd(source, index, triple);
      const value = source.slice(index, end);
      output += stripStrings ? `""${value.replace(/[^\r\n]/g, '')}` : value;
      index = end;
      continue;
    }

    const quote = source[index] === '"' || source[index] === "'" ? source[index] : '';
    if (quote) {
      const end = quotedEnd(source, index, quote);
      const value = source.slice(index, end);
      output += stripStrings ? '""' : value;
      index = end;
      continue;
    }

    if (source[index] === '/' && isSlashyStart(source, index)) {
      const end = quotedEnd(source, index, '/');
      const value = source.slice(index, end);
      output += stripStrings ? `""${value.replace(/[^\r\n]/g, '')}` : value;
      index = end;
      continue;
    }

    output += source[index];
    index += 1;
  }
  return output;
}

function stripComments(code) {
  return scanGroovy(code, false);
}

function stripCommentsAndStrings(code) {
  return scanGroovy(code, true);
}

export function detectBindings(code) {
  const clean = stripCommentsAndStrings(code);
  return ALL_BINDINGS.filter((name) => new RegExp(`(^|[^A-Za-z0-9_$])${name.replace(/[$]/g, '\\$&')}([^A-Za-z0-9_$]|$)`).test(clean)).sort();
}

function declaredBefore(code, name, index) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefix = stripComments(code.slice(0, index));
  const declaration = new RegExp(`\\b(?:def|String|boolean|byte|short|int|long|float|double|char|BigDecimal|BigInteger|var)\\s+${escaped}\\b|(?:^|[;{}\\n])\\s*${escaped}\\s*=`, 'm');
  return declaration.test(prefix);
}

function bindingRecommendation(names) {
  const suggestions = new Set();
  if (names.includes('prev')) suggestions.add('a JSR223 PostProcessor, Assertion, or Listener');
  if (names.includes('SampleResult')) suggestions.add('a JSR223 Sampler or Assertion');
  if (names.includes('AssertionResult')) suggestions.add('a JSR223 Assertion');
  if (names.includes('sampleResult') || names.includes('sampleEvent')) suggestions.add('a JSR223 Listener');
  return suggestions.size ? `Move the script to ${[...suggestions].join(' or ')}, or remove the unavailable binding.` : 'Choose an element type that exposes these bindings, or remove those references.';
}

/**
 * Lint Groovy code for JMeter-specific pitfalls without executing it.
 * @param {string} code
 * @param {string} elementType
 */
export function lintGroovyScript(code, elementType) {
  const raw = String(code || '');
  const clean = stripCommentsAndStrings(raw);
  const findings = [];
  const bindings = detectBindings(raw);
  const available = BINDINGS_BY_ELEMENT[elementType] || [];
  const unavailableBindings = bindings.filter((name) => !available.includes(name));

  const add = (id, severity, title, message, recommendation) => findings.push({ id, severity, title, message, recommendation });

  if (!raw.trim()) add('EMPTY_SCRIPT', 'error', 'Empty script', 'No Groovy code was provided.', 'Select a recipe or enter a Groovy script.');
  if (/\bThread\.sleep\s*\(|\bsleep\s*\(/.test(clean)) add('THREAD_SLEEP', 'error', 'Blocking sleep detected', 'The script blocks a JMeter worker thread.', 'Use a JMeter Timer or Flow Control Action instead of sleeping in Groovy.');

  const interpolation = /\$\{([A-Za-z_][\w.-]*)\}/g;
  let interpolationMatch;
  while ((interpolationMatch = interpolation.exec(raw)) !== null) {
    const localName = interpolationMatch[1].split('.')[0];
    if (!declaredBefore(raw, localName, interpolationMatch.index)) {
      add('JMETER_VAR_INTERPOLATION', 'warning', 'JMeter variable interpolation in script', `Found \${${interpolationMatch[1]}} without a preceding local declaration. JMeter expands it before Groovy compilation.`, 'Read JMeter values with vars.get("name") or props.get("name") to preserve compilation caching and special characters.');
      break;
    }
  }

  if (/\bSystem\.(?:out|err)\.print/.test(clean) || /(?:^|[;{}\n])\s*println\s*\(/m.test(clean)) add('SYSTEM_OUT', 'warning', 'Console output in hot path', 'System output bypasses JMeter logging controls and can become a bottleneck.', 'Use log.info(...) for logs or OUT.println(...) when console output is intentional.');
  if (/\bnew\s+Random\s*\(/.test(clean)) add('NEW_RANDOM_PER_CALL', 'info', 'Random created per invocation', 'Creating Random for each sample adds allocation and may produce correlated seeds.', 'Use ThreadLocalRandom.current() or org.apache.commons.lang3.RandomUtils.');
  if (/\bPattern\.compile\s*\(/.test(clean)) add('REGEX_COMPILE_IN_SCRIPT', 'info', 'Regex compiled per invocation', 'Pattern.compile runs each time this script executes.', 'Cache the Pattern in props or a static field.');
  if (/\bimport\s+bsh\.|\bbsh\.|\bBeanShell\b/.test(clean)) add('BEANSHELL_IMPORT', 'error', 'BeanShell dependency detected', 'The script references BeanShell APIs from Groovy.', 'Replace BeanShell APIs with native Groovy or Java equivalents.');
  if (/\bJsonSlurperClassic\b/.test(clean)) add('LEGACY_JSONSLURPER_CLASSIC', 'info', 'Legacy JSON parser detected', 'JsonSlurperClassic uses legacy parsing behavior.', 'Use groovy.json.JsonSlurper.');
  if (/\bprops\.put\s*\(/.test(clean)) add('PROPS_MUTATION_IN_LOOP_HOT_PATH', 'info', 'Shared properties mutation', 'props is shared across every JMeter thread and engine process.', 'Prefer vars for thread-local data unless the value is intentionally global.');
  if (raw.length > GROOVY_BUILDER.limits.codeMaxChars) add('SCRIPT_TOO_LONG', 'warning', 'Inline script is too long', `The script exceeds ${GROOVY_BUILDER.limits.codeMaxChars.toLocaleString()} characters.`, 'Move the script to a .groovy file and set the JSR223 FileName field.');

  if (unavailableBindings.length) {
    add('UNAVAILABLE_BINDING', 'error', 'Binding unavailable for this element', `${elementType} does not provide: ${unavailableBindings.join(', ')}.`, bindingRecommendation(unavailableBindings));
  }

  return { findings, bindings, unavailableBindings };
}

export function buildJsr223ElementXml({ elementType, name, code, parameters = '', cacheKey = true, scriptLanguage = 'groovy', filename = '' }) {
  if (!GROOVY_BUILDER.elementTypes.some((item) => item.id === elementType)) {
    throw new Error(`Unknown JSR223 element type: ${elementType}`);
  }
  const attrs = `guiclass="TestBeanGUI" testclass="${escapeXml(elementType)}" testname="${escapeXml(name)}" enabled="true"`;
  return `<${elementType} ${attrs}>\n  <stringProp name="scriptLanguage">${escapeXml(scriptLanguage)}</stringProp>\n  <stringProp name="parameters">${escapeXml(parameters)}</stringProp>\n  <stringProp name="filename">${escapeXml(filename)}</stringProp>\n  <stringProp name="cacheKey">${escapeXml(String(cacheKey))}</stringProp>\n  <stringProp name="script">${escapeXml(code)}</stringProp>\n</${elementType}>\n<hashTree/>`;
}

export function buildGroovyFile({ name, elementType, code }) {
  const label = GROOVY_BUILDER.elementTypes.find((item) => item.id === elementType)?.label || elementType;
  const bindings = BINDINGS_BY_ELEMENT[elementType] || COMMON_BINDINGS;
  return `// JMeter ${label} — ${name}\n// Generated by docs.jmeter.ai Groovy Builder\n// Bindings available: ${bindings.join(', ')}\n\n${String(code || '')}`;
}
