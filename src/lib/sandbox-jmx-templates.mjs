/**
 * JMX Test Plan Generator & Local Node.js Server Generator for the
 * Correlation & Practice Sandbox.
 *
 * Produces:
 *   1. SANDBOX_FLOWS metadata for the UI & MCP
 *   2. buildSandboxJmxPlan({ flowId, mode, target }) -> JMeter 5.6.3 .jmx XML
 *   3. generateLocalSandboxServerScript() -> zero-dependency Node.js server
 */

export const SANDBOX_TARGETS = {
  edge: {
    id: 'edge',
    label: 'Cloud Edge Ready (docs.jmeter.ai)',
    protocol: 'https',
    domain: 'docs.jmeter.ai',
    port: '',
    basePath: '/api/sandbox',
    baseUrl: 'https://docs.jmeter.ai/api/sandbox',
  },
  local: {
    id: 'local',
    label: 'Local Node Server (localhost:8787)',
    protocol: 'http',
    domain: 'localhost',
    port: '8787',
    basePath: '/api/sandbox',
    baseUrl: 'http://localhost:8787/api/sandbox',
  },
};

export const SANDBOX_FLOWS = [
  {
    id: 'flow1',
    index: '01',
    shortLabel: '01 · CSRF & Cookie',
    title: 'Flow 1: HTML Form + Dynamic csrf_token + Session Cookie',
    extractorBadge: 'Boundary Extractor → ${csrf_token}',
    playbookUrl: '/topics/errors/401-403-after-recording/',
    guideUrl: '/topics/correlation-dynamic-values/',
    extractorConfig: {
      element: 'Boundary Extractor + HTTP Cookie Manager',
      fieldToCheck: 'Response Body',
      referenceName: 'csrf_token',
      leftBoundary: 'name="csrf_token" value="',
      rightBoundary: '"',
      matchNo: '1',
      defaultValue: 'NOT_FOUND',
    },
    steps: [
      {
        step: 1,
        method: 'GET',
        path: '/flow1/login-page',
        statusBadge: '200 OK · 14ms',
        tokenChip: 'csrf_token: "csrf_live8f92_..."',
        summary: 'Returns login HTML form with hidden csrf_token and Set-Cookie: JMETER_SANDBOX_SID.',
      },
      {
        step: 2,
        method: 'POST',
        path: '/flow1/login',
        statusBadge: '200 Verified',
        tokenChip: 'Cookie + Token Matched',
        summary: 'Validates both the session cookie and correlated form field csrf_token=${csrf_token}.',
      },
    ],
  },
  {
    id: 'flow2',
    index: '02',
    shortLabel: '02 · JWT Bearer',
    title: 'Flow 2: OAuth2 JWT Login -> Order Creation -> Dynamic Polling',
    extractorBadge: 'JSON Extractor → $.auth.access_token',
    playbookUrl: '/topics/jwt-oauth-sso/',
    guideUrl: '/topics/api-load-testing/',
    extractorConfig: {
      element: 'JSON Extractor + HTTP Header Manager',
      fieldToCheck: 'Response Body (JSON)',
      referenceName: 'access_token, orderId',
      leftBoundary: '$.auth.access_token',
      rightBoundary: '$.data.orderId',
      matchNo: '1',
      defaultValue: 'NOT_FOUND',
    },
    steps: [
      {
        step: 1,
        method: 'POST',
        path: '/flow2/auth/token',
        statusBadge: '200 OK · 18ms',
        tokenChip: 'access_token: "jwt_live8f92_..."',
        summary: 'Issues a signed Bearer token inside $.auth.access_token.',
      },
      {
        step: 2,
        method: 'POST',
        path: '/flow2/orders',
        statusBadge: '201 Created',
        tokenChip: 'orderId: "ord_live8f92_..."',
        summary: 'Requires Authorization: Bearer ${access_token} and returns dynamic $.data.orderId.',
      },
      {
        step: 3,
        method: 'GET',
        path: '/flow2/orders/${orderId}',
        statusBadge: '200 Verified',
        tokenChip: 'Order State: COMPLETED',
        summary: 'Polls order status using both Bearer header and dynamic URL path ${orderId}.',
      },
    ],
  },
  {
    id: 'flow3',
    index: '03',
    shortLabel: '03 · ASP.NET State',
    title: 'Flow 3: ASP.NET __VIEWSTATE + Response Header Ticket',
    extractorBadge: 'Header Regex → X-Checkout-Ticket',
    playbookUrl: '/topics/errors/works-in-browser-fails-in-jmeter/',
    guideUrl: '/topics/correlation-dynamic-values/',
    extractorConfig: {
      element: 'Boundary Extractor (Body) + Regex Extractor (Headers)',
      fieldToCheck: 'Body (Step 1) + Response Headers (Step 2)',
      referenceName: 'viewstate, checkout_ticket',
      leftBoundary: 'id="__VIEWSTATE" value="',
      rightBoundary: 'X-Checkout-Ticket:\\s*([^\\r\\n]+)',
      matchNo: '1',
      defaultValue: 'NOT_FOUND',
    },
    steps: [
      {
        step: 1,
        method: 'GET',
        path: '/flow3/checkout.aspx',
        statusBadge: '200 OK · 16ms',
        tokenChip: '__VIEWSTATE: "vs_live8f92_..."',
        summary: 'Returns legacy ASP.NET form containing hidden __VIEWSTATE token.',
      },
      {
        step: 2,
        method: 'POST',
        path: '/flow3/checkout.aspx',
        statusBadge: '200 + Header',
        tokenChip: 'X-Checkout-Ticket: "tkt_..."',
        summary: 'Validates __VIEWSTATE and issues X-Checkout-Ticket in Response Headers.',
      },
      {
        step: 3,
        method: 'GET',
        path: '/flow3/confirm.aspx',
        statusBadge: '200 Verified',
        tokenChip: 'Header Ticket Matched',
        summary: 'Requires correlated header X-Checkout-Ticket: ${checkout_ticket}.',
      },
    ],
  },
  {
    id: 'flow4',
    index: '04',
    shortLabel: '04 · Chaos & 429',
    title: 'Flow 4: HTTP 429 Rate Limits & Silent HTTP 200 Soft Errors',
    extractorBadge: 'JSON Assertion -> $.status == "OK"',
    playbookUrl: '/topics/errors/http-429-rate-limited/',
    guideUrl: '/topics/jmeter-assertions-guide/',
    extractorConfig: {
      element: 'JSON Assertion + Constant Throughput Timer',
      fieldToCheck: 'JSON Path $.status',
      referenceName: 'Expected Value: OK',
      leftBoundary: '$.status',
      rightBoundary: 'OK',
      matchNo: '1',
      defaultValue: 'Fail if not "OK"',
    },
    steps: [
      {
        step: 1,
        method: 'GET',
        path: '/flow4/chaos?mode=soft_error',
        statusBadge: '200 Soft-Fail',
        tokenChip: '$.status: "ERROR" (DB_POOL)',
        summary: 'Returns HTTP 200 OK with {"status":"ERROR"} to test JSON Assertion detection.',
      },
      {
        step: 2,
        method: 'GET',
        path: '/flow4/chaos?mode=healthy',
        statusBadge: '200 Verified',
        tokenChip: '$.status: "OK" Passed',
        summary: 'Returns HTTP 200 OK with {"status":"OK"} passing JSON Assertion.',
      },
    ],
  },
];

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function boundaryExtractorXml(name, refName, left, right, useHeaders = 'false') {
  return `          <BoundaryExtractor guiclass="BoundaryExtractorGui" testclass="BoundaryExtractor" testname="${escapeXml(name)}" enabled="true">
            <stringProp name="BoundaryExtractor.useHeaders">${useHeaders}</stringProp>
            <stringProp name="BoundaryExtractor.refname">${escapeXml(refName)}</stringProp>
            <stringProp name="BoundaryExtractor.lboundary">${escapeXml(left)}</stringProp>
            <stringProp name="BoundaryExtractor.rboundary">${escapeXml(right)}</stringProp>
            <stringProp name="BoundaryExtractor.default">NOT_FOUND</stringProp>
            <stringProp name="BoundaryExtractor.match_number">1</stringProp>
          </BoundaryExtractor>
          <hashTree/>`;
}

