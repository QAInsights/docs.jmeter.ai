/**
 * Shared tokenizer for BM25 retrieval.
 *
 * Used by both:
 *   - scripts/generate-llms-chunks.mjs (build-time index creation)
 *   - src/lib/rag.mjs (query-time retrieval)
 *
 * Keeping a single tokenizer ensures the vocabulary stays consistent
 * between index and query.
 */

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for',
  'is', 'are', 'be', 'with', 'as', 'by', 'at', 'it', 'this', 'that',
  'you', 'your', 'can', 'will', 'if', 'then', 'from', 'use', 'using',
  'http', 'https', 'jmeter', 'doc', 'docs', 'how', 'do', 'i', 'what',
  'when', 'why', 'which', 'my',
]);

/**
 * Tokenize a string into normalized lowercase terms, dropping stop words
 * and very short tokens.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  const out = [];
  const matches = String(text).toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g);
  if (!matches) return out;
  for (const m of matches) {
    if (m.length < 2 || STOP.has(m)) continue;
    out.push(m);
  }
  return out;
}
