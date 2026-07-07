/**
 * Ask AI — client controller for the JMeter Docs chatbot.
 *
 * Responsibilities:
 *   - Open/close the slide-in panel (popover) with focus + inert management.
 *   - Maintain chat state (messages) and persist it to localStorage so a
 *     conversation survives page navigation and reloads (full persistence).
 *   - Send messages to /api/chat and stream the Gemini response back, with
 *     a typing indicator, a stop control, and live markdown rendering.
 *   - Render retrieved source citations from the X-Sources response header.
 *   - Lazy-load `marked` and `highlight.js` only when first needed.
 *
 * The endpoint is a Vercel serverless function (src/pages/api/chat.ts) that
 * performs BM25 retrieval over llms-chunks.json and streams via the Vercel
 * AI SDK text stream protocol.
 */

type Role = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  sources?: { title: string; url: string }[];
}

interface ChatState {
  messages: ChatMessage[];
}

const STORAGE_KEY = 'jmeter-ai-chat:v1';
const API_ENDPOINT = '/api/chat';
const CHAT_COUNT_ENDPOINT = '/api/chat-count';
const MAX_CONVERSATIONS = 10; // 10 user+assistant pairs per thread
const TEXTAREA_MAX_HEIGHT = 192; // px — auto-resize cap for the input (matches CSS max-block-size upper bound of 12rem)
const ERROR_PREVIEW_LENGTH = 300; // chars — truncate server error details

// Low-value messages (pure greetings, thanks, farewells) that don't warrant
// a Gemini API call. The check normalizes to lowercase + strips punctuation,
// and only matches if the ENTIRE message is one of these — "Hi, how do I..."
// still goes through to the API.
const LOW_VALUE_PATTERNS = new Set([
  // Greetings
  'hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'hola', 'hiya',
  'good morning', 'good afternoon', 'good evening', 'good night',
  'gm', 'gn',
  // Farewells
  'bye', 'goodbye', 'cya', 'see you', 'see ya', 'later',
  // Gratitude
  'thanks', 'thank you', 'thx', 'ty', 'tyvm', 'appreciate it',
  'much appreciated', 'thanks a lot', 'thanks a bunch',
  // Acknowledgements
  'ok', 'okay', 'k', 'cool', 'nice', 'great', 'got it', 'understood',
  'sounds good', 'will do',
]);

const LOW_VALUE_RESPONSES: Record<string, string> = {
  greeting: "Hi! I'm the JMeter Docs AI assistant. Ask me anything about Apache JMeter — test plans, listeners, timers, assertions, distributed testing, reports, and more.",
  farewell: 'Goodbye! Come back anytime you have JMeter questions.',
  thanks: "You're welcome! Feel free to ask another JMeter question anytime.",
  ack: 'Got it! Let me know if you have a JMeter question.',
};

/** Classify a message as low-value (greeting/thanks/farewell/ack) or null. */
function classifyLowValue(msg: string): string | null {
  const normalized = msg.toLowerCase().trim().replace(/[.!?,;]+$/g, '').trim();
  if (!normalized || normalized.length > 40) return null; // skip long messages
  if (!LOW_VALUE_PATTERNS.has(normalized)) return null;
  // Classify into a category for the canned response.
  const greetings = ['hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'hola', 'hiya',
    'good morning', 'good afternoon', 'good evening', 'good night', 'gm', 'gn'];
  const farewells = ['bye', 'goodbye', 'cya', 'see you', 'see ya', 'later'];
  const thanks = ['thanks', 'thank you', 'thx', 'ty', 'tyvm', 'appreciate it',
    'much appreciated', 'thanks a lot', 'thanks a bunch'];
  if (greetings.includes(normalized)) return 'greeting';
  if (farewells.includes(normalized)) return 'farewell';
  if (thanks.includes(normalized)) return 'thanks';
  return 'ack';
}

