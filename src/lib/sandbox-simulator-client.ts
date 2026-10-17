/**
 * Client-side simulation and preview helpers for Correlation Sandbox.
 * Keeps CorrelationSandbox.astro strictly under 500 lines (Rule #1).
 */
import { handleSandboxRequest, issueSandboxToken } from './sandbox-engine.mjs';

export function simulateFlowStep(flowId: string, mode: 'challenge' | 'solved') {
  const seed = 'live8f92';
  if (flowId === 'flow1') {
    const csrf = mode === 'solved' ? issueSandboxToken('csrf', seed) : '${csrf_token}';
    const sid = mode === 'solved' ? issueSandboxToken('sid', seed) : 'stale_sid';
    return handleSandboxRequest({
      method: 'POST',
      path: '/flow1/login',
      headers: { cookie: `JMETER_SANDBOX_SID=${sid}` },
      body: `username=perf_engineer&csrf_token=${csrf}`,
      seed,
    });
  }
  if (flowId === 'flow2') {
    const jwt = mode === 'solved' ? issueSandboxToken('jwt', seed) : '${access_token}';
    const ord = mode === 'solved' ? issueSandboxToken('ord', seed) : '${orderId}';
    return handleSandboxRequest({
      method: 'GET',
      path: `/flow2/orders/${ord}`,
      headers: { authorization: `Bearer ${jwt}` },
      seed,
    });
  }
  if (flowId === 'flow3') {
    const tkt = mode === 'solved' ? issueSandboxToken('tkt', seed) : 'NOT_FOUND';
    return handleSandboxRequest({
      method: 'GET',
      path: '/flow3/confirm.aspx',
      headers: { 'x-checkout-ticket': tkt },
      seed,
    });
  }
  return handleSandboxRequest({
    method: 'GET',
    path: '/flow4/chaos',
    query: { mode: mode === 'solved' ? 'healthy' : 'soft_error' },
    seed,
  });
}

export function getStepPreviews(flowId: string, isSolved: boolean) {
  if (flowId === 'flow1') {
    return {
      s1: `&lt;input name="csrf_token" value="<mark class="cs-hl-token">csrf_live8f92a401b9</mark>" /&gt;\nSet-Cookie: <span class="cs-hl-cookie">JMETER_SANDBOX_SID=sid_8f92a...</span>`,
      s2: isSolved
        ? `Cookie: <span class="cs-hl-var">\${JMETER_SANDBOX_SID}</span>\nPayload: csrf_token=<span class="cs-hl-var">\${csrf_token}</span>`
        : `Cookie: <span class="cs-hl-err">[MISSING COOKIE MANAGER]</span>\nPayload: csrf_token=<span class="cs-hl-err">\${csrf_token} (Uncorrelated)</span>`,
    };
  }
  if (flowId === 'flow2') {
    return {
      s1: `Response: {"auth": {"access_token": "<mark class="cs-hl-token">eyJhbGciOi...</mark>"}}\nExtractor: JSON Extractor \$.auth.access_token`,
      s2: isSolved
        ? `Authorization: Bearer <span class="cs-hl-var">\${access_token}</span>\nPath: /flow2/orders/<span class="cs-hl-var">\${orderId}</span>`
        : `Authorization: Bearer <span class="cs-hl-err">\${access_token} (Missing Header)</span>\nPath: /flow2/orders/\${orderId}`,
    };
  }
  if (flowId === 'flow3') {
    return {
      s1: `&lt;input name="__VIEWSTATE" value="<mark class="cs-hl-token">dDw0Mzk3...</mark>" /&gt;\nHeader: X-Checkout-Ticket: <span class="cs-hl-cookie">tkt_live8f92...</span>`,
      s2: isSolved
        ? `X-Checkout-Ticket: <span class="cs-hl-var">\${checkout_ticket}</span>\nPayload: __VIEWSTATE=<span class="cs-hl-var">\${viewstate}</span>`
        : `X-Checkout-Ticket: <span class="cs-hl-err">NOT_FOUND</span>\nPayload: __VIEWSTATE=\${viewstate}`,
    };
  }
  return {
    s1: `Target: /flow4/chaos?mode=healthy\nSimulates: HTTP 429 & Soft 200 Database Exhaustion`,
    s2: isSolved
      ? `Assertion: JSON Assertion (\$.status == "OK")\nResult: 200 OK Asserted & Verified`
      : `Assertion: <span class="cs-hl-err">[NO ASSERTION]</span>\nSilent 200 failure masks DB outage!`,
  };
}

