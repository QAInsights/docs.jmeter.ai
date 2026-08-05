/**
 * Generate per-version release notes pages under src/content/docs/releases/.
 *
 * Parses `## Version X.Y.Z` blocks out of the synced changelog pages
 * (user-manual/changes.mdx for the current version, changes-history.mdx for
 * everything before it) and emits:
 *   - releases/index.mdx          hub listing every version (newest first)
 *   - releases/<version>.mdx      one SEO page per version
 *
 * Each version page gets an auto-computed summary (change counts per
 * section), an optional hand/AI-written highlights block read from
 * scripts/release-highlights/<version>.md when present, and the full
 * changelog sections (minus the boilerplate "Known problems" appendix).
 *
 * Output is deterministic (no timestamps) so nightly sync runs produce
 * clean diffs. Like all generated MDX, the output is committed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stripFrontmatter } from './generate-llms-full.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'src/content/docs');
const OUT_DIR = path.join(DOCS_DIR, 'releases');
const HIGHLIGHTS_DIR = path.join(__dirname, 'release-highlights');

const CHANGE_SOURCES = [
  path.join(DOCS_DIR, 'user-manual/changes.mdx'),
  path.join(DOCS_DIR, 'user-manual/changes-history.mdx'),
];

/** Sections rendered on version pages, in display order. */
const SECTION_ORDER = [
  'New and Noteworthy',
  'Incompatible changes',
  'Changes',
  'Improvements',
  'Bug fixes',
  'Non-functional changes',
  'Thanks',
];

/** Sections excluded from version pages (repetitive boilerplate). */
const SKIPPED_SECTIONS = new Set(['Known problems and workarounds']);

/** Sections that count toward the "what changed" summary stats. */
const STAT_SECTIONS = new Set([
  'New and Noteworthy',
  'Incompatible changes',
  'Changes',
  'Improvements',
  'Bug fixes',
  'Non-functional changes',
]);

/**
 * Split a changelog body into version blocks on `## Version X.Y.Z`
 * headings. Text before the first version heading (page intro) is dropped.
 *
 * @param {string} body
 * @returns {Array<{ version: string, bodyText: string }>}
 */
export function parseVersions(body) {
  const lines = body.split('\n');
  const versions = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^## Version (\d+\.\d+(?:\.\d+)?)\s*$/);
    if (m) {
      if (current) versions.push(current);
      current = { version: m[1], lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) versions.push(current);
  return versions.map(({ version, lines }) => ({
    version,
    bodyText: lines.join('\n'),
  }));
}

/**
 * Split a version block body into `## <section>` chunks. The leading
 * segment (the "Summary" table of contents) comes before the first h2 and
 * is dropped.
 *
 * @param {string} blockText
 * @returns {Array<{ title: string, content: string, itemCount: number }>}
 */
export function splitSections(blockText) {
  const sections = [];
  let current = null;
  for (const line of blockText.split('\n')) {
    const m = line.match(/^## (.+?)\s*$/);
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1].trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections.map(({ title, lines }) => {
    const content = lines.join('\n').trim();
    return { title, content, itemCount: countItems(content) };
  });
}

/** Count markdown bullet items in a chunk of markdown. */
export function countItems(text) {
  return text.split('\n').filter((l) => /^\s*- /.test(l)).length;
}

/**
 * Semver-ish comparator (numeric per segment, missing segments = 0).
 * Sorts ascending; reverse for newest-first.
 */
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Collect per-section change counts for the summary stats. */
export function collectStats(sections) {
  const stats = { total: 0, improvements: 0, bugFixes: 0, incompatible: 0 };
  for (const s of sections) {
    if (!STAT_SECTIONS.has(s.title)) continue;
    stats.total += s.itemCount;
    if (s.title === 'Improvements' || s.title === 'Changes' || s.title === 'New and Noteworthy') {
      stats.improvements += s.itemCount;
    } else if (s.title === 'Bug fixes') {
      stats.bugFixes += s.itemCount;
    } else if (s.title === 'Incompatible changes') {
      stats.incompatible += s.itemCount;
    }
  }
  return stats;
}

/**
 * Build the meta description for a version page. Always 80-160 chars so it
 * passes seo-validation and renders fully in search results.
 */
export function buildReleaseDescription(version, stats) {
  const parts = [];
  if (stats.improvements > 0) parts.push(`${stats.improvements} improvements`);
  if (stats.bugFixes > 0) parts.push(`${stats.bugFixes} bug fixes`);
  const joined = parts.join(' and ');
  let desc = joined
    ? `Apache JMeter ${version} release notes with ${joined}, plus upgrade notes from the official changelog.`
    : `Apache JMeter ${version} release notes with the full list of changes from the official changelog.`;
  if (desc.length > 160) {
    desc = `Apache JMeter ${version} release notes: changes, bug fixes, and upgrade notes from the official changelog.`;
  }
  if (desc.length < 80) {
    desc += ' Covers every documented change for this version.';
  }
  return desc;
}

/** Rough reading-time estimate matching the existing frontmatter style. */
export function estimateReadTime(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 225))} min read`;
}

/** Order sections for display; unknown sections keep relative order last. */
export function orderSections(sections) {
  const kept = sections.filter((s) => !SKIPPED_SECTIONS.has(s.title));
  const ranked = kept
    .map((s) => ({ s, rank: SECTION_ORDER.indexOf(s.title) }))
    .sort((a, b) => {
      const ra = a.rank === -1 ? SECTION_ORDER.length : a.rank;
      const rb = b.rank === -1 ? SECTION_ORDER.length : b.rank;
      return ra - rb;
    });
  return ranked.map((r) => r.s);
}

/** Build the YAML frontmatter block for a version page. */
export function buildVersionFrontmatter(version, stats, bodyText) {
  const description = buildReleaseDescription(version, stats);
  return `---
