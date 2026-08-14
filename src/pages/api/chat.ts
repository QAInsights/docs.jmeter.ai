/**
 * /api/chat — serverless chat endpoint for the "Ask AI" assistant.
 *
 * Architecture:
 *   - Client sends `{ messages, turnstileToken }`.
 *   - Cloudflare Turnstile validates the token server-side to block
 *     curl/bot abuse. After the first successful verification, a signed
 *     HttpOnly cookie (30 min) allows subsequent messages without
 *     re-verification. If no Turnstile secret is configured (dev mode),
 *     validation is skipped entirely.
 *   - The last user message is used as a retrieval query against a
 *     pre-built per-page chunk index (src/lib/llms-chunks.json). BM25
 *     scores pick the top-8 most relevant JMeter docs pages.
 *   - If pages are found: they are injected into the system prompt as
 *     grounding context (RAG). The model is told to answer ONLY from
 *     the docs.
 *   - If no pages are found: an ungrounded system prompt is used instead,
 *     allowing the model to answer from general JMeter knowledge. The
 *     response includes an `X-Grounded: false` header so the UI can show
 *     a "not from docs" notice.
 *   - Vercel AI SDK `streamText` calls Google Gemini (free tier) and the
 *     response is streamed back as plain text chunks. Source URLs are
 *     exposed in an `X-Sources` header (URL-encoded).
 *
 * Env vars:
 *   - GOOGLE_GENERATIVE_AI_API_KEY — Google Gemini API key (required)
 *   - TURNSTILE_SECRET_KEY — Cloudflare Turnstile secret key (prod, optional in dev)
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  streamText,
  toTextStream,
  createTextStreamResponse,
  type ModelMessage,
} from 'ai';
import { retrieve, buildSystemPrompt, buildUngroundedPrompt } from '../../lib/rag.mjs';
import { incrementChatCount } from '../../lib/counter.mjs';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionCookie,
  verifySessionCookie,
  parseCookies,
  verifyTurnstileToken,
  getClientIp,
} from '../../lib/session.mjs';

export const prerender = false;

// Google Gemini model — free tier: 15 RPM, 1,500 requests/day.
const MODEL = 'gemini-2.5-flash';

// Workers populate process.env from bindings/secrets via the
// nodejs_compat_populate_process_env flag; in local dev use .dev.vars.
const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

// --- Signed session cookie helpers ----------------------------------------
// Cookie signing/verification and Turnstile validation live in
// ../../lib/session.mjs (shared with /api/share). The Gemini API key
// doubles as the HMAC signing key.

// Fail closed: in production a missing key means cookies are neither
// verified nor issued (every request re-runs Turnstile), rather than
// trusting a public fallback constant.
function getSigningKey(): string | null {
  if (GEMINI_API_KEY) return GEMINI_API_KEY;
  return process.env.NODE_ENV === 'production' ? null : 'dev-fallback-key';
}

/** Extract plain text from a ModelMessage's content (string or parts array). */
function messageText(m: ModelMessage): string {
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .map((p) => (p as { text?: string }).text || '')
      .join(' ');
  }
  return '';
}

// Low-value messages (pure greetings, thanks, farewells) that don't warrant
// a Gemini API call. Server-side safety net — the client also checks this.
const LOW_VALUE_PATTERNS = new Set([
  'hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'hola', 'hiya',
  'good morning', 'good afternoon', 'good evening', 'good night', 'gm', 'gn',
  'bye', 'goodbye', 'cya', 'see you', 'see ya', 'later',
  'thanks', 'thank you', 'thx', 'ty', 'tyvm', 'appreciate it',
  'much appreciated', 'thanks a lot', 'thanks a bunch',
  'ok', 'okay', 'k', 'cool', 'nice', 'great', 'got it', 'understood',
  'sounds good', 'will do',
]);

function isLowValueMessage(text: string): boolean {
  const normalized = text.toLowerCase().trim().replace(/[.!?,;]+$/g, '').trim();
  if (!normalized || normalized.length > 40) return false;
  return LOW_VALUE_PATTERNS.has(normalized);
}

