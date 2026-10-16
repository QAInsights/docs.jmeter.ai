import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:workers';
import {
  MCP_DATASET_NAME,
  MCP_EVENT_TYPES,
  MCP_OUTCOMES,
  MAX_BLOB_CHARS,
  detectMcpClient,
  extractRequestMeta,
  sanitizeTelemetryQuery,
  measureInputSize,
  classifyToolOutcome,
  writeMcpEvent,
} from '../../src/lib/mcp/telemetry.mjs';
import {
  buildToolBreakdownSql,
  buildZeroResultQueriesSql,
  buildClientBreakdownSql,
  buildRateLimitSql,
  queryMcpStats,
} from '../../src/lib/mcp/analytics-sql.mjs';
import { GET as getMcp, POST as postMcp } from '../../src/pages/api/mcp.ts';
import { GET as getMcpStats } from '../../src/pages/api/mcp-stats.ts';

describe('detectMcpClient', () => {
  it('identifies known AI agents from User-Agent or initialize clientInfo', () => {
    expect(detectMcpClient('claude-code/1.2.3').family).toBe('claude-code');
    expect(detectMcpClient('Mozilla/5.0 Cursor/0.48.0').family).toBe('cursor');
    expect(detectMcpClient('Visual Studio Code/1.99').family).toBe('vscode');
    expect(detectMcpClient('Windsurf/1.4').family).toBe('windsurf');
    expect(detectMcpClient('Antigravity/2.0').family).toBe('antigravity');
    expect(detectMcpClient('qwen-code/0.1.0').family).toBe('qwen');
    expect(detectMcpClient('curl/8.7.1').family).toBe('curl');
  });

  it('prefers initialize clientInfo when present', () => {
    const detected = detectMcpClient('node-fetch/1.0', {
      name: 'claude-code',
      version: '2.1.0',
    });
    expect(detected.family).toBe('claude-code');
    expect(detected.raw).toBe('claude-code/2.1.0');
  });

  it('falls back to custom clientInfo name or unknown/other', () => {
    expect(detectMcpClient('', { name: 'CustomAgent', version: '1.0' })).toEqual({
      family: 'customagent',
      raw: 'CustomAgent/1.0',
    });
    expect(detectMcpClient('')).toEqual({ family: 'unknown', raw: '' });
    expect(detectMcpClient('python-httpx/0.27.0').family).toBe('other');
  });
});

describe('extractRequestMeta', () => {
  it('extracts country, colo, and User-Agent from Cloudflare request', () => {
    const req = new Request('https://docs.jmeter.ai/api/mcp', {
      headers: { 'User-Agent': 'Cursor/1.0' },
    });
    Object.defineProperty(req, 'cf', {
      value: { country: 'US', colo: 'IAD' },
    });
    expect(extractRequestMeta(req)).toEqual({
      userAgent: 'Cursor/1.0',
      country: 'US',
      colo: 'IAD',
    });
  });

  it('falls back to cf-ipcountry header or safe defaults', () => {
    const req = new Request('https://docs.jmeter.ai/api/mcp', {
      headers: { 'cf-ipcountry': 'DE' },
    });
    expect(extractRequestMeta(req)).toEqual({
      userAgent: '',
      country: 'DE',
      colo: 'UNKNOWN',
    });
  });
});

describe('sanitizeTelemetryQuery & measureInputSize', () => {
  it('redacts secrets and truncates search/lookup queries', () => {
    const dirty =
      'Authorization: Bearer secret-token-123 password=mysecret eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.sig';
    const clean = sanitizeTelemetryQuery('search_jmeter_docs', { query: dirty });
    expect(clean).not.toContain('secret-token-123');
    expect(clean).not.toContain('mysecret');
    expect(clean).toContain('[redacted]');
    expect(clean).toContain('[jwt]');

    const longQuery = 'a'.repeat(400);
    expect(sanitizeTelemetryQuery('lookup_jmeter_property', { query: longQuery })).toHaveLength(
      MAX_BLOB_CHARS,
    );
  });

  it('never returns raw payloads for code, spec, or batch triage tools', () => {
    expect(sanitizeTelemetryQuery('lint_jmx_snippet', { jmxContent: '<jmeterTestPlan/>' })).toBe('');
    expect(sanitizeTelemetryQuery('lint_groovy_script', { code: 'log.info("secret")' })).toBe('');
    expect(sanitizeTelemetryQuery('convert_curl_or_har_to_jmx', { input: 'curl https://x.com' })).toBe('');
    expect(sanitizeTelemetryQuery('convert_openapi_to_jmx', { input: 'openapi: 3.0.0' })).toBe('');
    expect(sanitizeTelemetryQuery('triage_errors', { signatures: ['a | 500 | err'] })).toBe('');
  });

  it('measures input character length across tool argument shapes', () => {
    expect(measureInputSize('lint_jmx_snippet', { jmxContent: '12345' })).toBe(5);
    expect(measureInputSize('triage_errors', { signatures: ['abc', 'de'] })).toBe(5);
    expect(measureInputSize('calculate_workload_model', { targetRps: 100 })).toBe(0);
  });
});