function jsonExtractorXml(name, refName, jsonPath) {
  return `          <JSONPostProcessor guiclass="JSONPostProcessorGui" testclass="JSONPostProcessor" testname="${escapeXml(name)}" enabled="true">
            <stringProp name="JSONPostProcessor.referenceNames">${escapeXml(refName)}</stringProp>
            <stringProp name="JSONPostProcessor.jsonPathExprs">${escapeXml(jsonPath)}</stringProp>
            <stringProp name="JSONPostProcessor.match_numbers">1</stringProp>
            <stringProp name="JSONPostProcessor.defaultValues">NOT_FOUND</stringProp>
          </JSONPostProcessor>
          <hashTree/>`;
}

function headerManagerXml(name, headers) {
  const entries = Object.entries(headers)
    .map(
      ([k, v]) => `              <elementProp name="${escapeXml(k)}" elementType="Header">
                <stringProp name="Header.name">${escapeXml(k)}</stringProp>
                <stringProp name="Header.value">${escapeXml(v)}</stringProp>
              </elementProp>`,
    )
    .join('\n');
  return `          <HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="${escapeXml(name)}" enabled="true">
            <collectionProp name="HeaderManager.headers">
${entries}
            </collectionProp>
          </HeaderManager>
          <hashTree/>`;
}

