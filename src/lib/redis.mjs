/**
 * Shared Upstash Redis client for serverless endpoints.
 *
 * Env vars (set via `wrangler secret put` in prod, `.dev.vars` in local dev):
 *   - UPSTASH_REDIS_REST_URL
 *   - UPSTASH_REDIS_REST_TOKEN
 *
 * Returns null when Redis is not configured (local dev) so callers can
 * degrade gracefully.
 */

import { Redis } from '@upstash/redis';

let client = null;

/**
 * Get the shared Upstash Redis client, or null when unconfigured.
 * @returns {import('@upstash/redis').Redis | null}
 */
export function getRedisClient() {
  if (client !== null) return client || null;
  // Support both Upstash REST env var names (UPSTASH_REDIS_REST_*) and
  // legacy Vercel KV env var names (KV_REST_API_*).
  // Workers populates process.env from bindings/secrets via the
  // nodejs_compat_populate_process_env compatibility flag.
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    client = false; // mark as unavailable so we don't re-check env on every call
    return null;
  }
  client = new Redis({ url, token });
  return client;
}
