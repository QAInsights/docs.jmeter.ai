/**
 * Generates a standalone zero-dependency Node.js server (`jmeter-sandbox.mjs`)
 * so users can run high-RPS load tests locally on http://localhost:8787
 * without consuming Cloudflare Worker quota.
 */
export function generateLocalSandboxServerScript() {
  return `#!/usr/bin/env node
/**
 * docs.jmeter.ai — Local High-RPS Correlation & Chaos Sandbox Server
 * Usage: node jmeter-sandbox.mjs [port] (default port: 8787)
 * Zero npm dependencies required. Supports all 4 correlation & chaos flows.
 */
import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || process.argv[2] || 8787);
const SALT = 'jm-sandbox-v1-stateless';

function sign(kind, payload) {
  const input = \`\${SALT}:\${kind}:\${payload}\`;
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + (i & 0xff)), 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + (h2 & 0xff).toString(16).padStart(2, '0');
}

const issue = (prefix, seed = 'local') => \`\${prefix}_\${seed}_\${sign(prefix, seed)}\`;
const verify = (prefix, val) => {
  const m = new RegExp(\`^\${prefix}_([a-zA-Z0-9]{1,12})_([0-9a-f]{10})$\`).exec(String(val || '').trim());
  return Boolean(m && sign(prefix, m[1]) === m[2]);
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization, X-Checkout-Ticket, X-Sandbox-Sid',
  'access-control-expose-headers': 'X-Checkout-Ticket, X-Sandbox-Sid, Set-Cookie, Retry-After',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', \`http://localhost:\${PORT}\`);
  const path = url.pathname.replace(/^\\/api\\/sandbox/, '') || '/';
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const sendJson = (code, obj, extraHeaders = {}) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extraHeaders });
      res.end(JSON.stringify(obj, null, 2));
    };

    // Browser preflight — the live verification on the docs page calls this API cross-origin.
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }

    if (req.method === 'GET' && path === '/flow1/login-page') {
      const sid = issue('sid'), csrf = issue('csrf');
      // X-Sandbox-Sid mirrors Set-Cookie because fetch() cannot read Set-Cookie in browsers.
      res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': \`JMETER_SANDBOX_SID=\${sid}; Path=/\`, 'x-sandbox-sid': sid, ...CORS });
      return res.end(\`<form><input type="hidden" name="csrf_token" value="\${csrf}" /></form>\`);
    }
    if (req.method === 'POST' && path === '/flow1/login') {
      const params = new URLSearchParams(body);
      const cookie = String(req.headers.cookie || '');
      // Browsers cannot send Cookie headers — X-Sandbox-Sid is the browser-legal equivalent.
      const sid = (cookie.match(/JMETER_SANDBOX_SID=([^;]+)/) || [])[1] || req.headers['x-sandbox-sid'];
      if (!verify('sid', sid) || !verify('csrf', params.get('csrf_token'))) {
        return sendJson(403, { status: 'FORBIDDEN', error: 'Invalid session cookie or csrf_token' });
      }
      return sendJson(200, { status: 'VERIFIED', flow: 'flow1' });
    }
    if (req.method === 'POST' && path === '/flow2/auth/token') {
      return sendJson(200, { auth: { token_type: 'Bearer', access_token: issue('jwt'), expires_in: 300 } });
    }
    if (req.method === 'POST' && path === '/flow2/orders') {
      const jwt = String(req.headers.authorization || '').replace(/^Bearer\\s+/i, '');
      if (!verify('jwt', jwt)) return sendJson(401, { status: 'UNAUTHORIZED' });
      return sendJson(201, { data: { orderId: issue('ord'), status: 'PROCESSING' } });
    }
    if (req.method === 'GET' && path.startsWith('/flow2/orders/')) {
      const jwt = String(req.headers.authorization || '').replace(/^Bearer\\s+/i, '');
      const ord = path.slice('/flow2/orders/'.length);
      if (!verify('jwt', jwt) || !verify('ord', ord)) return sendJson(404, { status: 'NOT_FOUND' });
      return sendJson(200, { status: 'VERIFIED', flow: 'flow2', orderId: ord, orderState: 'COMPLETED' });
    }
    if (req.method === 'GET' && path === '/flow3/checkout.aspx') {
      res.writeHead(200, { 'content-type': 'text/html', ...CORS });
      return res.end(\`<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="\${issue('vs')}" />\`);
    }
    if (req.method === 'POST' && path === '/flow3/checkout.aspx') {
      const params = new URLSearchParams(body);
      if (!verify('vs', params.get('__VIEWSTATE'))) return sendJson(400, { status: 'INVALID_VIEWSTATE' });
      return sendJson(200, { status: 'STEP_2_OK' }, { 'x-checkout-ticket': issue('tkt') });
    }
    if (req.method === 'GET' && path === '/flow3/confirm.aspx') {
      if (!verify('tkt', req.headers['x-checkout-ticket'])) return sendJson(403, { status: 'MISSING_TICKET' });
      return sendJson(200, { status: 'VERIFIED', flow: 'flow3' });
    }
    if (path === '/flow4/chaos') {
      const mode = url.searchParams.get('mode') || 'soft_error';
      if (mode === '429') return sendJson(429, { status: 'RATE_LIMITED' }, { 'retry-after': '2' });
      return sendJson(200, { status: mode === 'healthy' ? 'OK' : 'ERROR', flow: 'flow4' });
    }
    return sendJson(200, { service: 'Local JMeter Sandbox', status: 'READY', port: PORT });
  });
});

server.listen(PORT, () => {
  console.log(\`JMeter Correlation Sandbox listening on http://localhost:\${PORT}/api/sandbox\`);
});
`;
}
