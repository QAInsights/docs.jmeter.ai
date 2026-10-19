/**
 * /api/mcp — MCP (Model Context Protocol) Streamable HTTP endpoint.
 *
 * Exposes the docs.jmeter.ai documentation index and diagnostic tools to
 * AI agents (Claude Code, Qwen Code, Cursor, etc.). Ask AI (/api/chat)
 * uses the same createServer() factory in-process so the public MCP
 * surface and the on-site chatbot stay in lockstep.
 *
 * Stateless mode: every request gets a fresh server and transport, no
 * session storage — Cloudflare Workers / serverless friendly.
 *
 * The index is generated at build time (scripts/generate-llms-chunks.mjs),
 * so this endpoint needs no database and no API keys.
 *
 * Access: every method is gated by the mcprush gateway token. Callers must
 * send `x-mcprush-token: <MCPRUSH_TOKEN>` — the mcprush gateway attaches it
 * to every call it forwards after checking the buyer's key and plan. Any
 * request without a matching token (or while MCPRUSH_TOKEN is unset) gets
 * a 401 before rate limiting or the MCP handler run.
 */

import { timingSafeEqual } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { normalizeDocPath, findChunkByPath } from '../../lib/rag.mjs';
import { checkMcpRateLimit } from '../../lib/mcp-rate-limit.mjs';
import { getClientIp } from '../../lib/session.mjs';
import {
  createServer,
  SERVER_NAME,
  SERVER_VERSION,
  MCP_TOOL_NAMES,
  runCurlHarConversionTool,
  runOpenApiConversionTool,
  runGroovyLintTool,
  runJmxLintTool,
  runCorrelationSandboxTool,
} from '../../lib/mcp/server.mjs';
import {
  MCP_EVENT_TYPES,
  MCP_OUTCOMES,
  detectMcpClient,
  extractRequestMeta,
  sanitizeTelemetryQuery,
  measureInputSize,
  classifyToolOutcome,
  writeMcpEvent,
} from '../../lib/mcp/telemetry.mjs';

export {
  normalizeDocPath,
  findChunkByPath,
  createServer,
  MCP_TOOL_NAMES,
  runCurlHarConversionTool,
  runOpenApiConversionTool,
  runGroovyLintTool,
  runJmxLintTool,
  runCorrelationSandboxTool,
};

export const prerender = false;

const MCPRUSH_GATE_BODY = JSON.stringify({
  jsonrpc: '2.0',
  id: null,
  error: { code: -32001, message: 'This endpoint answers mcprush only.' },
});

/**
 * mcprush gateway gate: constant-time compare of the `x-mcprush-token`
 * header against the MCPRUSH_TOKEN secret. Fail-closed — an unset secret
 * refuses every call, so a missing deploy secret is loud instead of a
 * silent unpaid opening. Runs first in every handler.
 */
