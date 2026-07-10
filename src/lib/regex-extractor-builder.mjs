/**
 * Browser-only JMeter Regular Expression Extractor builder.
 * Detects likely dynamic values in a pasted response body and proposes
 * Regex Extractor field values (pattern, template, match no, default).
 *
 * JavaScript RegExp is used for preview (close to Java for common patterns,
 * not guaranteed identical). No network I/O; all processing is local.
 */

import { REGEX_EXTRACTOR, buildDynamicKeyRegex } from './tools-config.mjs';
import { escapeRegExp, formatBytes, utf8ByteLength } from './tools-utils.mjs';

/** @typedef {typeof REGEX_EXTRACTOR} RegexExtractorConfig */

/** Re-export config fields for existing imports. */
export const MAX_BODY_CHARS = REGEX_EXTRACTOR.maxBodyBytes;
export const MAX_BODY_LABEL = REGEX_EXTRACTOR.maxBodyLabel;
export const MAX_CANDIDATES = REGEX_EXTRACTOR.maxCandidates;

export { escapeRegExp, formatBytes, utf8ByteLength };

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const LONG_HEX_RE = /\b[0-9a-f]{24,64}\b/gi;

/**
 * Merge partial options over defaults (shallow).
 * @param {Partial<RegexExtractorConfig>} [opts]
 * @returns {RegexExtractorConfig}
 */
export function resolveRegexConfig(opts = {}) {
  return { ...REGEX_EXTRACTOR, ...opts };
}

/**
 * @param {string} name
 * @returns {string}
 */
export function toVariableName(name) {
  const cleaned = String(name || 'value')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  if (!cleaned) return 'extractedValue';
  if (/^[0-9]/.test(cleaned)) return `var_${cleaned}`;
  return cleaned;
}

/**
 * @param {string} body
 * @param {Partial<RegexExtractorConfig>} [opts]
 * @returns {{ ok: true, body: string, bytes: number } | { ok: false, error: string, bytes: number }}
 */
export function validateBody(body, opts = {}) {
  const config = resolveRegexConfig(opts);
  const text = String(body ?? '');
  const bytes = utf8ByteLength(text);
  if (!text.trim()) {
    return { ok: false, error: 'Paste a response body to scan for dynamic values.', bytes };
  }
  if (bytes > config.maxBodyBytes) {
    return {
      ok: false,
      error: `Body is too large (${formatBytes(bytes)}). Max allowed is ${config.maxBodyLabel}. Trim the response or paste only the relevant fragment.`,
      bytes,
    };
  }
  return { ok: true, body: text, bytes };
}

/**
 * Build Regex Extractor field values for a candidate.
 * @param {{ key?: string, value: string, kind: string }} fields
 * @param {Partial<RegexExtractorConfig>} [opts]
 */
export function buildExtractorFields({ key, value, kind }, opts = {}) {
  const config = resolveRegexConfig(opts);
  const escapedVal = escapeRegExp(String(value));
  let regex;
  let note = '';

  if (key) {
    const k = escapeRegExp(key);
    if (kind === 'json-key' || kind === 'json-path') {
      regex = `"${k}"\\s*:\\s*"([^"]+)"`;
      note = 'JSON string property; prefer JSON Extractor when the whole body is JSON.';
    } else if (kind === 'html-input') {
      regex = `name=["']${k}["'][^>]*\\bvalue=["']([^"']+)["']`;
      note = 'HTML input; verify attribute order if the match fails.';
    } else if (kind === 'html-meta') {
      regex = `name=["']${k}["'][^>]*\\bcontent=["']([^"']+)["']`;
      note = 'HTML meta tag content.';
    } else {
      regex = `${k}["'\\s:=]+["']?([^"'\\s&<>]+)["']?`;
      note = 'Key/value style match near the field name.';
    }
  } else if (kind === 'jwt') {
    regex = `(eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+)`;
    note = 'JWT-shaped token (three base64url segments).';
  } else if (kind === 'uuid') {
    regex = `([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})`;
    note = 'UUID-style value.';
  } else if (kind === 'hex') {
    regex = `([0-9a-fA-F]{24,64})`;
    note = 'Long hex string; common for tokens and ids.';
  } else {
    regex = `(${escapedVal})`;
    note = 'Literal value match; prefer a key-based pattern when possible.';
  }

  const variableName = key
    ? toVariableName(key)
    : kind === 'jwt'
      ? 'jwtToken'
      : kind === 'uuid'
        ? 'uuidValue'
        : 'extractedValue';

  return {
    variableName,
    regex,
    template: config.defaultTemplate,
    matchNo: config.defaultMatchNo,
    defaultValue: config.defaultValue,
    note,
  };
}

/**
 * @param {string} pattern
 * @param {string} body
 * @param {number} [matchNo=1]
 * @param {Partial<RegexExtractorConfig>} [opts]
 */