title: "JMeter ${version} Release Notes"
seoTitle: "JMeter ${version} Release Notes - What's New and Changed"
description: "${description}"
keywords:
  - JMeter ${version} release notes
  - JMeter ${version} changelog
  - Apache JMeter documentation
difficulty: intermediate
guideType: reference
estimatedReadTime: "${estimateReadTime(bodyText)}"
lastVerified: "JMeter ${version}"
---`;
}

/** Build the full MDX document for one version. */
export function buildVersionPage(version, sections, highlights) {
  const ordered = orderSections(sections);
  const stats = collectStats(sections);

  const statRows = ordered
    .filter((s) => STAT_SECTIONS.has(s.title) && s.itemCount > 0)
    .map((s) => `| ${s.title} | ${s.itemCount} |`)
    .join('\n');

  const parts = [];
  parts.push(buildVersionFrontmatter(version, stats, ordered.map((s) => s.content).join('\n')));
  parts.push('');
  parts.push('{/* GENERATED by scripts/generate-release-pages.mjs from user-manual/changes.mdx and changes-history.mjs - do not edit by hand */}');
  parts.push('');
  parts.push(`:::note[About these release notes]`);
  parts.push(`This page lists every documented change shipped in Apache JMeter ${version}, generated from the official changelog. For download and upgrade guidance, see [Download JMeter](/reference/download-jmeter/).`);
  parts.push(':::');
  parts.push('');

  if (highlights) {
    parts.push(':::tip[Highlights]');
    parts.push(highlights.trim());
    parts.push(':::');
    parts.push('');
  }

  if (statRows) {
    parts.push('## Change summary');
    parts.push('');
    parts.push('| Section | Changes |');
    parts.push('| --- | --- |');
    parts.push(statRows);
    parts.push('');
  }

  for (const section of ordered) {
    parts.push(`## ${section.title}`);
    parts.push('');
    parts.push(section.content);
    parts.push('');
  }

  parts.push('## Useful links');
  parts.push('');
  parts.push('- [Download JMeter](/reference/download-jmeter/)');
  parts.push('- [Getting started guide](/getting-started/get-started/)');
  parts.push('- [All release notes](/releases/)');
  parts.push('- [Current changes page](/user-manual/changes/)');
  parts.push('- [History of previous changes](/user-manual/changes-history/)');
  parts.push('');

  return parts.join('\n');
}