function lastUserText(messages: ModelMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user') {
      const text = messageText(m);
      if (text.trim()) return text;
    }
  }
  return '';
}

export async function POST({ request }: { request: Request }) {
  let messages: ModelMessage[];
  let turnstileToken: string;
  try {
    const body = await request.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
    turnstileToken = body?.turnstileToken || '';
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Guard against excessively long messages that would inflate the Gemini
  // prompt and consume quota. 10K chars per message is generous for a docs Q&A.
  const MAX_MESSAGE_CHARS = 10000;
  const MAX_MESSAGES = 30;
  if (messages.length > MAX_MESSAGES) {
    return new Response(JSON.stringify({ error: 'Too many messages in conversation.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  for (const m of messages) {
    const text = messageText(m);
    if (text.length > MAX_MESSAGE_CHARS) {
      return new Response(JSON.stringify({ error: 'Message too long. Please shorten your question.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Short-circuit low-value messages (greetings, thanks, farewells) without
  // calling Gemini — saves API quota and reduces latency.
  const lastUser = lastUserText(messages);
  if (isLowValueMessage(lastUser)) {
    return new Response(
      "Hi! I'm the JMeter Docs AI assistant. Ask me anything about Apache JMeter — test plans, listeners, timers, assertions, distributed testing, reports, and more.",
      { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Grounded': 'false' } },
    );
  }

  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          'Google Gemini API key is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY in your .env file (dev) or Vercel Environment Variables (prod).',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // --- Bot protection (Cloudflare Turnstile + session cookie) -------------
  // If the user has a valid session cookie from a prior Turnstile verification,
  // skip the Turnstile check. Otherwise, validate the Turnstile token and
  // issue a new session cookie.
  const signingKey = getSigningKey();
  const cookies = parseCookies(request.headers.get('cookie'));
  const hasValidSession = verifySessionCookie(cookies[SESSION_COOKIE_NAME], signingKey);
  let needsTurnstile = !hasValidSession;

  if (needsTurnstile) {
    const verified = await verifyTurnstileToken(
      turnstileToken,
      TURNSTILE_SECRET,
      getClientIp(request),
    );
    if (!verified) {
      return new Response(
        JSON.stringify({ error: 'Bot verification failed. Please refresh the page and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  // --- RAG retrieval + prompt building ------------------------------------
  const query = lastUserText(messages);
  const sources = retrieve(query);
  const isGrounded = sources.length > 0;
  const system = isGrounded ? buildSystemPrompt(sources) : buildUngroundedPrompt();

  const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY });

  try {
    const result = streamText({
      model: google(MODEL),
      system,
      messages,
    });

    // Increment the global chat counter. A single REST INCR is ~50ms; we
    // await it so the X-Chat-Count header carries the accurate new value.
    // Failures are swallowed inside incrementChatCount() — the chat still
    // works if Redis is down or unconfigured.
    const newCount = await incrementChatCount();

    const headers: Record<string, string> = {
      'X-Model': MODEL,
      'X-Grounded': String(isGrounded),
    };
    if (newCount !== null) {
      headers['X-Chat-Count'] = String(newCount);
    }
    if (isGrounded) {
      headers['X-Sources'] = encodeURIComponent(
        sources.map((s) => `${s.title}|${s.url}`).join(','),
      );
    }

    // Set the session cookie after a successful Turnstile verification so
    // subsequent messages in this session skip the Turnstile round trip.
    // Skipped when no signing key is available (fail closed, no cookies).
    if (needsTurnstile && signingKey) {
      const cookieValue = createSessionCookie(signingKey);
      headers['Set-Cookie'] =
        `${SESSION_COOKIE_NAME}=${cookieValue}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
    }

    return createTextStreamResponse({
      stream: toTextStream({ stream: result.stream }),
      headers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/chat] streamText error:', message);
    return new Response(
      JSON.stringify({ error: 'Failed to stream response: ' + message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
