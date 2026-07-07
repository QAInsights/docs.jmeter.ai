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

import { Redis } from '@upstash/redis';
import { loadEnv } from 'vite';

const KEY = 'chat:total_count';

// Load env from .env files (dev) — in prod (Vercel) process.env is already
// populated. Vite's loadEnv reads .env files that Astro/Vite don't auto-inject
// into process.env for .mjs modules in dev mode.
const _env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

let client = null;
function getClient() {
  if (client !== null) return client;
  // Support both Upstash REST env var names (UPSTASH_REDIS_REST_*) and
  // legacy Vercel KV env var names (KV_REST_API_*).
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    _env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    _env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    _env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    _env.KV_REST_API_TOKEN;
  if (!url || !token) {
    client = false; // mark as unavailable so we don't re-check env on every call
    return null;
  }
  client = new Redis({ url, token });
  return client;
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