// --- DOM references -------------------------------------------------------
const trigger = document.getElementById('ask-ai-trigger') as HTMLButtonElement | null;
const panel = document.getElementById('ask-ai-panel') as HTMLElement | null;
const closeBtn = document.getElementById('ask-ai-close') as HTMLButtonElement | null;
const clearBtn = document.getElementById('ask-ai-clear') as HTMLButtonElement | null;
const body = document.getElementById('ask-ai-body') as HTMLElement | null;
const empty = document.getElementById('ask-ai-empty') as HTMLElement | null;
const messagesEl = document.getElementById('ask-ai-messages') as HTMLElement | null;
const input = document.getElementById('ask-ai-input') as HTMLTextAreaElement | null;
const sendBtn = document.getElementById('ask-ai-send') as HTMLButtonElement | null;
const errorEl = document.getElementById('ask-ai-error') as HTMLElement | null;
const statusEl = document.getElementById('ask-ai-status') as HTMLElement | null;
const turnstileContainer = document.getElementById('ask-ai-turnstile') as HTMLElement | null;
const countEl = document.getElementById('ask-ai-count') as HTMLElement | null;

// --- State (declared before init() runs to avoid TDZ) ---------------------
let state: ChatState = { messages: [] };
let isStreaming = false;
let abortController: AbortController | null = null;
let renderScheduled = false;
let pendingAssistantEl: HTMLElement | null = null;
let pendingAssistantText = '';
let displayedCount = 0; // last count rendered into the badge
let countFetched = false; // whether we've already fetched the count this session

// --- Turnstile (bot protection) -------------------------------------------
let turnstileSitekey = '';
let turnstileToken = '';
let turnstileWidgetId: string | null = null;
let turnstileScriptLoaded = false;
// After the first successful send, the server sets a session cookie that
// allows subsequent messages to skip Turnstile. We track this client-side
// so we don't require a fresh token (or show the widget) unnecessarily.
let sessionVerified = false;

// The global Turnstile API is injected by the CF script.
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

// --- Lazy-loaded markdown/highlight modules -------------------------------
let markedPromise: Promise<typeof import('marked')> | null = null;
let hljsPromise: Promise<typeof import('highlight.js')> | null = null;

function loadMarked() {
  if (!markedPromise) markedPromise = import('marked');
  return markedPromise;
}

function loadHljs() {
  if (!hljsPromise) hljsPromise = import('highlight.js');
  return hljsPromise;
}

// --- Turnstile helpers ----------------------------------------------------
function initTurnstile() {
  if (!turnstileContainer) return;
  turnstileSitekey = turnstileContainer.dataset.sitekey || '';
  if (!turnstileSitekey) return; // dev mode — no sitekey configured
  loadTurnstileScript().then(() => renderTurnstile());
}

