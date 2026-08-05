/**
 * Shared Upstash Redis client for serverless endpoints.
 *
 * Env vars (auto-injected by the Vercel/Upstash integration on deploy):
 *   - UPSTASH_REDIS_REST_URL
 *   - UPSTASH_REDIS_REST_TOKEN
 *
 * Returns null when Redis is not configured (local dev) so callers can
 * degrade gracefully.
 */

import { Redis } from '@upstash/redis';
import { loadEnv } from 'vite';

// Load env from .env files (dev) — in prod (Vercel) process.env is already
// populated. Vite's loadEnv reads .env files that Astro/Vite don't auto-inject
// into process.env for .mjs modules in dev mode.
const _env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

let client = null;

/**
 * Get the shared Upstash Redis client, or null when unconfigured.
 * @returns {import('@upstash/redis').Redis | null}
 */
export function getRedisClient() {
  if (client !== null) return client || null;
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
