import { describe, it, expect } from 'vitest';
import { lintJmx } from '../../src/lib/mcp/jmx-linter.mjs';

describe('jmx-linter', () => {
  it('handles empty input gracefully', () => {
    const res = lintJmx('');
    expect(res.findings.length).toBe(1);
    expect(res.findings[0].id).toBe('EMPTY_INPUT');
    expect(res.score).toBe(0);
  });

  it('detects active GUI listeners regardless of attribute order', () => {
    const jmx = `
      <ResultCollector enabled="true" testname="View Results Tree" testclass="ResultCollector" guiclass="ViewResultsFullVisualizer">
        <boolProp name="ResultCollector.error_logging">false</boolProp>
      </ResultCollector>
      <!-- Duplicate listener should not multiply findings -->
      <ResultCollector enabled="true" testname="View Results Tree 2" testclass="ResultCollector" guiclass="ViewResultsFullVisualizer" />
    `;
    const res = lintJmx(jmx);
    const listenerFindings = res.findings.filter((f) => f.id === 'ACTIVE_GUI_LISTENER');
    expect(listenerFindings.length).toBe(1);
    expect(listenerFindings[0].title).toContain('View Results Tree');
    expect(listenerFindings[0].severity).toBe('error');
  });

  it('ignores disabled listeners and disabled script elements', () => {
    const jmx = `
      <ResultCollector enabled="false" testname="Disabled Tree" testclass="ResultCollector" guiclass="ViewResultsFullVisualizer" />
      <BeanShellSampler enabled="false" testclass="BeanShellSampler" testname="Disabled BSH" />
      <JSR223Sampler enabled="false" testclass="JSR223Sampler" testname="Disabled JSR">
        <stringProp name="script">Thread.sleep(5000);</stringProp>
      </JSR223Sampler>
    `;
    const res = lintJmx(jmx);
    expect(res.findings.some((f) => f.id === 'ACTIVE_GUI_LISTENER')).toBe(false);
    expect(res.findings.some((f) => f.id === 'LEGACY_BEANSHELL')).toBe(false);
    expect(res.findings.some((f) => f.id === 'THREAD_SLEEP_IN_SCRIPT')).toBe(false);
  });

  it('detects legacy BeanShell components', () => {
    const jmx = `
      <BeanShellSampler testclass="BeanShellSampler" testname="Old Script" enabled="true">
        <stringProp name="BeanShellSampler.query">vars.put("x", "1");</stringProp>
      </BeanShellSampler>
    `;
    const res = lintJmx(jmx);
    const bshFinding = res.findings.find((f) => f.id === 'LEGACY_BEANSHELL');
    expect(bshFinding).toBeDefined();
    expect(bshFinding?.severity).toBe('error');
  });

  it('flags JSR223 scripts when cacheKey is empty or completely omitted', () => {
    const jmxOmitted = `
      <JSR223Sampler testclass="JSR223Sampler" testname="Groovy Sampler" enabled="true">
        <stringProp name="scriptLanguage">groovy</stringProp>
      </JSR223Sampler>
    `;
    const resOmitted = lintJmx(jmxOmitted);
    expect(resOmitted.findings.some((f) => f.id === 'JSR223_NO_CACHE')).toBe(true);

    const jmxEmpty = `
      <JSR223Sampler testclass="JSR223Sampler" testname="Groovy Sampler" enabled="true">
        <stringProp name="scriptLanguage">groovy</stringProp>
        <stringProp name="cacheKey"></stringProp>
      </JSR223Sampler>
    `;
    const resEmpty = lintJmx(jmxEmpty);
    expect(resEmpty.findings.some((f) => f.id === 'JSR223_NO_CACHE')).toBe(true);
  });

  it('flags Thread.sleep in active code but ignores commented-out sleep', () => {
    const jmxCommented = `
      <JSR223Sampler testclass="JSR223Sampler" testname="Sleep Sampler" enabled="true">
        <stringProp name="scriptLanguage">groovy</stringProp>
        <boolProp name="cacheKey">true</boolProp>
        <stringProp name="script">// Thread.sleep(1000);
        /* Thread.sleep(2000); */
        vars.put("status", "ok");
        </stringProp>
      </JSR223Sampler>
    `;
    const resCommented = lintJmx(jmxCommented);
    expect(resCommented.findings.some((f) => f.id === 'THREAD_SLEEP_IN_SCRIPT')).toBe(false);

    const jmxActive = `
      <JSR223Sampler testclass="JSR223Sampler" testname="Sleep Sampler" enabled="true">
        <stringProp name="scriptLanguage">groovy</stringProp>
        <boolProp name="cacheKey">true</boolProp>
        <stringProp name="script">Thread.sleep(1000);</stringProp>
      </JSR223Sampler>
    `;
    const resActive = lintJmx(jmxActive);
    expect(resActive.findings.some((f) => f.id === 'THREAD_SLEEP_IN_SCRIPT')).toBe(true);
  });

  it('flags zero ramp-up with high thread count', () => {
    const jmx = `
      <ThreadGroup testclass="ThreadGroup" testname="Thread Group" enabled="true">
        <stringProp name="ThreadGroup.num_threads">200</stringProp>
        <stringProp name="ThreadGroup.ramp_time">0</stringProp>
      </ThreadGroup>
    `;
    const res = lintJmx(jmx);
    const rampFinding = res.findings.find((f) => f.id === 'ZERO_RAMP_UP_HIGH_CONCURRENCY');
    expect(rampFinding).toBeDefined();
    expect(rampFinding?.severity).toBe('warning');
  });

  it('passes clean JMX with 100 score', () => {
    const jmx = `
      <HTTPSamplerProxy testclass="HTTPSamplerProxy" testname="HTTP Request" enabled="true">
        <stringProp name="HTTPSampler.connect_timeout">5000</stringProp>
        <stringProp name="HTTPSampler.response_timeout">30000</stringProp>
      </HTTPSamplerProxy>
    `;
    const res = lintJmx(jmx);
    expect(res.score).toBe(100);
    expect(res.findings.length).toBe(0);
    expect(res.summary).toContain('No anti-patterns detected');
  });

});
