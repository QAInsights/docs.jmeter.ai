import { describe, it, expect } from 'vitest';
import { loadEnv } from 'vite';

describe('Algolia DocSearch configuration', () => {
  it('astro.config.mjs should import starlight-docsearch', async () => {
    const raw = await import('node:fs').then((fs) =>
      fs.promises.readFile(new URL('../astro.config.mjs', import.meta.url), 'utf-8')
    );
    expect(raw).toContain("import starlightDocSearch from '@astrojs/starlight-docsearch'");
  });

  it('should reference all three required Algolia env vars', async () => {
    const raw = await import('node:fs').then((fs) =>
      fs.promises.readFile(new URL('../astro.config.mjs', import.meta.url), 'utf-8')
    );
    expect(raw).toContain('PUBLIC_ALGOLIA_APP_ID');
    expect(raw).toContain('PUBLIC_ALGOLIA_API_KEY');
    expect(raw).toContain('PUBLIC_ALGOLIA_INDEX_NAME');
  });

  it('should pass env vars to starlightDocSearch plugin options', async () => {
    const raw = await import('node:fs').then((fs) =>
      fs.promises.readFile(new URL('../astro.config.mjs', import.meta.url), 'utf-8')
    );
    expect(raw).toMatch(/appId:\s*env\.PUBLIC_ALGOLIA_APP_ID/);
    expect(raw).toMatch(/apiKey:\s*env\.PUBLIC_ALGOLIA_API_KEY/);
    expect(raw).toMatch(/indexName:\s*env\.PUBLIC_ALGOLIA_INDEX_NAME/);
  });

  it('starlightDocSearch should be registered inside plugins array', async () => {
    const raw = await import('node:fs').then((fs) =>
      fs.promises.readFile(new URL('../astro.config.mjs', import.meta.url), 'utf-8')
    );
    const pluginsBlock = raw.match(/plugins:\s*\[([\s\S]*?)\]/);
    expect(pluginsBlock).not.toBeNull();
    expect(pluginsBlock[1]).toContain('starlightDocSearch');
  });

  it('should use vite loadEnv for environment variable loading', async () => {
    const raw = await import('node:fs').then((fs) =>
      fs.promises.readFile(new URL('../astro.config.mjs', import.meta.url), 'utf-8')
    );
    expect(raw).toContain('loadEnv');
    expect(raw).toMatch(/const\s+env\s*=\s*loadEnv\(/);
  });

  it('PUBLIC_ env prefix ensures client-side exposure (required for DocSearch)', async () => {
    const raw = await import('node:fs').then((fs) =>
      fs.promises.readFile(new URL('../astro.config.mjs', import.meta.url), 'utf-8')
    );
    const envVarNames = [...raw.matchAll(/env\.(PUBLIC_\w+)/g)].map((m) => m[1]);
    const algoliaVars = envVarNames.filter((v) => v.includes('ALGOLIA'));
    expect(algoliaVars).toEqual([
      'PUBLIC_ALGOLIA_APP_ID',
      'PUBLIC_ALGOLIA_API_KEY',
      'PUBLIC_ALGOLIA_INDEX_NAME',
    ]);
  });

  it('should not expose any secret/server-only Algolia keys', async () => {
    const raw = await import('node:fs').then((fs) =>
      fs.promises.readFile(new URL('../astro.config.mjs', import.meta.url), 'utf-8')
    );
    expect(raw).not.toMatch(/ALGOLIA_ADMIN_KEY|ALGOLIA_WRITE_KEY|ALGOLIA_SECRET/);
  });

  it('package.json should declare @astrojs/starlight-docsearch as a dependency', async () => {
    const pkg = await import('../package.json', { with: { type: 'json' } }).then(
      (m) => m.default
    );
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps).toHaveProperty('@astrojs/starlight-docsearch');
  });
});
