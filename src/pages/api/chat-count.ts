/**
 * /api/chat-count — lightweight read-only endpoint for the global chat
 * counter. Used by the Ask AI panel on open to display the live total
 * before any message is sent.
 *
 * Cached at the edge for 60s to keep cost/latency negligible.
 */

import { getChatCount } from '../../lib/counter.mjs';

export const prerender = false;

export async function GET() {
  const count = await getChatCount();
  return new Response(JSON.stringify({ count }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
