/**
 * Global chat counter backed by Upstash Redis (REST).
 *
 * Env vars (auto-injected by the Vercel/Upstash integration on deploy):
 *   - UPSTASH_REDIS_REST_URL
 *   - UPSTASH_REDIS_REST_TOKEN
 *
 * In local dev without these vars, all calls no-op (return null / 0) so the
 * chat still works — the counter simply isn't persisted.
 */

import { getRedisClient } from './redis.mjs';

const KEY = 'chat:total_count';

function getClient() {
  return getRedisClient();
}

/**
 * Atomically increment the global chat counter by 1.
 * Returns the new value, or null if Redis is not configured.
 * Never throws — counter failures must not break the chat flow.
 */
export async function incrementChatCount() {
  const redis = getClient();
  if (!redis) return null;
  try {
    return await redis.incr(KEY);
  } catch {
    return null;
  }
}

/**
 * Read the current global chat counter.
 * Returns 0 if Redis is not configured or the key is unset.
 * Never throws.
 */
export async function getChatCount() {
  const redis = getClient();
  if (!redis) return 0;
  try {
    const v = await redis.get(KEY);
    return typeof v === 'number' ? v : Number(v) || 0;
  } catch {
    return 0;
  }
}

/** ISO week key (YYYY-Wnn) for weekly per-tool MCP usage buckets. */
export function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fd = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fd + 3);
  const week = 1 + Math.round((d - firstThursday) / 604800000);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const MCP_TOOL_KEY_PREFIX = 'mcp:tool';
const MCP_WEEK_KEY_PREFIX = 'mcp:calls';

/**
 * Increment weekly usage counters for an MCP tool call:
 *   mcp:tool:<name>:<yyyy-Wnn>  (per tool)
 *   mcp:calls:<yyyy-Wnn>        (all tools)
 * Returns the per-tool count, or null if Redis is not configured.
 * Never throws — telemetry must not break tool serving.
 */
export async function incrementMcpToolCount(toolName) {
  const redis = getClient();
  if (!redis) return null;
  const week = isoWeekKey();
  try {
    const pipeline = redis.pipeline();
    const toolKey = `${MCP_TOOL_KEY_PREFIX}:${toolName}:${week}`;
    pipeline.incr(toolKey);
    pipeline.incr(`${MCP_WEEK_KEY_PREFIX}:${week}`);
    const [count] = await pipeline.exec();
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
}