export function previewMatch(pattern, body, matchNo = 1, opts = {}) {
  const config = resolveRegexConfig(opts);
  try {
    const re = new RegExp(pattern, 'g');
    const matches = [];
    let m;
    while ((m = re.exec(body)) !== null && matches.length < config.maxPreviewMatches) {
      matches.push({
        full: m[0],
        group1: m[1] != null ? m[1] : m[0],
        index: m.index,
      });
      if (m[0].length === 0) re.lastIndex += 1;
    }
    const idx = Math.max(0, Math.floor(matchNo) - 1);
    return {
      ok: true,
      matchCount: matches.length,
      selected: matches[idx] || null,
      matches,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      matchCount: 0,
      selected: null,
      matches: [],
    };
  }
}

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   kind: string,
 *   key?: string,
 *   sampleValue: string,
 *   confidence: 'high' | 'medium' | 'low',
 *   reason: string,
 *   extractor: ReturnType<typeof buildExtractorFields>,
 *   preview: ReturnType<typeof previewMatch>,
 * }} Candidate
 */

/**
 * Scan body and return ranked dynamic-parameter candidates.
 * @param {string} rawBody
 * @param {Partial<RegexExtractorConfig>} [opts]
 */
export function analyzeResponseBody(rawBody, opts = {}) {
  const config = resolveRegexConfig(opts);
  const keyRe = buildDynamicKeyRegex(config.dynamicKeyNames);
  const validated = validateBody(rawBody, config);
  if (!validated.ok) {
    return {
      ok: false,
      error: validated.error,
      bytes: validated.bytes,
      bodyKind: 'text',
      candidates: [],
      tips: [],
    };
  }

  const body = validated.body;
  /** @type {Map<string, Omit<Candidate, 'extractor' | 'preview'> & { extractor?: Candidate['extractor'], preview?: Candidate['preview'] }>} */
  const byId = new Map();
  const tips = [
    'This tool runs entirely in your browser. The response body is never uploaded.',
    'Patterns target the Regular Expression Extractor. Prefer JSON Extractor when the body is pure JSON.',
    'JavaScript RegExp preview is close to Java in JMeter for most patterns; always verify with a Debug Sampler.',
  ];

  let bodyKind = /** @type {'json' | 'html' | 'text'} */ ('text');
  const trimmed = body.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const data = JSON.parse(trimmed);
      bodyKind = 'json';
      walkJson(data, [], config.maxJsonArrayItems, (path, key, value) => {
        if (typeof value !== 'string' && typeof value !== 'number') return;
        const str = String(value);
        if (!isInterestingValue(str, key, keyRe, config)) return;
        const conf = keyRe.test(key) ? 'high' : looksDynamicShape(str, config) ? 'medium' : 'low';
        if (conf === 'low' && str.length < 12) return;
        addCandidate(byId, {
          kind: 'json-key',
          key,
          value: str,
          label: path.length ? path.join('.') : key,
          confidence: conf,
          reason: keyRe.test(key)
            ? `JSON field "${key}" often holds a dynamic or session value.`
            : `JSON string at ${path.join('.') || key} looks dynamic.`,
        }, config);
      });
      tips.push('Body parsed as JSON; consider JSON Extractor or JMESPath for production plans.');
    } catch {
      // fall through
    }
  }

  if (/<[a-z][\s\S]*>/i.test(body) && bodyKind !== 'json') {
    bodyKind = 'html';
    scanHtmlInputs(body, byId, keyRe, config);
    scanHtmlMeta(body, byId, keyRe, config);
  }

  collectShapeMatches(body, byId, 'jwt', JWT_RE, 'JWT-shaped string (header.payload.signature).', 'medium', config);
  collectShapeMatches(body, byId, 'uuid', UUID_RE, 'UUID-shaped identifier.', 'medium', config);
  if (byId.size < 8) {
    collectShapeMatches(
      body,
      byId,
      'hex',
      LONG_HEX_RE,
      'Long hex string; common for tokens and ids.',
      'low',
      config,
    );
  }

  const rank = { high: 0, medium: 1, low: 2 };
  const candidates = [...byId.values()]
    .map((c) => {
      const extractor = buildExtractorFields(
        { key: c.key, value: c.sampleValue, kind: c.kind },
        config,
      );
      if (c.key) extractor.variableName = toVariableName(c.key);
      const preview = previewMatch(extractor.regex, body, 1, config);
      return { ...c, extractor, preview };
    })
    .filter((c) => c.preview.ok && c.preview.matchCount > 0)
    .sort((a, b) => {
      const r = rank[a.confidence] - rank[b.confidence];
      if (r !== 0) return r;
      return b.sampleValue.length - a.sampleValue.length;
    })
    .slice(0, config.maxCandidates);

  if (candidates.length === 0) {
    tips.push(
      'No strong candidates found. Try a smaller fragment that includes the token, or a named field such as "csrf":"...".',
    );
  }

  return {
    ok: true,
    bytes: validated.bytes,
    bodyKind,
    candidates,
    tips,
  };
}

