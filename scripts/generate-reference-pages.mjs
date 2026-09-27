/**
 * Generate long-tail component and function reference pages from the
 * upstream monoliths (Phase 1 of the traffic-growth plan):
 *   - src/content/docs/user-manual/component-reference.mdx (~129 components)
 *   - src/content/docs/user-manual/functions.mdx (~49 functions)
 *
 * Emits one additive page per component/function:
 *   - src/content/docs/components/<slug>.mdx
 *   - src/content/docs/functions/<slug>.mdx
 * plus hub pages (components/index.mdx, functions/index.mdx) and
 * src/lib/reference-index.json, which src/sidebar.mjs, the MCP
 * lookup_component/lookup_function tools, and llms.txt all read from.
 *
 * Synced docs retain their upstream text; only known legacy link targets are
 * rewritten to the split-page paths. Future syncs get new link targets
 * directly from tools/convert.mjs.
 *
 * Optional hand-written overlay content (unique commentary the upstream
 * docs don't have) lives in src/data/reference-overlays/{components,functions}/<slug>.md,
 * split into an intro and footer section by a `<!-- FOOTER -->` marker.
 *
 * Idempotent: parsing the same source text twice produces byte-identical
 * output (no timestamps), so nightly sync runs produce clean diffs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stripFrontmatter } from './generate-llms-full.mjs';
import { estimateReadTime } from './generate-release-pages.mjs';
import { referenceSlug, componentPath, functionPath } from '../src/lib/reference-slug.mjs';
import { CATEGORY_RELATED, FUNCTION_RELATED, COMPONENT_OVERRIDES, FUNCTION_OVERRIDES } from '../src/data/reference-links.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'src/content/docs');
const COMPONENT_SOURCE = path.join(DOCS_DIR, 'user-manual/component-reference.mdx');
const FUNCTION_SOURCE = path.join(DOCS_DIR, 'user-manual/functions.mdx');
const COMPONENTS_OUT_DIR = path.join(DOCS_DIR, 'components');
const FUNCTIONS_OUT_DIR = path.join(DOCS_DIR, 'functions');
const OVERLAYS_DIR = path.join(ROOT, 'src/data/reference-overlays');
const INDEX_OUT = path.join(ROOT, 'src/lib/reference-index.json');

/** Minimum documented components/functions before we assume upstream structure broke. */
export const MIN_COMPONENT_COUNT = 100;
export const MIN_FUNCTION_COUNT = 35;

/** Pages with less upstream body text than this (and no overlay) get noindex. */
const THIN_PAGE_WORD_THRESHOLD = 40;

const SYNCED_START = '{/* SYNCED-BODY:START */}';
const SYNCED_END = '{/* SYNCED-BODY:END */}';

/** Slice out the upstream-synced body, dropping CUSTOM-INTRO/CUSTOM-FOOTER wrappers. */
export function extractSyncedBody(body) {
  const startIdx = body.indexOf(SYNCED_START);
  const endIdx = body.indexOf(SYNCED_END);
  if (startIdx === -1 || endIdx === -1) return body;
  return body.slice(startIdx + SYNCED_START.length, endIdx);
}

/**
 * Parse component-reference.mdx into categories, each with its components.
 * `## N.M Category Name` headings start a category; `## N Name` (no dot,
 * the "18 Introduction" heading) ends whatever category came before and
 * starts an uncategorized zone that's dropped; any other `##` heading is
 * a component whose body runs until the next `##` heading.
 *
 * @param {string} raw full component-reference.mdx file text
 * @returns {Array<{ category: string, components: Array<{ name: string, formerly: string|null, body: string }> }>}
 */
