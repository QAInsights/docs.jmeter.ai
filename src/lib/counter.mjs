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
