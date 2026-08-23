/**
 * Shared normalization and safety helpers for imported HTTP request data.
 *
 * These helpers run before converter-owned JMeter variables are introduced by
 * the serializer, keeping imported cURL/HAR values outside JMeter's expression
 * trust boundary by default.
 */

const XML10_INVALID_CHARS = /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;

/** Escape XML markup and remove only code points forbidden by XML 1.0. */
export function escapeXml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(XML10_INVALID_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Portable base64 encoding for UTF-8 strings. */
export function base64Encode(value) {
  const text = String(value);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(text, 'utf-8').toString('base64');
  }
  if (typeof btoa !== 'undefined' && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  return '';
}

/**
 * Reject all imported JMeter expressions unless a trusted caller explicitly
 * opts in. Ordinary variables are rejected as well as functions because an
 * imported `${NAME}` can read converter-owned secrets at execution time.
 */
export function sanitizeJMeterValue(value, allowExpressions = false) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (allowExpressions) return text;
  if (/\$\{[^}]*\}/.test(text)) {
    throw new Error(
      'Security error: Imported cURL/HAR values containing JMeter expressions (${...}) are rejected to prevent variable access or script execution.',
    );
  }
  return text;
}

/**
 * Decode URL userinfo without allowing malformed percent escapes to crash a
 * batch. The encoded value is preserved when decoding fails and a warning is
 * returned so callers can identify the affected request.
 */
export function decodeUrlCredential(value, fieldName) {
  const encoded = String(value || '');
  try {
    return { value: decodeURIComponent(encoded), warning: null };
  } catch {
    return {
      value: encoded,
      warning: `Malformed percent-encoding in URL ${fieldName}; preserved the encoded credential value.`,
    };
  }
}

/** Parse a Cookie header into ordered name/value pairs without re-scoping it. */
export function parseCookieHeader(value) {
  const cookies = [];
  for (const part of String(value || '').split(';')) {
    const equals = part.indexOf('=');
    if (equals <= 0) continue;
    cookies.push({
      name: part.slice(0, equals).trim(),
      value: part.slice(equals + 1).trim(),
    });
  }
  return cookies;
}

/** Add request-local cookies to an existing Cookie header losslessly. */
export function appendCookieHeader(headers, cookies) {
  if (!cookies || cookies.length === 0) return;
  const value = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  const existing = headers.find((header) => header.name.toLowerCase() === 'cookie');
  if (existing) {
    existing.value = existing.value ? `${existing.value}; ${value}` : value;
  } else {
    headers.push({ name: 'Cookie', value });
  }
}