/**
 * URL/file slug for a version. Dots are replaced with hyphens because
 * dotted path segments collide with Astro's static-file routing (they
 * 404 in dev and prerendering). Titles and headings keep the dotted form.
 */
export function versionSlug(version) {
  return version.replaceAll('.', '-');
}

/** Build the hub page listing every version newest-first. */
export function buildHubPage(versionSummaries) {
  const description =
    'Every Apache JMeter release in one place: per-version release notes with change counts, highlights, incompatible changes, and download links.';

  const parts = [];
  parts.push(`---
title: "JMeter Release Notes"
seoTitle: "Apache JMeter Release Notes - What's New in Every Version"
description: "${description}"
keywords:
  - JMeter release notes
  - JMeter changelog
  - Apache JMeter version history
difficulty: intermediate
guideType: reference
estimatedReadTime: "2 min read"
---`);
  parts.push('');
  parts.push('{/* GENERATED by scripts/generate-release-pages.mjs - do not edit by hand */}');
  parts.push('');
  parts.push('Pick a version to see everything it shipped: new features, improvements, bug fixes, and incompatible changes. Release notes are generated from the official Apache JMeter changelog.');
  parts.push('');
  parts.push(`Need the latest bits? Head to [Download JMeter](/reference/download-jmeter/) or the [getting started guide](/getting-started/get-started/).`);
  parts.push('');

  for (const v of versionSummaries) {
    const counts = [];
    if (v.stats.improvements > 0) counts.push(`${v.stats.improvements} improvements`);
    if (v.stats.bugFixes > 0) counts.push(`${v.stats.bugFixes} bug fixes`);
    if (v.stats.incompatible > 0) counts.push(`${v.stats.incompatible} incompatible changes`);
    const detail = counts.length ? counts.join(' · ') : 'documented changes';
    parts.push(`### [JMeter ${v.version}](/releases/${versionSlug(v.version)}/)`);
    parts.push('');
    parts.push(`${detail}${v.hasHighlights ? ' · highlights included' : ''}`);
    parts.push('');
  }

  parts.push('## Related');
  parts.push('');
  parts.push('- [Current changes page](/user-manual/changes/)');
  parts.push('- [History of previous changes](/user-manual/changes-history/)');
  parts.push('- [Download JMeter](/reference/download-jmeter/)');
  parts.push('');

  return parts.join('\n');
}

/** Load optional highlights markdown for a version (may not exist). */
export function loadHighlights(version, dir = HIGHLIGHTS_DIR) {
  const file = path.join(dir, `${version}.md`);
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file, 'utf8').trim();
  return content || null;
}

function main() {
  // Parse every version across both changelog sources; first occurrence wins.
  const seen = new Map();
  for (const source of CHANGE_SOURCES) {
    if (!fs.existsSync(source)) {
      console.warn(`[releases] missing source: ${path.relative(ROOT, source)}`);
      continue;
    }
    const raw = fs.readFileSync(source, 'utf8');
    const { body } = stripFrontmatter(raw);
    for (const { version, bodyText } of parseVersions(body)) {
      if (!seen.has(version)) seen.set(version, bodyText);
    }
  }

  if (seen.size === 0) {
    console.error('[releases] no version blocks found; nothing to generate');
    process.exit(1);
  }

  const versions = [...seen.keys()].sort(compareVersions).reverse();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // The releases directory is fully generator-owned; clear stale output.
  for (const entry of fs.readdirSync(OUT_DIR)) {
    if (entry.endsWith('.mdx')) fs.rmSync(path.join(OUT_DIR, entry));
  }

  const summaries = [];
  for (const version of versions) {
    const sections = splitSections(seen.get(version));
    const stats = collectStats(sections);
    const highlights = loadHighlights(version);
    fs.writeFileSync(path.join(OUT_DIR, `${versionSlug(version)}.mdx`), buildVersionPage(version, sections, highlights), 'utf8');
    summaries.push({ version, stats, hasHighlights: Boolean(highlights) });
  }

  fs.writeFileSync(path.join(OUT_DIR, 'index.mdx'), buildHubPage(summaries), 'utf8');

  console.log(`[releases] generated ${versions.length} version pages + hub in ${path.relative(ROOT, OUT_DIR)}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