function loadTurnstileScript(): Promise<void> {
  if (turnstileScriptLoaded) return Promise.resolve();
  if (document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
    turnstileScriptLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      turnstileScriptLoaded = true;
      resolve();
    };
    // If the script fails to load, resolve anyway so the UI doesn't hang.
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

function renderTurnstile() {
  if (!turnstileContainer || !window.turnstile || !turnstileSitekey) return;
  // Remove any previous widget before re-rendering.
  if (turnstileWidgetId) {
    try { window.turnstile.remove(turnstileWidgetId); } catch { /* ignore */ }
    turnstileWidgetId = null;
  }
  turnstileContainer.classList.add('ask-ai-turnstile--visible');
  turnstileToken = ''; // clear stale token
  turnstileWidgetId = window.turnstile.render(turnstileContainer, {
    sitekey: turnstileSitekey,
    theme: 'auto',
    size: 'compact',
    callback: (token: string) => {
      turnstileToken = token;
      // Hide the widget once we have a token — it's verified server-side.
      turnstileContainer.classList.remove('ask-ai-turnstile--visible');
    },
    'expired-callback': () => {
      turnstileToken = '';
      turnstileContainer.classList.add('ask-ai-turnstile--visible');
    },
    'error-callback': () => { turnstileToken = ''; },
  });
}

function resetTurnstile() {
  // Tokens are single-use — reset the widget to get a fresh token.
  turnstileToken = '';
  if (turnstileWidgetId && window.turnstile) {
    try { window.turnstile.reset(turnstileWidgetId); } catch { /* ignore */ }
    // Show the widget again while the new challenge runs.
    turnstileContainer?.classList.add('ask-ai-turnstile--visible');
  }
}

function getTurnstileToken(): string {
  return turnstileToken;
}

function init() {
  // Move the panel to <body> so it is a top-level element. This keeps the
  // popover's top-layer promotion clean and lets us inert every other
  // body child for keyboard/AT users while the panel is open.
  document.body.appendChild(panel!);
  loadState();
  renderAll();
  wireUI();
  initTurnstile();
}

if (
  trigger &&
  panel &&
  closeBtn &&
  clearBtn &&
  body &&
  empty &&
  messagesEl &&
  input &&
  sendBtn &&
  errorEl
) {
  init();
}

// --- Persistence ----------------------------------------------------------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as ChatState;
    if (parsed && Array.isArray(parsed.messages)) {
      state.messages = parsed.messages.filter(
        (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
      );
    }
  } catch {
    /* ignore corrupt storage */
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or disabled — non-fatal */
  }
}

function clearState() {
  state.messages = [];
  saveState();
  renderAll();
}

// --- Rendering ------------------------------------------------------------
function renderAll() {
  if (!messagesEl || !empty) return;
  messagesEl.innerHTML = '';
  if (state.messages.length === 0) {
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    for (const m of state.messages) {
      messagesEl.appendChild(buildMessageEl(m));
    }
    scrollToBottom(false);
  }
  updateThreadLimit();
  updateSendEnabled();
}

function updateThreadLimit() {
  if (!input || !sendBtn) return;
  const userCount = state.messages.filter((m) => m.role === 'user').length;
  const remaining = MAX_CONVERSATIONS - userCount;
  if (remaining <= 0) {
    input.disabled = true;
    input.placeholder = 'Thread limit reached. Start a new chat.';
    sendBtn.disabled = true;
    if (statusEl) statusEl.textContent = `Thread limit reached (${MAX_CONVERSATIONS} messages).`;
  } else {
    input.disabled = false;
    input.placeholder = 'Ask about JMeter... (Enter to send, Shift+Enter for newline)';
    if (remaining <= 3 && !isStreaming) {
      if (statusEl) statusEl.textContent = `${remaining} message${remaining > 1 ? 's' : ''} left in this thread.`;
    }
  }
}

function buildMessageEl(m: ChatMessage): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `ask-ai-msg ask-ai-msg--${m.role}`;
  wrap.dataset.id = m.id;

  const role = document.createElement('span');
  role.className = 'ask-ai-msg__role';
  role.textContent = m.role === 'user' ? 'You' : 'AI';
  wrap.appendChild(role);

  const bubble = document.createElement('div');
  bubble.className = 'ask-ai-msg__bubble';
  wrap.appendChild(bubble);

  if (m.role === 'user') {
    bubble.textContent = m.content;
  } else if (m.content) {
    // Assistant messages are rendered as markdown. For already-finished
    // messages from storage, render via the lazy loader. Skip for empty
    // messages (the streaming flow handles those via showTyping/readStream).
    bubble.textContent = m.content;
    renderMarkdownInto(bubble, m.content, true);
  }

  if (m.sources && m.sources.length) {
    wrap.appendChild(buildSourcesEl(m.sources));
  }

  return wrap;
}

