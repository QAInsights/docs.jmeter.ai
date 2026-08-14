/**
 * Configure Cloudflare Workers secrets from the local .env and deploy.
 *
 * Usage:
 *   node scripts/deploy-cloudflare.mjs            # secrets + SESSION KV only
 *   node scripts/deploy-cloudflare.mjs --deploy   # ...then build + deploy
 *
 * What it does:
 *   1. Verifies `wrangler` is authenticated.
 *   2. Ensures the SESSION KV namespace exists (the @astrojs/cloudflare
 *      adapter injects that binding) and patches its id into wrangler.jsonc.
 *   3. Pushes the four runtime secrets via `wrangler secret put` (values are
 *      piped over stdin and never printed). KV_REST_API_* values from the old
 *      Vercel integration are mapped to UPSTASH_REDIS_REST_* names.
 *
 * PUBLIC_* vars (Algolia, Turnstile site key) are build-time values baked in
 * by `astro build` — they are intentionally NOT set as worker secrets.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const WRANGLER_CONFIG = path.join(ROOT, 'wrangler.jsonc');
const KV_NAMESPACE_TITLE = 'docs-jmeter-ai-sessions';

/**
 * Parse .env text into a plain object. Handles comments, blank lines,
 * quoted values, and inline ` # comment` suffixes.
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseDotEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Strip inline comments only when separated by whitespace (values may
    // legitimately contain '#').
    val = val.replace(/\s+#.*$/, '');
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

/**
 * Resolve the four worker secrets from parsed .env values, mapping the
 * legacy Vercel KV_REST_API_* names onto UPSTASH_REDIS_REST_*.
 * @param {Record<string, string>} env
 * @returns {Record<string, string>} name → value (missing values omitted)
 */
export function resolveSecrets(env) {
  const pairs = {
    GOOGLE_GENERATIVE_AI_API_KEY: env.GOOGLE_GENERATIVE_AI_API_KEY,
    TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY,
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN,
  };
  return Object.fromEntries(Object.entries(pairs).filter(([, v]) => v));
}

/** Run wrangler with args; secret values go over stdin, never argv. */
function wrangler(args, { input } = {}) {
  const res = spawnSync('npx', ['wrangler', ...args], {
    cwd: ROOT,
    shell: true,
    input: input === undefined ? undefined : `${input}\n`,
    encoding: 'utf8',
    stdio: input === undefined ? ['inherit', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  });
  return {
    ok: res.status === 0,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

/** Insert or replace the kv_namespaces entry in wrangler.jsonc. */
export function patchWranglerConfig(text, namespaceId) {
  const entry = `"kv_namespaces": [{ "binding": "SESSION", "id": "${namespaceId}" }],`;
  if (/"kv_namespaces"\s*:/.test(text)) {
    return text.replace(/"kv_namespaces"\s*:\s*\[[^\]]*\],?/, entry);
  }
  return text.replace(
    /(\n\s*\/\/ Public build-time config)/,
    `\n  ${entry}$1`,
  );
}

function ensureKvNamespace() {
  const existing = wrangler(['kv', 'namespace', 'list']);
  if (existing.ok) {
    try {
      const namespaces = JSON.parse(existing.stdout.slice(existing.stdout.indexOf('[')));
      const found = namespaces.find((ns) => ns.title === KV_NAMESPACE_TITLE);
      if (found) return found.id;
    } catch { /* fall through to create */ }
  }
  console.log(`Creating KV namespace "${KV_NAMESPACE_TITLE}"...`);
  const created = wrangler(['kv', 'namespace', 'create', KV_NAMESPACE_TITLE]);
  const match = (created.stdout + created.stderr).match(/"id"\s*:\s*"([^"]+)"/);
  if (!created.ok || !match) {
    console.error('Failed to create KV namespace:', created.stderr || created.stdout);
    process.exit(1);
  }
  return match[1];
}

function main() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('.env not found — copy .env.example and fill in the values first.');
    process.exit(1);
  }

  const whoami = wrangler(['whoami']);
  if (!whoami.ok) {
    console.error('wrangler is not authenticated. Run: npx wrangler login');
    process.exit(1);
  }
  console.log('wrangler authenticated.');

  const kvId = ensureKvNamespace();
  const configText = fs.readFileSync(WRANGLER_CONFIG, 'utf8');
  if (!configText.includes(kvId)) {
    fs.writeFileSync(WRANGLER_CONFIG, patchWranglerConfig(configText, kvId), 'utf8');
    console.log(`Patched wrangler.jsonc with SESSION KV namespace id.`);
  } else {
    console.log('SESSION KV namespace already configured.');
  }

  const secrets = resolveSecrets(parseDotEnv(fs.readFileSync(ENV_FILE, 'utf8')));
  const missing = [
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'TURNSTILE_SECRET_KEY',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ].filter((name) => !secrets[name]);
  for (const name of missing) {
    console.warn(`WARNING: ${name} not found in .env — skipping.`);
  }
  for (const [name, value] of Object.entries(secrets)) {
    // `versions secret put` (not `secret put`): dashboard Git deploys use
    // Workers versions, where plain `secret put` errors with "the latest
    // version of your Worker isn't currently deployed". Versioned secrets
    // stage on the latest version and are inherited by the next deploy.
    const res = wrangler(['versions', 'secret', 'put', name], { input: value });
    if (!res.ok) {
      console.error(`Failed to set secret ${name}:`, res.stderr || res.stdout);
      process.exit(1);
    }
    console.log(`Set secret ${name} (takes effect on next deploy).`);
  }

  if (process.argv.includes('--deploy')) {
    console.log('\nBuilding and deploying...');
    const build = spawnSync('pnpm', ['run', 'build'], { cwd: ROOT, shell: true, stdio: 'inherit' });
    if (build.status !== 0) process.exit(build.status ?? 1);
    const deploy = spawnSync(
      'npx',
      ['wrangler', 'deploy', '--config', 'dist/server/wrangler.json'],
      { cwd: ROOT, shell: true, stdio: 'inherit' },
    );
    process.exit(deploy.status ?? 0);
  }

  console.log('\nDone. Next: pnpm run build && npx wrangler deploy --config dist/server/wrangler.json');
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
