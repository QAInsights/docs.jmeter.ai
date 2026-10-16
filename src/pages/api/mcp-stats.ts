/**
 * /api/mcp-stats — lightweight read-only endpoint returning aggregated
 * Docs MCP tool usage stats from Cloudflare Workers Analytics Engine (`mcp_events`).
 *
 * Accepts an optional `?days=N` query param (1..90, default 30).
 * Cached at the Cloudflare edge for 5 minutes (s-maxage=300) so page loads
 * never consume Analytics Engine SQL read quota on every request.
 */

import { queryMcpStats } from '../../lib/mcp/analytics-sql.mjs';

export const prerender = false;

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const days = daysParam ? Number(daysParam) : undefined;
  const stats = await queryMcpStats({ days });

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