describe('classifyToolOutcome', () => {
  it('detects zero_result vs matched for search_jmeter_docs', () => {
    const miss = classifyToolOutcome('search_jmeter_docs', { query: 'xyz' }, {
      content: [{ type: 'text', text: 'No documentation pages on docs.jmeter.ai matched "xyz".' }],
    });
    expect(miss).toMatchObject({
      outcome: MCP_OUTCOMES.ZERO_RESULT,
      resultCount: 0,
      isZeroResult: 1,
      isError: 0,
    });

    const hit = classifyToolOutcome('search_jmeter_docs', { query: 'csv' }, {
      content: [{ type: 'text', text: 'Found 4 relevant page(s) on docs.jmeter.ai.' }],
    });
    expect(hit).toMatchObject({
      outcome: MCP_OUTCOMES.OK,
      resultCount: 4,
      isZeroResult: 0,
      isError: 0,
    });
  });

  it('detects zero_result on lookup_component, lookup_function, and get_jmeter_page misses', () => {
    const compMiss = classifyToolOutcome('lookup_component', { name: 'Nope' }, {
      isError: true,
      content: [{ type: 'text', text: 'No component named "Nope" was found.' }],
    });
    expect(compMiss.outcome).toBe(MCP_OUTCOMES.ZERO_RESULT);
    expect(compMiss.isZeroResult).toBe(1);
    expect(compMiss.isError).toBe(1);
  });

  it('distinguishes none, uncertain, and matched on lookup_error_playbook', () => {
    const none = classifyToolOutcome('lookup_error_playbook', { query: 'foo' }, {
      content: [{ type: 'text', text: 'No specific playbook matched "foo".' }],
    });
    expect(none.outcome).toBe(MCP_OUTCOMES.ZERO_RESULT);
    expect(none.subDetail).toBe('none');

    const uncertain = classifyToolOutcome('lookup_error_playbook', { query: 'bar' }, {
      content: [{ type: 'text', text: 'No specific playbook matched "bar".\n\nPossible playbooks:\n- A' }],
    });
    expect(uncertain.outcome).toBe(MCP_OUTCOMES.UNCERTAIN);
    expect(uncertain.isZeroResult).toBe(1);
  });
});

describe('writeMcpEvent', () => {
  it('writes canonical indexes, blobs, and doubles to Analytics Engine dataset', () => {
    const points = [];
    const mockDataset = {
      writeDataPoint(dp) {
        points.push(dp);
      },
    };

    const ok = writeMcpEvent(
      {
        eventType: MCP_EVENT_TYPES.TOOL_CALL,
        rpcMethod: 'tools/call',
        toolName: 'search_jmeter_docs',
        outcome: MCP_OUTCOMES.OK,
        query: 'thread group',
        clientFamily: 'claude-code',
        clientRaw: 'claude-code/1.0',
        country: 'US',
        colo: 'SJC',
        subDetail: 'bm25',
        latencyMs: 12,
        resultCount: 5,
        isError: 0,
        isZeroResult: 0,
        inputChars: 12,
      },
      mockDataset,
    );

    expect(ok).toBe(true);
    expect(points).toHaveLength(1);
    expect(points[0].indexes).toEqual(['search_jmeter_docs']);
    expect(points[0].blobs[0]).toBe('tool_call');
    expect(points[0].blobs[2]).toBe('search_jmeter_docs');
    expect(points[0].blobs[4]).toBe('thread group');
    expect(points[0].blobs[5]).toBe('claude-code');
    expect(points[0].doubles).toEqual([12, 1, 5, 0, 0, 12]);
  });

  it('swallows dataset errors and returns false when unbound', () => {
    expect(writeMcpEvent({ eventType: 'tool_call', rpcMethod: 'tools/call', outcome: 'ok' }, null)).toBe(false);
    const throwingDataset = {
      writeDataPoint() {
        throw new Error('boom');
      },
    };
    expect(
      writeMcpEvent({ eventType: 'tool_call', rpcMethod: 'tools/call', outcome: 'ok' }, throwingDataset),
    ).toBe(false);
  });
});

