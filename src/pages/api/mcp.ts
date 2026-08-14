/**
 * /api/mcp — MCP (Model Context Protocol) Streamable HTTP endpoint.
 *
 * Exposes the docs.jmeter.ai documentation index to AI agents (Claude Code,
 * Qwen Code, Cursor, etc.) so they can ground JMeter answers in this site
 * and cite its URLs. Stateless mode: every request gets a fresh server and
 * transport, no session storage — Vercel serverless friendly.
 *
 * Tools:
 *   - search_jmeter_docs(query): BM25 search over the per-page chunk index
 *     (same retrieval as the Ask AI chatbot), returns titles, URLs, snippets.
 *   - get_jmeter_page(url): full markdown text of one documentation page.
 *
 * The index is generated at build time (scripts/generate-llms-chunks.mjs),
 * so this endpoint needs no database and no API keys.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { retrieve, INDEX } from '../../lib/rag.mjs';
import { checkMcpRateLimit } from '../../lib/mcp-rate-limit.mjs';
import { getClientIp } from '../../lib/session.mjs';

export const prerender = false;
export const maxDuration = 30;

const SERVER_NAME = 'jmeter-docs';
const SERVER_VERSION = '1.0.0';
const SNIPPET_CHARS = 500;
const MAX_PAGE_CHARS = 24000;

const SERVER_INSTRUCTIONS = [
  'You have access to the Apache JMeter community documentation at https://docs.jmeter.ai.',
  'Use search_jmeter_docs to find relevant pages, then get_jmeter_page to read one in full.',
  'Always cite the docs.jmeter.ai URL you used when answering.',
].join(' ');

/** Strip markdown noise so search snippets stay readable. */
function snippet(body: string): string {
  const cleaned = body
    .replace(/^import .*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<a id="[^"]*"><\/a>/g, '')
    .replace(/:::(note|tip|caution|danger)(\[[^\]]*\])?/g, '')
    .replace(/:::/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned.length > SNIPPET_CHARS
    ? cleaned.slice(0, SNIPPET_CHARS) + '...'
    : cleaned;
}

/**
 * Normalize a user-supplied page reference to a docs path. Accepts full
 * URLs (https://docs.jmeter.ai/topics/x/), absolute paths (/topics/x/),
 * or bare paths (topics/x), with or without trailing slash and .mdx/.html.
 */
export function normalizeDocPath(input: string): string {
  let pathText = input.trim();
  try {
    if (/^https?:\/\//i.test(pathText)) {
      pathText = new URL(pathText).pathname;
    }
  } catch {
    // Not a URL — treat as a path below.
  }
  return pathText
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.(mdx|html?)$/i, '');
}

/** Find an index chunk whose URL pathname matches the normalized path. */
export function findChunkByPath(pathname: string) {
  const clean = normalizeDocPath(pathname);
  if (!clean) return undefined;
  return INDEX.find((chunk) => {
    try {
      return normalizeDocPath(new URL(chunk.url).pathname) === clean;
    } catch {
      return false;
    }
  });
}

function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    'search_jmeter_docs',
    {
      title: 'Search JMeter documentation',
      description:
        'Search the Apache JMeter documentation on docs.jmeter.ai. Returns the most relevant pages with titles, URLs, and snippets. Use for any question about JMeter test plans, components, functions, properties, distributed testing, reports, or troubleshooting.',
      inputSchema: {
        query: z.string().min(1).describe('Search query, e.g. "how to correlate dynamic values" or "thread group ramp up"'),
      },
    },
    async ({ query }) => {
      const results = retrieve(query);
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No documentation pages on docs.jmeter.ai matched "${query}". Try broader keywords (e.g. "correlation" instead of a full sentence), or point the user at https://docs.jmeter.ai/topics/troubleshooting/.`,
            },
          ],
        };
      }
      const listing = results
        .map((r, i) => `${i + 1}. ${r.title}\nURL: ${r.url}\nSnippet: ${snippet(r.body)}`)
        .join('\n\n');
      return {
        content: [
          {
            type: 'text' as const,
            text: `Found ${results.length} relevant page(s) on docs.jmeter.ai. Use get_jmeter_page with a URL to read one in full.\n\n${listing}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'get_jmeter_page',
    {
      title: 'Read a JMeter documentation page',
      description:
        'Fetch the full markdown text of one docs.jmeter.ai page. Accepts the page URL (e.g. https://docs.jmeter.ai/topics/api-load-testing/) or a bare path (e.g. topics/api-load-testing).',
      inputSchema: {
        url: z.string().min(1).describe('Page URL or path, e.g. https://docs.jmeter.ai/user-manual/functions/ or user-manual/functions'),
      },
    },
    async ({ url }) => {
      const chunk = findChunkByPath(url);
      if (!chunk) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No documentation page found for "${url}". Use search_jmeter_docs to find valid pages.`,
            },
          ],
          isError: true,
        };
      }
      let body = chunk.body.trim();
      let truncatedNote = '';
      if (body.length > MAX_PAGE_CHARS) {
        body = body.slice(0, MAX_PAGE_CHARS);
        truncatedNote = `\n\n[...page truncated at ${MAX_PAGE_CHARS} characters]`;
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: `# ${chunk.title}\nSource: ${chunk.url}\n\n${body}${truncatedNote}`,
          },
        ],
      };
    },
  );

  return server;
}

export async function POST({ request }: { request: Request }) {
  const rate = await checkMcpRateLimit(getClientIp(request));
  if (rate && !rate.allowed) {
    // JSON-RPC-shaped error so MCP clients surface a meaningful message.
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: `Rate limit exceeded: max 120 requests/min per IP. Retry after ${rate.retryAfter}s.`,
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rate.retryAfter),
        },
      },
    );
  }
  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless: no session headers, Vercel-safe
      enableJsonResponse: true, // plain JSON responses (no SSE) for serverless
    });
    const server = createServer();
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/mcp] error:', message);
    return new Response(JSON.stringify({ error: 'MCP request failed: ' + message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** GET advertises the server for humans and directory crawlers. */
export async function GET() {
  return new Response(
    JSON.stringify(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        description:
          'Apache JMeter community documentation (docs.jmeter.ai): search and read guides, the user manual, error playbooks, and release notes.',
        transport: 'streamable-http',
        endpoint: 'https://docs.jmeter.ai/api/mcp',
        auth: 'none',
        tools: ['search_jmeter_docs', 'get_jmeter_page'],
        docs: 'https://docs.jmeter.ai/mcp/',
      },
      null,
      2,
    ),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

/** Stateless server: there are no sessions to terminate. */
export function DELETE() {
  return new Response(JSON.stringify({ error: 'Stateless MCP server: no sessions to delete.' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: 'GET, POST' },
  });
}
