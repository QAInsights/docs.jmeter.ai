/**
 * cURL & HAR to Apache JMeter (JMX) Test Plan Converter.
 *
 * Parses raw cURL commands (single, multiline, or batch) and HAR 1.2 JSON
 * archives into production-ready, schema-compliant Apache JMeter 5.6.3 .jmx XML.
 */

import { tokenizeCurlStream as tokenizeShellCurlStream } from './curl-shell-tokenizer.mjs';
import {
  appendCookieHeader,
  base64Encode,
  decodeUrlCredential,
  escapeXml,
  parseCookieHeader,
  sanitizeJMeterValue,
} from './request-normalization.mjs';

export { base64Encode, escapeXml, sanitizeJMeterValue } from './request-normalization.mjs';

/** Maximum allowed input size in characters (1 MB) to prevent unbounded memory allocation */
export const MAX_INPUT_CHARS = 1_000_000;
/** Maximum number of requests allowed in a single conversion batch */
export const MAX_BATCH_REQUESTS = 250;

/**
 * @typedef {{
 *   method: string,
 *   url: string,
 *   protocol: string,
 *   domain: string,
 *   port: string,
 *   path: string,
 *   queryParams: Array<{ name: string, value: string, encode?: boolean, useEquals?: boolean, source?: 'url' | 'data' }>,
 *   rawQuery?: string,
 *   headers: Array<{ name: string, value: string }>,
 *   body: string | null,
 *   bodyType: 'raw' | 'form' | 'none',
 *   mimeType?: string,
 *   formData?: Array<{ name: string, value: string }>,
 *   fileArgs?: Array<{ path: string, paramName: string, mimeType: string }>,
 *   auth?: { type: 'basic' | 'bearer', value: string, username?: string, password?: string },
 *   cookies?: Array<{ name: string, value: string, domain?: string, path?: string, secure?: boolean, expires?: string, managerEligible?: boolean }>,
 *   insecure?: boolean,
 *   followRedirects?: boolean,
 *   name?: string,
 *   hasUnresolvedFiles?: boolean,
 *   blockingErrors?: string[],
 *   warnings?: string[],
 * }} ParsedHttpRequest
 *
 * @typedef {{
 *   input: string,
 *   testPlanName?: string,
 *   threads?: number,
 *   rampUpSeconds?: number,
 *   durationSeconds?: number,
 *   loopCount?: number,
 *   parameterizeHost?: boolean,
 *   parameterizeAuth?: boolean,
 *   includeAssertions?: boolean,
 *   includeCookieManager?: boolean,
 *   filterStaticAssets?: boolean,
 *   allowJMeterFunctions?: boolean,
 * }} ConversionOptions
 */

/**
 * Check if a port is the standard default port for the given protocol.
 * @param {string} protocol
 * @param {string} port
 * @returns {boolean}
 */
export function isStandardPort(protocol, port) {
  const normProto = String(protocol).toLowerCase().replace(':', '');
  const normPort = String(port);
  if (normProto === 'https' && (normPort === '443' || normPort === '')) return true;
  if (normProto === 'http' && (normPort === '80' || normPort === '')) return true;
  return false;
}

/**
 * List of static asset file extensions to filter out from HAR by default.
 */
const STATIC_ASSET_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'avif', 'bmp', 'tiff',
  'css', 'scss', 'less',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'mp4', 'webm', 'ogg', 'mp3', 'wav',
  'map',
]);

/**
 * Check if a URL points to a static media/font/css asset.
 * @param {string} urlStr
 * @returns {boolean}
 */
export function isStaticAssetUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname.toLowerCase();
    const lastDot = pathname.lastIndexOf('.');
    if (lastDot === -1) return false;
    const ext = pathname.slice(lastDot + 1);
    return STATIC_ASSET_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