function httpSamplerXml({ name, method, path, body = '', childrenXml = '' }) {
  const hasBody = Boolean(body);
  const bodySection = hasBody
    ? `          <boolProp name="HTTPSampler.postBodyRaw">true</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments" guiclass="HTTPArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
            <collectionProp name="Arguments.arguments">
              <elementProp name="" elementType="HTTPArgument">
                <boolProp name="HTTPArgument.always_encode">false</boolProp>
                <stringProp name="Argument.value">${escapeXml(body)}</stringProp>
                <stringProp name="Argument.metadata">=</stringProp>
              </elementProp>
            </collectionProp>
          </elementProp>`
    : `          <elementProp name="HTTPsampler.Arguments" elementType="Arguments" guiclass="HTTPArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
            <collectionProp name="Arguments.arguments"/>
          </elementProp>`;

  const hashContent = childrenXml
    ? `        <hashTree>\n${childrenXml}\n        </hashTree>`
    : '        <hashTree/>';

  return `        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="${escapeXml(name)}" enabled="true">
${bodySection}
          <stringProp name="HTTPSampler.path">${escapeXml(path)}</stringProp>
          <stringProp name="HTTPSampler.method">${escapeXml(method)}</stringProp>
          <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
          <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
          <stringProp name="HTTPSampler.implementation">HttpClient4</stringProp>
        </HTTPSamplerProxy>
${hashContent}`;
}

