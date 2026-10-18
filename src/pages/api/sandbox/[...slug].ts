/**
 * /api/sandbox/[...slug] — Hosted Stateless Correlation & Practice Target.
 *
 * Designed for 1-thread JMeter correlation debugging and script verification.
 * Protected by per-IP Cloudflare rate limiting. For high-RPS load testing,
 * users can download the zero-dependency local server (`jmeter-sandbox.mjs`)
 * from /tools/correlation-sandbox/.
 */

import { handleSandboxRequest } from '../../../lib/sandbox-engine.mjs';
import { checkMcpRateLimit } from '../../../lib/mcp-rate-limit.mjs';
import { getClientIp } from '../../../lib/session.mjs';

export const prerender = false;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Checkout-Ticket, X-Sandbox-Sid, Cookie',
  'Access-Control-Expose-Headers': 'X-Checkout-Ticket, X-Sandbox-Sid, Set-Cookie, Retry-After',
  'Cache-Control': 'no-store',
};

async function dispatchSandbox({ request }: { request: Request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const clientIp = getClientIp(request);
  const rate = await checkMcpRateLimit(`sandbox:${clientIp}`);
  if (!rate.allowed) {
    return new Response(
      JSON.stringify(
        {
          status: 'RATE_LIMITED',
          error: `Cloud sandbox rate limit reached. Retry after ${rate.retryAfter}s.`,
          hint: 'The hosted /api/sandbox endpoint is intended for 1-thread correlation debugging. For high-RPS load tests, download jmeter-sandbox.mjs from https://docs.jmeter.ai/tools/correlation-sandbox/ and run node jmeter-sandbox.mjs locally.',
        },
        null,
        2,
      ),
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': String(rate.retryAfter),
        },
      },
    );
  }

  const url = new URL(request.url);
  const query: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    query[k] = v;
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((val, key) => {
    headers[key.toLowerCase()] = val;
  });

  let body = '';
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.text();
    } catch {
      body = '';
    }
  }

  const result = handleSandboxRequest({
    method: request.method,
    path: url.pathname,
    query,
    headers,
    body,
  });

  return new Response(result.body, {
    status: result.status,
    headers: {
      ...CORS_HEADERS,
      ...(result.headers || {}),
    },
  });
}

export const GET = dispatchSandbox;
export const POST = dispatchSandbox;
export const PUT = dispatchSandbox;
export const DELETE = dispatchSandbox;
export const OPTIONS = dispatchSandbox;