export function parseComponents(raw) {
  const { body } = stripFrontmatter(raw);
  const synced = extractSyncedBody(body);
  const lines = synced.split('\n');

  /** @type {Array<{ category: string, components: any[] }>} */
  const categories = [];
  let currentCategory = null;
  let current = null;
  const flush = () => {
    if (current && currentCategory) {
      currentCategory.components.push({ ...current, body: current.lines.join('\n').trim() });
    }
    current = null;
  };

  for (const line of lines) {
    const categoryMatch = line.match(/^## \d+\.\d+\s+(.+?)\s*$/);
    const introMatch = line.match(/^## \d+\s+.+$/);
    const headingMatch = line.match(/^## (.+?)\s*$/);

    if (categoryMatch) {
      flush();
      currentCategory = { category: categoryMatch[1].trim(), components: [] };
      categories.push(currentCategory);
      continue;
    }
    if (introMatch) {
      flush();
      currentCategory = null;
      continue;
    }
    if (headingMatch) {
      flush();
      if (!currentCategory) continue; // heading before the first real category (shouldn't happen)
      let name = headingMatch[1].trim();
      let formerly = null;
      const wasMatch = name.match(/^(.+?)\s*_\(formerly (.+?)\)_\s*$/);
      if (wasMatch) {
        name = wasMatch[1].trim();
        formerly = wasMatch[2].trim();
      }
      current = { name, formerly, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();
  return categories;
}

/**
 * Parse functions.mdx into function entries. `## __Name` headings are
 * functions; any other `##` heading (the intro) ends the previous function.
 * A trailing `###`/`####` heading matching the intro's own "N.M Title"
 * numbering scheme (e.g. "20.6 Pre-defined Variables") is document-level,
 * not part of the preceding function, and ends parsing of that function.
 *
 * @param {string} raw full functions.mdx file text
 * @returns {Array<{ name: string, body: string }>}
 */
export function parseFunctions(raw) {
  const { body } = stripFrontmatter(raw);
  const synced = extractSyncedBody(body);
  const lines = synced.split('\n');

  /** @type {Array<{ name: string, lines: string[] }>} */
  const functions = [];
  let current = null;
  const flush = () => {
    if (current) functions.push({ name: current.name, body: current.lines.join('\n').trim() });
    current = null;
  };

  for (const line of lines) {
    const fnMatch = line.match(/^##\s+(__[A-Za-z0-9]+)\s*$/);
    const otherH2 = /^##\s+/.test(line);
    const trailingNumberedSubsection = /^#{3,4}\s+\d+\.\d+\s/.test(line);

    if (fnMatch) {
      flush();
      current = { name: fnMatch[1], lines: [] };
      continue;
    }
    if (otherH2) {
      flush();
      continue;
    }
    if (trailingNumberedSubsection) {
      flush();
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();
  return functions;
}

/** Count words in a chunk of markdown (rough thin-page heuristic). */
function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Map every component's legacy <complink> anchor (the
 * `name.replace(/[^a-zA-Z0-9]/g, '_')` scheme tools/convert.mjs used before
 * this generator existed) to its new split-page path. Existing monoliths
 * may still contain legacy links; rewrite them before generating pages.
 * @param {Array<{ components: Array<{ name: string }> }>} categories
 */
export function buildLegacyComponentAnchorMap(categories) {
  const map = new Map();
  for (const { components } of categories) {
    for (const c of components) {
      map.set(c.name.replace(/[^a-zA-Z0-9]/g, '_'), componentPath(c.name));
      map.set(c.name.replace(/ /g, '_'), componentPath(c.name));
      if (c.formerly) map.set(c.formerly.replace(/[^a-zA-Z0-9]/g, '_'), componentPath(c.name));
    }
  }
  return map;
}

/** Same idea as buildLegacyComponentAnchorMap, for <funclink> anchors. */
export function buildLegacyFunctionAnchorMap(functions) {
  const map = new Map();
  for (const fn of functions) {
    map.set(fn.name, functionPath(fn.name));
    map.set(`${fn.name}__`, functionPath(fn.name));
  }
  return map;
}

/**
 * Rewrite legacy-anchor links in a page body to the new split-page paths.
 * Only rewrites an anchor when it exactly matches a known component/function
 * (via the maps above), so links to non-component anchors in the monolith
 * (e.g. "#Assertions", "#introduction") are left untouched.
 */
export function rewriteLegacyReferenceLinks(body, componentAnchorMap, functionAnchorMap) {
  return body
    .replace(/\(\/user-manual\/component-reference\/#([^)\s]+)\)/g, (match, anchor) => {
      const target = componentAnchorMap.get(anchor) || componentAnchorMap.get(anchor.replace(/%28/gi, '(').replace(/%29/gi, ')'));
      return target ? `(${target})` : match;
    })
    .replace(/\(\/user-manual\/functions\/#([^)\s]+)\)/g, (match, anchor) => {
      const target = functionAnchorMap.get(anchor);
      return target ? `(${target})` : match;
    });
}

/** Load an overlay file, split into { intro, footer } markdown strings. */
export function loadOverlay(kind, slug, dir = OVERLAYS_DIR) {
  const file = path.join(dir, kind, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const markerIdx = raw.indexOf('<!-- FOOTER -->');
  if (markerIdx === -1) return { intro: raw.trim(), footer: '' };
  return {
    intro: raw.slice(0, markerIdx).trim(),
    footer: raw.slice(markerIdx + '<!-- FOOTER -->'.length).trim(),
  };
}

/** Build an 80–160 char meta description, matching the seo-validation gate. */
export function buildDescription(name, kind, categoryLabel) {
  let desc = kind === 'component'
    ? `Configure the JMeter ${name} ${categoryLabel.toLowerCase()}: properties, defaults, and practical usage notes for building reliable load tests.`
    : `JMeter ${name} function reference: syntax, parameters, and practical examples for parameterizing test plans with dynamic values.`;
  if (desc.length > 160) {
    desc = kind === 'component'
      ? `JMeter ${name}: properties, defaults, and usage notes for load and performance testing.`
      : `JMeter ${name} function: syntax, parameters, and usage examples.`;
  }
  if (desc.length < 80) {
    desc += ' See the full property table and related JMeter documentation below.';
  }
  if (desc.length > 160) desc = desc.slice(0, 157).trimEnd() + '...';
  return desc;
}

/** Build the "Related" block links for a component, category defaults + per-slug overrides. */
function buildComponentRelated(slug, category) {
  const links = [];
  const catDefaults = CATEGORY_RELATED[category];
  if (catDefaults?.topic) links.push(catDefaults.topic);
  if (catDefaults?.tool) links.push(catDefaults.tool);
  const overrides = COMPONENT_OVERRIDES[slug];
  if (overrides?.related) links.push(...overrides.related);
  links.push({ title: 'Full Component Reference', href: '/user-manual/component-reference/' });
  links.push({ title: 'Functions and Variables', href: '/user-manual/functions/' });
  // De-dupe by href, preserving first occurrence (overrides win over category defaults).
  const seen = new Set();
  return links.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)));
}

/** Build the "Related" block links for a function. */
function buildFunctionRelated(slug) {
  const links = [];
  if (FUNCTION_RELATED.topic) links.push(FUNCTION_RELATED.topic);
  if (FUNCTION_RELATED.tool) links.push(FUNCTION_RELATED.tool);
  const overrides = FUNCTION_OVERRIDES[slug];
  if (overrides?.related) links.push(...overrides.related);
  links.push({ title: 'Full Functions Reference', href: '/user-manual/functions/' });
  links.push({ title: 'Component Reference', href: '/user-manual/component-reference/' });
  const seen = new Set();
  return links.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)));
}

/** Build the YAML frontmatter block for a reference page. */
function buildFrontmatter({ title, seoTitle, description, keywords, readTime, noindex, canonicalTopic }) {
  const lines = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `seoTitle: "${seoTitle.replace(/"/g, '\\"')}"`,
    `description: "${description.replace(/"/g, '\\"')}"`,
    'keywords:',
    ...keywords.map((k) => `  - ${k}`),
    'difficulty: intermediate',
    'guideType: reference',
    `estimatedReadTime: "${readTime}"`,
    'lastVerified: "JMeter 5.6"',
    ...(canonicalTopic ? [`canonicalTopic: ${canonicalTopic}`] : []),
  ];
  if (noindex) {
    lines.push('head:');
    lines.push('  - tag: meta');
    lines.push('    attrs:');
    lines.push('      name: robots');
    lines.push('      content: "noindex, follow"');
  }
  lines.push('---');
  return lines.join('\n');
}

/** Build one component page. */
export function buildComponentPage(component, category) {
  const { name, formerly, body } = component;
  const slug = referenceSlug(name);
  // Astro's default heading-id algorithm (github-slugger) lowercases and
  // hyphenates, exactly what referenceSlug produces - using that (not the
  // legacy NAME_WITH_UNDERSCORES scheme <complink> used to emit) means this
  // "view in context" link actually scrolls to the right heading.
  const anchor = slug;
  const overlay = loadOverlay('components', slug);
  const noindex = !overlay && wordCount(body) < THIN_PAGE_WORD_THRESHOLD;

  const parts = [];
  parts.push(buildFrontmatter({
    title: name,
    seoTitle: `JMeter ${name}: Usage, Properties & Examples`,
    description: buildDescription(name, 'component', category),
    keywords: [`JMeter ${name}`, `${name} JMeter`, `JMeter ${category}`],
    readTime: estimateReadTime(body),
    noindex,
    canonicalTopic: CATEGORY_RELATED[category]?.topic?.href.match(/^\/topics\/([^/]+)\/$/)?.[1],
  }));
  parts.push('');
  parts.push(`{/* GENERATED by scripts/generate-reference-pages.mjs from user-manual/component-reference.mdx - do not edit by hand. Unique commentary: src/data/reference-overlays/components/${slug}.md */}`);
  parts.push('');
  parts.push(`*Part of the **${category}** category${formerly ? ` — formerly called **${formerly}**` : ''}. Also documented in context in the [full Component Reference](/user-manual/component-reference/#${anchor}).*`);
  parts.push('');
  if (overlay?.intro) {
    parts.push(overlay.intro);
    parts.push('');
  }
  parts.push(body);
  parts.push('');
  if (overlay?.footer) {
    parts.push(overlay.footer);
    parts.push('');
  }
  parts.push('## Related');
  parts.push('');
  for (const link of buildComponentRelated(slug, category)) {
    parts.push(`- [${link.title}](${link.href})`);
  }
  parts.push('');
  return parts.join('\n');
}

/** Build one function page. */
export function buildFunctionPage(fn) {
  const { name, body } = fn;
  const slug = referenceSlug(name);
  // Astro's default heading-id algorithm (github-slugger) lowercases but
  // keeps underscores as-is, so "## __time" renders id="__time" verbatim -
  // the raw function name is already the correct anchor, unlike components
  // (which do get hyphenated).
  const anchor = name;
  const overlay = loadOverlay('functions', slug);
  const noindex = !overlay && wordCount(body) < THIN_PAGE_WORD_THRESHOLD;

  const parts = [];
  parts.push(buildFrontmatter({
    title: name,
    seoTitle: `JMeter ${name} Function: Syntax, Parameters & Examples`,
    description: buildDescription(name, 'function', 'function'),
    keywords: [`JMeter ${name}`, `${name} function jmeter`, 'JMeter functions'],
    readTime: estimateReadTime(body),
    noindex,
    canonicalTopic: 'functions-and-variables',
  }));
  parts.push('');
  parts.push(`{/* GENERATED by scripts/generate-reference-pages.mjs from user-manual/functions.mdx - do not edit by hand. Unique commentary: src/data/reference-overlays/functions/${slug}.md */}`);
  parts.push('');
  parts.push(`*Also documented in context in the [full Functions and Variables reference](/user-manual/functions/#${anchor}).*`);
  parts.push('');
  if (overlay?.intro) {
    parts.push(overlay.intro);
    parts.push('');
  }
  parts.push(body);
  parts.push('');
  if (overlay?.footer) {
    parts.push(overlay.footer);
    parts.push('');
  }
  parts.push('## Related');
  parts.push('');
  for (const link of buildFunctionRelated(slug)) {
    parts.push(`- [${link.title}](${link.href})`);
  }
  parts.push('');
  return parts.join('\n');
}

/** Build the components hub page, grouped by category. */
export function buildComponentsHub(categories) {
  const parts = [];
  parts.push(`---
title: "JMeter Component Reference: Browse by Category"
seoTitle: "JMeter Components: Samplers, Controllers, Listeners & More"
description: "Browse every Apache JMeter test plan component by category: samplers, logic controllers, listeners, timers, assertions, and processors."
keywords:
  - JMeter components
  - JMeter samplers list
  - JMeter listeners list
difficulty: intermediate
guideType: reference
estimatedReadTime: "2 min read"
---`);
  parts.push('');
  parts.push("import ReferenceDirectory from '../../../components/ReferenceDirectory.astro';");
  parts.push('');
  parts.push('{/* GENERATED by scripts/generate-reference-pages.mjs - do not edit by hand */}');
  parts.push('');
  parts.push('Every JMeter test plan component, one dedicated page per component with its properties, defaults, and related guides. Search by name or narrow by category. For the single-page view, see the [full Component Reference](/user-manual/component-reference/).');
  parts.push('');
  parts.push('<ReferenceDirectory kind="component" />');
  parts.push('');
  return parts.join('\n');
}

/** Build the functions hub page. */
export function buildFunctionsHub(functions) {
  const parts = [];
  parts.push(`---
title: "JMeter Functions Reference: Browse All Functions"
seoTitle: "JMeter Functions List: __time, __Random, __P & More"
description: "Browse every Apache JMeter \${__function()} with a dedicated page: syntax, parameters, and usage examples for each one."
keywords:
  - JMeter functions list
  - JMeter __time function
  - JMeter __Random function
difficulty: intermediate
guideType: reference
estimatedReadTime: "2 min read"
---`);
  parts.push('');
  parts.push("import ReferenceDirectory from '../../../components/ReferenceDirectory.astro';");
  parts.push('');
  parts.push('{/* GENERATED by scripts/generate-reference-pages.mjs - do not edit by hand */}');
  parts.push('');
  parts.push('Every built-in JMeter function, one dedicated page per function with its syntax, parameters, and examples. Search by function name below, or see the [full Functions and Variables reference](/user-manual/functions/).');
  parts.push('');
  parts.push('<ReferenceDirectory kind="function" />');
  parts.push('');
  return parts.join('\n');
}

/**
 * Refuse to retain stale pages after an upstream rename or removal.
 */
function checkGeneratedDir(dir, expected) {
  fs.mkdirSync(dir, { recursive: true });
  for (const entry of fs.readdirSync(dir)) {
    if (entry.endsWith('.mdx') && !expected.has(entry)) {
      throw new Error(`[reference-pages] stale generated page: ${path.join(dir, entry)}`);
    }
  }
}

function refreshReferenceLinksInDocs(dir, componentAnchorMap, functionAnchorMap) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dir !== DOCS_DIR || !['components', 'functions'].includes(entry.name)) {
        refreshReferenceLinksInDocs(file, componentAnchorMap, functionAnchorMap);
      }
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      const source = fs.readFileSync(file, 'utf8');
      const updated = rewriteLegacyReferenceLinks(source, componentAnchorMap, functionAnchorMap);
      if (updated !== source) fs.writeFileSync(file, updated, 'utf8');
    }
  }
}