function buildFlowSamplersXml(flowId, isSolved) {
  if (flowId === 'flow1') {
    const step1Child = isSolved
      ? boundaryExtractorXml('Extract csrf_token', 'csrf_token', 'name="csrf_token" value="', '"')
      : '';
    const tokenVal = isSolved ? '${csrf_token}' : 'csrf_stale_recorded_token';
    const step2Child = headerManagerXml('Form Content-Type', {
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    return [
      httpSamplerXml({
        name: '01 GET /flow1/login-page',
        method: 'GET',
        path: '/api/sandbox/flow1/login-page',
        childrenXml: step1Child,
      }),
      httpSamplerXml({
        name: '02 POST /flow1/login',
        method: 'POST',
        path: '/api/sandbox/flow1/login',
        body: `username=perf_engineer&csrf_token=${tokenVal}`,
        childrenXml: step2Child,
      }),
    ].join('\n');
  }

  if (flowId === 'flow2') {
    const step1Child = [
      headerManagerXml('JSON Content-Type', { 'Content-Type': 'application/json' }),
      ...(isSolved ? [jsonExtractorXml('Extract access_token', 'access_token', '$.auth.access_token')] : []),
    ].join('\n');
    const bearerVal = isSolved ? 'Bearer ${access_token}' : 'Bearer jwt_stale_recorded_token';
    const step2Child = [
      headerManagerXml('Bearer Auth Header', {
        'Content-Type': 'application/json',
        Authorization: bearerVal,
      }),
      ...(isSolved ? [jsonExtractorXml('Extract orderId', 'orderId', '$.data.orderId')] : []),
    ].join('\n');
    const orderPath = isSolved
      ? '/api/sandbox/flow2/orders/${orderId}'
      : '/api/sandbox/flow2/orders/ord_stale_recorded_id';
    return [
      httpSamplerXml({
        name: '01 POST /flow2/auth/token',
        method: 'POST',
        path: '/api/sandbox/flow2/auth/token',
        body: '{"client_id":"jmeter-lab","grant_type":"client_credentials"}',
        childrenXml: step1Child,
      }),
      httpSamplerXml({
        name: '02 POST /flow2/orders',
        method: 'POST',
        path: '/api/sandbox/flow2/orders',
        body: '{"sku":"JM-PRO-1","qty":2}',
        childrenXml: step2Child,
      }),
      httpSamplerXml({
        name: '03 GET /flow2/orders/${orderId}',
        method: 'GET',
        path: orderPath,
        childrenXml: headerManagerXml('Bearer Auth Header', { Authorization: bearerVal }),
      }),
    ].join('\n');
  }

  if (flowId === 'flow3') {
    const step1Child = isSolved
      ? boundaryExtractorXml('Extract __VIEWSTATE', 'viewstate', 'id="__VIEWSTATE" value="', '"')
      : '';
    const vsVal = isSolved ? '${viewstate}' : 'vs_stale_recorded_viewstate';
    const step2Child = [
      headerManagerXml('Form Header', { 'Content-Type': 'application/x-www-form-urlencoded' }),
      ...(isSolved
        ? [boundaryExtractorXml('Extract X-Checkout-Ticket Header', 'checkout_ticket', 'x-checkout-ticket: ', '\n', 'true')]
        : []),
    ].join('\n');
    const tktVal = isSolved ? '${checkout_ticket}' : 'tkt_stale_recorded_ticket';
    return [
      httpSamplerXml({
        name: '01 GET /flow3/checkout.aspx',
        method: 'GET',
        path: '/api/sandbox/flow3/checkout.aspx',
        childrenXml: step1Child,
      }),
      httpSamplerXml({
        name: '02 POST /flow3/checkout.aspx',
        method: 'POST',
        path: '/api/sandbox/flow3/checkout.aspx',
        body: `__VIEWSTATE=${vsVal}&action=submit`,
        childrenXml: step2Child,
      }),
      httpSamplerXml({
        name: '03 GET /flow3/confirm.aspx',
        method: 'GET',
        path: '/api/sandbox/flow3/confirm.aspx',
        childrenXml: headerManagerXml('Checkout Ticket Header', { 'X-Checkout-Ticket': tktVal }),
      }),
    ].join('\n');
  }

  // Flow 4: Chaos & JSON Assertion
  const jsonAssertion = isSolved
    ? `          <JSONPathAssertion guiclass="JSONPathAssertionGui" testclass="JSONPathAssertion" testname="Assert $.status == OK" enabled="true">
            <stringProp name="JSON_PATH">$.status</stringProp>
            <stringProp name="EXPECTED_VALUE">OK</stringProp>
            <boolProp name="JSONVALIDATION">true</boolProp>
            <boolProp name="EXPECT_NULL">false</boolProp>
            <boolProp name="INVERT">false</boolProp>
          </JSONPathAssertion>
          <hashTree/>`
    : '';
  const modeParam = isSolved ? 'healthy' : 'soft_error';
  return httpSamplerXml({
    name: `01 GET /flow4/chaos?mode=${modeParam}`,
    method: 'GET',
    path: `/api/sandbox/flow4/chaos?mode=${modeParam}`,
    childrenXml: jsonAssertion,
  });
}

/**
 * Generate a valid Apache JMeter 5.6.3 .jmx XML string for a sandbox flow.
 * @param {{ flowId?: string, mode?: 'challenge' | 'solved', target?: 'edge' | 'local' }} [opts]
 */
export function buildSandboxJmxPlan(opts = {}) {
  const flow = SANDBOX_FLOWS.find((f) => f.id === opts.flowId) || SANDBOX_FLOWS[0];
  const mode = opts.mode === 'solved' ? 'solved' : 'challenge';
  const isSolved = mode === 'solved';
  const targetCfg = opts.target === 'local' ? SANDBOX_TARGETS.local : SANDBOX_TARGETS.edge;

  const includeCookieMgr = flow.id !== 'flow1' || isSolved;
  const cookieXml = includeCookieMgr
    ? `      <CookieManager guiclass="CookiePanel" testclass="CookieManager" testname="HTTP Cookie Manager" enabled="true">
        <collectionProp name="CookieManager.cookies"/>
        <boolProp name="CookieManager.clearEachIteration">true</boolProp>
      </CookieManager>
      <hashTree/>\n`
    : '';

  const samplersXml = buildFlowSamplersXml(flow.id, isSolved);
  const planTitle = `${flow.title} (${isSolved ? 'Solved Correlated' : 'Challenge Uncorrelated'})`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="${escapeXml(planTitle)}" enabled="true">
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
        <collectionProp name="Arguments.arguments"/>
      </elementProp>
      <stringProp name="TestPlan.comments">Generated by docs.jmeter.ai Correlation &amp; Practice Sandbox</stringProp>
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
    </TestPlan>
    <hashTree>
      <ConfigTestElement guiclass="HttpDefaultsGui" testclass="ConfigTestElement" testname="HTTP Request Defaults" enabled="true">
        <elementProp name="HTTPsampler.Arguments" elementType="Arguments" guiclass="HTTPArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
          <collectionProp name="Arguments.arguments"/>
        </elementProp>
        <stringProp name="HTTPSampler.domain">${targetCfg.domain}</stringProp>
        <stringProp name="HTTPSampler.port">${targetCfg.port}</stringProp>
        <stringProp name="HTTPSampler.protocol">${targetCfg.protocol}</stringProp>
        <stringProp name="HTTPSampler.connect_timeout">5000</stringProp>
        <stringProp name="HTTPSampler.response_timeout">15000</stringProp>
      </ConfigTestElement>
      <hashTree/>
${cookieXml}      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Sandbox Users" enabled="true">
        <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
        <stringProp name="ThreadGroup.num_threads">1</stringProp>
        <stringProp name="ThreadGroup.ramp_time">1</stringProp>
        <boolProp name="ThreadGroup.scheduler">false</boolProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller" enabled="true">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <stringProp name="LoopController.loops">1</stringProp>
        </elementProp>
      </ThreadGroup>
      <hashTree>
${samplersXml}
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>`;
}

export { generateLocalSandboxServerScript } from './sandbox-local-server.mjs';
