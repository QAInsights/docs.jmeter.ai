/**
 * Cloudflare Workers Analytics Engine telemetry for the Docs MCP server (/api/mcp).
 *
 * Schema (`mcp_events` dataset):
 *   indexes[0] (index1): sampling & primary filter key (toolName || rpcMethod)
 *   blobs[0]   (blob1):  eventType   ('tool_call' | 'rpc_lifecycle' | 'rate_limit' | 'discovery' | 'http_error')
 *   blobs[1]   (blob2):  rpcMethod   ('tools/call' | 'initialize' | 'tools/list' | 'GET /api/mcp' | ...)
 *   blobs[2]   (blob3):  toolName    (MCP tool name, or '' for non-tool events)
 *   blobs[3]   (blob4):  outcome     ('ok' | 'zero_result' | 'uncertain' | 'tool_error' | 'schema_error' | 'unknown_tool' | 'rate_limited' | 'http_405' | 'http_500')
 *   blobs[4]   (blob5):  query       (redacted & truncated search/lookup query, '' for code/spec tools)
 *   blobs[5]   (blob6):  clientFamily('claude-code' | 'cursor' | 'vscode' | 'windsurf' | 'qwen' | 'antigravity' | 'devin' | 'other' | ...)
 *   blobs[6]   (blob7):  clientRaw   (clientInfo name/version or User-Agent, max 256 chars)
 *   blobs[7]   (blob8):  country     (Cloudflare ISO country code, e.g. 'US', 'XX')
 *   blobs[8]   (blob9):  colo        (Cloudflare edge colo, e.g. 'IAD', 'UNKNOWN')
 *   blobs[9]   (blob10): subDetail   (tool-specific safe metadata: match mode, elementType, environment, etc.)
 *   blobs[10]  (blob11): serverVer   (SERVER_VERSION)
 *
 *   doubles[0] (double1): latencyMs    (execution duration in milliseconds)
 *   doubles[1] (double2): count        (always 1, for weighted AVG calculations with _sample_interval)
 *   doubles[2] (double3): resultCount  (number of matched docs/properties/playbooks/recipes)
 *   doubles[3] (double4): isError      (1 on tool/schema/HTTP error or rate limit, 0 otherwise)
 *   doubles[4] (double5): isZeroResult (1 when a search/lookup returned 0 matches, 0 otherwise)
 *   doubles[5] (double6): inputChars   (character length of primary input, without storing raw code)
 */

import { env } from 'cloudflare:workers';
import { redactSecrets } from '../classifier.mjs';
import { SERVER_VERSION } from './server.mjs';

export const MCP_DATASET_NAME = 'mcp_events';
export const MAX_BLOB_CHARS = 256;

export const MCP_EVENT_TYPES = Object.freeze({
  TOOL_CALL: 'tool_call',
  RPC_LIFECYCLE: 'rpc_lifecycle',
  RATE_LIMIT: 'rate_limit',
  DISCOVERY: 'discovery',
  HTTP_ERROR: 'http_error',
});

export const MCP_OUTCOMES = Object.freeze({
  OK: 'ok',
  ZERO_RESULT: 'zero_result',
  UNCERTAIN: 'uncertain',
  TOOL_ERROR: 'tool_error',
  SCHEMA_ERROR: 'schema_error',
  UNKNOWN_TOOL: 'unknown_tool',
  RATE_LIMITED: 'rate_limited',
  HTTP_405: 'http_405',
  HTTP_500: 'http_500',
});

const QUERY_SAFE_TOOLS = new Set([
  'search_jmeter_docs',
  'get_jmeter_page',
  'lookup_jmeter_property',
  'get_jsr223_recipe',
  'lookup_error_playbook',
  'lookup_component',
  'lookup_function',
]);

