/**
 * Generate src/lib/llms-chunks.json — a structured, per-page breakdown of
 * public/llms-full.txt. Each chunk is one documentation page, kept in
 * sidebar order. The /api/chat serverless route imports this file to do
 * lightweight BM25 retrieval and feed grounded context to Gemini.
 *
 * Wired into `npm run build` (after generate-llms-full) so it stays in sync.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tokenize } from '../src/lib/tokenizer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'public/llms-full.txt');
const OUTPUT = path.join(ROOT, 'src/lib/llms-chunks.json');

/**
 * Split llms-full.txt into page blocks. Each block is delimited by a
 * leading `---\nTitle: …\nURL: …\n---` header (see generate-llms-full.mjs).
 * Returns an array of { title, url, body } in document order.
 */
export function splitIntoBlocks(raw) {
  const chunks = [];
  // Match the header fence and capture title + url, then everything until
  // the next fence (or end of document).
  const headerRe = /^---\s*\nTitle:\s*(.*?)\nURL:\s*(.*?)\n---\s*\n/gm;
  let match;
  const starts = [];
  while ((match = headerRe.exec(raw)) !== null) {
    starts.push({ index: match.index, title: match[1].trim(), url: match[2].trim(), headerEnd: headerRe.lastIndex });
  }
  for (let i = 0; i < starts.length; i++) {
    const bodyEnd = i + 1 < starts.length ? starts[i + 1].index : raw.length;
    const body = raw.slice(starts[i].headerEnd, bodyEnd).trim();
    if (!body) continue;
    chunks.push({ title: starts[i].title, url: starts[i].url, body });
  }
  return chunks;
}

/**
 * Build the chunk index: each entry carries its title, url, body, plus a
 * precomputed term-frequency map and length to speed up BM25 at request
 * time without re-tokenizing on every serverless invocation.
 */
export function buildChunkIndex(chunks) {
  return chunks.map((c) => {
    const tokens = tokenize(`${c.title} ${c.body}`);
    const freq = {};
    for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
    return {
      title: c.title,
      url: c.url,
      body: c.body,
      terms: freq,
      length: tokens.length,
    };
  });
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.warn(`[llms-chunks] ${path.relative(ROOT, INPUT)} not found — run generate-llms-full first.`);
    process.exit(1);
  }
  const raw = fs.readFileSync(INPUT, 'utf8');
  const chunks = splitIntoBlocks(raw);
  const index = buildChunkIndex(chunks);
  const out = {
    generatedAt: new Date().toISOString(),
    count: index.length,
    avgDocLength: Math.round(index.reduce((s, c) => s + c.length, 0) / Math.max(index.length, 1)),
    chunks: index,
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(out), 'utf8');
  console.log(`[llms-chunks] wrote ${path.relative(ROOT, OUTPUT)} — ${index.length} chunks`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