function buildSourcesEl(sources: { title: string; url: string }[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ask-ai-sources';
  container.setAttribute('aria-label', 'Sources');
  for (const s of sources) {
    const a = document.createElement('a');
    a.className = 'ask-ai-source';
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = s.url;
    a.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    const label = document.createElement('span');
    label.textContent = s.title;
    a.appendChild(label);
    container.appendChild(a);
  }
  return container;
}

/**
 * Render markdown into a bubble. When `withHighlight` is true (final render),
 * syntax-highlight code blocks with highlight.js. During streaming we skip
 * highlighting for performance and apply it once at the end.
 */
async function renderMarkdownInto(el: HTMLElement, markdown: string, withHighlight: boolean) {
  const { marked } = await loadMarked();
  let html: string;
  try {
    html = marked.parse(markdown, { async: false, breaks: true }) as string;
  } catch {
    html = escapeHtml(markdown);
  }
  el.innerHTML = sanitizeHtml(html);
  if (withHighlight) {
    try {
      const hljs = await loadHljs();
      const highlight = (hljs as { highlightElement?: (el: HTMLElement) => void })
        .highlightElement;
      if (highlight) {
        el.querySelectorAll('pre code').forEach((node) => {
          try {
            highlight(node as HTMLElement);
          } catch {
            /* unknown language — leave as-is */
          }
        });
      }
    } catch {
      /* highlight.js failed to load — code stays unstyled, still readable */
    }
  }
}

// --- Streaming send -------------------------------------------------------
async function send(text: string) {
  const trimmed = text.trim();
  if (!trimmed || isStreaming) return;

  // Enforce per-thread conversation limit (10 user+assistant pairs).
  const userCount = state.messages.filter((m) => m.role === 'user').length;
  if (userCount >= MAX_CONVERSATIONS) {
    showError(
      `This thread has reached the ${MAX_CONVERSATIONS}-message limit. Start a new chat to continue.`,
    );
    return;
  }

  // Short-circuit low-value messages (greetings, thanks, farewells) with a
  // canned response — no API call, no Turnstile token needed.
  const lowValueCategory = classifyLowValue(trimmed);
  if (lowValueCategory) {
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: trimmed };
    const assistantMsg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: LOW_VALUE_RESPONSES[lowValueCategory],
    };
    state.messages.push(userMsg, assistantMsg);
    saveState();
    renderAll();
    setInput('');
    scrollToBottom(true);
    return;
  }

  hideError();

  // If Turnstile is configured and we don't have a session yet, require a
  // valid token before sending. After the first successful send, the server
  // sets a session cookie and we skip Turnstile for subsequent messages.
  const token = sessionVerified ? '' : getTurnstileToken();
  if (turnstileSitekey && !sessionVerified && !token) {
    showError('Please complete the bot verification check before sending.');
    return;
  }

  const userMsg: ChatMessage = { id: uid(), role: 'user', content: trimmed };
  state.messages.push(userMsg);
  saveState();
  renderAll();
  setInput('');

  // Prepare an empty assistant bubble + typing indicator.
  const assistantMsg: ChatMessage = { id: uid(), role: 'assistant', content: '' };
  state.messages.push(assistantMsg);
  const el = buildMessageEl(assistantMsg);
  if (messagesEl) messagesEl.appendChild(el);
  const bubble = el.querySelector('.ask-ai-msg__bubble') as HTMLElement;
  pendingAssistantEl = bubble;
  pendingAssistantText = '';
  showTyping(bubble);
  scrollToBottom(true);
  setStreaming(true);

  // Reset Turnstile after capturing the token (tokens are single-use).
  // Only needed for the first message before the session cookie is set.
  if (!sessionVerified) resetTurnstile();

  abortController = new AbortController();
  const modelMessages = state.messages
    .filter((m) => m !== assistantMsg)
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: modelMessages, turnstileToken: token }),
      signal: abortController.signal,
    });

    if (!res.ok) {
      const detail = await safeText(res);
      // Try to extract a clean error message from JSON responses.
      let msg = `Request failed (${res.status})`;
      if (detail) {
        try {
          const parsed = JSON.parse(detail);
          if (parsed.error) msg = parsed.error;
          else msg += `: ${detail}`;
        } catch {
          msg += `: ${detail}`;
        }
      }
      throw new Error(msg);
    }

    // Sources travel in a response header (URL-encoded, comma-separated "title|url").
    // X-Grounded indicates whether the answer came from doc context (RAG) or
    // general Gemini knowledge (fallback when no docs matched).
    // X-Chat-Count carries the incremented global counter from Upstash.
    const grounded = res.headers.get('X-Grounded') !== 'false';
    const sourcesHeader = res.headers.get('X-Sources') || '';
    const chatCountHeader = res.headers.get('X-Chat-Count');
    if (chatCountHeader) {
      const n = Number(chatCountHeader);
      if (Number.isFinite(n) && n > 0) renderCount(n);
    }
    const sources = sourcesHeader
      ? parseSourcesHeader(decodeURIComponent(sourcesHeader))
      : [];

    await readStream(res, bubble, () => hideTyping(bubble));

    // First successful response means the server accepted our Turnstile
    // token and set a session cookie. Subsequent sends skip Turnstile.
    sessionVerified = true;
    // Hide the Turnstile widget — no longer needed for this session.
    turnstileContainer?.classList.remove('ask-ai-turnstile--visible');

    // Finalize: full markdown render + syntax highlighting + sources.
    const finalText = pendingAssistantText;
    assistantMsg.content = finalText;
    assistantMsg.sources = sources;
    await renderMarkdownInto(bubble, finalText, true);
    if (sources.length) {
      el.appendChild(buildSourcesEl(sources));
    }
    saveState();
    if (statusEl) {
      if (grounded && sources.length) {
        statusEl.textContent = `Based on ${sources.length} doc page${sources.length > 1 ? 's' : ''}. AI-generated, verify important steps.`;
      } else {
        statusEl.textContent = 'Not from docs. Answered from general knowledge. Try rephrasing with JMeter terms.';
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      // Keep partial text if any was streamed.
      assistantMsg.content = pendingAssistantText || '(stopped)';
      if (pendingAssistantEl) {
        await renderMarkdownInto(pendingAssistantEl, assistantMsg.content, true);
      }
      saveState();
    } else {
      // Server error (403 bot check, 429 rate limit, 500, etc.).
      // Roll back the user message and empty assistant bubble so the
      // chat state stays clean — the user can retry after fixing the issue.
      showError((err as Error).message || 'Something went wrong. Please try again.');
      state.messages = state.messages.filter(
        (m) => m.id !== userMsg.id && m.id !== assistantMsg.id,
      );
      saveState();
      renderAll();
      resetTurnstile();
    }
  } finally {
    setStreaming(false);
    abortController = null;
    pendingAssistantEl = null;
    pendingAssistantText = '';
    updateThreadLimit();
    updateSendEnabled();
    input?.focus();
  }
}