const CLIENT_PATTERNS = [
  ['claude-code', /claude-code|claude[\s/_-]*code|anthropic/i],
  ['cursor', /\bcursor\b/i],
  ['windsurf', /\bwindsurf\b|codeium/i],
  ['antigravity', /\bantigravity\b/i],
  ['vscode', /\bvs[\s_-]*code\b|vscode|visual studio code/i],
  ['qwen', /\bqwen\b/i],
  ['pi', /\bpi(?:-coding-agent|[\s/_-]*mcp|\/)/i],
  ['devin', /\bdevin\b/i],
  ['zed', /\bzed\b/i],
  ['continue', /\bcontinue\b/i],
  ['copilot', /\bcopilot\b/i],
  ['openai', /\bopenai\b|chatgpt|codex/i],
  ['mcp-inspector', /mcp[\s_-]*inspector/i],
  ['curl', /\bcurl\//i],
  ['browser', /mozilla\/5\.0/i],
];

function truncateBlob(value, max = MAX_BLOB_CHARS) {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) : clean;
}

/**
 * Normalize MCP client identity from `initialize` clientInfo or HTTP User-Agent.
 * @param {string} [userAgent]
 * @param {{ name?: string, version?: string } | null} [clientInfo]
 * @returns {{ family: string, raw: string }}
 */
export function detectMcpClient(userAgent = '', clientInfo = null) {
  const infoName = typeof clientInfo?.name === 'string' ? clientInfo.name.trim() : '';
  const infoVersion = typeof clientInfo?.version === 'string' ? clientInfo.version.trim() : '';
  const infoLabel = infoName ? (infoVersion ? `${infoName}/${infoVersion}` : infoName) : '';
  const combined = `${infoLabel} ${userAgent || ''}`.trim();

  for (const [family, pattern] of CLIENT_PATTERNS) {
    if (pattern.test(infoLabel) || pattern.test(combined)) {
      return { family, raw: truncateBlob(infoLabel || userAgent) };
    }
  }
  if (infoName) {
    return { family: truncateBlob(infoName.toLowerCase(), 64), raw: truncateBlob(infoLabel) };
  }
  return { family: combined ? 'other' : 'unknown', raw: truncateBlob(userAgent) };
}

const OPT_OUT_VALUES = new Set(['0', 'false', 'off', 'no', 'disable', 'disabled']);
const ENV_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

/**
 * Check whether MCP telemetry is disabled globally (`MCP_TELEMETRY_DISABLED=true`)
 * or per-request (`?telemetry=0|off|false`, `X-MCP-Telemetry: off|0`, or `DNT: 1`).
 * @param {Request | null} [request]
 * @returns {boolean}
 */
export function isMcpTelemetryDisabled(request = null) {
  const envFlag =
    typeof process !== 'undefined' ? String(process.env?.MCP_TELEMETRY_DISABLED || '').trim().toLowerCase() : '';
  if (ENV_TRUE_VALUES.has(envFlag)) return true;
  if (!request) return false;

  const headerVal = String(request.headers?.get?.('x-mcp-telemetry') || '').trim().toLowerCase();
  if (OPT_OUT_VALUES.has(headerVal)) return true;

  const dnt = String(request.headers?.get?.('dnt') || '').trim();
  if (dnt === '1') return true;

  try {
    const url = new URL(request.url);
    const paramVal = String(url.searchParams.get('telemetry') || '').trim().toLowerCase();
    if (OPT_OUT_VALUES.has(paramVal)) return true;
  } catch {
    /* ignore invalid URL */
  }
  return false;
}

/**
 * Extract coarse geo/colo, User-Agent, and opt-out flag from a Cloudflare Request.
 * Never extracts IP addresses.
 * @param {Request} request
 */
export function extractRequestMeta(request) {
  const cf = /** @type {{ country?: string, colo?: string } | undefined} */ (
    /** @type {any} */ (request)?.cf
  );
  const userAgent = request?.headers?.get?.('user-agent') || '';
  const country = cf?.country || request?.headers?.get?.('cf-ipcountry') || 'XX';
  const colo = cf?.colo || 'UNKNOWN';
  return {
    userAgent: truncateBlob(userAgent),
    country: truncateBlob(country, 16),
    colo: truncateBlob(colo, 16),
    telemetryDisabled: isMcpTelemetryDisabled(request),
  };
}

