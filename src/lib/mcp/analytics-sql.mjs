/**
 * Cloudflare Workers Analytics Engine SQL queries and stats reader for `mcp_events`.
 *
 * Uses `_sample_interval` in all aggregations per Cloudflare Analytics Engine
 * best practices so metrics remain accurate even if automatic sampling kicks in.
 */

import { MCP_DATASET_NAME } from './telemetry.mjs';

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 90;
const DEFAULT_TIMEOUT_MS = 4000;

function sanitizeIdentifier(name, fallback = MCP_DATASET_NAME) {
  const clean = String(name || fallback).replace(/[^a-zA-Z0-9_]/g, '');
  return clean || fallback;
}

function clampDays(days, fallback = DEFAULT_WINDOW_DAYS) {
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, MAX_WINDOW_DAYS);
}

/**
 * Per-tool usage, weighted average latency, error count, and zero-result count.
 * @param {{ dataset?: string, days?: number }} [opts]
 */
export function buildToolBreakdownSql(opts = {}) {
  const table = sanitizeIdentifier(opts.dataset);
  const days = clampDays(opts.days);
  return [
    'SELECT',
    '  blob3 AS tool,',
    '  SUM(_sample_interval) AS calls,',
    '  SUM(_sample_interval * double1) / SUM(_sample_interval) AS avg_latency_ms,',
    '  SUM(_sample_interval * double4) AS errors,',
    '  SUM(_sample_interval * double5) AS zero_results',
    `FROM ${table}`,
    `WHERE blob1 = 'tool_call' AND blob3 != '' AND timestamp >= NOW() - INTERVAL '${days}' DAY`,
    'GROUP BY tool',
    'ORDER BY calls DESC',
  ].join('\n');
}

/**
 * Top zero-result search/lookup queries to surface documentation gaps.
 * @param {{ dataset?: string, days?: number, limit?: number }} [opts]
 */
export function buildZeroResultQueriesSql(opts = {}) {
  const table = sanitizeIdentifier(opts.dataset);
  const days = clampDays(opts.days);
  const limit = Math.min(Math.max(Math.floor(Number(opts.limit) || 25), 1), 100);
  return [
    'SELECT',
    '  blob3 AS tool,',
    '  blob5 AS query,',
    '  SUM(_sample_interval) AS misses',
    `FROM ${table}`,
    `WHERE blob1 = 'tool_call' AND double5 = 1 AND blob5 != '' AND timestamp >= NOW() - INTERVAL '${days}' DAY`,
    'GROUP BY tool, query',
    'ORDER BY misses DESC',
    `LIMIT ${limit}`,
  ].join('\n');
}

/**
 * MCP client agent breakdown (Claude Code, Cursor, VS Code, Windsurf, etc.).
 * @param {{ dataset?: string, days?: number }} [opts]
 */
export function buildClientBreakdownSql(opts = {}) {
  const table = sanitizeIdentifier(opts.dataset);
  const days = clampDays(opts.days);
  return [
    'SELECT',
    '  blob6 AS client_family,',
    '  blob2 AS rpc_method,',
    '  SUM(_sample_interval) AS requests',
    `FROM ${table}`,
    `WHERE timestamp >= NOW() - INTERVAL '${days}' DAY`,
    'GROUP BY client_family, rpc_method',
    'ORDER BY requests DESC',
  ].join('\n');
}

/**
 * Rate-limit (429) hits by country and client family.
 * @param {{ dataset?: string, days?: number }} [opts]
 */
export function buildRateLimitSql(opts = {}) {
  const table = sanitizeIdentifier(opts.dataset);
  const days = clampDays(opts.days, 7);
  return [
    'SELECT',
    '  blob8 AS country,',
    '  blob6 AS client_family,',
    '  SUM(_sample_interval) AS rate_limited_requests',
    `FROM ${table}`,
    `WHERE blob1 = 'rate_limit' AND timestamp >= NOW() - INTERVAL '${days}' DAY`,
    'GROUP BY country, client_family',
    'ORDER BY rate_limited_requests DESC',
  ].join('\n');
}

function resolveCredentials(opts = {}) {
  const envObj = typeof process !== 'undefined' ? process.env || {} : {};
  const accountId = opts.accountId || envObj.CLOUDFLARE_ACCOUNT_ID || envObj.CF_ACCOUNT_ID || '';
  const apiToken = opts.apiToken || envObj.CLOUDFLARE_API_TOKEN || envObj.CF_API_TOKEN || '';
  return { accountId: accountId.trim(), apiToken: apiToken.trim() };
}

/**
 * Query aggregated MCP tool usage stats from the Cloudflare Analytics Engine SQL API.
 * Never throws; returns `{ configured: false, ... }` when credentials are absent.
 *
 * @param {{
 *   accountId?: string,
 *   apiToken?: string,
 *   dataset?: string,
 *   days?: number,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 * }} [opts]
 */
export async function queryMcpStats(opts = {}) {
  const windowDays = clampDays(opts.days);
  const empty = {
    configured: false,
    windowDays,
    totalCalls: 0,
    zeroResultCalls: 0,
    errorCalls: 0,
    tools: [],
  };

  const { accountId, apiToken } = resolveCredentials(opts);
  if (!accountId || !apiToken) return empty;

  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const sql = buildToolBreakdownSql({ dataset: opts.dataset, days: windowDays });
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/analytics_engine/sql`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: sql,
      signal: controller.signal,
    });
    if (!res.ok) return { ...empty, configured: true };

    const body = await res.json();
    const rows = Array.isArray(body?.data) ? body.data : [];
    const tools = rows.map((row) => ({
      tool: String(row.tool || ''),
      calls: Math.round(Number(row.calls) || 0),
      avgLatencyMs: Math.round((Number(row.avg_latency_ms) || 0) * 10) / 10,
      errors: Math.round(Number(row.errors) || 0),
      zeroResults: Math.round(Number(row.zero_results) || 0),
    }));

    const totalCalls = tools.reduce((sum, t) => sum + t.calls, 0);
    const zeroResultCalls = tools.reduce((sum, t) => sum + t.zeroResults, 0);
    const errorCalls = tools.reduce((sum, t) => sum + t.errors, 0);

    return {
      configured: true,
      windowDays,
      totalCalls,
      zeroResultCalls,
      errorCalls,
      tools,
    };
  } catch {
    return { ...empty, configured: true };
  } finally {
    clearTimeout(timer);
  }
}