async function readStream(res: Response, bubble: HTMLElement, onFirstChunk?: () => void) {
  if (!res.body) {
    // Fallback: read as plain text.
    const text = await res.text();
    onFirstChunk?.();
    pendingAssistantText = text;
    scheduleStreamRender(bubble);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let firstChunk = true;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (firstChunk) {
      firstChunk = false;
      onFirstChunk?.();
    }
    buffer += decoder.decode(value, { stream: true });
    // The text stream protocol sends raw text chunks; no framing to parse.
    pendingAssistantText = buffer;
    scheduleStreamRender(bubble);
  }
}

function scheduleStreamRender(bubble: HTMLElement) {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    if (!pendingAssistantEl) return;
    const text = pendingAssistantText;
    // During streaming, render markdown without code highlighting for speed,
    // and show a blinking caret to signal active generation.
    void renderMarkdownInto(bubble, text + ' ▋', false);
    scrollToBottom(true);
  });
}

function stopStreaming() {
  if (abortController) abortController.abort();
}

// --- Typing indicator -----------------------------------------------------
function showTyping(bubble: HTMLElement) {
  // JMeter gauge-style spinner: a semicircle gauge with a sweeping needle,
  // evoking JMeter's performance-testing identity.
  bubble.innerHTML =
    '<span class="ask-ai-typing" aria-label="Assistant is thinking">' +
    '<span class="ask-ai-typing__gauge">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round">' +
    '<path class="ask-ai-typing__arc" d="M3 18a9 9 0 0 1 18 0" />' +
    '<line class="ask-ai-typing__needle" x1="12" y1="18" x2="12" y2="6" />' +
    '<circle class="ask-ai-typing__pivot" cx="12" cy="18" r="1.5" stroke="none" />' +
    '</svg>' +
    '</span>' +
    '<span class="ask-ai-typing__label">Thinking</span>' +
    '</span>';
}

