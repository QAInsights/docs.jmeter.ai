/**
 * Generate public/llms-full.txt — a single concatenation of every docs
 * page's markdown body, in sidebar navigation order. AI engines prefer
 * this over llms.txt (which is just a directory of links) because the
 * actual page content is inline.
 *
 * Wired into `npm run build` so it stays in sync automatically.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenSidebar } from '../src/sidebar.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'src/content/docs');
const OUTPUT = path.join(ROOT, 'public/llms-full.txt');
const SITE = 'https://docs.jmeter.ai';

/**
 * Strip a leading YAML frontmatter block (--- ... ---) from a markdown
 * string and return { frontmatter, body }. If no frontmatter is present,
 * frontmatter is null and body is the original text.
 */
export function stripFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: null, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: null, body: text };
  const fmRaw = text.slice(3, end).trim();
  const bodyStart = end + 4; // skip "\n---"
  const body = text.slice(bodyStart).replace(/^[\r\n]+/, '');
  return { frontmatter: fmRaw, body };
}

/**
 * Parse a YAML frontmatter string just enough to pull out the `title`
 * (and optionally `description`). Values may be single- or double-quoted.
 */
export function parseFrontmatter(fmRaw) {
  if (!fmRaw) return {};
  const out = {};
  for (const line of fmRaw.split(/\r?\n/)) {
    const m = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    let val = rawVal.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/**
 * Build a single page block for llms-full.txt.
 * Returns null if the link does not resolve to a docs file (e.g. the
 * landing page at "/").
 */
export function buildPageBlock({ label, link }, docsDir, site) {
  if (!link || link === '/') return null;
  const rel = link.replace(/^\//, '');
  const file = path.join(docsDir, `${rel}.mdx`);
  if (!fs.existsSync(file)) {
    console.warn(`[llms-full] skipping ${link}: no file at ${path.relative(process.cwd(), file)}`);
    return null;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const { frontmatter, body } = stripFrontmatter(raw);
  const fm = parseFrontmatter(frontmatter);
  const title = fm.title || label;
  const url = `${site}${link}${link.endsWith('/') ? '' : '/'}`;
  return `---\nTitle: ${title}\nURL: ${url}\n---\n\n${body.trim()}\n`;
}

/**
 * Assemble the full llms-full.txt document from a flattened sidebar.
 */
export function assembleDocument(entries, docsDir, site, { generatedAt } = {}) {
  const blocks = [];
  let included = 0;
  let skipped = 0;
  for (const entry of entries) {
    const block = buildPageBlock(entry, docsDir, site);
    if (block) {
      blocks.push(block);
      included++;
    } else {
      skipped++;
    }
  }
  const header = [
    '# JMeter Docs — Full Content',
    '',
    `> Community-maintained documentation for Apache JMeter with improved navigation, search, and reading experience. This is an independent community resource and is not affiliated with, endorsed by, or sponsored by the Apache Software Foundation. For official documentation, visit jmeter.apache.org.`,
    '',
    `Site: ${site}`,
    `Pages: ${included}`,
    generatedAt ? `Generated: ${generatedAt}` : null,
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');
  return { content: header + blocks.join('\n\n'), included, skipped };
}

function main() {
  const entries = flattenSidebar();
  const { content, included, skipped } = assembleDocument(entries, DOCS_DIR, SITE, {
    generatedAt: new Date().toISOString(),
  });
  fs.writeFileSync(OUTPUT, content, 'utf8');
  console.log(
    `[llms-full] wrote ${path.relative(ROOT, OUTPUT)} — ${included} pages, ${skipped} skipped`
  );
}

// Run only when invoked directly, not when imported by tests.
const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
