/**
 * Server-side markdown rendering for shared Ask AI conversations.
 *
 * Shared threads store client-submitted assistant text and render it with
 * set:html on a public, indexed page, so this pipeline is stricter than a
 * normal markdown pass:
 *
 *   1. Raw HTML in the source is escaped BEFORE marked parses it, so no
 *      injected tag (<svg/onload=...>, <script>, ...) can ever reach the
 *      output; marked only emits tags from its own grammar.
 *   2. The generated HTML is then rebuilt through a tag/attribute allowlist:
 *      unknown tags are unwrapped, every attribute is dropped, and only
 *      href/src/alt/title survive after a URL-scheme check that decodes
 *      HTML entities first (blocks javascript:, data:, vbscript:, file:,
 *      including entity-encoded variants).
 *
 * Never throws: any unexpected failure falls back to fully escaped text.
 */

import { marked } from 'marked';

/** Tags marked may legitimately produce from escaped source. */
const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'em',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
  'li', 'ol', 'p', 'pre', 's', 'strong',
  'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
]);

/** Schemes that are never acceptable in href/src on a public page. */
const DANGEROUS_SCHEMES = ['javascript:', 'vbscript:', 'data:', 'file:'];

const NAMED_ENTITIES = {
  '&colon;': ':',
  '&tab;': '\t',
  '&newline;': '\n',
  '&semi;': ';',
};

/**
 * Escape text so it renders as literal characters in HTML.
 * @param {string} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One pass of numeric/named entity decoding plus `&amp;` unescaping. */
function decodeEntitiesOnce(value) {
  let out = value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 127 ? String.fromCharCode(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return code >= 0 && code <= 127 ? String.fromCharCode(code) : '';
    });
  for (const [entity, char] of Object.entries(NAMED_ENTITIES)) {
    out = out.split(entity).join(char);
    out = out.split(entity.toUpperCase()).join(char);
  }
  return out.split('&amp;').join('&');
}

/**
 * Decode the HTML entities that could otherwise hide a URL scheme from
 * the blocklist (e.g. `javascript&#58;alert(1)`, or double-encoded
 * `javascript&amp;#58;alert(1)`). Iterates until stable so stacked
 * encodings cannot smuggle a scheme past the check.
 * @param {string} value
 * @returns {string}
 */
function decodeUrlEntities(value) {
  let out = value;
  for (let i = 0; i < 3; i++) {
    const next = decodeEntitiesOnce(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * True when a URL is safe to keep in href/src. Blocks dangerous schemes
 * after entity decoding and control-character stripping; allows http(s),
 * mailto, fragment, and relative paths.
 * @param {string} url
 * @returns {boolean}
 */
export function isSafeUrl(url) {
  const decoded = decodeUrlEntities(url);
  const cleaned = decoded.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  if (!cleaned) return false;
  return !DANGEROUS_SCHEMES.some((scheme) => cleaned.startsWith(scheme));
}

/**
 * Rebuild marked's output through the allowlist. Input must already be
 * marked-generated HTML from an escaped source.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeGeneratedHtml(html) {
  // Opening tags: unwrap disallowed ones, rebuild allowed ones from
  // validated attributes only (everything else, including on* handlers,
  // is dropped implicitly).
  let out = html.replace(/<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g, (match, tag, attrs) => {
    const name = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return '';
    if (name === 'br' || name === 'hr') return `<${name}>`;
    const kept = [];
    for (const m of attrs.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
      const key = m[1].toLowerCase();
      const value = m[2];
      if (key === 'href' && name === 'a') {
        kept.push(`href="${isSafeUrl(value) ? value : '#'}"`);
      } else if (key === 'src' && name === 'img') {
        kept.push(`src="${isSafeUrl(value) ? value : '#'}"`);
      } else if (key === 'alt' && name === 'img') {
        kept.push(`alt="${value}"`);
      } else if (key === 'title' && (name === 'a' || name === 'img')) {
        kept.push(`title="${value}"`);
      }
    }
    // Match the chat panel's behavior: external links open safely.
    const href = kept.find((a) => a.startsWith('href="'));
    if (name === 'a' && href && /^href="https?:/i.test(href)) {
      kept.push('target="_blank"', 'rel="noopener noreferrer"');
    }
    return kept.length ? `<${name} ${kept.join(' ')}>` : `<${name}>`;
  });
  // Closing tags: unwrap disallowed ones.
  out = out.replace(/<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/g, (match, tag) =>
    ALLOWED_TAGS.has(tag.toLowerCase()) ? match : '',
  );
  return out;
}

/**
 * Render a shared conversation message (markdown, possibly containing
 * hostile HTML) into safe HTML for set:html.
 * @param {string} md
 * @returns {string} safe HTML, or escaped plain text on any failure
 */
export function renderSharedMarkdown(md) {
  const escapedSource = escapeHtml(md);
  let html;
  try {
    html = marked.parse(escapedSource, { async: false, breaks: true });
  } catch {
    return escapedSource;
  }
  try {
    return sanitizeGeneratedHtml(String(html));
  } catch {
    return escapedSource;
  }
}
