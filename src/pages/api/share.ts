/**
 * /api/share — save an Ask AI conversation and return a shareable URL.
 *
 * Abuse control reuses the chat flow's bot protection: a valid signed
 * session cookie (set by /api/chat after the first Turnstile-verified
 * message) is accepted directly. Without a cookie, a fresh Turnstile
 * token is verified. In dev mode (no TURNSTILE_SECRET_KEY) both checks
 * pass so the feature is testable locally. On top of that, a fixed-window
 * per-IP rate limit caps how many threads one client can publish.
 *
 * Shared pages are intentionally indexable (each thread is a long-tail SEO
 * page), so this endpoint treats abuse as a first-class concern: strict
 * payload caps, bot gating, rate limiting, and the public page renders
 * content through the escape-first sanitizer in src/lib/shared-markdown.mjs.
 *
 * Storage: Upstash Redis via src/lib/share-store.mjs (365-day TTL).
 * Response: `{ id, url }` or `{ error }`. The url uses the request's own
 * origin so preview deployments link to themselves, not production.
 */

import { loadEnv } from 'vite';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionCookie,
  verifySessionCookie,
  parseCookies,
  verifyTurnstileToken,
  getClientIp,
} from '../../lib/session.mjs';
import {
  validateSharePayload,
  saveSharedConversation,
  checkShareRateLimit,
} from '../../lib/share-store.mjs';

export const prerender = false;

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');
const TURNSTILE_SECRET =
  process.env.TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET_KEY;
const GEMINI_API_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY;

// Same signing key as /api/chat so its session cookie verifies here.
// Fail closed: in production a missing key means cookies are neither
// verified nor issued, rather than trusting a public fallback constant.
function getSigningKey(): string | null {
  if (GEMINI_API_KEY) return GEMINI_API_KEY;
  return process.env.NODE_ENV === 'production' ? null : 'dev-fallback-key';
}

export async function POST({ request }: { request: Request }) {
  let rawMessages: unknown;
  let turnstileToken = '';
  try {
    const body = await request.json();
    rawMessages = body?.messages;
    turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const validation = validateSharePayload(rawMessages);
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  // --- Bot protection: session cookie first, Turnstile fallback ---------
  const signingKey = getSigningKey();
  const clientIp = getClientIp(request);
  const cookies = parseCookies(request.headers.get('cookie'));
  const hasValidSession = verifySessionCookie(cookies[SESSION_COOKIE_NAME], signingKey);
  if (!hasValidSession) {
    const verified = await verifyTurnstileToken(turnstileToken, TURNSTILE_SECRET, clientIp);
    if (!verified) {
      return json(
        { error: 'Bot verification failed. Please refresh the page and try again.' },
        403,
      );
    }
  }

  // --- Per-IP rate limit -------------------------------------------------
  // Shared pages are indexable, so one Turnstile pass must not allow
  // unlimited UGC publishing. Redis unavailable: degrade to the normal
  // save path (which already returns 503 when Redis is down).
  const rate = await checkShareRateLimit(clientIp);
  if (rate && !rate.allowed) {
    return json(
      { error: 'Too many shared conversations from this network. Please try again later.' },
      429,
    );
  }

  const id = await saveSharedConversation(validation.messages);
  if (!id) {
    return json(
      { error: 'Sharing is temporarily unavailable. Please try again later.' },
      503,
    );
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // If the caller proved humanity via Turnstile just now, issue the same
  // session cookie the chat endpoint uses so follow-up shares skip checks.
  // Skipped when no signing key is available (fail closed, no cookies).
  if (!hasValidSession && signingKey) {
    headers['Set-Cookie'] =
      `${SESSION_COOKIE_NAME}=${createSessionCookie(signingKey)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
  }

  // Echo the request's own origin so preview deployments mint preview URLs.
  const origin = new URL(request.url).origin;
  return new Response(JSON.stringify({ id, url: `${origin}/shared/${id}/` }), {
    status: 200,
    headers,
  });
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