function mcprushGateResponse(request: Request): Response | null {
  const want = process.env.MCPRUSH_TOKEN;
  const sent = Buffer.from(request.headers.get('x-mcprush-token') || '');
  const good = Buffer.from(want || '');
  const ok = Boolean(want) && sent.length === good.length && timingSafeEqual(sent, good);
  if (ok) return null;
  return new Response(MCPRUSH_GATE_BODY, {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function POST({ request, locals }: { request: Request; locals: any }) {
  const gated = mcprushGateResponse(request);
  if (gated) return gated;

  const startedAt = Date.now();
  const reqMeta = extractRequestMeta(request);
  const baseClient = detectMcpClient(reqMeta.userAgent);

  const limited = await mcpRateLimitResponse(request, 'POST /api/mcp', reqMeta, baseClient);
  if (limited) return limited;

  const clonedRequest = request.clone();
  let handledToolCalls = 0;

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless: no session headers, Vercel-safe
      enableJsonResponse: true, // plain JSON responses (no SSE) for serverless
    });
    const server = createServer({
      onToolCall({ toolName, args, result, durationMs }) {
        handledToolCalls++;
        const classification = classifyToolOutcome(toolName, args, result);
        writeMcpEvent({
          eventType: MCP_EVENT_TYPES.TOOL_CALL,
          rpcMethod: 'tools/call',
          toolName,
          outcome: classification.outcome,
          query: sanitizeTelemetryQuery(toolName, args),
          clientFamily: baseClient.family,
          clientRaw: baseClient.raw,
          country: reqMeta.country,
          colo: reqMeta.colo,
          subDetail: classification.subDetail,
          latencyMs: durationMs,
          resultCount: classification.resultCount,
          isError: classification.isError,
          isZeroResult: classification.isZeroResult,
          inputChars: measureInputSize(toolName, args),
          telemetryDisabled: reqMeta.telemetryDisabled,
        });
      },
    });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    const latencyMs = Date.now() - startedAt;

    recordRpcLifecycleEvents(clonedRequest, locals, {
      reqMeta,
      baseClient,
      latencyMs,
      getHandledToolCalls: () => handledToolCalls,
    });

    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/mcp] error:', message);
    writeMcpEvent({
      eventType: MCP_EVENT_TYPES.HTTP_ERROR,
      rpcMethod: 'POST /api/mcp',
      outcome: MCP_OUTCOMES.HTTP_500,
      clientFamily: baseClient.family,
      clientRaw: baseClient.raw,
      country: reqMeta.country,
      colo: reqMeta.colo,
      latencyMs: Date.now() - startedAt,
      isError: 1,
      telemetryDisabled: reqMeta.telemetryDisabled,
    });
    return new Response(JSON.stringify({ error: 'MCP request failed: ' + message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}

/**
 * Reject the optional Streamable HTTP listening stream because this server is
 * stateless and has no server-initiated messages. Other GETs advertise the
 * server for humans and directory crawlers.
 */
export async function GET({ request }: { request: Request }) {
  const gated = mcprushGateResponse(request);
  if (gated) return gated;

  const startedAt = Date.now();
  const reqMeta = extractRequestMeta(request);
  const client = detectMcpClient(reqMeta.userAgent);

  const limited = await mcpRateLimitResponse(request, 'GET /api/mcp', reqMeta, client);
  if (limited) return limited;

  if (acceptsEventStream(request)) {
    writeMcpEvent({
      eventType: MCP_EVENT_TYPES.DISCOVERY,
      rpcMethod: 'GET /api/mcp',
      outcome: MCP_OUTCOMES.HTTP_405,
      clientFamily: client.family,
      clientRaw: client.raw,
      country: reqMeta.country,
      colo: reqMeta.colo,
      subDetail: 'sse_rejected',
      latencyMs: Date.now() - startedAt,
      isError: 1,
      telemetryDisabled: reqMeta.telemetryDisabled,
    });
    return new Response(
      JSON.stringify({ error: 'This stateless MCP endpoint does not offer an SSE listening stream.' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Allow: 'GET, POST',
          Vary: 'Accept',
        },
      },
    );
  }

  writeMcpEvent({
    eventType: MCP_EVENT_TYPES.DISCOVERY,
    rpcMethod: 'GET /api/mcp',
    outcome: MCP_OUTCOMES.OK,
    clientFamily: client.family,
    clientRaw: client.raw,
    country: reqMeta.country,
    colo: reqMeta.colo,
    latencyMs: Date.now() - startedAt,
    resultCount: MCP_TOOL_NAMES.length,
    telemetryDisabled: reqMeta.telemetryDisabled,
  });

  return new Response(
    JSON.stringify(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        description:
          'Apache JMeter community documentation (docs.jmeter.ai): search and read guides, convert cURL/HAR/OpenAPI to JMX, lint JMX and Groovy, calculate workload sizing, plan distributed clusters, query tuning properties, fetch Groovy recipes, and lookup diagnostic error playbooks.',
        transport: 'streamable-http',
        endpoint: 'https://docs.jmeter.ai/api/mcp',
        auth: 'x-mcprush-token',
        tools: [...MCP_TOOL_NAMES],
        docs: 'https://docs.jmeter.ai/mcp/',
      },
      null,
      2,
    ),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        Vary: 'Accept',
      },
    },
  );
}

/**
 * Inspect the cloned JSON-RPC payload asynchronously via Cloudflare waitUntil
 * to record lifecycle methods (`initialize` clientInfo, `tools/list`, `ping`)
 * and any `tools/call` rejected by schema validation before reaching the tool handler.
 */
