import { describe, it, expect } from 'vitest';
import {
  signSandboxToken,
  issueSandboxToken,
  verifySandboxToken,
  handleSandboxRequest,
} from '../../src/lib/sandbox-engine.mjs';
import {
  SANDBOX_FLOWS,
  SANDBOX_TARGETS,
  buildSandboxJmxPlan,
  generateLocalSandboxServerScript,
} from '../../src/lib/sandbox-jmx-templates.mjs';
import { lintJmx } from '../../src/lib/mcp/jmx-linter.mjs';
import { runCorrelationSandboxTool } from '../../src/lib/mcp/server.mjs';
import { TOOLS_REGISTRY, CORRELATION_SANDBOX } from '../../src/lib/tools-config.mjs';
import { GET, POST, OPTIONS } from '../../src/pages/api/sandbox/[...slug].ts';

describe('sandbox-engine token signing and verification', () => {
  it('issues and validates stateless deterministic tokens', () => {
    const token = issueSandboxToken('csrf', 'run42');
    expect(token).toMatch(/^csrf_run42_[0-9a-f]{10}$/);
    const check = verifySandboxToken('csrf', token, '${csrf_token}', 'Boundary Extractor', '/playbook');
    expect(check.valid).toBe(true);
    if (check.valid) expect(check.seed).toBe('run42');
  });

  it('diagnoses unresolved JMeter variables and NOT_FOUND defaults', () => {
    const literalVar = verifySandboxToken('csrf', '${csrf_token}', '${csrf_token}', 'Boundary Extractor', '/p');
    expect(literalVar.valid).toBe(false);
    if (!literalVar.valid) {
      expect(literalVar.reason).toContain('Unresolved JMeter variable');
      expect(literalVar.playbookUrl).toContain('extractor-not-found-default-value');
    }

    const notFound = verifySandboxToken('csrf', 'NOT_FOUND', '${csrf_token}', 'Boundary Extractor', '/p');
    expect(notFound.valid).toBe(false);
  });

  it('rejects stale recorded tokens and tampered signatures', () => {
    const stale = verifySandboxToken('csrf', 'csrf_stale_recorded_token', '${csrf_token}', 'Boundary', '/p');
    expect(stale.valid).toBe(false);
    if (!stale.valid) expect(stale.reason).toContain('Stale recorded token');

    const tampered = verifySandboxToken('csrf', 'csrf_run42_0000000000', '${csrf_token}', 'Boundary', '/p');
    expect(tampered.valid).toBe(false);
    if (!tampered.valid) expect(tampered.reason).toContain('Invalid token signature');
  });
});

describe('sandbox-engine multi-step flows', () => {
  it('Flow 1: completes HTML form + csrf_token + Set-Cookie chain and rejects uncorrelated requests', () => {
    const step1 = handleSandboxRequest({ method: 'GET', path: '/api/sandbox/flow1/login-page', seed: 's1' });
    expect(step1.status).toBe(200);
    const cookieHeader = step1.headers['set-cookie'];
    const sidMatch = /JMETER_SANDBOX_SID=([^;]+)/.exec(cookieHeader);
    const csrfMatch = /name="csrf_token" value="([^"]+)"/.exec(step1.body);
    expect(sidMatch).toBeTruthy();
    expect(csrfMatch).toBeTruthy();

    // Uncorrelated request (missing cookie)
    const failNoCookie = handleSandboxRequest({
      method: 'POST',
      path: '/flow1/login',
      body: `username=qa&csrf_token=${csrfMatch[1]}`,
    });
    expect(failNoCookie.status).toBe(403);

    // Uncorrelated request (literal ${csrf_token})
    const failBadCsrf = handleSandboxRequest({
      method: 'POST',
      path: '/flow1/login',
      headers: { cookie: `JMETER_SANDBOX_SID=${sidMatch[1]}` },
      body: 'username=qa&csrf_token=${csrf_token}',
    });
    expect(failBadCsrf.status).toBe(403);

    // Correlated request
    const step2 = handleSandboxRequest({
      method: 'POST',
      path: '/flow1/login',
      headers: { cookie: `JMETER_SANDBOX_SID=${sidMatch[1]}` },
      body: `username=qa&csrf_token=${csrfMatch[1]}`,
    });
    expect(step2.status).toBe(200);
    expect(JSON.parse(step2.body).status).toBe('VERIFIED');
  });

  it('Flow 2: completes OAuth2 JWT -> Order Creation -> Dynamic Polling chain', () => {
    const step1 = handleSandboxRequest({ method: 'POST', path: '/flow2/auth/token', seed: 's2' });
    expect(step1.status).toBe(200);
    const { access_token } = JSON.parse(step1.body).auth;

    const step2 = handleSandboxRequest({
      method: 'POST',
      path: '/flow2/orders',
      headers: { Authorization: `Bearer ${access_token}` },
      body: '{"sku":"JM-PRO-1","qty":2}',
      seed: 's2',
    });
    expect(step2.status).toBe(201);
    const { orderId } = JSON.parse(step2.body).data;

    const step3 = handleSandboxRequest({
      method: 'GET',
      path: `/flow2/orders/${orderId}`,
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(step3.status).toBe(200);
    expect(JSON.parse(step3.body).orderState).toBe('COMPLETED');
  });

  it('Flow 3: completes ASP.NET __VIEWSTATE + X-Checkout-Ticket header chain', () => {
    const step1 = handleSandboxRequest({ method: 'GET', path: '/flow3/checkout.aspx', seed: 's3' });
    expect(step1.status).toBe(200);
    const vsMatch = /id="__VIEWSTATE" value="([^"]+)"/.exec(step1.body);
    expect(vsMatch).toBeTruthy();

    const step2 = handleSandboxRequest({
      method: 'POST',
      path: '/flow3/checkout.aspx',
      body: `__VIEWSTATE=${encodeURIComponent(vsMatch[1])}`,
      seed: 's3',
    });
    expect(step2.status).toBe(200);
    const ticket = step2.headers['x-checkout-ticket'];
    expect(ticket).toMatch(/^tkt_/);

    const step3 = handleSandboxRequest({
      method: 'GET',
      path: '/flow3/confirm.aspx',
      headers: { 'X-Checkout-Ticket': ticket },
    });
    expect(step3.status).toBe(200);
    expect(JSON.parse(step3.body).status).toBe('VERIFIED');
  });

  it('Flow 4: simulates HTTP 429 rate limiting and HTTP 200 soft errors', () => {
    const rateLimited = handleSandboxRequest({
      method: 'GET',
      path: '/flow4/chaos',
      query: { mode: '429' },
    });
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.headers['retry-after']).toBe('2');

    const softError = handleSandboxRequest({
      method: 'GET',
      path: '/flow4/chaos',
      query: { mode: 'soft_error' },
    });
    expect(softError.status).toBe(200);
    expect(JSON.parse(softError.body).status).toBe('ERROR');
  });
});