function encodeCurlQueryComponent(value) {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

/**
 * Serialize a structured cURL query operand without losing anonymous/no-equals
 * forms such as `-d flag` and `--data-urlencode '=a b'`.
 */
function serializeQueryParam(param) {
  const encode = param.encode !== false;
  const value = encode ? encodeCurlQueryComponent(param.value) : param.value;
  if (param.useEquals === false) return value;
  const name = encodeCurlQueryComponent(param.name);
  return `${name}=${value}`;
}

/**
 * Known cURL options that take a separate operand/argument.
 */
const CURL_OPTIONS_WITH_OPERAND = new Set([
  '-X', '--request',
  '-H', '--header',
  '-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode',
  '--json',
  '-F', '--form', '--form-string',
  '-u', '--user', '--oauth2-bearer',
  '-b', '--cookie',
  '-c', '--cookie-jar',
  '-A', '--user-agent',
  '-e', '--referer',
  '--url',
  '-o', '--output',
  '-m', '--max-time',
  '--connect-timeout',
  '-x', '--proxy',
  '--preproxy', '--proxy-user', '--proxy-header', '--noproxy',
  '--proxy-cacert', '--proxy-cert', '--proxy-key',
  '--socks4', '--socks4a', '--socks5', '--socks5-hostname',
  '--connect-to', '--unix-socket',
  '--dns-interface', '--dns-ipv4-addr', '--dns-ipv6-addr',
  '--local-port',
  '--interface',
  '--cacert', '--cert', '--key', '--capath', '--ciphers',
  '--resolve',
  '--retry',
  '--retry-delay', '--retry-max-time',
  '--limit-rate',
]);

/**
 * Options that affect security, client certs, proxy, or DNS that cannot be automatically reproduced.
 */
const CURL_UNSUPPORTED_CRITICAL_OPTIONS = new Set([
  '--proxy', '-x',
  '--preproxy', '--proxy-user', '--proxy-header', '--noproxy',
  '--proxy-cacert', '--proxy-cert', '--proxy-key',
  '--socks4', '--socks4a', '--socks5', '--socks5-hostname',
  '--connect-to', '--unix-socket',
  '--dns-interface', '--dns-ipv4-addr', '--dns-ipv6-addr',
  '--local-port',
  '--cert', '--key',
  '--cacert', '--capath',
  '--ciphers',
  '--resolve',
  '--interface',
  '-m', '--max-time', '--connect-timeout',
  '--retry', '--retry-delay', '--retry-max-time',
  '--limit-rate',
  '--compressed',
  '-k', '--insecure', '--location-trusted',
  '-0', '--http1.0', '--http1.1', '--http2', '--http2-prior-knowledge', '--http3',
  '--next',
]);

const CURL_SHORT_OPTIONS_WITH_ATTACHED_OPERAND = new Set([
  '-X', '-H', '-d', '-F', '-u', '-b', '-c', '-A', '-e', '-o', '-m', '-x',
]);

/**
 * Known boolean flags that take NO operands.
 */
const CURL_BOOLEAN_FLAGS = new Set([
  '-k', '--insecure',
  '-L', '--location',
  '-G', '--get',
  '-I', '--head',
  '-s', '--silent',
  '-S', '--show-error',
  '-v', '--verbose',
  '-i', '--include',
  '-f', '--fail',
  '--compressed',
  '--location-trusted',
  '-N', '--no-buffer',
  '-0', '--http1.0',
  '--http1.1',
  '--http2',
  '--http2-prior-knowledge',
  '--http3',
]);

/**
 * Tokenize a full shell script/text into individual commands, preserving
 * empty quoted tokens ('', ""), multiline quoted bodies, comments, and line continuations.
 *
 * @param {string} text
 * @returns {string[][]} Array of token arrays, one per cURL command.
 */
export function tokenizeCurlStream(text) {
  return tokenizeShellCurlStream(text, MAX_INPUT_CHARS);
}

/**
 * Check if a token looks like a target URL or valid hostname/path.
 * @param {string} token
 * @returns {boolean}
 */
export function isTargetUrl(token) {
  if (!token || typeof token !== 'string') return false;
  if (token.startsWith('-')) return false;
  if (/^https?:\/\//i.test(token)) return true;
  // Hostname pattern (e.g. example.com, localhost:8080, 127.0.0.1:3000/api, my-api.org)
  if (/^(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,})(?::\d+)?(?:\/.*)?$/.test(token)) {
    return true;
  }
  return false;
}

/**
 * Parse a token list of a single cURL command into a ParsedHttpRequest.
 * @param {string[]} rawTokens
 * @param {boolean} [allowFunctions]
 * @returns {ParsedHttpRequest | null}
 */
export function parseCurlTokens(rawTokens, allowFunctions = false) {
  if (!rawTokens || rawTokens.length === 0) return null;

  // Flatten attached long and short operands (e.g. --url=https://... or
  // -xhttp://proxy.example). This happens before request-affecting policy.
  const tokens = [];
  for (const t of rawTokens) {
    if (t.startsWith('--') && t.includes('=')) {
      const eqIdx = t.indexOf('=');
      tokens.push(t.slice(0, eqIdx));
      tokens.push(t.slice(eqIdx + 1));
    } else {
      const shortOption = t.length > 2 ? t.slice(0, 2) : '';
      if (CURL_SHORT_OPTIONS_WITH_ATTACHED_OPERAND.has(shortOption)) {
        tokens.push(shortOption, t.slice(2));
      } else {
        tokens.push(t);
      }
    }
  }

  let startIndex = 0;
  if (tokens[0].toLowerCase() === 'curl') {
    startIndex = 1;
  }

  let method = 'GET';
  let methodExplicitlySet = false;
  let forceGet = false;
  let url = '';
  /** @type {Array<{ name: string, value: string }>} */
  const headers = [];
  /** @type {Array<{ mode: string, value: string }>} */
  const dataParts = [];
  /** @type {Array<{ name: string, value: string }>} */
  const formData = [];
  /** @type {Array<{ path: string, paramName: string, mimeType: string }>} */
  const fileArgs = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const blockingErrors = [];
  let hasUnresolvedFiles = false;
  const addBlockingError = (message) => {
    warnings.push(message);
    blockingErrors.push(message);
  };
  const addUnresolvedFile = (message) => {
    hasUnresolvedFiles = true;
    addBlockingError(message);
  };
  let isJsonPayload = false;
  let insecure = false;
  let followRedirects = false; // cURL default is false (-L enables)
  let auth = null;
  /** @type {Array<{ name: string, value: string, domain?: string, path?: string, secure?: boolean, managerEligible?: boolean }>} */
  const cookies = [];

  for (let i = startIndex; i < tokens.length; i++) {
    const token = tokens[i];
    if (CURL_OPTIONS_WITH_OPERAND.has(token) && i + 1 >= tokens.length) {
      throw new Error(`Invalid cURL command: option "${token}" requires an operand.`);
    }

    // Method flags (-X or --request)
    if (token === '-X' || token === '--request') {
      if (i + 1 < tokens.length) {
        method = sanitizeJMeterValue(tokens[++i].toUpperCase(), allowFunctions);
        methodExplicitlySet = true;
      }
      continue;
    }

    // Force GET (-G or --get)
    if (token === '-G' || token === '--get') {
      forceGet = true;
      continue;
    }

    // Head request (-I or --head)
    if (token === '-I' || token === '--head') {
      method = 'HEAD';
      methodExplicitlySet = true;
      continue;
    }

    // Explicit URL flag (--url)
    if (token === '--url') {
      if (i + 1 < tokens.length) {
        const explicitUrl = sanitizeJMeterValue(tokens[++i], allowFunctions);
        if (url) {
          addBlockingError('Multiple URL operands or transfers in one cURL invocation are not supported. Split them into separate cURL commands.');
        } else {
          url = explicitUrl;
        }
      }
      continue;
    }

    // Header flag (-H or --header)
    if (token === '-H' || token === '--header') {
      if (i + 1 < tokens.length) {
        const headerLine = sanitizeJMeterValue(tokens[++i], allowFunctions);
        if (headerLine.startsWith('@')) {
          addUnresolvedFile(`Header option "${token} ${headerLine}" references a local header file that cannot be read in web/MCP environments.`);
          continue;
        }
        const colonIdx = headerLine.indexOf(':');
        if (colonIdx > 0) {
          const name = headerLine.slice(0, colonIdx).trim();
          const value = headerLine.slice(colonIdx + 1).trim();
          if (!name.startsWith(':') && name.toLowerCase() !== 'content-length') {
            headers.push({ name, value });
            // Cookie headers are request-local. Keep the header intact rather
            // than broadening its scope through the global Cookie Manager.
            if (name.toLowerCase() === 'cookie') {
              cookies.push(...parseCookieHeader(value).map((cookie) => ({ ...cookie, managerEligible: false })));
            }
          }
        }
      }
      continue;
    }

    // JSON payload shorthand (--json)
    if (token === '--json') {
      if (i + 1 < tokens.length) {
        const jsonVal = sanitizeJMeterValue(tokens[++i], allowFunctions);
        if (jsonVal.startsWith('@')) {
          addUnresolvedFile(`File reference "--json ${jsonVal}" cannot be read in web/MCP environments. Paste the JSON contents before exporting.`);
        } else {
          dataParts.push({ mode: '--json', value: jsonVal });
        }
        isJsonPayload = true;
        if (!methodExplicitlySet && method === 'GET') {
          method = 'POST';
        }
      }
      continue;
    }

    // Data / Body flags (-d, --data, --data-raw, --data-binary, --data-ascii, --data-urlencode)
    if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary' ||
      token === '--data-ascii' ||
      token === '--data-urlencode'
    ) {
      if (i + 1 < tokens.length) {
        const dataVal = sanitizeJMeterValue(tokens[++i], allowFunctions);
        const dataUrlencodeFile = token === '--data-urlencode' && (
          dataVal.startsWith('@') || (/^[^=@]+@.+/.test(dataVal))
        );
        if ((dataVal.startsWith('@') && token !== '--data-raw') || dataUrlencodeFile) {
          addUnresolvedFile(`File reference "${token} ${dataVal}" cannot be read in web/MCP environments. Paste the raw body contents before exporting.`);
        } else {
          dataParts.push({ mode: token, value: dataVal });
        }
        if (!methodExplicitlySet && method === 'GET') {
          method = 'POST';
        }
      }
      continue;
    }

    // Multipart Form Data (-F or --form or --form-string)
    if (token === '-F' || token === '--form' || token === '--form-string') {
      if (i + 1 < tokens.length) {
        const formField = sanitizeJMeterValue(tokens[++i], allowFunctions);
        if (!methodExplicitlySet && method === 'GET') {
          method = 'POST';
        }
        const eqIdx = formField.indexOf('=');
        if (eqIdx > 0) {
          const fieldName = formField.slice(0, eqIdx).trim();
          const fieldValue = formField.slice(eqIdx + 1).trim();
          const partHeaderFileMatch = fieldValue.match(/;headers=["']?@([^;"']+)/i);
          const modifierMatch = fieldValue.match(/;(type|filename|headers)=([^;]*)/i);

          if ((fieldValue.startsWith('@') || fieldValue.startsWith('<')) && token !== '--form-string') {
            const fileParts = fieldValue.slice(1).split(';');
            const filePath = fileParts[0];
            addUnresolvedFile(`Multipart file parameter "${fieldName}" references unresolved local path "${filePath}". Supply file contents through a supported workflow before exporting.`);
          } else if (token !== '--form-string' && partHeaderFileMatch) {
            addUnresolvedFile(`Multipart parameter "${fieldName}" loads part headers from unresolved local path "${partHeaderFileMatch[1]}". Paste the effective headers before exporting.`);
          } else if (token !== '--form-string' && modifierMatch) {
            const modifier = modifierMatch[1].toLowerCase();
            addBlockingError(`Multipart modifier "${modifier}" on parameter "${fieldName}" cannot be reproduced safely in the generated JMX.`);
          } else {
            formData.push({
              name: fieldName,
              value: fieldValue,
            });
          }
        }
      }
      continue;
    }

    // User auth (-u or --user)
    if (token === '-u' || token === '--user') {
      if (i + 1 < tokens.length) {
        const userPass = sanitizeJMeterValue(tokens[++i], allowFunctions);
        const colonIdx = userPass.indexOf(':');
        const username = colonIdx !== -1 ? userPass.slice(0, colonIdx) : userPass;
        const password = colonIdx !== -1 ? userPass.slice(colonIdx + 1) : '';
        auth = { type: 'basic', value: userPass, username, password };
      }
      continue;
    }

    // OAuth2 Bearer token (--oauth2-bearer)
    if (token === '--oauth2-bearer') {
      if (i + 1 < tokens.length) {
        auth = { type: 'bearer', value: sanitizeJMeterValue(tokens[++i], allowFunctions) };
      }
      continue;
    }

    // Cookies (-b or --cookie)
    if (token === '-b' || token === '--cookie') {
      if (i + 1 < tokens.length) {
        const cookieStr = sanitizeJMeterValue(tokens[++i], allowFunctions);
        if (cookieStr && !cookieStr.includes('=')) {
          addUnresolvedFile(`Cookie option "${token} ${cookieStr}" references a local cookie file that cannot be read in web/MCP environments.`);
        } else {
          const requestCookies = parseCookieHeader(cookieStr);
          cookies.push(...requestCookies.map((cookie) => ({ ...cookie, managerEligible: false })));
          appendCookieHeader(headers, requestCookies);
        }
      }
      continue;
    }

    // User-Agent (-A or --user-agent)
    if (token === '-A' || token === '--user-agent') {
      if (i + 1 < tokens.length) {
        headers.push({ name: 'User-Agent', value: sanitizeJMeterValue(tokens[++i], allowFunctions) });
      }
      continue;
    }

    // Referer (-e or --referer)
    if (token === '-e' || token === '--referer') {
      if (i + 1 < tokens.length) {
        headers.push({ name: 'Referer', value: sanitizeJMeterValue(tokens[++i], allowFunctions) });
      }
      continue;
    }

    // Insecure SSL (-k or --insecure)
    if (token === '-k' || token === '--insecure') {
      insecure = true;
      addBlockingError(`Critical option "${token}" disables TLS verification and cannot be reproduced safely in the generated JMX.`);
      continue;
    }

    // Location / Redirects (-L or --location)
    if (token === '-L' || token === '--location') {
      followRedirects = true;
      continue;
    }

    // Critical unsupported security/proxy options
    if (CURL_UNSUPPORTED_CRITICAL_OPTIONS.has(token)) {
      const message = `Critical option "${token}" cannot be reproduced safely in JMX; the generated plan is incomplete until routing/TLS configuration is supplied manually.`;
      addBlockingError(message);
      if (CURL_OPTIONS_WITH_OPERAND.has(token) && i + 1 < tokens.length) {
        i++;
      }
      continue;
    }

    // Skip known value-taking options
    if (CURL_OPTIONS_WITH_OPERAND.has(token)) {
      if (i + 1 < tokens.length) {
        i++;
      }
      continue;
    }

    // Unknown options fail closed because their request/transport semantics are
    // not known. Presentation-only flags are the only safe non-blocking case.
    if (token.startsWith('-')) {
      if (CURL_BOOLEAN_FLAGS.has(token)) {
        warnings.push(`Presentation-only cURL flag "${token}" does not affect the generated request and was ignored.`);
      } else if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-') && !isTargetUrl(tokens[i + 1])) {
        addBlockingError(`Unsupported cURL option "${token} ${tokens[i + 1]}" may affect the request and cannot be converted safely.`);
        i++;
      } else {
        addBlockingError(`Unsupported cURL flag "${token}" may affect the request and cannot be converted safely.`);
      }
      continue;
    }

    // Every positional operand is a cURL transfer URL. Supporting more than one
    // requires modeling per-transfer option state, so fail closed for now.
    if (!url) {
      url = sanitizeJMeterValue(token, allowFunctions);
    } else {
      addBlockingError('Multiple URL operands or transfers in one cURL invocation are not supported. Split them into separate cURL commands.');
    }
  }

  if (!url) {
    throw new Error('Invalid cURL command: no transfer URL was provided.');
  }

  if (forceGet && !methodExplicitlySet) {
    method = 'GET';
  }

  // Scheme-less normalization: cURL defaults scheme-less targets to http://
  let normalizedUrl = url;
  const explicitScheme = normalizedUrl.match(/^([A-Za-z][A-Za-z0-9+.-]*):(?=\/\/)/);
  if (explicitScheme && !/^https?:$/i.test(explicitScheme[0])) {
    throw new Error(`Unsupported URL protocol "${explicitScheme[1]}:". Only HTTP and HTTPS requests can be converted.`);
  }
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    // If explicit port is 443, use https://; otherwise cURL defaults to http://
    if (/:443(?:\/|$)/.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    } else {
      normalizedUrl = 'http://' + normalizedUrl;
    }
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error(`Invalid cURL URL "${url}".`);
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol "${parsedUrl.protocol}". Only HTTP and HTTPS requests can be converted.`);
  }

  // Extract embedded user:pass from URL (e.g. http://user:pass@example.com)
  if (parsedUrl.username || parsedUrl.password) {
    if (!auth) {
      const decodedUsername = decodeUrlCredential(parsedUrl.username, 'username');
      const decodedPassword = decodeUrlCredential(parsedUrl.password, 'password');
      if (decodedUsername.warning) warnings.push(decodedUsername.warning);
      if (decodedPassword.warning) warnings.push(decodedPassword.warning);
      const u = decodedUsername.value;
      const p = decodedPassword.value;
      auth = { type: 'basic', username: u, password: p, value: `${u}:${p}` };
    }
  }

  // Extract query params from URL
  /** @type {Array<{ name: string, value: string, encode?: boolean, useEquals?: boolean, source?: 'url' | 'data' }>} */
  const queryParams = [];
  parsedUrl.searchParams.forEach((value, name) => {
    queryParams.push({ name, value, encode: true, useEquals: true, source: 'url' });
  });
  const rawQuery = parsedUrl.search.startsWith('?') ? parsedUrl.search.slice(1) : parsedUrl.search;

  // Basic / Bearer Auth header injection
  const authHeader = headers.find((h) => h.name.toLowerCase() === 'authorization');
  if (authHeader && /^Bearer\s+/i.test(authHeader.value)) {
    auth = {
      type: 'bearer',
      value: authHeader.value.replace(/^Bearer\s+/i, '').trim(),
    };
  } else if (auth?.type === 'basic') {
    if (!authHeader) {
      const basicEncoded = base64Encode(`${auth.username || ''}:${auth.password || ''}`);
      headers.push({ name: 'Authorization', value: `Basic ${basicEncoded}` });
    }
  } else if (auth?.type === 'bearer' && !authHeader) {
    headers.push({ name: 'Authorization', value: `Bearer ${auth.value}` });
  }

  if (isJsonPayload) {
    if (!headers.some((h) => h.name.toLowerCase() === 'content-type')) {
      headers.push({ name: 'Content-Type', value: 'application/json' });
    }
    if (!headers.some((h) => h.name.toLowerCase() === 'accept')) {
      headers.push({ name: 'Accept', value: 'application/json' });
    }
  }

  let body = null;
  let bodyType = 'none';
  let mimeType = undefined;

  if (dataParts.length > 0) {
    if (forceGet) {
      for (const entry of dataParts) {
        if (entry.mode === '--data-urlencode') {
          const eqIdx = entry.value.indexOf('=');
          if (eqIdx > 0) {
            queryParams.push({
              name: entry.value.slice(0, eqIdx),
              value: entry.value.slice(eqIdx + 1),
              encode: true,
              useEquals: true,
              source: 'data',
            });
          } else {
            queryParams.push({
              name: '',
              value: eqIdx === 0 ? entry.value.slice(1) : entry.value,
              encode: true,
              useEquals: false,
              source: 'data',
            });
          }
          continue;
        }

        for (const part of entry.value.split('&')) {
          if (!part) continue;
          const eqIdx = part.indexOf('=');
          if (eqIdx >= 0) {
            queryParams.push({
              name: part.slice(0, eqIdx),
              value: part.slice(eqIdx + 1),
              encode: false,
              useEquals: true,
              source: 'data',
            });
          } else {
            queryParams.push({ name: '', value: part, encode: false, useEquals: false, source: 'data' });
          }
        }
      }
    } else {
      const processedParts = dataParts.map((entry) => {
        if (entry.mode === '--data-urlencode') {
          const eqIdx = entry.value.indexOf('=');
          if (eqIdx > 0) {
            const k = entry.value.slice(0, eqIdx);
            const v = encodeCurlQueryComponent(entry.value.slice(eqIdx + 1));
            return `${k}=${v}`;
          }
          return encodeCurlQueryComponent(eqIdx === 0 ? entry.value.slice(1) : entry.value);
        }
        return entry.value;
      });

      body = processedParts.join('&');
      bodyType = 'raw';
      mimeType = isJsonPayload ? 'application/json' : 'application/x-www-form-urlencoded';

      if (!isJsonPayload && !headers.some((h) => h.name.toLowerCase() === 'content-type')) {
        headers.push({ name: 'Content-Type', value: 'application/x-www-form-urlencoded' });
      }
    }
  } else if (formData.length > 0 || fileArgs.length > 0) {
    bodyType = 'form';
    mimeType = 'multipart/form-data';
  }

  const effectivePort = parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80');

  const enrichedCookies = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    managerEligible: c.managerEligible === true,
  }));

  const cleanUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;

  return {
    method,
    url: cleanUrl,
    protocol: parsedUrl.protocol.replace(':', ''),
    domain: parsedUrl.hostname,
    port: effectivePort,
    path: parsedUrl.pathname,
    queryParams,
    rawQuery,
    headers,
    body,
    bodyType,
    mimeType,
    formData: formData.length > 0 ? formData : undefined,
    fileArgs: fileArgs.length > 0 ? fileArgs : undefined,
    auth,
    cookies: enrichedCookies.length > 0 ? enrichedCookies : undefined,
    insecure,
    followRedirects,
    hasUnresolvedFiles,
    blockingErrors: blockingErrors.length > 0 ? blockingErrors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    name: `${method} ${parsedUrl.pathname || '/'}`,
  };
}

/**
 * Parse text containing one or more cURL commands.
 * @param {string} text
 * @param {boolean} [allowFunctions]
 * @returns {ParsedHttpRequest[]}
 */
export function parseCurlCommands(text, allowFunctions = false) {
  if (!text || typeof text !== 'string') return [];
  const commandTokensList = tokenizeCurlStream(text);
  if (commandTokensList.length > MAX_BATCH_REQUESTS) {
    throw new Error(`Batch limit exceeded: maximum ${MAX_BATCH_REQUESTS} requests allowed per conversion.`);
  }

  const results = [];
  for (const tokens of commandTokensList) {
    const parsed = parseCurlTokens(tokens, allowFunctions);
    if (parsed) results.push(parsed);
  }

  return results;
}

/**
 * Parse HAR 1.2 JSON content into a list of ParsedHttpRequests.
 * @param {string | object} harInput
 * @param {{ filterStatic?: boolean, allowFunctions?: boolean }} [options]
 * @returns {ParsedHttpRequest[]}
 */
export function parseHarJson(harInput, options = {}) {
  const filterStatic = options.filterStatic !== false;
  const allowFunctions = options.allowFunctions === true;

  let parsed;
  if (typeof harInput === 'string') {
    if (harInput.length > MAX_INPUT_CHARS) {
      throw new Error(`HAR input exceeds maximum size of ${MAX_INPUT_CHARS} characters.`);
    }
    try {
      parsed = JSON.parse(harInput);
    } catch (error) {
      throw new Error(`Invalid HAR JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (typeof harInput === 'object' && harInput !== null) {
    parsed = harInput;
  } else {
    return [];
  }

  /** @type {any[]} */
  const entries = parsed.log?.entries || parsed.entries || (Array.isArray(parsed) ? parsed : []);
  if (!Array.isArray(entries)) return [];

  if (entries.length > MAX_BATCH_REQUESTS) {
    throw new Error(`HAR entry limit exceeded: maximum ${MAX_BATCH_REQUESTS} requests allowed per conversion.`);
  }

  /** @type {ParsedHttpRequest[]} */
  const results = [];

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    const entry = entries[entryIndex];
    const req = entry?.request;
    if (!req || typeof req.url !== 'string' || req.url.trim() === '') {
      throw new Error(`Invalid HAR entry ${entryIndex + 1}: missing request URL.`);
    }

    const rawUrl = sanitizeJMeterValue(req.url, allowFunctions);
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new Error(`Invalid HAR entry ${entryIndex + 1}: malformed request URL "${rawUrl}".`);
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(`Invalid HAR entry ${entryIndex + 1}: unsupported protocol "${parsedUrl.protocol}". Only HTTP and HTTPS are supported.`);
    }

    const method = sanitizeJMeterValue(String(req.method || 'GET').toUpperCase(), allowFunctions);

    // Extension-only filtering is safe only for fetch methods. API routes can
    // legitimately end in .css/.png while a mutating request still belongs in
    // the executable flow.
    if (filterStatic && (method === 'GET' || method === 'HEAD') && isStaticAssetUrl(rawUrl)) {
      continue;
    }

    /** @type {Array<{ name: string, value: string }>} */
    const headers = [];
    /** @type {Array<{ name: string, value: string, domain?: string, path?: string, secure?: boolean, expires?: string, managerEligible?: boolean }>} */
    const cookies = [];
    /** @type {string[]} */
    const warnings = [];
    /** @type {string[]} */
    const blockingErrors = [];
    if (Array.isArray(req.headers)) {
      for (const h of req.headers) {
        if (h.name && !h.name.startsWith(':') && h.name.toLowerCase() !== 'content-length') {
          const name = sanitizeJMeterValue(h.name, allowFunctions);
          const value = sanitizeJMeterValue(h.value || '', allowFunctions);
          headers.push({ name, value });
          if (name.toLowerCase() === 'cookie') {
            cookies.push(...parseCookieHeader(value).map((cookie) => ({ ...cookie, managerEligible: false })));
          }
        }
      }
    }

    /** @type {Array<{ name: string, value: string, encode?: boolean, useEquals?: boolean, source?: 'url' | 'data' }>} */
    const queryParams = [];
    if (Array.isArray(req.queryString) && req.queryString.length > 0) {
      for (const q of req.queryString) {
        queryParams.push({
          name: sanitizeJMeterValue(q.name, allowFunctions),
          value: sanitizeJMeterValue(q.value || '', allowFunctions),
          encode: true,
          useEquals: true,
          source: 'url',
        });
      }
    } else {
      parsedUrl.searchParams.forEach((value, name) => {
        queryParams.push({
          name: sanitizeJMeterValue(name, allowFunctions),
          value: sanitizeJMeterValue(value, allowFunctions),
          encode: true,
          useEquals: true,
          source: 'url',
        });
      });
    }

    let body = null;
    let bodyType = 'none';
    let mimeType = req.postData?.mimeType ? sanitizeJMeterValue(req.postData.mimeType, allowFunctions) : undefined;
    /** @type {Array<{ name: string, value: string }> | undefined} */
    let formData = undefined;
    /** @type {Array<{ path: string, paramName: string, mimeType: string }> | undefined} */
    let fileArgs = undefined;
    let hasUnresolvedFiles = false;

    if (req.postData) {
      if (req.postData.text) {
        body = sanitizeJMeterValue(req.postData.text, allowFunctions);
        bodyType = 'raw';
      } else if (Array.isArray(req.postData.params) && req.postData.params.length > 0) {
        const formFields = [];
        const files = [];
        for (const p of req.postData.params) {
          if (p.fileName) {
            const filePath = sanitizeJMeterValue(p.fileName, allowFunctions);
            const parameterName = sanitizeJMeterValue(p.name, allowFunctions);
            sanitizeJMeterValue(p.contentType || 'application/octet-stream', allowFunctions);
            hasUnresolvedFiles = true;
            const message = `HAR multipart parameter "${parameterName}" references unresolved local path "${filePath}". Browser HAR data does not include a usable JMeter-side file.`;
            warnings.push(message);
            blockingErrors.push(message);
          } else {
            formFields.push({
              name: sanitizeJMeterValue(p.name, allowFunctions),
              value: sanitizeJMeterValue(p.value || '', allowFunctions),
            });
          }
        }
        if (formFields.length > 0) formData = formFields;
        // File params are intentionally not serialized until a caller can
        // explicitly provide and acknowledge a usable JMeter-side path.
        if (files.length > 0) fileArgs = files;
        bodyType = 'form';
      }
    }

    if (Array.isArray(req.cookies) && req.cookies.length > 0) {
      const requestOnlyCookies = [];
      const existingCookieNames = new Set(
        headers
          .filter((header) => header.name.toLowerCase() === 'cookie')
          .flatMap((header) => parseCookieHeader(header.value))
          .map((cookie) => cookie.name),
      );
      for (const c of req.cookies) {
        const cookieName = sanitizeJMeterValue(c.name, allowFunctions);
        const normalized = {
          name: cookieName,
          value: sanitizeJMeterValue(c.value || '', allowFunctions),
          domain: c.domain ? sanitizeJMeterValue(c.domain, allowFunctions) : undefined,
          path: c.path ? sanitizeJMeterValue(c.path, allowFunctions) : undefined,
          secure: c.secure === true,
          expires: c.expires ? String(c.expires) : undefined,
          managerEligible: false,
        };
        cookies.push(normalized);
        if (!existingCookieNames.has(cookieName)) requestOnlyCookies.push(normalized);
      }
      appendCookieHeader(
        headers,
        requestOnlyCookies,
      );
    }

    let auth = null;
    const authHeader = headers.find((h) => h.name.toLowerCase() === 'authorization');
    if (authHeader && /^Bearer\s+/i.test(authHeader.value)) {
      auth = {
        type: 'bearer',
        value: authHeader.value.replace(/^Bearer\s+/i, '').trim(),
      };
    }
    if (!authHeader && (parsedUrl.username || parsedUrl.password)) {
      const decodedUsername = decodeUrlCredential(parsedUrl.username, 'username');
      const decodedPassword = decodeUrlCredential(parsedUrl.password, 'password');
      if (decodedUsername.warning) warnings.push(decodedUsername.warning);
      if (decodedPassword.warning) warnings.push(decodedPassword.warning);
      auth = {
        type: 'basic',
        username: decodedUsername.value,
        password: decodedPassword.value,
        value: `${decodedUsername.value}:${decodedPassword.value}`,
      };
      headers.push({
        name: 'Authorization',
        value: `Basic ${base64Encode(`${decodedUsername.value}:${decodedPassword.value}`)}`,
      });
    }

    const effectivePort = parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80');
    const cleanUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;

    results.push({
      method,
      url: cleanUrl,
      protocol: parsedUrl.protocol.replace(':', ''),
      domain: parsedUrl.hostname,
      port: effectivePort,
      path: parsedUrl.pathname,
      queryParams,
      rawQuery: parsedUrl.search.startsWith('?') ? parsedUrl.search.slice(1) : parsedUrl.search,
      headers,
      body,
      bodyType,
      mimeType,
      formData,
      fileArgs,
      cookies: cookies.length > 0 ? cookies : undefined,
      auth,
      followRedirects: true,
      hasUnresolvedFiles,
      blockingErrors: blockingErrors.length > 0 ? blockingErrors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      name: `${method} ${parsedUrl.pathname || '/'}`,
    });
  }

  return results;
}

