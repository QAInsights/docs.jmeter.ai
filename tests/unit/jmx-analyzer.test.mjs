import { describe, expect, it } from 'vitest';
import { analyzeJmxStructure } from '../../src/lib/jmx-analyzer.mjs';
import { JMX_LINTER } from '../../src/lib/tools-config.mjs';
import { lintJmx } from '../../src/lib/mcp/jmx-linter.mjs';

const realisticPlan = `<?xml version="1.0"?>
<jmeterTestPlan version="1.2" jmeter="5.6.3" properties="5.0">
<TestPlan enabled="true" testname="Checkout Load" testclass="TestPlan" guiclass="TestPlanGui">
  <elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
    <collectionProp name="Arguments.arguments"/>
  </elementProp>
</TestPlan>
<ThreadGroup guiclass="ThreadGroupGui" enabled="true" testname="Buyers" testclass="ThreadGroup">
  <stringProp name="ThreadGroup.num_threads">25</stringProp>
  <stringProp name="ThreadGroup.ramp_time">10</stringProp>
  <boolProp name="ThreadGroup.scheduler">true</boolProp>
  <stringProp name="ThreadGroup.duration">120</stringProp>
  <elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller" enabled="true">
    <boolProp name="LoopController.continue_forever">false</boolProp>
    <intProp name="LoopController.loops">3</intProp>
  </elementProp>
</ThreadGroup>
<ThreadGroup testclass="ThreadGroup" testname="Disabled Group" enabled="false" guiclass="ThreadGroupGui">
  <stringProp name="ThreadGroup.num_threads">99</stringProp>
  <stringProp name="ThreadGroup.ramp_time">2</stringProp>
  <boolProp name="ThreadGroup.scheduler">false</boolProp>
  <stringProp name="ThreadGroup.duration">999</stringProp>
  <stringProp name="LoopController.loops">1</stringProp>
</ThreadGroup>
<ConfigTestElement testname="HTTP Defaults" guiclass="HttpDefaultsGui" testclass="ConfigTestElement" enabled="true"></ConfigTestElement>
<HTTPSamplerProxy testclass="HTTPSamplerProxy" testname="GET cart" enabled="true">
  <elementProp name="HTTPsampler.Arguments" elementType="Arguments" guiclass="HTTPArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
    <collectionProp name="Arguments.arguments"/>
  </elementProp>
</HTTPSamplerProxy>
<HTTPSamplerProxy enabled="true" testname="POST order" testclass="HTTPSamplerProxy"></HTTPSamplerProxy>
<JSR223PostProcessor testclass="JSR223PostProcessor" enabled="true" testname="Parse"></JSR223PostProcessor>
<ResultCollector testname="Results" enabled="true" testclass="ResultCollector"></ResultCollector>
<ResponseAssertion enabled="true" testclass="ResponseAssertion" testname="Status"></ResponseAssertion>
<ConstantTimer testclass="ConstantTimer" testname="Think" enabled="true"></ConstantTimer>
<CSVDataSet testclass="CSVDataSet" testname="Users" enabled="true"></CSVDataSet>
<HeaderManager enabled="true" testname="Headers" testclass="HeaderManager"></HeaderManager>
<CookieManager testclass="CookieManager" enabled="true" testname="Cookies"></CookieManager>
</jmeterTestPlan>`;