describe('sandbox-jmx-templates & MCP integration', () => {
  it('generates valid JMeter 5.6.3 JMX plans that pass lintJmx with score 100', () => {
    for (const flow of SANDBOX_FLOWS) {
      for (const mode of ['solved', 'challenge']) {
        const xml = buildSandboxJmxPlan({ flowId: flow.id, mode, target: 'edge' });
        expect(xml).toContain('<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">');
        const lint = lintJmx(xml);
        expect(lint.score).toBe(100);
        expect(lint.findings).toEqual([]);
      }
    }
  });

  it('switches target host between docs.jmeter.ai and localhost:8787', () => {
    const edgeXml = buildSandboxJmxPlan({ flowId: 'flow1', mode: 'solved', target: 'edge' });
    expect(edgeXml).toContain('<stringProp name="HTTPSampler.domain">docs.jmeter.ai</stringProp>');

    const localXml = buildSandboxJmxPlan({ flowId: 'flow1', mode: 'solved', target: 'local' });
    expect(localXml).toContain('<stringProp name="HTTPSampler.domain">localhost</stringProp>');
    expect(localXml).toContain('<stringProp name="HTTPSampler.port">8787</stringProp>');
  });

  it('generates a standalone zero-dependency Node.js sandbox server script', () => {
    const script = generateLocalSandboxServerScript();
    expect(script).toContain("import http from 'node:http'");
    expect(script).toContain('/flow1/login-page');
    expect(script).toContain('/flow2/orders');
    expect(script).toContain('/flow3/checkout.aspx');
    expect(script).toContain('/flow4/chaos');
  });

  it('exposes get_correlation_sandbox via MCP and registers in TOOLS_REGISTRY', () => {
    expect(TOOLS_REGISTRY).toContainEqual({
      title: 'Correlation & Practice Sandbox',
      path: '/tools/correlation-sandbox/',
    });
    expect(CORRELATION_SANDBOX.flows.length).toBe(4);
    expect(SANDBOX_TARGETS.edge.baseUrl).toBe('https://docs.jmeter.ai/api/sandbox');

    const res = runCorrelationSandboxTool({ flowId: 'flow2', mode: 'solved', target: 'local' });
    expect(res.isError).toBeUndefined();
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.flowId).toBe('flow2');
    expect(parsed.target).toBe('http://localhost:8787/api/sandbox');
    expect(parsed.jmxXml).toContain('JSONPostProcessor');
  });

  it('serves /api/sandbox/[...slug] via Astro SSR handlers', async () => {
    const optRes = await OPTIONS({ request: new Request('https://docs.jmeter.ai/api/sandbox/health', { method: 'OPTIONS' }) });
    expect(optRes.status).toBe(204);

    const getRes = await GET({ request: new Request('https://docs.jmeter.ai/api/sandbox/flow1/login-page') });
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('set-cookie')).toContain('JMETER_SANDBOX_SID=');

    const postRes = await POST({
      request: new Request('https://docs.jmeter.ai/api/sandbox/flow2/auth/token', {
        method: 'POST',
        body: '{}',
      }),
    });
    expect(postRes.status).toBe(200);
  });
});