/**
 * Generate JMeter 5.6.3 compliant JMX XML from parsed HTTP requests.
 * @param {ParsedHttpRequest[]} requests
 * @param {ConversionOptions} [options]
 * @returns {string}
 */
export function buildJmxXml(requests, options = {}) {
  const testPlanName = escapeXml(options.testPlanName || 'cURL Converted Test Plan');
  const threads = options.threads ?? 1;
  const rampUp = options.rampUpSeconds ?? 1;
  const duration = options.durationSeconds ?? 0;
  const parameterizeHost = options.parameterizeHost !== false;
  const parameterizeAuth = options.parameterizeAuth !== false;
  const includeAssertions = options.includeAssertions !== false;
  const includeCookieManager = options.includeCookieManager !== false;

  // If duration is greater than 0, default loop count to -1 (infinite) so the test runs for the duration
  let loopCount = options.loopCount ?? 1;
  if (duration > 0 && (options.loopCount === undefined || options.loopCount === 1)) {
    loopCount = -1;
  }

  if (requests.length === 0) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">\n  <hashTree>\n    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Empty Test Plan" enabled="true">\n      <boolProp name="TestPlan.functional_mode">false</boolProp>\n      <boolProp name="TestPlan.tearDown_on_shutdown">true</boolProp>\n      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>\n      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">\n        <collectionProp name="Arguments.arguments"/>\n      </elementProp>\n    </TestPlan>\n    <hashTree/>\n  </hashTree>\n</jmeterTestPlan>';
  }

  // Find dominant host / protocol / port origin for HTTP Request Defaults
  /** @type {Record<string, number>} */
  const domainCounts = {};
  for (const r of requests) {
    if (r.domain) {
      domainCounts[r.domain] = (domainCounts[r.domain] || 0) + 1;
    }
  }

  let dominantDomain = '';
  let maxCount = 0;
  for (const [dom, cnt] of Object.entries(domainCounts)) {
    if (cnt > maxCount) {
      maxCount = cnt;
      dominantDomain = dom;
    }
  }

  const dominantReq = requests.find((r) => r.domain === dominantDomain);
  const defaultProtocol = dominantReq?.protocol || 'https';
  const defaultPort = dominantReq?.port || (defaultProtocol === 'https' ? '443' : '80');

  // Parameterize complete Bearer credentials only. A stable variable per
  // distinct token avoids coupling overlapping tokens such as `abc` and
  // `abcdef` through substring replacement.
  const bearerVariables = new Map();
  if (parameterizeAuth) {
    for (const r of requests) {
      for (const authHeader of r.headers.filter((h) => h.name.toLowerCase() === 'authorization')) {
        const match = authHeader.value.match(/^Bearer\s+(.+)$/i);
        const token = match?.[1]?.trim();
        if (token && !bearerVariables.has(token)) {
          bearerVariables.set(token, '');
        }
      }
    }
    const multipleTokens = bearerVariables.size > 1;
    let tokenIndex = 0;
    for (const token of bearerVariables.keys()) {
      tokenIndex += 1;
      bearerVariables.set(token, multipleTokens ? `AUTH_TOKEN_${tokenIndex}` : 'AUTH_TOKEN');
    }
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="${testPlanName}" enabled="true">
      <stringProp name="TestPlan.comments">Generated by docs.jmeter.ai cURL &amp; HAR to JMX converter</stringProp>
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.tearDown_on_shutdown">true</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
        <collectionProp name="Arguments.arguments">`;

  if (parameterizeHost && dominantDomain) {
    xml += `
          <elementProp name="BASE_URL" elementType="Argument">
            <stringProp name="Argument.name">BASE_URL</stringProp>
            <stringProp name="Argument.value">${escapeXml(dominantDomain)}</stringProp>
            <stringProp name="Argument.metadata">=</stringProp>
          </elementProp>`;
  }

  if (parameterizeAuth) {
    for (const [token, variableName] of bearerVariables) {
      xml += `
          <elementProp name="${variableName}" elementType="Argument">
            <stringProp name="Argument.name">${variableName}</stringProp>
            <stringProp name="Argument.value">${escapeXml(token)}</stringProp>
            <stringProp name="Argument.metadata">=</stringProp>
          </elementProp>`;
    }
  }

  xml += `
        </collectionProp>
      </elementProp>
    </TestPlan>
    <hashTree>
      <ConfigTestElement guiclass="HttpDefaultsGui" testclass="ConfigTestElement" testname="HTTP Request Defaults" enabled="true">
        <stringProp name="HTTPSampler.protocol">${escapeXml(defaultProtocol)}</stringProp>
        <stringProp name="HTTPSampler.domain">${parameterizeHost && dominantDomain ? '${BASE_URL}' : escapeXml(dominantDomain)}</stringProp>
        <stringProp name="HTTPSampler.port">${isStandardPort(defaultProtocol, defaultPort) ? '' : escapeXml(defaultPort)}</stringProp>
        <stringProp name="HTTPSampler.connect_timeout">5000</stringProp>
        <stringProp name="HTTPSampler.response_timeout">15000</stringProp>
      </ConfigTestElement>
      <hashTree/>`;

  if (includeCookieManager) {
    xml += `
      <CookieManager guiclass="CookiePanel" testclass="CookieManager" testname="HTTP Cookie Manager" enabled="true">
        <collectionProp name="CookieManager.cookies">`;
    xml += `
        </collectionProp>
        <boolProp name="CookieManager.clearEachIteration">false</boolProp>
        <boolProp name="CookieManager.controlledByThreadGroup">false</boolProp>
      </CookieManager>
      <hashTree/>`;
  }

  xml += `
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Thread Group" enabled="true">
        <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller" enabled="true">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <stringProp name="LoopController.loops">${loopCount === -1 ? '-1' : String(loopCount)}</stringProp>
        </elementProp>
        <stringProp name="ThreadGroup.num_threads">\${__P(threads,${String(threads)})}</stringProp>
        <stringProp name="ThreadGroup.ramp_time">\${__P(rampUp,${String(rampUp)})}</stringProp>
        <boolProp name="ThreadGroup.scheduler">${duration > 0 ? 'true' : 'false'}</boolProp>
        <stringProp name="ThreadGroup.duration">${duration > 0 ? `\${__P(duration,${String(duration)})}` : ''}</stringProp>
        <stringProp name="ThreadGroup.delay">0</stringProp>
        <boolProp name="ThreadGroup.same_user_on_next_iteration">true</boolProp>
      </ThreadGroup>
      <hashTree>`;

  // Build each HTTP Sampler
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const samplerName = escapeXml(req.name || `${req.method} Request ${i + 1}`);

    const sameDomain = req.domain === dominantDomain;
    const sameProtocol = req.protocol === defaultProtocol;
    const samePort = req.port === defaultPort;

    const domainProp = sameDomain && parameterizeHost ? '' : (sameDomain ? '' : escapeXml(req.domain));
    const protocolProp = sameProtocol ? '' : escapeXml(req.protocol);
    const portProp = samePort ? '' : escapeXml(req.port);
    const methodProp = escapeXml(req.method || 'GET');

    const hasRawBody = req.bodyType === 'raw' && req.body !== null;
    const isMultipart = (req.mimeType && req.mimeType.toLowerCase().includes('multipart/form-data')) || (req.fileArgs && req.fileArgs.length > 0);
    const hasFormData = req.bodyType === 'form' && Array.isArray(req.formData) && req.formData.length > 0;
    const hasFileArgs = Array.isArray(req.fileArgs) && req.fileArgs.length > 0;
    const hasQueryParams = Array.isArray(req.queryParams) && req.queryParams.length > 0;

    let samplerPath = req.path || '/';
    if (hasQueryParams || req.rawQuery) {
      const querySegments = [];
      if (req.rawQuery) querySegments.push(req.rawQuery);
      const structuredParams = req.rawQuery
        ? (req.queryParams || []).filter((param) => param.source === 'data')
        : (req.queryParams || []);
      querySegments.push(...structuredParams.map(serializeQueryParam));
      if (querySegments.length > 0) {
        samplerPath = `${samplerPath}${samplerPath.includes('?') ? '&' : '?'}${querySegments.join('&')}`;
      }
    }

    xml += `
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="${samplerName}" enabled="true">`;

    if (hasRawBody) {
      xml += `
          <boolProp name="HTTPSampler.postBodyRaw">true</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments">
              <elementProp name="" elementType="HTTPArgument">
                <boolProp name="HTTPArgument.always_encode">false</boolProp>
                <stringProp name="Argument.value">${escapeXml(req.body)}</stringProp>
                <stringProp name="Argument.metadata">=</stringProp>
              </elementProp>
            </collectionProp>
          </elementProp>`;
    } else if (hasFormData) {
      xml += `
          <boolProp name="HTTPSampler.postBodyRaw">false</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments" guiclass="HTTPArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
            <collectionProp name="Arguments.arguments">`;

      if (hasFormData) {
        for (const field of req.formData || []) {
          xml += `
              <elementProp name="${escapeXml(field.name)}" elementType="HTTPArgument">
                <boolProp name="HTTPArgument.always_encode">true</boolProp>
                <stringProp name="Argument.name">${escapeXml(field.name)}</stringProp>
                <stringProp name="Argument.value">${escapeXml(field.value)}</stringProp>
                <stringProp name="Argument.metadata">=</stringProp>
                <boolProp name="HTTPArgument.use_equals">true</boolProp>
              </elementProp>`;
        }
      }

      xml += `
            </collectionProp>
          </elementProp>`;
    } else {
      xml += `
          <boolProp name="HTTPSampler.postBodyRaw">false</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments" guiclass="HTTPArgumentsPanel" testclass="Arguments" testname="User Defined Variables" enabled="true">
            <collectionProp name="Arguments.arguments"/>
          </elementProp>`;
    }

    if (hasFileArgs) {
      xml += `
          <elementProp name="HTTPsampler.Files" elementType="HTTPFileArgs">
            <collectionProp name="HTTPFileArgs.files">`;
      for (const fa of req.fileArgs || []) {
        xml += `
              <elementProp name="${escapeXml(fa.path)}" elementType="HTTPFileArg">
                <stringProp name="File.path">${escapeXml(fa.path)}</stringProp>
                <stringProp name="File.paramname">${escapeXml(fa.paramName)}</stringProp>
                <stringProp name="File.mimetype">${escapeXml(fa.mimeType)}</stringProp>
              </elementProp>`;
      }
      xml += `
            </collectionProp>
          </elementProp>`;
    }

    if (domainProp) {
      xml += `
          <stringProp name="HTTPSampler.domain">${domainProp}</stringProp>`;
    }
    if (protocolProp) {
      xml += `
          <stringProp name="HTTPSampler.protocol">${protocolProp}</stringProp>`;
    }
    if (portProp) {
      xml += `
          <stringProp name="HTTPSampler.port">${portProp}</stringProp>`;
    }

    xml += `
          <stringProp name="HTTPSampler.path">${escapeXml(samplerPath)}</stringProp>
          <stringProp name="HTTPSampler.method">${methodProp}</stringProp>
          <boolProp name="HTTPSampler.follow_redirects">${req.followRedirects ? 'true' : 'false'}</boolProp>
          <boolProp name="HTTPSampler.auto_redirects">false</boolProp>
          <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
          <boolProp name="HTTPSampler.DO_MULTIPART_POST">${isMultipart ? 'true' : 'false'}</boolProp>
          <stringProp name="HTTPSampler.connect_timeout">5000</stringProp>
          <stringProp name="HTTPSampler.response_timeout">15000</stringProp>
        </HTTPSamplerProxy>
        <hashTree>`;

    // Imported request cookies remain sampler-local even when a Cookie Manager
    // is present. The empty manager learns runtime Set-Cookie responses without
    // preloading cookies that only appeared later in a HAR timeline.
    let filteredHeaders = req.headers.map((header) => ({ ...header }));
    if (!includeCookieManager && Array.isArray(req.cookies)) {
      const existingCookieNames = new Set(
        filteredHeaders
          .filter((header) => header.name.toLowerCase() === 'cookie')
          .flatMap((header) => parseCookieHeader(header.value))
          .map((cookie) => cookie.name),
      );
      appendCookieHeader(
        filteredHeaders,
        req.cookies.filter((cookie) => !existingCookieNames.has(cookie.name)),
      );
    }
    if (isMultipart) {
      filteredHeaders = filteredHeaders.filter((h) => !(h.name.toLowerCase() === 'content-type' && h.value.toLowerCase().includes('multipart/form-data')));
    }

    if (filteredHeaders && filteredHeaders.length > 0) {
      xml += `
          <HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="HTTP Header Manager" enabled="true">
            <collectionProp name="HeaderManager.headers">`;

      for (const h of filteredHeaders) {
        let val = h.value;
        if (parameterizeAuth && h.name.toLowerCase() === 'authorization') {
          const bearerMatch = val.match(/^Bearer\s+(.+)$/i);
          const token = bearerMatch?.[1]?.trim();
          const variableName = token ? bearerVariables.get(token) : undefined;
          if (variableName) val = `Bearer \${${variableName}}`;
        }
        xml += `
              <elementProp name="" elementType="Header">
                <stringProp name="Header.name">${escapeXml(h.name)}</stringProp>
                <stringProp name="Header.value">${escapeXml(val)}</stringProp>
              </elementProp>`;
      }

      xml += `
            </collectionProp>
          </HeaderManager>
          <hashTree/>`;
    }

    if (includeAssertions) {
      xml += `
          <ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="Response Code 200/201/204" enabled="true">
            <collectionProp name="Asserion.test_strings">
              <stringProp name="49586">200</stringProp>
              <stringProp name="49587">201</stringProp>
              <stringProp name="49590">204</stringProp>
            </collectionProp>
            <stringProp name="Assertion.custom_message">Unexpected HTTP response code</stringProp>
            <stringProp name="Assertion.test_field">Assertion.response_code</stringProp>
            <boolProp name="Assertion.assume_success">false</boolProp>
            <intProp name="Assertion.test_type">40</intProp>
          </ResponseAssertion>
          <hashTree/>`;
    }

    xml += `
        </hashTree>`;
  }

  xml += `
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
`;

  return xml;
}

/**
 * Universal converter function: automatically detects cURL vs HAR input,
 * parses requests, and builds a complete JMX XML plan with analytics summary.
 *
 * @param {ConversionOptions} options
 * @returns {{
 *   jmxXml: string,
 *   requestCount: number,
 *   inputFormat: 'curl' | 'har' | 'empty',
 *   requests: Array<{ method: string, url: string, domain: string, path: string, headersCount: number, bodyType: string }>,
 *   detectedDomains: string[],
 *   hasBearerToken: boolean,
 *   hasUnresolvedFiles: boolean,
 *   hasUnresolvedFileBody: boolean,
 *   blockingErrors: string[],
 *   isValid: boolean,
 *   warnings: string[],
 *   summary: string,
 * }}
 */
export function convertCurlOrHarToJmx(options) {
  const input = String(options?.input || '').trim();

  if (!input) {
    return {
      jmxXml: buildJmxXml([], options),
      requestCount: 0,
      inputFormat: 'empty',
      requests: [],
      detectedDomains: [],
      hasBearerToken: false,
      hasUnresolvedFiles: false,
      hasUnresolvedFileBody: false,
      blockingErrors: [],
      isValid: false,
      warnings: [],
      summary: 'No cURL commands or HAR JSON provided.',
    };
  }

  if (input.length > MAX_INPUT_CHARS) {
    throw new Error(`Input exceeds maximum size of ${MAX_INPUT_CHARS} characters.`);
  }

  let requests = [];
  let inputFormat = 'curl';
  const allowFunctions = options?.allowJMeterFunctions === true;
  let recognizedHar = false;

  // Check if input is HAR JSON
  if (input.startsWith('{') || input.startsWith('[')) {
    let parsedJson;
    try {
      parsedJson = JSON.parse(input);
    } catch {
      parsedJson = null;
    }
    if (parsedJson && (Array.isArray(parsedJson) || Array.isArray(parsedJson.log?.entries) || Array.isArray(parsedJson.entries))) {
      recognizedHar = true;
      requests = parseHarJson(parsedJson, {
        filterStatic: options?.filterStaticAssets !== false,
        allowFunctions,
      });
      inputFormat = 'har';
    }
  }

  if (!recognizedHar) {
    requests = parseCurlCommands(input, allowFunctions);
    inputFormat = 'curl';
  }

  const jmxXml = buildJmxXml(requests, options);

  const detectedDomains = Array.from(new Set(requests.map((r) => r.domain).filter(Boolean)));
  const hasBearerToken = requests.some((r) =>
    r.headers.some((h) => h.name.toLowerCase() === 'authorization' && /^Bearer\s+/i.test(h.value))
  );
  const hasUnresolvedFiles = requests.some((r) => r.hasUnresolvedFiles === true);
  const blockingErrors = requests.flatMap((r) => r.blockingErrors || []);
  const isValid = requests.length > 0 && blockingErrors.length === 0;

  const allWarnings = requests.flatMap((r) => r.warnings || []);

  const methodsList = requests.map((r) => r.method);
  const methodCounts = methodsList.reduce((acc, m) => {
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, /** @type {Record<string, number>} */ ({}));

  const methodSummary = Object.entries(methodCounts)
    .map(([m, c]) => `${c} ${m}`)
    .join(', ');

  const summary =
    requests.length > 0 && isValid
      ? `Converted ${requests.length} HTTP request(s) (${methodSummary}) from ${inputFormat.toUpperCase()} into a valid Apache JMeter 5.6.3 test plan with ${detectedDomains.length} target domain(s).`
      : requests.length > 0
        ? `Parsed ${requests.length} HTTP request(s), but the generated plan is incomplete and cannot be exported until ${blockingErrors.length} blocking issue(s) are resolved.`
      : `Could not parse valid HTTP requests from ${inputFormat.toUpperCase()} input. Ensure the cURL command or HAR file is well-formed.`;

  return {
    jmxXml,
    requestCount: requests.length,
    inputFormat: requests.length > 0 ? /** @type {'curl' | 'har'} */ (inputFormat) : 'empty',
    requests: requests.map((r) => ({
      method: r.method,
      url: r.url,
      domain: r.domain,
      path: r.path,
      headersCount: r.headers.length,
      bodyType: r.bodyType,
    })),
    detectedDomains,
    hasBearerToken,
    hasUnresolvedFiles,
    // Compatibility alias for callers created before all file types were
    // treated uniformly.
    hasUnresolvedFileBody: hasUnresolvedFiles,
    blockingErrors,
    isValid,
    warnings: allWarnings,
    summary,
  };
}
