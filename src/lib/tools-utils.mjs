/**
 * Shared pure helpers for interactive tools (clamp, size, escape, param read).
 * Safe for Node tests and browser scripts.
 */

/**
 * Clamp a numeric value into [min, max]. Non-finite returns fallback.
 * @param {number} value
 * @param {{ min: number, max: number }} range
 * @param {number} [fallback]
 * @returns {number}
 */
export function clampToRange(value, range, fallback = range.min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(range.max, Math.max(range.min, n));
}

/**
 * UTF-8 byte length of a string (for paste size limits).
 * @param {string} text
 * @returns {number}
 */
export function utf8ByteLength(text) {
  const s = String(text ?? '');
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(s).length;
  }
  return unescape(encodeURIComponent(s)).length;
}

/**
 * @param {number} n
 * @returns {string}
 */
export function formatBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Escape a string for safe inclusion in a RegExp source.
 * @param {string} text
 * @returns {string}
 */
export function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Read a positive number from URLSearchParams or a plain object.
 * @param {URLSearchParams | Record<string, string>} params
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
export function readPositiveNumber(params, key, fallback) {
  const raw =
    typeof params.get === 'function'
      ? params.get(key)
      : /** @type {Record<string, string>} */ (params)[key];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Read a boolean flag from URLSearchParams or a plain object.
 * @param {URLSearchParams | Record<string, string>} params
 * @param {string} key
 * @returns {boolean}
 */
export function readBoolFlag(params, key) {
  const raw =
    typeof params.get === 'function'
      ? params.get(key)
      : /** @type {Record<string, string>} */ (params)[key];
  return raw === '1' || raw === 'true';
}

/**
 * @param {URLSearchParams | Record<string, string>} params
 * @param {string} key
 * @param {{ min: number, max: number }} range
 * @param {number} fallback
 */
export function readClampedNumber(params, key, range, fallback) {
  const raw =
    typeof params.get === 'function'
      ? params.get(key)
      : /** @type {Record<string, string>} */ (params)[key];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return clampToRange(n, range, fallback);
}

/**
 * Clipboard write with textarea fallback (browser only).
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function copyText(text) {
  const value = String(text ?? '');
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (typeof document === 'undefined') {
    throw new Error('Clipboard unavailable');
  }
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.append(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}
