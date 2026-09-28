/**
 * Generate src/lib/mcp/error-labels.json: the classifier.dev label set for
 * zero-shot error triage, built from the topics/errors/*.mdx playbooks.
 *
 * Each playbook contributes { id, title, label, url, rootCause, firstFix }.
 * `label` comes from the page's `classifierLabel` frontmatter (falling back
 * to `title`); `rootCause` is the first entry under "## Common causes"
 * (or the "## Quick diagnosis (TL;DR)" paragraph for the few playbooks
 * without that heading) and `firstFix` is the first item under
 * "## Fix (ordered)". A sha1 over the sorted "id\tlabel" lines becomes
 * `labelSetVersion`, which the classifier cache folds into its keys so a
 * changed label set invalidates old entries.
 *
 * Workers has no fs at runtime, so the JSON is committed to the repo and
 * imported by src/lib/mcp/error-playbooks.mjs via `with { type: 'json' }`,
 * the same pattern as src/lib/reference-index.json.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ERRORS_DIR = path.join(ROOT, 'src/content/docs/topics/errors');
const OUT = path.join(ROOT, 'src/lib/mcp/error-labels.json');

const MAX_SNIPPET_CHARS = 300;

/** Strip markdown links to their text, bold markers, and inline code ticks. */
export function stripMarkdown(text) {
  return String(text || '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split an mdx file into { frontmatter, body }. */
export function splitFrontmatter(raw) {
  const m = String(raw).match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { frontmatter: {}, body: String(raw) };
  return { frontmatter: parseYaml(m[1]) || {}, body: String(raw).slice(m[0].length) };
}

/** Return the raw body text between `## heading` and the next `##` heading. */
export function sectionBody(body, heading) {
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'mi');
  const m = body.match(re);
  if (!m) return '';
  const rest = body.slice(m.index + m[0].length);
  const next = rest.search(/^##\s+/m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

/**
 * First meaningful content inside a section body. If the first content line
 * is a markdown table, returns the first data row rendered as
 * "<Cause>: <Detail>"; otherwise the first bullet or paragraph.
 */
export function firstContentItem(section) {
  const lines = String(section || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith(':::') && !l.startsWith('{') && !l.startsWith('<'));
  if (lines.length === 0) return '';
  const first = lines[0];
  if (first.startsWith('|')) {
    // Table: skip header row and the |---| separator; take first data row.
    const dataRow = lines.find(
      (l, i) => i > 0 && l.startsWith('|') && !/^\|[\s\-|:]+\|$/.test(l),
    );
    if (dataRow) {
      const cells = dataRow
        .split('|')
        .slice(1, -1)
        .map((c) => stripMarkdown(c))
        .filter(Boolean);
      return truncate(cells.join(': '));
    }
    return '';
  }
  return truncate(stripMarkdown(first.replace(/^[-*]\s+/, '')));
}

/**
 * First fix step under "## Fix (ordered)": the first numbered list item,
 * or the first "### N. Title" subsection heading for playbooks that group
 * fixes under headings.
 */
export function firstFixStep(section) {
  const lines = String(section || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const numbered = line.match(/^(?:###\s*)?\d+\.\s+(.+)$/);
    if (numbered) return truncate(stripMarkdown(numbered[1]));
  }
  return '';
}

function truncate(text) {
  const t = String(text || '').trim();
  return t.length > MAX_SNIPPET_CHARS ? t.slice(0, MAX_SNIPPET_CHARS).trimEnd() : t;
}

/** Pick the root-cause snippet for a playbook body. */
export function extractRootCause(body) {
  const causes = firstContentItem(sectionBody(body, 'Common causes'));
  if (causes) return causes;
  // A few playbooks substitute a bespoke heading; fall back to the TL;DR.
  const tldr = firstContentItem(sectionBody(body, 'Quick diagnosis (TL;DR)'));
  if (tldr) return tldr;
  return firstContentItem(sectionBody(body, 'Symptom'));
}

/**
 * Build the error-label index from the topics/errors directory.
 * @param {string} [dir]
 * @returns {{ generatedAt: string, labelSetVersion: string, playbooks: Array }}
 */
export function generateErrorLabels(dir = ERRORS_DIR) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') && f !== 'index.mdx')
    .sort();

  const playbooks = files.map((file) => {
    const slug = file.replace(/\.mdx$/, '');
    const { frontmatter, body } = splitFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
    return {
      id: slug,
      title: frontmatter.title || slug,
      label: frontmatter.classifierLabel || frontmatter.title || slug,
      url: `https://docs.jmeter.ai/topics/errors/${slug}/`,
      rootCause: extractRootCause(body),
      firstFix: firstFixStep(sectionBody(body, 'Fix (ordered)')),
    };
  });

  const labelSetVersion = crypto
    .createHash('sha1')
    .update(playbooks.map((p) => `${p.id}\t${p.label}`).sort().join('\n'))
    .digest('hex')
    .slice(0, 12);

  return {
    generatedAt: new Date().toISOString(),
    labelSetVersion,
    playbooks,
  };
}

function main() {
  const index = generateErrorLabels();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n');
  console.log(
    `[error-labels] wrote ${index.playbooks.length} playbooks to ${path.relative(ROOT, OUT)} (labelSetVersion ${index.labelSetVersion})`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
