/**
 * Generate a Markdown twin (`index.md`) for every prerendered docs page.
 *
 * Runs after `astro build`: walks the static client output for every
 * `index.html`, converts each page's Starlight article body
 * (`.sl-markdown-content`) with the same htmlToMarkdown used by the
 * on-page "Copy MD" button, and writes `index.md` beside `index.html`.
 * A Cloudflare URL Rewrite Rule (scripts/setup-markdown-rule.mjs)
 * serves these files for `Accept: text/markdown` requests.
 *
 * Wired into `pnpm run build` so it stays in sync automatically.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { htmlToMarkdown } from '../src/lib/page-export.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const SITE = 'https://docs.jmeter.ai';

/**
 * Resolve the static assets directory from the adapter's generated
 * wrangler config (dist/server/wrangler.json → assets.directory,
 * relative to dist/server).
 */
export function resolveAssetsDir(distDir) {
  const configPath = path.join(distDir, 'server', 'wrangler.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return path.resolve(path.dirname(configPath), config.assets.directory);
}

/**
 * Collect every `index.html` under dir, recursively.
 */
export function collectIndexHtml(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectIndexHtml(full));
    } else if (entry.name === 'index.html') {
      results.push(full);
    }
  }
  return results;
}

/**
 * Pull title, description, canonical URL, and last-updated date out of a
 * built page. Title is the first <h1> inside <main> (fallback: <title>
 * with the trailing " | docs.jmeter.ai" stripped). lastUpdated is the
 * first `time[datetime]` inside <main>, truncated to YYYY-MM-DD; null
 * when absent.
 */
export function extractPageMetadata(document, pagePath) {
  const docTitle = (document.title || '')
    .replace(/\s*\|\s*docs\.jmeter\.ai\s*$/, '')
    .trim();
  const title =
    document.querySelector('main h1')?.textContent?.trim() || docTitle;
  const description =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute('content') || '';
  const lastUpdated =
    document
      .querySelector('main time[datetime]')
      ?.getAttribute('datetime')
      ?.slice(0, 10) || null;
  return { title, description, url: `${SITE}${pagePath}`, lastUpdated };
}

/**
 * Assemble the index.md file: quoted-YAML frontmatter, the page title as
 * an H1, then the converted body. Ends with a single trailing newline.
 */
export function buildPageMarkdown({ title, description, url, lastUpdated, body }) {
  const lines = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `url: ${url}`,
  ];
  if (lastUpdated) lines.push(`lastUpdated: ${lastUpdated}`);
  lines.push('source: docs.jmeter.ai', '---', '', `# ${title}`, '', body);
  return `${lines.join('\n')}\n`;
}

/**
 * Map an index.html path relative to the assets dir onto the page's URL
 * path: 'index.html' → '/', 'a/b/index.html' → '/a/b/'.
 */
export function pagePathFor(relHtmlPath) {
  const dir = path.dirname(relHtmlPath).split(path.sep).join('/');
  return dir === '.' ? '/' : `/${dir}/`;
}

/**
 * Convert one built HTML page to its Markdown export. Returns null when
 * the page has no `.sl-markdown-content` article body (or the body
 * converts to nothing) — those pages get no index.md.
 */
export function convertPageHtml(html, pagePath) {
  const document = new JSDOM(html).window.document;
  const root = document.querySelector('.sl-markdown-content');
  if (!root) return null;
  // Starlight renders the page title h1 outside .sl-markdown-content;
  // MDX bodies often repeat it — drop a leading H1 so the twin doesn't
  // have two (the frontmatter title is emitted as the single H1).
  const body = htmlToMarkdown(root).replace(/^\s*#\s+[^\n]*\n+/, '');
  if (!body) return null;
  return buildPageMarkdown({ ...extractPageMetadata(document, pagePath), body });
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('[page-markdown] dist/ not found — run `astro build` first.');
    process.exit(1);
  }
  const assetsDir = resolveAssetsDir(DIST_DIR);
  let written = 0;
  let skipped = 0;
  for (const file of collectIndexHtml(assetsDir)) {
    const pagePath = pagePathFor(path.relative(assetsDir, file));
    if (pagePath === '/') {
      skipped++;
      continue;
    }
    const markdown = convertPageHtml(fs.readFileSync(file, 'utf8'), pagePath);
    if (!markdown) {
      skipped++;
      continue;
    }
    fs.writeFileSync(path.join(path.dirname(file), 'index.md'), markdown, 'utf8');
    written++;
  }
  if (written === 0) {
    console.error(
      '[page-markdown] wrote 0 files — no page had a .sl-markdown-content body',
    );
    process.exit(1);
  }
  console.log(`[page-markdown] wrote ${written} files, skipped ${skipped}`);
}

// Run only when invoked directly, not when imported by tests.
const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