/**
 * @param {unknown} node
 * @param {string[]} path
 * @param {number} maxArrayItems
 * @param {(path: string[], key: string, value: unknown) => void} visit
 */
function walkJson(node, path, maxArrayItems, visit) {
  if (node == null) return;
  if (Array.isArray(node)) {
    const max = Math.min(node.length, maxArrayItems);
    for (let i = 0; i < max; i++) walkJson(node[i], path.concat(String(i)), maxArrayItems, visit);
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      visit(path.concat(k), k, v);
      if (v && typeof v === 'object') walkJson(v, path.concat(k), maxArrayItems, visit);
    }
  }
}

/**
 * @param {string} str
 * @param {string} key
 * @param {RegExp} keyRe
 * @param {RegexExtractorConfig} config
 */
function isInterestingValue(str, key, keyRe, config) {
  if (!str || str.length < config.minValueLength || str.length > config.maxValueLength) return false;
  if (/^(true|false|null)$/i.test(str)) return false;
  if (keyRe.test(key)) return true;
  return looksDynamicShape(str, config);
}

/**
 * @param {string} str
 * @param {RegexExtractorConfig} config
 */
function looksDynamicShape(str, config) {
  if (str.length < config.minShapeLength) return false;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(str)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)) {
    return true;
  }
  if (/^[0-9a-f]{24,}$/i.test(str)) return true;
  if (/^[A-Za-z0-9_-]{20,}$/.test(str) && /[0-9]/.test(str)) return true;
  return false;
}

/**
 * @param {Map<string, object>} map
 * @param {{ kind: string, key?: string, value: string, label: string, confidence: 'high'|'medium'|'low', reason: string }} c
 * @param {RegexExtractorConfig} config
 */
function addCandidate(map, c, config) {
  const id = `${c.kind}:${c.key || ''}:${c.value.slice(0, 48)}`;
  if (map.has(id)) return;
  if (map.size >= config.maxCandidates * 3) return;
  map.set(id, {
    id,
    label: c.label,
    kind: c.kind,
    key: c.key,
    sampleValue: c.value,
    confidence: c.confidence,
    reason: c.reason,
  });
}

/**
 * @param {string} body
 * @param {Map<string, object>} map
 * @param {RegExp} keyRe
 * @param {RegexExtractorConfig} config
 */
function scanHtmlInputs(body, map, keyRe, config) {
  const inputRe = /<input\b[^>]*\bname\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let im;
  while ((im = inputRe.exec(body)) !== null && map.size < config.maxCandidates * 2) {
    const name = im[1];
    const tag = im[0];
    const valMatch = /\bvalue\s*=\s*["']([^"']*)["']/i.exec(tag);
    const value = valMatch ? valMatch[1] : '';
    if (!value || value.length < config.minValueLength) continue;
    if (!keyRe.test(name) && !looksDynamicShape(value, config)) continue;
    addCandidate(map, {
      kind: 'html-input',
      key: name,
      value,
      label: `input[name=${name}]`,
      confidence: keyRe.test(name) ? 'high' : 'medium',
      reason: `HTML input "${name}" with a non-trivial value.`,
    }, config);
  }
}

/**
 * @param {string} body
 * @param {Map<string, object>} map
 * @param {RegExp} keyRe
 * @param {RegexExtractorConfig} config
 */
function scanHtmlMeta(body, map, keyRe, config) {
  const metaRe =
    /<meta\b[^>]*\bname\s*=\s*["']([^"']+)["'][^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let mm;
  while ((mm = metaRe.exec(body)) !== null) {
    const [, name, content] = mm;
    if (!keyRe.test(name) && !/csrf|token|nonce/i.test(name)) continue;
    addCandidate(map, {
      kind: 'html-meta',
      key: name,
      value: content,
      label: `meta[name=${name}]`,
      confidence: 'high',
      reason: `HTML meta "${name}" often used for CSRF or anti-forgery tokens.`,
    }, config);
  }
}

/**
 * @param {string} body
 * @param {Map<string, object>} map
 * @param {string} kind
 * @param {RegExp} re
 * @param {string} reason
 * @param {'high'|'medium'|'low'} confidence
 * @param {RegexExtractorConfig} config
 */
function collectShapeMatches(body, map, kind, re, reason, confidence, config) {
  const pattern = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m;
  let count = 0;
  while ((m = pattern.exec(body)) !== null && count < config.maxShapeMatchesPerKind) {
    addCandidate(map, {
      kind,
      value: m[0],
      label: kind.toUpperCase(),
      confidence,
      reason,
    }, config);
    count += 1;
  }
}

/** Demo body for the empty state. */
export const SAMPLE_HTTP_BODY = `{
  "status": "ok",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
  "user": { "id": "550e8400-e29b-41d4-a716-446655440000", "name": "Ada" },
  "csrf": "a1b2c3d4e5f6a7b8c9d0e1f2"
}`;