describe('analyzeJmxStructure', () => {
  it('inventories a realistic plan and excludes disabled threads from totals', () => {
    const result = analyzeJmxStructure(realisticPlan);
    expect(result.isJmx).toBe(true);
    expect(result.jmeterVersion).toBe('5.6.3');
    expect(result.testPlanName).toBe('Checkout Load');
    expect(result.threadGroups).toEqual([
      { name: 'Buyers', enabled: true, type: 'ThreadGroup', threads: 25, rampUp: 10, loops: 3, duration: 120 },
      { name: 'Disabled Group', enabled: false, type: 'ThreadGroup', threads: 99, rampUp: 2, loops: 1, duration: null },
    ]);
    expect(result.totalThreads).toBe(25);
    expect(result.counts).toEqual({
      httpSamplers: 2,
      otherSamplers: 0,
      jsr223: 1,
      beanshell: 0,
      listeners: 1,
      assertions: 1,
      timers: 1,
      controllers: 0,
      configElements: 4,
      preProcessors: 0,
      postProcessors: 0,
      disabledElements: 1,
    });
    expect(result.hasHttpDefaults).toBe(true);
    expect(result.hasCsvDataSet).toBe(true);
    expect(result.hasHeaderManager).toBe(true);
    expect(result.hasCookieManager).toBe(true);
    expect(result.hasCacheManager).toBe(false);
    expect(result.hasBackendListener).toBe(false);
  });

  it('only reports scheduler duration when enabled and recognizes infinite loops', () => {
    const result = analyzeJmxStructure(`<jmeterTestPlan><ThreadGroup testclass="ThreadGroup" testname="Loop" enabled="true"><stringProp name="ThreadGroup.num_threads">1</stringProp><boolProp name="ThreadGroup.scheduler">false</boolProp><stringProp name="ThreadGroup.duration">40</stringProp><boolProp name="LoopController.continue_forever">true</boolProp><intProp name="LoopController.loops">5</intProp></ThreadGroup></jmeterTestPlan>`);
    expect(result.threadGroups[0]).toMatchObject({ loops: -1, duration: null });
  });

  it('returns null for expression-based thread values', () => {
    const result = analyzeJmxStructure(`<jmeterTestPlan><ThreadGroup testclass="ThreadGroup" testname="Dynamic"><stringProp name="ThreadGroup.num_threads">\${threads}</stringProp></ThreadGroup></jmeterTestPlan>`);
    expect(result.threadGroups[0].threads).toBeNull();
    expect(result.totalThreads).toBe(0);
  });

  it('detects plugin classes and concurrency thread-group fields', () => {
    const result = analyzeJmxStructure(`<jmeterTestPlan><kg.apc.jmeter.threads.UltimateThreadGroup testname="Plugin" testclass="kg.apc.jmeter.threads.ConcurrencyThreadGroup" enabled="true"><stringProp name="TargetLevel">40</stringProp><stringProp name="RampUp">20</stringProp><stringProp name="Hold">60</stringProp></kg.apc.jmeter.threads.UltimateThreadGroup></jmeterTestPlan>`);
    expect(result.pluginClasses).toEqual(['kg.apc.jmeter.threads.ConcurrencyThreadGroup']);
    expect(result.threadGroups[0]).toMatchObject({ type: 'kg.apc.jmeter.threads.ConcurrencyThreadGroup', threads: 40, rampUp: 20, duration: 60 });
    expect(result.totalThreads).toBe(0);
  });

  it.each(['', 'plain text'])('handles empty and non-JMX input: %j', (input) => {
    const result = analyzeJmxStructure(input);
    expect(result.isJmx).toBe(false);
    expect(result.threadGroups).toEqual([]);
    expect(result.totalThreads).toBe(0);
    expect(Object.values(result.counts).every((count) => count === 0)).toBe(true);
  });
});

describe('JMX linter samples', () => {
  it('keeps the clean sample at 100', () => {
    expect(lintJmx(JMX_LINTER.samples.clean).score).toBe(100);
  });

  it('covers every advertised anti-pattern', () => {
    const ids = lintJmx(JMX_LINTER.samples.antiPatterns).findings.map((finding) => finding.id);
    expect(ids).toEqual(expect.arrayContaining([
      'ACTIVE_GUI_LISTENER',
      'LEGACY_BEANSHELL',
      'JSR223_NO_CACHE',
      'THREAD_SLEEP_IN_SCRIPT',
      'ZERO_RAMP_UP_HIGH_CONCURRENCY',
      'MISSING_HTTP_TIMEOUTS',
      'JAVA_HTTP_IMPLEMENTATION',
    ]));
  });
});