function recordRpcLifecycleEvents(
  clonedRequest: Request,
  locals: any,
  context: {
    reqMeta: { userAgent: string; country: string; colo: string; telemetryDisabled?: boolean };
    baseClient: { family: string; raw: string };
    latencyMs: number;
    getHandledToolCalls: () => number;
  },
) {
  const work = (async () => {
    if (context.reqMeta.telemetryDisabled) return;
    try {
      const payload: any = await clonedRequest.json();
      const calls = Array.isArray(payload) ? payload : [payload];
      let unhandledTools = 0;

      for (const call of calls) {
        const method = typeof call?.method === 'string' ? call.method : '';
        if (!method) continue;

        if (method === 'tools/call') {
          const name = typeof call?.params?.name === 'string' ? call.params.name : '';
          const args = call?.params?.arguments;
          const isKnown = MCP_TOOL_NAMES.includes(name);
          if (!isKnown || context.getHandledToolCalls() === 0) {
            unhandledTools++;
            if (unhandledTools > context.getHandledToolCalls()) {
              writeMcpEvent({
                eventType: MCP_EVENT_TYPES.TOOL_CALL,
                rpcMethod: 'tools/call',
                toolName: isKnown ? name : name.slice(0, 64),
                outcome: isKnown ? MCP_OUTCOMES.SCHEMA_ERROR : MCP_OUTCOMES.UNKNOWN_TOOL,
                query: isKnown ? sanitizeTelemetryQuery(name, args) : '',
                clientFamily: context.baseClient.family,
                clientRaw: context.baseClient.raw,
                country: context.reqMeta.country,
                colo: context.reqMeta.colo,
                latencyMs: context.latencyMs,
                isError: 1,
                inputChars: isKnown ? measureInputSize(name, args) : 0,
                telemetryDisabled: context.reqMeta.telemetryDisabled,
              });
            }
          }
          continue;
        }

        const client =
          method === 'initialize' && call?.params?.clientInfo
            ? detectMcpClient(context.reqMeta.userAgent, call.params.clientInfo)
            : context.baseClient;

        writeMcpEvent({
          eventType: MCP_EVENT_TYPES.RPC_LIFECYCLE,
          rpcMethod: method,
          outcome: MCP_OUTCOMES.OK,
          clientFamily: client.family,
          clientRaw: client.raw,
          country: context.reqMeta.country,
          colo: context.reqMeta.colo,
          subDetail: typeof call?.params?.protocolVersion === 'string' ? call.params.protocolVersion : '',
          latencyMs: context.latencyMs,
          telemetryDisabled: context.reqMeta.telemetryDisabled,
        });
      }
    } catch {
      /* non-JSON or malformed body: ignore */
    }
  })();

  const ctx = locals?.cfContext;
  if (ctx?.waitUntil) ctx.waitUntil(work);
  else work.catch(() => {});
}

async function mcpRateLimitResponse(
  request: Request,
  rpcMethod: string,
  reqMeta: { userAgent: string; country: string; colo: string; telemetryDisabled?: boolean },
  client: { family: string; raw: string },
): Promise<Response | null> {
  const rate = await checkMcpRateLimit(getClientIp(request));
  if (rate.allowed) return null;

  writeMcpEvent({
    eventType: MCP_EVENT_TYPES.RATE_LIMIT,
    rpcMethod,
    outcome: MCP_OUTCOMES.RATE_LIMITED,
    clientFamily: client.family,
    clientRaw: client.raw,
    country: reqMeta.country,
    colo: reqMeta.colo,
    isError: 1,
    telemetryDisabled: reqMeta.telemetryDisabled,
  });

  // JSON-RPC-shaped error so MCP clients surface a meaningful message.
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32000,
        message: `Rate limit exceeded. Retry after ${rate.retryAfter}s.`,
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Retry-After': String(rate.retryAfter),
      },
    },
  );
}

function acceptsEventStream(request: Request): boolean {
  return (request.headers.get('accept') || '')
    .split(',')
    .some((mediaType) => mediaType.trim().split(';', 1)[0] === 'text/event-stream');
}

/** Stateless server: there are no sessions to terminate. */
export function DELETE({ request }: { request: Request }) {
  const gated = mcprushGateResponse(request);
  if (gated) return gated;

  return new Response(JSON.stringify({ error: 'Stateless MCP server: no sessions to delete.' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Allow: 'GET, POST',
    },
  });
}
