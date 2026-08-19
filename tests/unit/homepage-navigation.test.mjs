import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenSidebar } from '../../src/sidebar.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const indexSource = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
const docsRoot = join(root, 'src/content/docs');
const pagesRoot = join(root, 'src/pages');

function contentPathForLink(link) {
  const normalized = link.replace(/^\/|\/$/g, '');
  if (!normalized) return null;
  const direct = join(docsRoot, `${normalized}.mdx`);
  if (existsSync(direct)) return direct;
  const index = join(docsRoot, normalized, 'index.mdx');
  if (existsSync(index)) return index;
  return direct;
}

/** Standalone pages (e.g. /mcp/) live in src/pages, not the docs collection. */
function standalonePageForLink(link) {
  const normalized = link.replace(/^\/|\/$/g, '');
  if (!normalized) return null;
  const astroPage = join(pagesRoot, `${normalized}.astro`);
  if (existsSync(astroPage)) return astroPage;
  const astroIndex = join(pagesRoot, normalized, 'index.astro');
  if (existsSync(astroIndex)) return astroIndex;
  return null;
}

describe('homepage practitioner navigation', () => {
  it('defines the expected workflow cards', () => {
    const titles = [
      'I need a calculator',
      'Run a CLI test',
      "I'm stuck on an error",
      'Record HTTP traffic',
      'Build a test plan',
      'Run distributed load',
      'Analyze dashboard results',
      'Tune properties',
      'Extend JMeter',
    ];

    for (const title of titles) {
      // Titles may use single or double quotes in the source file.
      expect(
        indexSource.includes(`title: '${title}'`) || indexSource.includes(`title: "${title}"`),
        `missing workflow title: ${title}`,
      ).toBe(true);
    }
  });

  it('offers dual hero CTAs for new and experienced users', () => {
    expect(indexSource).toContain("href=\"/topics/jmeter-for-beginners/\"");
    expect(indexSource).toContain("href=\"/getting-started/get-started/\"");
    expect(indexSource).toContain("I'm new");
    expect(indexSource).toContain('I know JMeter');
  });

  it('links every homepage goal to an existing docs page', () => {
    const goalLinks = Array.from(indexSource.matchAll(/href: '([^']+)'/g))
      .map((match) => match[1])
      .filter((href) => href.startsWith('/'));

    expect(goalLinks.length).toBeGreaterThanOrEqual(12);
    for (const href of goalLinks) {
      const contentPath = contentPathForLink(href);
      const pagePath = standalonePageForLink(href);
      const resolved = existsSync(contentPath) ? contentPath : pagePath;
      expect(resolved, `${href} should resolve to docs content or a standalone page`).not.toBeNull();
      expect(existsSync(resolved), `${href} should resolve to ${resolved}`).toBe(true);
    }
  });

  it('keeps sidebar leaf links resolvable after navigation changes', () => {
    for (const item of flattenSidebar()) {
      if (item.link === '/') continue;
      const path = contentPathForLink(item.link);
      expect(existsSync(path), `${item.link} should resolve to ${path}`).toBe(true);
    }
  });
});
