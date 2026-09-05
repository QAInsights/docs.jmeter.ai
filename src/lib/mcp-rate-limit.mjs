/**
 * Per-IP rate limit for the /api/mcp endpoint.
 *
 * The MCP endpoint is unauthenticated and advertised to AI agents, so a
 * runaway client (retry loop, misconfigured agent) can burn the monthly
 * function-invocation quota single-handedly. This caps each client IP at
 * the limit configured in wrangler.jsonc per Cloudflare location. Tests can
 * inject the same small `{ limit() }` port.
 */

import { env } from 'cloudflare:workers';

/** Client backoff hint; enforcement remains canonical in wrangler.jsonc. */
export const MCP_RETRY_AFTER_SECONDS = 60;

/**
 * Cloudflare-native MCP request counter per client IP.
 *
 * @param {string} ip client address (sanitized into the key)
 * @param {RateLimit} [limiter]
 *   Rate limiter port; defaults to the generated Cloudflare binding.
 * @returns {Promise<{ allowed: true } | { allowed: false, retryAfter: number }>}
 *   Binding failures allow the request so legitimate MCP traffic stays online.
 */
export async function checkMcpRateLimit(ip, limiter = env.MCP_RATE_LIMITER) {
  const safeIp = String(ip).replace(/[^a-zA-Z0-9.:_-]/g, '_').slice(0, 64);
  try {
    const { success } = await limiter.limit({ key: `mcp:${safeIp}` });
    return success
      ? { allowed: true }
      : { allowed: false, retryAfter: MCP_RETRY_AFTER_SECONDS };
  } catch {
    return { allowed: true };
  }
}
