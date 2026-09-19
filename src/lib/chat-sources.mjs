/**
 * Extract docs.jmeter.ai citations from assistant markdown (and MCP tool
 * text). Used by Ask AI when the model cites pages after a tool loop.
 * Only indexed documentation pages become chips (same guarantee as the
 * old retrieve()/X-Sources path).
 */

import docPaths from './doc-paths.json' with { type: 'json' };

const DOCS_ORIGIN = 'https://docs.jmeter.ai';
const INDEXED_PATHS = new Set(docPaths);
const ASSET_EXT = /\.(?:png|jpe?g|gif|svg|webp|ico|css|js|mjs|map|woff2?|ttf|otf|mp4|webm|pdf)(?:$|\?)/i;
const FILE_EXT = /\.[a-z0-9]{1,8}$/i;
const UNSAFE_SCHEME = /^(javascript|data|vbscript|file):/i;

function pathKey(pathname) {
  return String(pathname || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.(mdx|html?)$/i, '');
}

/**
 * @param {string} url
 * @returns {string} canonical https://docs.jmeter.ai/.../ URL, or ''
 */
export function canonicalizeDocUrl(url) {
  let raw = String(url || '').trim();
  raw = raw.replace(/^[<`"'(\[]+/, '').replace(/[>`"')\],.;:!?]+$/g, '');
  raw = raw.replace(/[.,;:]+$/g, '');
  if (!raw || UNSAFE_SCHEME.test(raw)) return '';
  try {
    const parsed = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw)
      : raw.startsWith('/')
        ? new URL(raw, DOCS_ORIGIN)
        : null;
    if (!parsed) return '';
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    if (parsed.hostname !== 'docs.jmeter.ai') return '';
    parsed.hash = '';
    parsed.username = '';
    parsed.password = '';
    const path = parsed.pathname || '/';
    if (ASSET_EXT.test(path) || FILE_EXT.test(path.split('/').pop() || '')) {
      return '';
    }
    const key = pathKey(path);
    if (key && !INDEXED_PATHS.has(key)) return '';
    const slashPath = path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`;
    return `${DOCS_ORIGIN}${slashPath}${parsed.search}`;
  } catch {
    return '';
  }
}

function titleFromUrl(url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const last = path.split('/').filter(Boolean).pop() || 'docs.jmeter.ai';
    return last.replace(/[-_]+/g, ' ');
  } catch {
    return 'docs.jmeter.ai';
  }
}

/**
 * @param {string} text
 * @returns {{ title: string, url: string }[]}
 */
export function extractDocSources(text) {
  const src = String(text || '');
  if (!src) return [];
  /** @type {{ title: string, url: string }[]} */
  const out = [];
  const seen = new Set();

  /**
   * @param {string} title
   * @param {string} url
   */
  function add(title, url) {
    const canonical = canonicalizeDocUrl(url);
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    const label = String(title || '').trim() || titleFromUrl(canonical);
    out.push({ title: label, url: canonical });
  }

  for (const match of src.matchAll(
    /\[([^\]]+)\]\((https:\/\/docs\.jmeter\.ai\/[^)\s<>`"]+|\/(?:user-manual|topics|tools|getting-started|reference|releases|extending|mcp)[^)\s<>`"]*)\)/gi,
  )) {
    add(match[1], match[2]);
  }

  for (const match of src.matchAll(/^Source:\s*(https:\/\/docs\.jmeter\.ai\/[A-Za-z0-9/_-]+)/gim)) {
    add('', match[1]);
  }

  for (const match of src.matchAll(
    /^(?:[\d]+\.\s*)?(.+)\r?\nURL:\s*(https:\/\/docs\.jmeter\.ai\/[A-Za-z0-9/_-]+)/gim,
  )) {
    add(match[1], match[2]);
  }

  for (const match of src.matchAll(/https:\/\/docs\.jmeter\.ai\/[A-Za-z0-9/_-]+/gi)) {
    add('', match[0]);
  }

  return out;
}

/**
 * @param {{ title: string, url: string }[]} primary
 * @param {{ title: string, url: string }[]} extra
 * @returns {{ title: string, url: string }[]}
 */
export function mergeDocSources(primary, extra) {
  /** @type {{ title: string, url: string }[]} */
  const out = [];
  const seen = new Set();
  for (const item of [...(primary || []), ...(extra || [])]) {
    const canonical = canonicalizeDocUrl(item?.url);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push({
      title: String(item?.title || '').trim() || titleFromUrl(canonical),
      url: canonical,
    });
  }
  return out;
}
