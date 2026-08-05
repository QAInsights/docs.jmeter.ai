/**
 * Storage for shareable Ask AI conversations.
 *
 * Conversations are stored in Upstash Redis under `share:<id>` with a
 * 365-day TTL. The id is a short URL-safe random string. Pure helpers
 * (validation, id generation) are exported separately for unit testing.
 */

import { getRedisClient } from './redis.mjs';

/** Conversations expire after one year. Shared threads are indexable pages, so they need a lifespan long enough to be discovered and earn traffic. */
export const SHARE_TTL_SECONDS = 365 * 24 * 60 * 60;

/** Payload caps, mirroring the /api/chat limits. */
export const MAX_SHARED_MESSAGES = 60; // 30 user+assistant pairs
export const MAX_SHARED_MESSAGE_CHARS = 10000;

/** Ids: 10 chars from a URL-safe alphabet (~60 bits of entropy). */
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const ID_LENGTH = 10;

/**
 * Generate a short URL-safe conversation id.
 * @returns {string}
 */
export function generateShareId() {
  const bytes = new Uint8Array(ID_LENGTH);
  // crypto is global in Node 19+ and Vercel edge/node runtimes.
  globalThis.crypto.getRandomValues(bytes);
  let id = '';
  for (const b of bytes) id += ID_ALPHABET[b % ID_ALPHABET.length];
  return id;
}

/**
 * Validate and normalize a share payload. Returns `{ ok: true, messages }`
 * or `{ ok: false, error }` so the endpoint can respond without throwing.
 *
 * @param {unknown} raw
 * @returns {{ ok: true, messages: Array<{ role: 'user' | 'assistant', content: string }> } | { ok: false, error: string }}
 */
export function validateSharePayload(raw) {
  const messages = Array.isArray(raw) ? raw : null;
  if (!messages || messages.length === 0) {
    return { ok: false, error: 'No messages to share.' };
  }
  if (messages.length > MAX_SHARED_MESSAGES) {
    return { ok: false, error: 'Conversation is too long to share.' };
  }
  const cleaned = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'Invalid message format.' };
    const role = /** @type {{ role?: unknown, content?: unknown }} */ (m).role;
    const content = /** @type {{ role?: unknown, content?: unknown }} */ (m).content;
    if (role !== 'user' && role !== 'assistant') {
      return { ok: false, error: 'Invalid message role.' };
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, error: 'Invalid message content.' };
    }
    if (content.length > MAX_SHARED_MESSAGE_CHARS) {
      return { ok: false, error: 'Message too long to share.' };
    }
    cleaned.push({ role, content });
  }
  // A share without at least one assistant answer has nothing to show.
  if (!cleaned.some((m) => m.role === 'assistant')) {
    return { ok: false, error: 'Wait for the AI to answer before sharing.' };
  }
  return { ok: true, messages: cleaned };
}

/**
 * Save a validated conversation. Returns the share id, or null when Redis
 * is unavailable. Never throws.
 *
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {Promise<string | null>}
 */
export async function saveSharedConversation(messages) {
  const redis = getRedisClient();
  if (!redis) return null;
  const id = generateShareId();
  try {
    await redis.set(`share:${id}`, { messages, createdAt: Date.now() }, {
      ex: SHARE_TTL_SECONDS,
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Load a shared conversation by id. Returns `{ messages, createdAt }`,
 * or null when missing/expired/invalid id. Never throws.
 *
 * @param {string} id
 * @returns {Promise<{ messages: Array<{ role: string, content: string }>, createdAt: number } | null>}
 */
export async function getSharedConversation(id) {
  if (!/^[A-Za-z2-9]{6,24}$/.test(id)) return null;
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const data = await redis.get(`share:${id}`);
    if (!data || typeof data !== 'object') return null;
    const record = /** @type {{ messages?: unknown, createdAt?: unknown }} */ (data);
    if (!Array.isArray(record.messages)) return null;
    const validation = validateSharePayload(record.messages);
    if (!validation.ok) return null;
    return {
      messages: validation.messages,
      createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
    };
  } catch {
    return null;
  }
}