/**
 * Scrub and truncate query arguments for search/lookup tools.
 * Code, spec, and batch tools NEVER return their raw input here.
 * @param {string} toolName
 * @param {Record<string, any> | null | undefined} args
 * @returns {string}
 */
export function sanitizeTelemetryQuery(toolName, args) {
  if (!QUERY_SAFE_TOOLS.has(toolName) || !args || typeof args !== 'object') {
    return '';
  }
  const raw =
    args.query ??
    args.url ??
    args.name ??
    (toolName === 'get_jsr223_recipe' ? '*' : '');
  if (typeof raw !== 'string' || !raw.trim()) return '';
  return truncateBlob(redactSecrets(raw), MAX_BLOB_CHARS);
}

/**
 * Measure input size in characters without persisting raw code/spec payloads.
 * @param {string} _toolName
 * @param {Record<string, any> | null | undefined} args
 * @returns {number}
 */
export function measureInputSize(_toolName, args) {
  if (!args || typeof args !== 'object') return 0;
  for (const key of ['jmxContent', 'code', 'input', 'query', 'url', 'name', 'workerIps']) {
    if (typeof args[key] === 'string') return args[key].length;
  }
  if (Array.isArray(args.signatures)) {
    return args.signatures.reduce((sum, s) => sum + String(s ?? '').length, 0);
  }
  return 0;
}

