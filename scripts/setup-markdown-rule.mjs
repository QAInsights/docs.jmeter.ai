/**
 * Provision the Cloudflare zone URL Rewrite Rule that serves each docs
 * page's pregenerated index.md (see scripts/generate-page-markdown.mjs)
 * for `Accept: text/markdown` requests. Browsers are unaffected: the
 * rule only fires when Accept lacks `text/html`.
 *
 * Usage:
 *   node scripts/setup-markdown-rule.mjs            # create/update the rule
 *   node scripts/setup-markdown-rule.mjs --dry-run  # print the rule JSON
 *
 * Needs CLOUDFLARE_API_TOKEN (permission Zone → Transform Rules: Edit)
 * and CLOUDFLARE_ZONE_ID, from the environment or .env.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseDotEnv } from './deploy-cloudflare.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const API_BASE = 'https://api.cloudflare.com/client/v4';

// Keep in sync with the `Vary: Accept` prefix blocks in public/_headers.
export const DOCS_PREFIXES = [
  '/user-manual/',
  '/getting-started/',
  '/extending/',
  '/reference/',
  '/releases/',
  '/topics/',
  '/tools/',
  '/legal/',
  '/mcp/',
];

const RULE_DESCRIPTION =
  'docs.jmeter.ai: serve Markdown for Accept: text/markdown';

/**
 * Rewrite expression: only LLM-style requests (Accept contains
 * text/markdown but not text/html) for trailing-slash docs URLs.
 */
export function buildExpression(prefixes) {
  const starts = prefixes
    .map((p) => `starts_with(http.request.uri.path, "${p}")`)
    .join(' or ');
  return (
    '(any(http.request.headers["accept"][*] contains "text/markdown")' +
    ' and not any(http.request.headers["accept"][*] contains "text/html")' +
    ' and ends_with(http.request.uri.path, "/")' +
    ` and (${starts}))`
  );
}

/** The rewrite rule object sent to the Rulesets API. */
export function buildRule() {
  return {
    description: RULE_DESCRIPTION,
    enabled: true,
    expression: buildExpression(DOCS_PREFIXES),
    action: 'rewrite',
    action_parameters: {
      uri: {
        path: {
          expression: 'concat(http.request.uri.path, "index.md")',
        },
      },
    },
  };
}

/**
 * Create or update the rewrite rule via the Cloudflare Rulesets API.
 * Looks up the zone's http_request_transform entrypoint ruleset: if the
 * phase has no ruleset yet, creates one containing just this rule;
 * otherwise patches the existing rule with our description, or appends
 * it. Returns the resulting rule id.
 */
export async function applyRule({ fetchImpl, token, zoneId }) {
  const call = async (method, url, body, { allow404 = false } = {}) => {
    const res = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok && !(allow404 && res.status === 404)) {
      const detail = (await res.text?.()) || '';
      throw new Error(
        `Cloudflare API ${method} ${url} failed: ${res.status} ${detail}`.trim(),
      );
    }
    return res;
  };

  const rule = buildRule();
  const entrypoint = `${API_BASE}/zones/${zoneId}/rulesets/phases/http_request_transform/entrypoint`;
  const current = await call('GET', entrypoint, undefined, { allow404: true });

  if (current.status === 404) {
    const res = await call('POST', `${API_BASE}/zones/${zoneId}/rulesets`, {
      name: 'default',
      kind: 'zone',
      phase: 'http_request_transform',
      rules: [rule],
    });
    const data = await res.json();
    return data.result?.rules?.[0]?.id ?? data.result?.id;
  }

  const data = await current.json();
  const rulesetId = data.result.id;
  const existing = (data.result.rules || []).find(
    (r) => r.description === RULE_DESCRIPTION,
  );
  if (existing) {
    const res = await call(
      'PATCH',
      `${API_BASE}/zones/${zoneId}/rulesets/${rulesetId}/rules/${existing.id}`,
      rule,
    );
    const patched = await res.json();
    return patched.result?.id ?? existing.id;
  }
  const res = await call(
    'POST',
    `${API_BASE}/zones/${zoneId}/rulesets/${rulesetId}/rules`,
    rule,
  );
  const created = await res.json();
  return created.result?.id;
}

async function main() {
  const rule = buildRule();
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify(rule, null, 2));
    return;
  }

  const fileEnv = fs.existsSync(ENV_FILE)
    ? parseDotEnv(fs.readFileSync(ENV_FILE, 'utf8'))
    : {};
  const token = process.env.CLOUDFLARE_API_TOKEN || fileEnv.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID || fileEnv.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) {
    console.error(
      'CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are required (environment or .env).',
    );
    console.error(
      'The API token needs permission Zone → Transform Rules: Edit.',
    );
    process.exit(1);
  }

  const ruleId = await applyRule({ fetchImpl: fetch, token, zoneId });
  console.log(`[setup-markdown-rule] applied, rule id: ${ruleId}`);
}

// Run only when invoked directly, not when imported by tests.
const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
