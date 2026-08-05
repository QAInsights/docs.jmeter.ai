/**
 * /api/share — save an Ask AI conversation and return a shareable URL.
 *
 * Abuse control reuses the chat flow's bot protection: a valid signed
 * session cookie (set by /api/chat after the first Turnstile-verified
 * message) is accepted directly. Without a cookie, a fresh Turnstile
 * token is verified. In dev mode (no TURNSTILE_SECRET_KEY) both checks
 * pass so the feature is testable locally.
 *
 * Storage: Upstash Redis via src/lib/share-store.mjs (365-day TTL).
 * Response: `{ id, url }` or `{ error }`.
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
import { validateSharePayload, saveSharedConversation } from '../../lib/share-store.mjs';

export const prerender = false;
export const maxDuration = 15;

const SITE = 'https://docs.jmeter.ai';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');
const TURNSTILE_SECRET =
  process.env.TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET_KEY;
const GEMINI_API_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY;

// Same signing key as /api/chat so its session cookie verifies here.
function getSigningKey(): string {
  return GEMINI_API_KEY || 'dev-fallback-key';
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
  const cookies = parseCookies(request.headers.get('cookie'));
  const hasValidSession = verifySessionCookie(cookies[SESSION_COOKIE_NAME], getSigningKey());
  if (!hasValidSession) {
    const verified = await verifyTurnstileToken(
      turnstileToken,
      TURNSTILE_SECRET,
      getClientIp(request),
    );
    if (!verified) {
      return json(
        { error: 'Bot verification failed. Please refresh the page and try again.' },
        403,
      );
    }
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
  if (!hasValidSession) {
    headers['Set-Cookie'] =
      `${SESSION_COOKIE_NAME}=${createSessionCookie(getSigningKey())}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
  }

  return new Response(JSON.stringify({ id, url: `${SITE}/shared/${id}/` }), {
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