function hideTyping(bubble: HTMLElement) {
  if (bubble.querySelector('.ask-ai-typing')) bubble.innerHTML = '';
}

// --- UI wiring ------------------------------------------------------------
function wireUI() {
  trigger!.addEventListener('click', openPanel);
  closeBtn!.addEventListener('click', closePanel);
  clearBtn!.addEventListener('click', clearState);

  // Suggested prompts
  document.querySelectorAll<HTMLButtonElement>('.ask-ai-suggestion').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt || '';
      if (prompt) send(prompt);
    });
  });

  // Composer
  input!.addEventListener('input', () => {
    autoResize(input!);
    updateSendEnabled();
  });
  input!.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) return;
      send(input!.value);
    }
  });
  sendBtn!.addEventListener('click', () => {
    if (isStreaming) {
      stopStreaming();
    } else {
      send(input!.value);
    }
  });

  // Backdrop click closes (popover="manual" disables light-dismiss).
  // The popover fills the viewport; clicking the dimmed area outside the
  // sheet targets the panel element itself. We check e.target === panel
  // (not sheet.contains) because send() may replace button innerHTML during
  // the same click, detaching the original event target and causing a false
  // "outside click" detection.
  panel!.addEventListener('click', (e) => {
    if (e.target === panel) closePanel();
  });

  // Escape closes (popover handles Escape to leave top layer, but we want
  // to also restore focus/inert reliably).
  panel!.addEventListener('toggle', (e: Event) => {
    const ce = e as ToggleEvent;
    if (ce.newState === 'closed') onClosed();
    if (ce.newState === 'open') onOpened();
  });
}

function openPanel() {
  if (!panel!.matches(':popover-open')) panel!.showPopover();
}

function closePanel() {
  if (panel!.matches(':popover-open')) panel!.hidePopover();
}

function onOpened() {
  trigger!.setAttribute('aria-expanded', 'true');
  // Mark the rest of the document inert so keyboard/AT users can't reach
  // content hidden behind the panel.
  setInertOutside(panel!, true);
  // Fetch the global chat count once to populate the header badge.
  void fetchAndRenderCount();
  // Focus the input if there's already a conversation, otherwise focus the
  // first suggestion so keyboard users get a quick start.
  if (state.messages.length > 0) {
    input?.focus();
    scrollToBottom(false);
  } else {
    const firstSuggestion = panel!.querySelector<HTMLButtonElement>('.ask-ai-suggestion');
    firstSuggestion?.focus();
  }
}

function onClosed() {
  trigger!.setAttribute('aria-expanded', 'false');
  setInertOutside(panel!, false);
  trigger!.focus();
}

function setInertOutside(exclude: HTMLElement, on: boolean) {
  const skip = exclude;
  document.querySelectorAll<HTMLElement>('body > *').forEach((node) => {
    if (node === skip || skip.contains(node) || node.contains(skip)) return;
    if (on) {
      if (!node.hasAttribute('inert')) node.setAttribute('inert', '');
    } else {
      node.removeAttribute('inert');
    }
  });
}