/**
 * Live verification runner — performs the REAL HTTP sequence for a flow against
 * the selected target (edge API or local jmeter-sandbox.mjs) using fetch().
 * Extracts tokens from actual responses (body regex / exposed headers) in
 * 'solved' mode, or replays stale recorded literals in 'challenge' mode.
 * Returns per-step results + the final step's verdict for the console panel.
 */
export interface LiveStep {
  label: string;
  status: number;
  ms: number;
  ok: boolean;
}

export interface LiveFlowResult {
  steps: LiveStep[];
  status: number;
  ok: boolean;
  body: string;
  totalMs: number;
}

const TIMEOUT_MS = 8000;

async function liveFetch(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<{ res: Response; ms: number; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = performance.now();
  try {
    const res = await fetch(`${baseUrl}${path}`, { ...init, signal: ctrl.signal });
    const text = await res.text();
    return { res, ms: Math.round(performance.now() - t0), text };
  } finally {
    clearTimeout(timer);
  }
}

function pick(body: string, re: RegExp, fallback: string): string {
  const m = re.exec(body);
  return m ? m[1] : fallback;
}

export async function runLiveFlowVerification(
  flowId: string,
  mode: 'challenge' | 'solved',
  baseUrl: string,
): Promise<LiveFlowResult> {
  const solved = mode === 'solved';
  const steps: LiveStep[] = [];
  let lastStatus = 0;
  let lastBody = '';
  let lastOk = false;

  const hit = async (label: string, path: string, init: RequestInit = {}) => {
    const { res, ms, text } = await liveFetch(baseUrl, path, init);
    lastStatus = res.status;
    lastBody = text;
    lastOk = res.status >= 200 && res.status < 300;
    steps.push({ label, status: res.status, ms, ok: lastOk });
    return { res, text };
  };

  if (flowId === 'flow1') {
    const r1 = await hit('01 GET /flow1/login-page', '/flow1/login-page');
    const csrf = solved
      ? pick(r1.text, /name="csrf_token" value="([^"]+)"/, 'NOT_FOUND')
      : 'csrf_stale_recorded_token';
    const sid = solved ? r1.res.headers.get('x-sandbox-sid') || 'NOT_FOUND' : 'sid_stale_recorded';
    await hit('02 POST /flow1/login', '/flow1/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-sandbox-sid': sid,
      },
      body: `username=perf_engineer&csrf_token=${csrf}`,
    });
  } else if (flowId === 'flow2') {
    const r1 = await hit('01 POST /flow2/auth/token', '/flow2/auth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"client_id":"jmeter-lab","grant_type":"client_credentials"}',
    });
    const jwt = solved ? pick(r1.text, /"access_token":\s*"([^"]+)"/, 'NOT_FOUND') : 'jwt_stale_recorded_token';
    const r2 = await hit('02 POST /flow2/orders', '/flow2/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
      body: '{"sku":"JM-PRO-1","qty":2}',
    });
    const ord = solved ? pick(r2.text, /"orderId":\s*"([^"]+)"/, 'NOT_FOUND') : 'ord_stale_recorded_id';
    await hit(`03 GET /flow2/orders/${solved ? ord : '${orderId}'}`, `/flow2/orders/${encodeURIComponent(ord)}`, {
      headers: { authorization: `Bearer ${jwt}` },
    });
  } else if (flowId === 'flow3') {
    const r1 = await hit('01 GET /flow3/checkout.aspx', '/flow3/checkout.aspx');
    const vs = solved
      ? pick(r1.text, /id="__VIEWSTATE" value="([^"]+)"/, 'NOT_FOUND')
      : 'vs_stale_recorded_viewstate';
    const r2 = await hit('02 POST /flow3/checkout.aspx', '/flow3/checkout.aspx', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `__VIEWSTATE=${encodeURIComponent(vs)}&action=submit`,
    });
    const tkt = solved
      ? r2.res.headers.get('x-checkout-ticket') || 'NOT_FOUND'
      : 'tkt_stale_recorded_ticket';
    await hit('03 GET /flow3/confirm.aspx', '/flow3/confirm.aspx', {
      headers: { 'x-checkout-ticket': tkt },
    });
  } else {
    await hit('01 GET /flow4/chaos', `/flow4/chaos?mode=${solved ? 'healthy' : 'soft_error'}`);
  }

  const totalMs = steps.reduce((a, s) => a + s.ms, 0);
  return { steps, status: lastStatus, ok: lastOk, body: lastBody, totalMs };
}