function parseJsonCount(text) {
  try {
    const clean = String(text || '').replace(/\n\n\(Showing top \d+ of \d+[\s\S]*$/, '');
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    return 1;
  }
}

/**
 * Classify a tool call's execution result into outcome, counts, and safe sub-details.
 * @param {string} toolName
 * @param {Record<string, any> | null | undefined} args
 * @param {any} result
 */
export function classifyToolOutcome(toolName, args, result) {
  const text = String(result?.content?.[0]?.text || '');
  const isErr = Boolean(result?.isError);

  if (toolName === 'search_jmeter_docs') {
    if (text.startsWith('No documentation pages on docs.jmeter.ai matched ')) {
      return { outcome: MCP_OUTCOMES.ZERO_RESULT, resultCount: 0, isError: 0, isZeroResult: 1, subDetail: 'none' };
    }
    const m = text.match(/^Found (\d+) relevant page/);
    const count = m ? Number(m[1]) : 1;
    return { outcome: MCP_OUTCOMES.OK, resultCount: count, isError: 0, isZeroResult: 0, subDetail: 'bm25' };
  }

  if (toolName === 'get_jmeter_page' || toolName === 'lookup_component' || toolName === 'lookup_function') {
    if (isErr && /^No (documentation page|component|function) /.test(text)) {
      return { outcome: MCP_OUTCOMES.ZERO_RESULT, resultCount: 0, isError: 1, isZeroResult: 1, subDetail: 'not_found' };
    }
    return { outcome: isErr ? MCP_OUTCOMES.TOOL_ERROR : MCP_OUTCOMES.OK, resultCount: isErr ? 0 : 1, isError: isErr ? 1 : 0, isZeroResult: 0, subDetail: '' };
  }

  if (toolName === 'lookup_jmeter_property') {
    if (text.startsWith('No curated JMeter properties matched ')) {
      return { outcome: MCP_OUTCOMES.ZERO_RESULT, resultCount: 0, isError: 0, isZeroResult: 1, subDetail: 'none' };
    }
    return { outcome: MCP_OUTCOMES.OK, resultCount: parseJsonCount(text), isError: 0, isZeroResult: 0, subDetail: 'matched' };
  }

  if (toolName === 'lookup_error_playbook') {
    if (text.startsWith('No specific playbook matched ')) {
      const uncertain = text.includes('Possible playbooks:');
      return {
        outcome: uncertain ? MCP_OUTCOMES.UNCERTAIN : MCP_OUTCOMES.ZERO_RESULT,
        resultCount: 0,
        isError: 0,
        isZeroResult: 1,
        subDetail: uncertain ? 'uncertain' : 'none',
      };
    }
    return { outcome: MCP_OUTCOMES.OK, resultCount: parseJsonCount(text), isError: 0, isZeroResult: 0, subDetail: 'matched' };
  }

  if (toolName === 'get_jsr223_recipe') {
    const count = parseJsonCount(text);
    const zero = count === 0;
    return {
      outcome: zero ? MCP_OUTCOMES.ZERO_RESULT : MCP_OUTCOMES.OK,
      resultCount: count,
      isError: 0,
      isZeroResult: zero ? 1 : 0,
      subDetail: zero ? 'none' : 'matched',
    };
  }

  const subDetail =
    (toolName === 'lint_groovy_script' && args?.elementType) ||
    (toolName === 'plan_distributed_testing' && args?.environment) ||
    (toolName === 'tune_linux_os' && args?.targetDistro) ||
    '';

  if (isErr) {
    return { outcome: MCP_OUTCOMES.TOOL_ERROR, resultCount: 0, isError: 1, isZeroResult: 0, subDetail: truncateBlob(subDetail, 64) };
  }

  const resultCount =
    toolName === 'triage_errors' && Array.isArray(result?.structuredContent?.groups)
      ? result.structuredContent.groups.length
      : 1;

  return { outcome: MCP_OUTCOMES.OK, resultCount, isError: 0, isZeroResult: 0, subDetail: truncateBlob(subDetail, 64) };
}

/**
 * Fire-and-forget write to Cloudflare Workers Analytics Engine.
 * Never awaits and never throws.
 *
 * @param {{
 *   eventType: string,
 *   rpcMethod: string,
 *   toolName?: string,
 *   outcome: string,
 *   query?: string,
 *   clientFamily?: string,
 *   clientRaw?: string,
 *   country?: string,
 *   colo?: string,
 *   subDetail?: string,
 *   latencyMs?: number,
 *   resultCount?: number,
 *   isError?: number,
 *   isZeroResult?: number,
 *   inputChars?: number,
 * }} event
 * @param {{ writeDataPoint?: (dp: { indexes?: string[], blobs?: string[], doubles?: number[] }) => void }} [dataset]
 */
export function writeMcpEvent(event, dataset = env?.MCP_ANALYTICS) {
  if (event?.telemetryDisabled || isMcpTelemetryDisabled()) return false;
  if (!dataset || typeof dataset.writeDataPoint !== 'function') return false;
  try {
    const indexKey = truncateBlob(event.toolName || event.rpcMethod || event.eventType, 96);
    dataset.writeDataPoint({
      indexes: [indexKey],
      blobs: [
        truncateBlob(event.eventType, 32),
        truncateBlob(event.rpcMethod, 64),
        truncateBlob(event.toolName || '', 64),
        truncateBlob(event.outcome, 32),
        truncateBlob(event.query || '', MAX_BLOB_CHARS),
        truncateBlob(event.clientFamily || 'unknown', 64),
        truncateBlob(event.clientRaw || '', MAX_BLOB_CHARS),
        truncateBlob(event.country || 'XX', 16),
        truncateBlob(event.colo || 'UNKNOWN', 16),
        truncateBlob(event.subDetail || '', 64),
        truncateBlob(SERVER_VERSION, 32),
      ],
      doubles: [
        Math.max(0, Number(event.latencyMs) || 0),
        1,
        Math.max(0, Number(event.resultCount) || 0),
        event.isError ? 1 : 0,
        event.isZeroResult ? 1 : 0,
        Math.max(0, Number(event.inputChars) || 0),
      ],
    });
    return true;
  } catch {
    return false;
  }
}