function main() {
  if (!fs.existsSync(COMPONENT_SOURCE) || !fs.existsSync(FUNCTION_SOURCE)) {
    console.error('[reference-pages] missing source file(s); skipping generation');
    process.exit(1);
  }

  const componentCategories = parseComponents(fs.readFileSync(COMPONENT_SOURCE, 'utf8'));
  const totalComponents = componentCategories.reduce((n, c) => n + c.components.length, 0);
  const functions = parseFunctions(fs.readFileSync(FUNCTION_SOURCE, 'utf8'));

  if (totalComponents < MIN_COMPONENT_COUNT) {
    console.error(`[reference-pages] parsed only ${totalComponents} components (expected >= ${MIN_COMPONENT_COUNT}); upstream structure may have changed. Aborting.`);
    process.exit(1);
  }
  if (functions.length < MIN_FUNCTION_COUNT) {
    console.error(`[reference-pages] parsed only ${functions.length} functions (expected >= ${MIN_FUNCTION_COUNT}); upstream structure may have changed. Aborting.`);
    process.exit(1);
  }

  // Keep both the monoliths and generated pages on the same split-page links.
  const componentAnchorMap = buildLegacyComponentAnchorMap(componentCategories);
  const functionAnchorMap = buildLegacyFunctionAnchorMap(functions);
  checkGeneratedDir(COMPONENTS_OUT_DIR, new Set(['index.mdx', ...componentCategories.flatMap(({ components }) => components.map(({ name }) => `${referenceSlug(name)}.mdx`))]));
  checkGeneratedDir(FUNCTIONS_OUT_DIR, new Set(['index.mdx', ...functions.map(({ name }) => `${referenceSlug(name)}.mdx`)]));
  for (const { components } of componentCategories) {
    for (const c of components) {
      c.body = rewriteLegacyReferenceLinks(c.body, componentAnchorMap, functionAnchorMap);
    }
  }
  for (const fn of functions) {
    fn.body = rewriteLegacyReferenceLinks(fn.body, componentAnchorMap, functionAnchorMap);
  }

  const indexEntries = [];

  for (const { category, components } of componentCategories) {
    for (const component of components) {
      const slug = referenceSlug(component.name);
      fs.writeFileSync(path.join(COMPONENTS_OUT_DIR, `${slug}.mdx`), buildComponentPage(component, category), 'utf8');
      indexEntries.push({ kind: 'component', slug, name: component.name, category, path: `/components/${slug}/` });
    }
  }
  fs.writeFileSync(path.join(COMPONENTS_OUT_DIR, 'index.mdx'), buildComponentsHub(componentCategories), 'utf8');

  for (const fn of functions) {
    const slug = referenceSlug(fn.name);
    fs.writeFileSync(path.join(FUNCTIONS_OUT_DIR, `${slug}.mdx`), buildFunctionPage(fn), 'utf8');
    indexEntries.push({ kind: 'function', slug, name: fn.name, category: 'Functions', path: `/functions/${slug}/` });
  }
  fs.writeFileSync(path.join(FUNCTIONS_OUT_DIR, 'index.mdx'), buildFunctionsHub(functions), 'utf8');

  fs.writeFileSync(INDEX_OUT, JSON.stringify(indexEntries, null, 2) + '\n', 'utf8');

  refreshReferenceLinksInDocs(DOCS_DIR, componentAnchorMap, functionAnchorMap);

  console.log(`[reference-pages] generated ${totalComponents} component pages + ${functions.length} function pages + 2 hubs`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