// --- Chat counter badge ---------------------------------------------------
/**
 * Fetch the global chat count from /api/chat-count and render it into the
 * header badge. Called once when the panel first opens. Subsequent updates
 * arrive via the X-Chat-Count header on chat responses (see send()).
 */
async function fetchAndRenderCount() {
  if (countFetched || !countEl) return;
  countFetched = true;
  try {
    const res = await fetch(CHAT_COUNT_ENDPOINT);
    if (!res.ok) return;
    const data = (await res.json()) as { count?: number };
    if (typeof data.count === 'number') {
      renderCount(data.count);
    }
  } catch {
    /* non-fatal — badge stays hidden */
  }
}

/**
 * Render the count into the badge with a count-up animation from the
 * previously displayed value. The phrase: "AI answered N JMeter questions".
 */
function renderCount(target: number) {
  if (!countEl || target < 0) return;
  countEl.hidden = false;
  if (target === displayedCount) {
    countEl.textContent = formatCountPhrase(target);
    return;
  }
  const start = displayedCount;
  const diff = target - start;
  const duration = 600;
  const startTime = performance.now();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    displayedCount = target;
    countEl.textContent = formatCountPhrase(target);
    return;
  }

  const tick = (now: number) => {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(start + diff * eased);
    countEl.textContent = formatCountPhrase(current);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      displayedCount = target;
    }
  };
  requestAnimationFrame(tick);
}

function formatCountPhrase(n: number): string {
  return `AI answered ${n.toLocaleString()} JMeter question${n === 1 ? '' : 's'}`;
}


function setStreaming(on: boolean) {
  isStreaming = on;
  if (sendBtn) {
    sendBtn.classList.toggle('ask-ai-send--stop', on);
    sendBtn.setAttribute('aria-label', on ? 'Stop generating' : 'Send message');
    sendBtn.disabled = false;
    sendBtn.innerHTML = on
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7z" /></svg>';
  }
}

function updateSendEnabled() {
  if (!sendBtn || isStreaming) return;
  sendBtn.disabled = input ? input.value.trim().length === 0 : true;
}

function setInput(value: string) {
  if (input) {
    input.value = value;
    autoResize(input);
  }
  updateSendEnabled();
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT) + 'px';
}

function scrollToBottom(smooth: boolean) {
  if (!body) return;
  requestAnimationFrame(() => {
    body.scrollTo({ top: body.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  });
}

function showError(msg: string) {
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function hideError() {
  if (errorEl) errorEl.hidden = true;
}

async function safeText(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, ERROR_PREVIEW_LENGTH);
  } catch {
    return '';
  }
}

function parseSourcesHeader(header: string): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  // Sources are comma-separated: "title1|url1,title2|url2"
  // URLs contain no commas, so splitting on commas is safe.
  for (const part of header.split(',')) {
    const raw = part.trim();
    if (!raw) continue;
    const sep = raw.lastIndexOf('|');
    if (sep <= 0) continue;
    const title = raw.slice(0, sep).trim();
    const url = raw.slice(sep + 1).trim();
    if (title && url) out.push({ title, url });
  }
  return out;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Minimal post-parse sanitization: strip <script>/<style>/<iframe>, remove
 * event-handler attributes and javascript: URLs. The model output is
 * grounded in docs, but this guards against any injected markup.
 */
function sanitizeHtml(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  tpl.content.querySelectorAll('script, style, iframe, object, embed, form').forEach((n) => n.remove());
  tpl.content.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value.toLowerCase().trim();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'src' || name === 'xlink:href') && val.startsWith('javascript:'))
        el.removeAttribute(attr.name);
    }
    // Force external links to open safely.
    if (el.tagName === 'A') {
      const href = el.getAttribute('href');
      if (href && /^https?:\/\//i.test(href)) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });
  return tpl.innerHTML;
}
