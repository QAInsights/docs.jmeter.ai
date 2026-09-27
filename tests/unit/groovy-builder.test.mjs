import { describe, expect, it } from 'vitest';
import { jsr223Recipes } from '../../src/lib/mcp/jsr223-recipes.mjs';
import {
  buildGroovyFile,
  buildJsr223ElementXml,
  detectBindings,
  lintGroovyScript,
} from '../../src/lib/groovy-builder.mjs';

const naturalTypes = {
  jwt_parse_expiry: 'JSR223PreProcessor',
  hmac_sha256_signer: 'JSR223PreProcessor',
  dynamic_header_injection: 'JSR223PreProcessor',
  json_nested_extraction: 'JSR223PostProcessor',
  custom_csv_logger: 'JSR223PostProcessor',
};

function ids(code, type = 'JSR223PostProcessor') {
  return lintGroovyScript(code, type).findings.map((finding) => finding.id);
}

describe('detectBindings', () => {
  it('returns sorted distinct bindings while ignoring comments and strings', () => {
    expect(detectBindings(`// prev and SampleResult\nlog.info("vars and props")\nvars.put('x', prev.getResponseCode())\n/* OUT */`)).toEqual(['log', 'prev', 'vars']);
  });

  it.each([
    ['URLs inside strings', 'def url = "https://example.com"; prev.getTime()', ['prev']],
    ['apostrophes inside comments', `// don't\nvars.get("x")`, ['vars']],
    ['triple-quoted strings', `def s = '''multi\nline // not a comment\n'''; ctx.getThread()`, ['ctx']],
    ['slashy strings', 'def r = ~/prev/; sampler.getName()', ['sampler']],
    ['division followed by a comment', `a / b // comment\nprops.get("x")`, ['props']],
  ])('scans %s in source order', (_case, code, expected) => {
    expect(detectBindings(code)).toEqual(expected);
  });
});

describe('lintGroovyScript', () => {
  it('flags empty scripts only when blank', () => {
    expect(ids('')).toContain('EMPTY_SCRIPT');
    expect(ids('vars.put("x", "1")')).not.toContain('EMPTY_SCRIPT');
  });

  it('flags sleeps outside comments', () => {
    expect(ids('Thread.sleep(20)')).toContain('THREAD_SLEEP');
    expect(ids('// Thread.sleep(20)\nvars.put("x", "1")')).not.toContain('THREAD_SLEEP');
  });

  it('distinguishes JMeter interpolation from declared Groovy GStrings', () => {
    expect(ids('log.info("${authToken}")')).toContain('JMETER_VAR_INTERPOLATION');
    expect(ids('def total = 1\nlog.info("value=${total}")')).not.toContain('JMETER_VAR_INTERPOLATION');
  });

  it.each([
    ['SYSTEM_OUT', 'System.out.println("x")', 'log.info("x")'],
    ['NEW_RANDOM_PER_CALL', 'def n = new Random().nextInt()', 'def n = java.util.concurrent.ThreadLocalRandom.current().nextInt()'],
    ['REGEX_COMPILE_IN_SCRIPT', 'def p = Pattern.compile("x")', 'def ok = "Pattern.compile(x)"'],
    ['BEANSHELL_IMPORT', 'import bsh.Interpreter', 'import groovy.json.JsonSlurper'],
    ['LEGACY_JSONSLURPER_CLASSIC', 'new JsonSlurperClassic()', 'new JsonSlurper()'],
    ['PROPS_MUTATION_IN_LOOP_HOT_PATH', 'props.put("x", "1")', 'vars.put("x", "1")'],
  ])('handles %s positive and negative cases', (id, positive, negative) => {
    expect(ids(positive)).toContain(id);
    expect(ids(negative)).not.toContain(id);
  });

  it('flags statement println but allows OUT.println', () => {
    expect(ids('println("x")')).toContain('SYSTEM_OUT');
    expect(ids('OUT.println("x")')).not.toContain('SYSTEM_OUT');
  });

  it('flags scripts over the configured limit', () => {
    expect(ids(`def x = 1\n${'x'.repeat(200_001)}`)).toContain('SCRIPT_TOO_LONG');
    expect(ids('def x = 1')).not.toContain('SCRIPT_TOO_LONG');
  });

  it('reports bindings unavailable to the selected element', () => {
    expect(lintGroovyScript('prev.getTime()', 'JSR223Timer').unavailableBindings).toEqual(['prev']);
    expect(lintGroovyScript('prev.getTime()', 'JSR223PreProcessor').unavailableBindings).toEqual(['prev']);
    expect(lintGroovyScript('SampleResult.setSuccessful(true)', 'JSR223PostProcessor').unavailableBindings).toEqual(['SampleResult']);
    expect(lintGroovyScript('prev.getTime()', 'JSR223PostProcessor').unavailableBindings).toEqual([]);
    expect(lintGroovyScript('sampler.getName()', 'JSR223Listener').unavailableBindings).toEqual([]);
  });

  it('keeps every curated recipe free of errors for its natural element', () => {
    for (const recipe of jsr223Recipes) {
      const errors = lintGroovyScript(recipe.code, naturalTypes[recipe.id]).findings.filter((finding) => finding.severity === 'error');
      expect(errors, recipe.id).toEqual([]);
    }
  });
});

describe('buildJsr223ElementXml', () => {
  it('escapes values and preserves exact property order', () => {
    const xml = buildJsr223ElementXml({
      elementType: 'JSR223PostProcessor',
      name: 'Parse "A&B"',
      parameters: '--value <x>',
      filename: 'a&b.groovy',
      code: 'if (a < b && c > d) println("x")',
    });
    expect(xml).toContain('testname="Parse &quot;A&amp;B&quot;"');
    expect(xml).toContain('if (a &lt; b &amp;&amp; c &gt; d) println(&quot;x&quot;)');
    expect(xml.indexOf('scriptLanguage')).toBeLessThan(xml.indexOf('parameters'));
    expect(xml.indexOf('parameters')).toBeLessThan(xml.indexOf('filename'));
    expect(xml.indexOf('filename')).toBeLessThan(xml.indexOf('cacheKey'));
    expect(xml.indexOf('cacheKey')).toBeLessThan(xml.indexOf('name="script"'));
    expect(xml).toMatch(/<\/JSR223PostProcessor>\n<hashTree\/>$/);
  });

  it('throws on an unknown type', () => {
    expect(() => buildJsr223ElementXml({ elementType: 'Unknown', name: 'x', code: 'x' })).toThrow(/Unknown/);
  });
});

describe('buildGroovyFile', () => {
  it('adds a descriptive binding header', () => {
    const file = buildGroovyFile({ name: 'Parser', elementType: 'JSR223PostProcessor', code: 'prev.getTime()' });
    expect(file).toContain('// JMeter JSR223 PostProcessor — Parser');
    expect(file).toContain('// Bindings available:');
    expect(file).toContain('\n\nprev.getTime()');
  });
});
