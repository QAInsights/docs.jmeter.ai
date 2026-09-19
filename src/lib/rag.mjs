/**
 * BM25 retrieval over the build-time chunk index. Used by
 * search_jmeter_docs (MCP + Ask AI) and unit tests.
 *
 * Kept separate from the /api/chat server handler so tokenization and
 * BM25 scoring can be unit-tested without the AI SDK or an API key.
 *
 * The chunk index is generated at build time by
 * scripts/generate-llms-chunks.mjs from public/llms-full.txt.
 */

import chunkIndex from './llms-chunks.json' with { type: 'json' };
import { tokenize } from './tokenizer.mjs';

// Re-export so existing imports from rag.mjs still work.
export { tokenize };

/** @typedef {{ title: string, url: string, body: string, terms: Record<string, number>, length: number }} Chunk */

export const INDEX = /** @type {Chunk[]} */ (chunkIndex.chunks);
export const AVG_DOC_LENGTH =
  chunkIndex.avgDocLength ||
  Math.max(
    1,
    Math.round(INDEX.reduce((s, c) => s + c.length, 0) / Math.max(INDEX.length, 1)),
  );

export const TOP_K = 8;

// BM25 parameters: standard values from the information retrieval literature.
const BM25_K1 = 1.5;  // term frequency saturation
const BM25_B = 0.75;   // length normalization
const TITLE_TERM_BONUS = 1.5; // boost for query terms appearing in page title

/**
 * Normalize a page reference to a docs path. Accepts full URLs, absolute
 * paths, or bare paths, with or without trailing slash and .mdx/.html.
 * @param {string} input
 * @returns {string}
 */
export function normalizeDocPath(input) {
  let pathText = String(input || '').trim();
  try {
    if (/^https?:\/\//i.test(pathText)) {
      pathText = new URL(pathText).pathname;
    }
  } catch {
    // Not a URL; treat as a path below.
  }
  return pathText
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.(mdx|html?)$/i, '');
}

/**
 * Find an index chunk whose URL pathname matches the normalized path.
 * @param {string} pathname
 * @returns {Chunk | undefined}
 */
export function findChunkByPath(pathname) {
  const clean = normalizeDocPath(pathname);
  if (!clean) return undefined;
  return INDEX.find((chunk) => {
    try {
      return normalizeDocPath(new URL(chunk.url).pathname) === clean;
    } catch {
      return false;
    }
  });
}

/**
 * BM25 retrieval over the chunk index. Returns the top-K chunks ranked by
 * relevance to the query, with a small bonus on title-term overlap so pages
 * whose name matches the user's intent surface first.
 *
 * When `pagePath` is set (Ask AI "this page"), that chunk is pinned first
 * so answers stay grounded in the page the user is reading.
 *
 * @param {string} query
 * @param {{ topK?: number, pagePath?: string }} [opts]
 * @returns {Chunk[]}
 */
export function retrieve(query, opts = {}) {
  const topK = opts.topK ?? TOP_K;
  const pageChunk = opts.pagePath ? findChunkByPath(opts.pagePath) : undefined;
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return pageChunk ? [pageChunk] : [];
  const queryFreq = /** @type {Record<string, number>} */ ({});
  for (const t of queryTerms) queryFreq[t] = (queryFreq[t] || 0) + 1;

  const N = INDEX.length;

  // Precompute document frequency per query term.
  const df = {};
  for (const term of Object.keys(queryFreq)) {
    df[term] = INDEX.filter((c) => (c.terms[term] || 0) > 0).length;
  }

  const scored = INDEX.map((chunk) => {
    let score = 0;
    for (const [term, qf] of Object.entries(queryFreq)) {
      const tf = chunk.terms[term] || 0;
      if (tf === 0) continue;
      const idf = Math.log(1 + (N - df[term] + 0.5) / (df[term] + 0.5));
      const denom = tf + BM25_K1 * (1 - BM25_B + (BM25_B * chunk.length) / AVG_DOC_LENGTH);
      score += idf * ((tf * (BM25_K1 + 1)) / denom) * qf;
    }
    if (score > 0) {
      const titleTerms = new Set(tokenize(chunk.title));
      for (const t of queryTerms) if (titleTerms.has(t)) score += TITLE_TERM_BONUS;
    }
    return { chunk, score };
  });

  const ranked = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.chunk);

  if (!pageChunk) return ranked;
  return [pageChunk, ...ranked.filter((c) => c.url !== pageChunk.url)].slice(0, topK);
}
