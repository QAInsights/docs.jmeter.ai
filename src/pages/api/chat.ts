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
import { loadEnv } from 'vite';
import {
  streamText,
  toTextStream,
  createTextStreamResponse,
  type ModelMessage,
} from 'ai';
import { createHmac } from 'node:crypto';
import { retrieve, buildSystemPrompt, buildUngroundedPrompt } from '../../lib/rag.mjs';

// Allow streaming responses up to 30 seconds on Vercel.
export const prerender = false;
export const maxDuration = 30;

// Google Gemini model — free tier: 15 RPM, 1,500 requests/day.
const MODEL = 'gemini-2.5-flash';

// Session cookie lifetime: 30 minutes after first Turnstile verification.
const SESSION_COOKIE_NAME = 'jmeter-ai-session';
const SESSION_TTL_MS = 30 * 60 * 1000;

// Load env from .env (dev) or process.env (Vercel prod).
const env = loadEnv(
  process.env.NODE_ENV || 'development',
  process.cwd(),
  '',
);
const GEMINI_API_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  env.GOOGLE_GENERATIVE_AI_API_KEY;
const TURNSTILE_SECRET =
  process.env.TURNSTILE_SECRET_KEY ||
  env.TURNSTILE_SECRET_KEY;

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// --- Signed session cookie helpers ----------------------------------------
// The cookie value is `<expiry>:<hmac>` where HMAC is derived from the
// expiry + the Gemini API key (which is already secret and present).
// No extra env vars needed.

function getSigningKey(): string {
  return GEMINI_API_KEY || 'dev-fallback-key';
}

function createSessionCookie(): string {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = String(expiry);
  const sig = createHmac('sha256', getSigningKey())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionCookie(value: string | null): boolean {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac('sha256', getSigningKey())
    .update(payload)
    .digest('base64url');
  if (sig !== expected) return false;
  const expiry = Number(payload);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  return true;
}

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('cookie') || '';
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      const key = part.slice(0, eq).trim();
      const val = part.slice(eq + 1).trim();
      out[key] = val;
    }
  }
  return out;
}

/** Validate a Cloudflare Turnstile token server-side. */
async function verifyTurnstile(
  token: string,
  remoteip?: string,
): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true; // dev mode — no secret configured
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.append('secret', TURNSTILE_SECRET);
    body.append('response', token);
    if (remoteip) body.append('remoteip', remoteip);
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body,
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

function getClientIP(request: Request): string {
  const headers = request.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
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
  const cookies = parseCookies(request);
  const hasValidSession = verifySessionCookie(cookies[SESSION_COOKIE_NAME]);
  let needsTurnstile = !hasValidSession;

  if (needsTurnstile) {
    const verified = await verifyTurnstile(turnstileToken, getClientIP(request));
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

    const headers: Record<string, string> = {
      'X-Model': MODEL,
      'X-Grounded': String(isGrounded),
    };
    if (isGrounded) {
      headers['X-Sources'] = encodeURIComponent(
        sources.map((s) => `${s.title}|${s.url}`).join(','),
      );
    }

    // Set the session cookie after a successful Turnstile verification so
    // subsequent messages in this session skip the Turnstile round trip.
    if (needsTurnstile) {
      const cookieValue = createSessionCookie();
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
