import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenSidebar } from '../../src/sidebar.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const indexSource = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
const docsRoot = join(root, 'src/content/docs');

function contentPathForLink(link) {
  const normalized = link.replace(/^\/|\/$/g, '');
  if (!normalized) return null;
  return join(docsRoot, `${normalized}.mdx`);
}

describe('homepage practitioner navigation', () => {
  it('defines the expected workflow cards', () => {
    const titles = [
      'Record HTTP traffic',
      'Build a test plan',
      'Run distributed load',
      'Analyze dashboard results',
      'Tune properties',
      'Extend JMeter',
    ];

    for (const title of titles) {
      expect(indexSource).toContain(`title: '${title}'`);
    }
  });

  it('links every homepage goal to an existing docs page', () => {
    const goalLinks = Array.from(indexSource.matchAll(/href: '([^']+)'/g))
      .map((match) => match[1])
      .filter((href) => href.startsWith('/'));

    expect(goalLinks.length).toBeGreaterThanOrEqual(12);
    for (const href of goalLinks) {
      const path = contentPathForLink(href);
      expect(path, `${href} should resolve to docs content`).not.toBeNull();
      expect(existsSync(path), `${href} should resolve to ${path}`).toBe(true);
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
