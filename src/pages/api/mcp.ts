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
 */

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
} from '../../lib/mcp/server.mjs';

export {
  normalizeDocPath,
  findChunkByPath,
  createServer,
  MCP_TOOL_NAMES,
  runCurlHarConversionTool,
};

export const prerender = false;

export async function POST({ request }: { request: Request }) {
  const limited = await mcpRateLimitResponse(request);
  if (limited) return limited;

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless: no session headers, Vercel-safe
      enableJsonResponse: true, // plain JSON responses (no SSE) for serverless
    });
    const server = createServer();
    await server.connect(transport);
    const response = await transport.handleRequest(request);
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
  const limited = await mcpRateLimitResponse(request);
  if (limited) return limited;

  if (acceptsEventStream(request)) {
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

  return new Response(
    JSON.stringify(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        description:
          'Apache JMeter community documentation (docs.jmeter.ai): search and read guides, convert cURL/HAR to JMX, lint JMX test plans, calculate workload sizing, plan distributed clusters, query tuning properties, fetch Groovy recipes, and lookup diagnostic error playbooks.',
        transport: 'streamable-http',
        endpoint: 'https://docs.jmeter.ai/api/mcp',
        auth: 'none',
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

async function mcpRateLimitResponse(request: Request): Promise<Response | null> {
  const rate = await checkMcpRateLimit(getClientIp(request));
  if (rate.allowed) return null;

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
export function DELETE() {
  return new Response(JSON.stringify({ error: 'Stateless MCP server: no sessions to delete.' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Allow: 'GET, POST',
    },
  });
}
