import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DOCS_PREFIXES,
  buildExpression,
  buildRule,
  applyRule,
} from '../../scripts/setup-markdown-rule.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

describe('buildExpression', () => {
  it('contains every docs prefix and both Accept header checks', () => {
    const expr = buildExpression(DOCS_PREFIXES);
    for (const prefix of DOCS_PREFIXES) {
      expect(expr).toContain(`starts_with(http.request.uri.path, "${prefix}")`);
    }
    expect(expr).toContain(
      'any(http.request.headers["accept"][*] contains "text/markdown")',
    );
    expect(expr).toContain(
      'not any(http.request.headers["accept"][*] contains "text/html")',
    );
    expect(expr).toContain('ends_with(http.request.uri.path, "/")');
  });

  it('matches the exact expected expression (golden)', () => {
    expect(buildExpression(['/a/', '/b/'])).toBe(
      '(any(http.request.headers["accept"][*] contains "text/markdown") and not any(http.request.headers["accept"][*] contains "text/html") and ends_with(http.request.uri.path, "/") and (starts_with(http.request.uri.path, "/a/") or starts_with(http.request.uri.path, "/b/")))',
    );
  });
});

describe('buildRule', () => {
  it('rewrites the URI path to index.md', () => {
    const rule = buildRule();
    expect(rule.enabled).toBe(true);
    expect(rule.action).toBe('rewrite');
    expect(rule.action_parameters.uri.path.expression).toBe(
      'concat(http.request.uri.path, "index.md")',
    );
    expect(rule.description).toContain('text/markdown');
  });
});

/** Stub fetch that records calls and returns canned responses. */
function stubFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ method: init.method, url, headers: init.headers, body: init.body });
    const next = responses[calls.length - 1];
    return {
      ok: next.status < 400,
      status: next.status,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body),
    };
  };
  return { calls, fetchImpl };
}

describe('applyRule', () => {
  it('creates the ruleset when the phase entrypoint is missing (404)', async () => {
    const { calls, fetchImpl } = stubFetch([
      { status: 404, body: {} },
      { status: 200, body: { result: { id: 'rs-1', rules: [{ id: 'rule-1' }] } } },
    ]);
    const id = await applyRule({ fetchImpl, token: 'tok', zoneId: 'zone-1' });
    expect(id).toBe('rule-1');
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(
      'https://api.cloudflare.com/client/v4/zones/zone-1/rulesets/phases/http_request_transform/entrypoint',
    );
    expect(calls[1].method).toBe('POST');
    expect(calls[1].url).toBe(
      'https://api.cloudflare.com/client/v4/zones/zone-1/rulesets',
    );
    const payload = JSON.parse(calls[1].body);
    expect(payload.phase).toBe('http_request_transform');
    expect(payload.kind).toBe('zone');
    expect(payload.name).toBe('default');
    expect(payload.rules).toHaveLength(1);
    expect(payload.rules[0].action).toBe('rewrite');
  });

  it('patches an existing rule with the same description', async () => {
    const { calls, fetchImpl } = stubFetch([
      {
        status: 200,
        body: {
          result: {
            id: 'rs-1',
            rules: [
              { id: 'other', description: 'unrelated rule' },
              {
                id: 'rule-1',
                description: 'docs.jmeter.ai: serve Markdown for Accept: text/markdown',
              },
            ],
          },
        },
      },
      { status: 200, body: { result: { id: 'rule-1' } } },
    ]);
    const id = await applyRule({ fetchImpl, token: 'tok', zoneId: 'zone-1' });
    expect(id).toBe('rule-1');
    expect(calls[1].method).toBe('PATCH');
    expect(calls[1].url).toBe(
      'https://api.cloudflare.com/client/v4/zones/zone-1/rulesets/rs-1/rules/rule-1',
    );
  });

  it('appends a new rule when the ruleset exists without it', async () => {
    const { calls, fetchImpl } = stubFetch([
      {
        status: 200,
        body: {
          result: { id: 'rs-1', rules: [{ id: 'other', description: 'unrelated' }] },
        },
      },
      { status: 200, body: { result: { id: 'rule-2' } } },
    ]);
    const id = await applyRule({ fetchImpl, token: 'tok', zoneId: 'zone-1' });
    expect(id).toBe('rule-2');
    expect(calls[1].method).toBe('POST');
    expect(calls[1].url).toBe(
      'https://api.cloudflare.com/client/v4/zones/zone-1/rulesets/rs-1/rules',
    );
  });

  it('rejects when PATCH returns 404 (e.g. stale ruleset/rule id)', async () => {
    const { fetchImpl } = stubFetch([
      {
        status: 200,
        body: {
          result: {
            id: 'rs-1',
            rules: [
              {
                id: 'rule-1',
                description: 'docs.jmeter.ai: serve Markdown for Accept: text/markdown',
              },
            ],
          },
        },
      },
      { status: 404, body: { success: false } },
    ]);
    await expect(
      applyRule({ fetchImpl, token: 'tok', zoneId: 'zone-1' }),
    ).rejects.toThrow(
      'https://api.cloudflare.com/client/v4/zones/zone-1/rulesets/rs-1/rules/rule-1',
    );
  });

  it('sends the token in the Authorization header but never leaks it', async () => {
    const { calls, fetchImpl } = stubFetch([{ status: 403, body: { success: false } }]);
    let thrown;
    try {
      await applyRule({ fetchImpl, token: 'secret-tok', zoneId: 'zone-1' });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeDefined();
    expect(thrown.message).toContain('403');
    expect(calls[0].headers.Authorization).toBe('Bearer secret-tok');
    // The token must not end up in URLs, bodies, or the error message.
    const sent = calls.map((c) => [c.url, c.body]);
    expect(JSON.stringify(sent)).not.toContain('secret-tok');
    expect(thrown.message).not.toContain('secret-tok');
  });
});

describe('docs prefixes stay in sync with public/_headers', () => {
  const headers = fs.readFileSync(path.join(ROOT, 'public/_headers'), 'utf8');

  // Parse _headers blocks: a top-level selector line followed by
  // indented `Header: value` lines.
  function blocks() {
    const out = [];
    let current = null;
    for (const line of headers.split('\n')) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      if (/^\s/.test(line)) {
        current?.rules.push(line.trim());
      } else {
        current = { selector: line.trim(), rules: [] };
        out.push(current);
      }
    }
    return out;
  }

  it('every docs prefix has a Vary: Accept block and vice versa', () => {
    const varySelectors = blocks()
      .filter((b) => b.rules.some((r) => r === 'Vary: Accept'))
      .map((b) => b.selector.replace(/\*$/, ''))
      .sort();
    expect(varySelectors).toEqual([...DOCS_PREFIXES].sort());
    expect([...DOCS_PREFIXES].sort()).toEqual(varySelectors);
  });

  it('the /*.md block carries the markdown content-type and noindex', () => {
    const md = blocks().find((b) => b.selector === '/*.md');
    expect(md).toBeDefined();
    expect(md.rules).toContain('Content-Type: text/markdown; charset=utf-8');
    expect(md.rules).toContain('X-Robots-Tag: noindex');
  });
});
