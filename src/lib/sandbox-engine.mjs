/**
 * Pure, stateless HTTP simulation engine for the JMeter Correlation & Practice Sandbox.
 * Shared across:
 *   1. Hosted Cloudflare Worker endpoint (/api/sandbox/[...slug])
 *   2. Browser live step runner in CorrelationSandbox.astro
 *   3. Unit tests & MCP verification
 *
 * Uses deterministic signed tokens so multi-step correlation (CSRF, Cookie,
 * Bearer JWT, __VIEWSTATE, X-Checkout-Ticket, orderId) is validated with zero
 * server-side storage or database writes.
 */

const SANDBOX_SALT = 'jm-sandbox-v1-stateless';

/**
 * Compute a compact 10-hex-character deterministic signature for a token payload.
 * @param {string} kind
 * @param {string} payload
 * @returns {string}
 */
export function signSandboxToken(kind, payload) {
  const input = `${SANDBOX_SALT}:${kind}:${payload}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= ch + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + (h2 & 0xff).toString(16).padStart(2, '0');
}

/**
 * Issue a signed stateless token (`<prefix>_<payload>_<sig>`).
 * @param {string} prefix
 * @param {string} [seed]
 * @returns {string}
 */
export function issueSandboxToken(prefix, seed = 'live') {
  const cleanSeed = String(seed).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'live';
  const sig = signSandboxToken(prefix, cleanSeed);
  return `${prefix}_${cleanSeed}_${sig}`;
}

/**
 * Verify a signed stateless token and diagnose common JMeter correlation mistakes.
 * @param {string} prefix
 * @param {string | undefined | null} candidate
 * @param {string} varHint
 * @param {string} extractorHint
 * @param {string} playbookUrl
 * @returns {{ valid: true, seed: string } | { valid: false, reason: string, hint: string, playbookUrl: string }}
 */
export function verifySandboxToken(prefix, candidate, varHint, extractorHint, playbookUrl) {
  const raw = String(candidate ?? '').trim();
  if (!raw) {
    return {
      valid: false,
      reason: `Missing required dynamic value (${varHint}).`,
      hint: `Add ${extractorHint} under the previous sampler to capture ${varHint}.`,
      playbookUrl,
    };
  }
  if (raw.includes('${') || raw === 'NOT_FOUND' || raw === 'UNSET') {
    return {
      valid: false,
      reason: `Unresolved JMeter variable or default value ("${raw}") received for ${varHint}.`,
      hint: `Your extractor did not match the previous response and fell back to "${raw}". Check field boundaries/JSONPath in ${extractorHint}.`,
      playbookUrl: 'https://docs.jmeter.ai/topics/errors/extractor-not-found-default-value/',
    };
  }
  if (raw.includes('stale') || raw.includes('hardcoded') || raw.includes('recorded')) {
    return {
      valid: false,
      reason: `Stale recorded token ("${raw}") rejected for ${varHint}.`,
      hint: `This value came from a recorded session and has expired. Replace the hardcoded value with ${varHint} extracted via ${extractorHint}.`,
      playbookUrl,
    };
  }
  const match = new RegExp(`^${prefix}_([a-zA-Z0-9]{1,12})_([0-9a-f]{10})$`).exec(raw);
  if (!match) {
    return {
      valid: false,
      reason: `Malformed token format ("${raw}") for ${varHint}.`,
      hint: `Expected a live ${prefix}_* token extracted from the prior step using ${extractorHint}.`,
      playbookUrl,
    };
  }
  const [, seed, sig] = match;
  if (signSandboxToken(prefix, seed) !== sig) {
    return {
      valid: false,
      reason: `Invalid token signature for ${varHint} ("${raw}").`,
      hint: `Ensure ${varHint} is dynamically extracted from the previous step response via ${extractorHint}.`,
      playbookUrl,
    };
  }
  return { valid: true, seed };
}

/** Normalize request headers to lowercase keys. */
function normalizeHeaders(headers = {}) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[String(k).toLowerCase()] = String(v ?? '');
  }
  return out;
}

/** Parse URL-encoded form body into a key-value map. */
function parseFormBody(body = '') {
  const params = new URLSearchParams(String(body || '').trim());
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

/** Parse Cookie header into a map. */
function parseCookies(cookieHeader = '') {
  const out = {};
  for (const part of String(cookieHeader || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

/** Handle Flow 1: HTML Form + Dynamic csrf_token + Set-Cookie Session Chain. */
function handleFlow1(method, subPath, headers, body, seed) {
  if (method === 'GET' && subPath === '/flow1/login-page') {
    const sid = issueSandboxToken('sid', seed);
    const csrf = issueSandboxToken('csrf', seed);
    const html = [
      '<!DOCTYPE html>',
      '<html lang="en"><head><title>Sandbox Login</title></head><body>',
      '  <form id="loginForm" action="/api/sandbox/flow1/login" method="POST">',
      '    <input type="text" name="username" value="perf_engineer" />',
      `    <input type="hidden" name="csrf_token" value="${csrf}" />`,
      '  </form>',
      '</body></html>',
    ].join('\n');
    return {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': `JMETER_SANDBOX_SID=${sid}; Path=/; HttpOnly; SameSite=Lax`,
        // Browser fetch() cannot read Set-Cookie, so echo the session id via an
        // exposed header — lets the live in-browser verification extract it for real.
        'x-sandbox-sid': sid,
        'access-control-expose-headers': 'x-sandbox-sid',
      },
      body: html,
      extractedPreview: { cookie: `JMETER_SANDBOX_SID=${sid}`, csrf_token: csrf },
    };
  }

  if (method === 'POST' && subPath === '/flow1/login') {
    const cookies = parseCookies(headers.cookie);
    const form = parseFormBody(body);
    // Browser fetch() cannot send Cookie — accept X-Sandbox-Sid as the
    // browser-legal equivalent so the live page demo exercises the same check.
    const sid = cookies.JMETER_SANDBOX_SID || headers['x-sandbox-sid'];
    const sidCheck = verifySandboxToken(
      'sid',
      sid,
      'Cookie: JMETER_SANDBOX_SID',
      'an HTTP Cookie Manager',
      'https://docs.jmeter.ai/topics/errors/401-403-after-recording/',
    );
    if (!sidCheck.valid) {
      return jsonResponse(403, {
        status: 'FORBIDDEN',
        flow: 'flow1',
        failedCheck: 'session_cookie',
        error: sidCheck.reason,
        fix: sidCheck.hint,
        playbook: sidCheck.playbookUrl,
      });
    }
    const csrfCheck = verifySandboxToken(
      'csrf',
      form.csrf_token,
      '${csrf_token}',
      'a Boundary Extractor (left: name="csrf_token" value=", right: ")',
      'https://docs.jmeter.ai/topics/errors/401-403-after-recording/',
    );
    if (!csrfCheck.valid) {
      return jsonResponse(403, {
        status: 'FORBIDDEN',
        flow: 'flow1',
        failedCheck: 'csrf_token',
        error: csrfCheck.reason,
        fix: csrfCheck.hint,
        playbook: csrfCheck.playbookUrl,
      });
    }
    return jsonResponse(200, {
      status: 'VERIFIED',
      flow: 'flow1',
      message: 'Session cookie and dynamic csrf_token correlated!',
      user: form.username || 'perf_engineer',
      sessionId: sid,
    });
  }
  return null;
}

/** Handle Flow 2: OAuth2 / JWT Bearer -> Order Creation -> Dynamic Polling. */
function handleFlow2(method, subPath, query, headers, body, seed) {
  if (method === 'POST' && subPath === '/flow2/auth/token') {
    const jwt = issueSandboxToken('jwt', seed);
    return jsonResponse(200, {
      auth: {
        token_type: 'Bearer',
        access_token: jwt,
        expires_in: 300,
      },
    });
  }

  const authHeader = String(headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const jwtCheck = verifySandboxToken(
    'jwt',
    authHeader,
    '${access_token}',
    'a JSON Extractor ($.auth.access_token) + HTTP Header Manager (Authorization: Bearer ${access_token})',
    'https://docs.jmeter.ai/topics/jwt-oauth-sso/',
  );

  if (method === 'POST' && subPath === '/flow2/orders') {
    if (!jwtCheck.valid) {
      return jsonResponse(401, {
        status: 'UNAUTHORIZED',
        flow: 'flow2',
        failedCheck: 'bearer_token',
        error: jwtCheck.reason,
        fix: jwtCheck.hint,
        playbook: jwtCheck.playbookUrl,
      });
    }
    const orderId = issueSandboxToken('ord', seed);
    return jsonResponse(201, {
      data: {
        orderId,
        status: 'PROCESSING',
        sku: 'JM-PRO-1',
      },
    });
  }

  if (method === 'GET' && subPath.startsWith('/flow2/orders/')) {
    if (!jwtCheck.valid) {
      return jsonResponse(401, {
        status: 'UNAUTHORIZED',
        flow: 'flow2',
        failedCheck: 'bearer_token',
        error: jwtCheck.reason,
        fix: jwtCheck.hint,
        playbook: jwtCheck.playbookUrl,
      });
    }
    const orderId = decodeURIComponent(subPath.slice('/flow2/orders/'.length));
    const ordCheck = verifySandboxToken(
      'ord',
      orderId,
      '${orderId}',
      'a JSON Extractor ($.data.orderId)',
      'https://docs.jmeter.ai/topics/correlation-dynamic-values/',
    );
    if (!ordCheck.valid) {
      return jsonResponse(404, {
        status: 'NOT_FOUND',
        flow: 'flow2',
        failedCheck: 'order_id',
        error: ordCheck.reason,
        fix: ordCheck.hint,
        playbook: ordCheck.playbookUrl,
      });
    }
    return jsonResponse(200, {
      status: 'VERIFIED',
      flow: 'flow2',
      orderId,
      orderState: 'COMPLETED',
      message: 'Bearer token and dynamic orderId path parameter correlated!',
    });
  }
  return null;
}

/** Handle Flow 3: ASP.NET __VIEWSTATE + Response Header Ticket. */
function handleFlow3(method, subPath, headers, body, seed) {
  if (method === 'GET' && subPath === '/flow3/checkout.aspx') {
    const vs = issueSandboxToken('vs', seed);
    const html = [
      '<!DOCTYPE html>',
      '<html><body>',
      '<form method="post" action="/api/sandbox/flow3/checkout.aspx">',
      `  <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="${vs}" />`,
      '</form>',
      '</body></html>',
    ].join('\n');
    return {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: html,
      extractedPreview: { __VIEWSTATE: vs },
    };
  }

  if (method === 'POST' && subPath === '/flow3/checkout.aspx') {
    const form = parseFormBody(body);
    const vsCheck = verifySandboxToken(
      'vs',
      form.__VIEWSTATE,
      '${viewstate}',
      'a Boundary Extractor (left: id="__VIEWSTATE" value=", right: ")',
      'https://docs.jmeter.ai/topics/errors/works-in-browser-fails-in-jmeter/',
    );
    if (!vsCheck.valid) {
      return jsonResponse(400, {
        status: 'INVALID_VIEWSTATE',
        flow: 'flow3',
        failedCheck: '__VIEWSTATE',
        error: vsCheck.reason,
        fix: vsCheck.hint,
        playbook: vsCheck.playbookUrl,
      });
    }
    const ticket = issueSandboxToken('tkt', seed);
    return {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-checkout-ticket': ticket,
        'access-control-expose-headers': 'x-checkout-ticket',
      },
      body: JSON.stringify({
        status: 'STEP_2_OK',
        nextUrl: '/api/sandbox/flow3/confirm.aspx',
        note: 'Extract the X-Checkout-Ticket response header for the final confirmation call.',
      }, null, 2),
    };
  }

  if (method === 'GET' && subPath === '/flow3/confirm.aspx') {
    const tktCheck = verifySandboxToken(
      'tkt',
      headers['x-checkout-ticket'],
      '${checkout_ticket}',
      'a Regex or Boundary Extractor set to "Response Headers" (X-Checkout-Ticket: (.*))',
      'https://docs.jmeter.ai/topics/correlation-dynamic-values/',
    );
    if (!tktCheck.valid) {
      return jsonResponse(403, {
        status: 'MISSING_HEADER_TICKET',
        flow: 'flow3',
        failedCheck: 'x-checkout-ticket',
        error: tktCheck.reason,
        fix: tktCheck.hint,
        playbook: tktCheck.playbookUrl,
      });
    }
    return jsonResponse(200, {
      status: 'VERIFIED',
      flow: 'flow3',
      ticket: headers['x-checkout-ticket'],
      message: 'ASP.NET __VIEWSTATE body field and X-Checkout-Ticket response header correlated!',
    });
  }
  return null;
}

/** Handle Flow 4: Rate Limit (HTTP 429) & Silent Soft-Error Chaos API. */
function handleFlow4(query) {
  const mode = String(query.mode || 'soft_error');
  if (mode === '429') {
    return {
      status: 429,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'retry-after': '2',
      },
      body: JSON.stringify({
        status: 'RATE_LIMITED',
        flow: 'flow4',
        error: 'HTTP 429 Too Many Requests: Burst threshold exceeded.',
        fix: 'Add a Constant Throughput Timer or Precise Throughput Timer and honour Retry-After headers.',
        playbook: 'https://docs.jmeter.ai/topics/errors/http-429-rate-limited/',
      }, null, 2),
    };
  }
  if (mode === 'healthy') {
    return jsonResponse(200, {
      status: 'OK',
      flow: 'flow4',
      transactionId: issueSandboxToken('tx', 'ok'),
      message: 'Healthy response passing JSON Assertion ($.status == "OK").',
    });
  }
  // Default: HTTP 200 OK with a silent application error payload (teaches JSON Assertion!)
  return jsonResponse(200, {
    status: 'ERROR',
    flow: 'flow4',
    code: 'DB_POOL_EXHAUSTED',
    message: 'HTTP 200 returned, but business transaction failed! JMeter marks HTTP 200 as green unless you attach a JSON Assertion checking $.status == "OK".',
    playbook: 'https://docs.jmeter.ai/topics/jmeter-assertions-guide/',
  });
}

function jsonResponse(status, payload) {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload, null, 2),
  };
}

/**
 * Main stateless router for `/api/sandbox/*` and browser simulation.
 * @param {{
 *   method?: string,
 *   path?: string,
 *   query?: Record<string, string>,
 *   headers?: Record<string, string>,
 *   body?: string,
 *   seed?: string
 * }} req
 */
export function handleSandboxRequest(req = {}) {
  const method = String(req.method || 'GET').toUpperCase();
  const rawPath = String(req.path || '/').replace(/^\/api\/sandbox/, '') || '/';
  const subPath = rawPath.startsWith('/') ? rawPath.replace(/\/+$/, '') || '/' : `/${rawPath}`;
  const query = req.query || {};
  const headers = normalizeHeaders(req.headers);
  const body = String(req.body ?? '');
  const seed = String(req.seed || query.seed || 'live8f92');

  if (subPath === '/' || subPath === '/health') {
    return jsonResponse(200, {
      service: 'docs.jmeter.ai Correlation Sandbox',
      status: 'READY',
      flows: ['flow1', 'flow2', 'flow3', 'flow4'],
      docs: 'https://docs.jmeter.ai/tools/correlation-sandbox/',
    });
  }

  const r1 = handleFlow1(method, subPath, headers, body, seed);
  if (r1) return r1;
  const r2 = handleFlow2(method, subPath, query, headers, body, seed);
  if (r2) return r2;
  const r3 = handleFlow3(method, subPath, headers, body, seed);
  if (r3) return r3;
  if (subPath === '/flow4/chaos') return handleFlow4(query);

  return jsonResponse(404, {
    status: 'NOT_FOUND',
    error: `Unknown sandbox route: ${method} ${subPath}`,
    availableRoutes: [
      'GET /flow1/login-page',
      'POST /flow1/login',
      'POST /flow2/auth/token',
      'POST /flow2/orders',
      'GET /flow2/orders/{orderId}',
      'GET /flow3/checkout.aspx',
      'POST /flow3/checkout.aspx',
      'GET /flow3/confirm.aspx',
      'GET /flow4/chaos?mode=soft_error|429|healthy',
    ],
  });
}
