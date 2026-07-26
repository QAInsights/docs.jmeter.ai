import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SYNCED_MANUAL_MAPPINGS, HUB_AND_SPOKE_TAXONOMY, getInternalLinksForPath } from '../../src/lib/internal-linking.mjs';
import { faqSchema } from '../../src/faq-schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DOCS_DIR = path.join(ROOT, 'src/content/docs');

function routeToMdxPath(route) {
  const clean = route.replace(/^\//, '').replace(/\/$/, '');
  return path.join(DOCS_DIR, `${clean}.mdx`);
}

describe('Internal Linking System - Taxonomy & Mappings', () => {
  it('every synced manual mapping has valid title and href', () => {
    for (const mapping of Object.values(SYNCED_MANUAL_MAPPINGS)) {
      expect(mapping.practicalGuide).toBeDefined();
      expect(mapping.practicalGuide.title).toBeTruthy();
      expect(mapping.practicalGuide.href).toMatch(/^\/topics\//);

      expect(mapping.relatedTool).toBeDefined();
      expect(mapping.relatedTool.title).toBeTruthy();
      expect(mapping.relatedTool.href).toMatch(/^\/tools\//);

      // Verify targeted mdx files exist
      const toolMdx = routeToMdxPath(mapping.relatedTool.href);
      expect(fs.existsSync(toolMdx)).toBe(true);
    }
  });

  it('hub-and-spoke pillar topics have valid recipes, tools, and reference links', () => {
    for (const pillar of Object.values(HUB_AND_SPOKE_TAXONOMY)) {
      expect(pillar.title).toBeTruthy();
      expect(pillar.recipes.length).toBeGreaterThanOrEqual(4);
      expect(pillar.tools.length).toBeGreaterThanOrEqual(1);
      expect(pillar.reference.length).toBeGreaterThanOrEqual(1);

      for (const recipe of pillar.recipes) {
        expect(recipe.href).toMatch(/^\/topics\//);
        const mdxFile = routeToMdxPath(recipe.href);
        expect(fs.existsSync(mdxFile)).toBe(true);
      }
    }
  });

  it('getInternalLinksForPath returns mapping for mapped paths', () => {
    const manualResult = getInternalLinksForPath('/user-manual/component-reference');
    expect(manualResult).toBeDefined();
    expect(manualResult.practicalGuide.href).toBe('/topics/api-load-testing/');

    const pillarResult = getInternalLinksForPath('/topics/api-load-testing');
    expect(pillarResult).toBeDefined();
    expect(pillarResult.title).toBe('API Load Testing');
  });

  it('faqSchema keys correspond to existing documentation or tool pages', () => {
    for (const route of Object.keys(faqSchema)) {
      if (route === '/topics/errors') continue;
      const mdxFile = routeToMdxPath(route);
      expect(fs.existsSync(mdxFile)).toBe(true);
    }
  });
});