describe('analytics-sql & /api/mcp-stats', () => {
  it('builds sample-safe SQL queries using _sample_interval', () => {
    expect(buildToolBreakdownSql({ days: 14 })).toContain('SUM(_sample_interval) AS calls');
    expect(buildToolBreakdownSql({ days: 14 })).toContain("INTERVAL '14' DAY");
    expect(buildZeroResultQueriesSql({ limit: 10 })).toContain('double5 = 1');
    expect(buildClientBreakdownSql()).toContain('GROUP BY client_family, rpc_method');
    expect(buildRateLimitSql()).toContain("blob1 = 'rate_limit'");
  });

  it('returns unconfigured empty stats when Cloudflare credentials are absent', async () => {
    const stats = await queryMcpStats({ accountId: '', apiToken: '' });
    expect(stats).toEqual({
      configured: false,
      windowDays: 30,
      totalCalls: 0,
      zeroResultCalls: 0,
      errorCalls: 0,
      tools: [],
    });
  });

  it('aggregates tool rows from Analytics Engine SQL API response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      async json() {
        return {
          data: [
            { tool: 'search_jmeter_docs', calls: 120, avg_latency_ms: 8.44, errors: 0, zero_results: 7 },
            { tool: 'lint_jmx_snippet', calls: 30, avg_latency_ms: 14.2, errors: 2, zero_results: 0 },
          ],
        };
      },
    }));

    const stats = await queryMcpStats({
      accountId: 'acc_123',
      apiToken: 'tok_456',
      days: 7,
      fetchImpl: fetchMock,
    });

    expect(stats.configured).toBe(true);
    expect(stats.windowDays).toBe(7);
    expect(stats.totalCalls).toBe(150);
    expect(stats.zeroResultCalls).toBe(7);
    expect(stats.errorCalls).toBe(2);
    expect(stats.tools[0]).toEqual({
      tool: 'search_jmeter_docs',
      calls: 120,
      avgLatencyMs: 8.4,
      errors: 0,
      zeroResults: 7,
    });
  });

  it('GET /api/mcp-stats returns 200 with edge Cache-Control headers', async () => {
    const res = await getMcpStats({
      request: new Request('https://docs.jmeter.ai/api/mcp-stats?days=30'),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
    const body = await res.json();
    expect(body).toHaveProperty('totalCalls');
    expect(body).toHaveProperty('tools');
  });
});

describe('/api/mcp endpoint telemetry integration', () => {
  const origWrite = env.MCP_ANALYTICS.writeDataPoint;

  afterEach(() => {
    env.MCP_ANALYTICS.writeDataPoint = origWrite;
  });

  it('records tool_call and rpc_lifecycle events on POST /api/mcp and discovery on GET /api/mcp', async () => {
    const recorded = [];
    env.MCP_ANALYTICS.writeDataPoint = (dp) => recorded.push(dp);

    const getRes = await getMcp({
      request: new Request('https://docs.jmeter.ai/api/mcp', {
        headers: { Accept: 'application/json', 'User-Agent': 'Cursor/0.49' },
      }),
    });
    expect(getRes.status).toBe(200);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].blobs[0]).toBe(MCP_EVENT_TYPES.DISCOVERY);
    expect(recorded[0].blobs[5]).toBe('cursor');

    const waitUntilPromises = [];
    const postRes = await postMcp({
      request: new Request('https://docs.jmeter.ai/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'User-Agent': 'claude-code/1.0.0',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'search_jmeter_docs',
            arguments: { query: 'nonexistent_ gibberish_query_999999' },
          },
        }),
      }),
      locals: {
        cfContext: {
          waitUntil(p) {
            waitUntilPromises.push(p);
          },
        },
      },
    });
    expect(postRes.status).toBe(200);
    await Promise.all(waitUntilPromises);

    const toolEvent = recorded.find((dp) => dp.blobs[0] === MCP_EVENT_TYPES.TOOL_CALL);
    expect(toolEvent).toBeDefined();
    expect(toolEvent.blobs[2]).toBe('search_jmeter_docs');
    expect(toolEvent.blobs[3]).toBe(MCP_OUTCOMES.ZERO_RESULT);
    expect(toolEvent.blobs[5]).toBe('claude-code');
    expect(toolEvent.doubles[4]).toBe(1); // isZeroResult
  }, 15000);
});
