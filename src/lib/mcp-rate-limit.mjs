/**
 * Per-IP rate limit for the /api/mcp endpoint.
 *
 * The MCP endpoint is unauthenticated and advertised to AI agents, so a
 * runaway client (retry loop, misconfigured agent) can burn the monthly
 * function-invocation quota single-handedly. This caps each client IP at
 * MCP_RATE_MAX requests per fixed window; the hard cap lives at the Vercel
 * firewall layer, this is the portable application-level backstop.
 *
 * Follows the share-store.mjs pattern: fixed window via INCR + EXPIRE,
 * fails open (returns null) when Redis is unavailable so an Upstash
 * outage never takes the endpoint down with it.
 */

import { getRedisClient } from './redis.mjs';

/** Rate-limit window: one minute, fixed. */
export const MCP_RATE_WINDOW_SECONDS = 60;

/** Max MCP requests per client IP per window. A normal agent session (initialize + a handful of tool calls per user question) stays far below this. */
export const MCP_RATE_MAX = 120;

/**
 * Fixed-window MCP request counter per client IP.
 *
 * @param {string} ip client address (sanitized into the key)
 * @param {object | null} [client] Redis client; defaults to the shared client
 * @returns {Promise<{ allowed: true } | { allowed: false, retryAfter: number } | null>}
 *   null when Redis is unavailable, so the caller should allow the request.
 */
export async function checkMcpRateLimit(ip, client = getRedisClient()) {
  if (!client) return null;
  const key = `mcp:rate:${String(ip).replace(/[^a-zA-Z0-9.:_-]/g, '_').slice(0, 64)}`;
  try {
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, MCP_RATE_WINDOW_SECONDS);
    return count <= MCP_RATE_MAX
      ? { allowed: true }
      : { allowed: false, retryAfter: MCP_RATE_WINDOW_SECONDS };
  } catch {
    return null;
  }
}
