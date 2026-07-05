import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'tools/convert.mjs',
        'astro.config.mjs',
        'src/lib/docs-graph-data.mjs',
        'src/lib/docs-graph-physics.mjs',
        'src/lib/sharing-urls.mjs',
        'src/lib/path-utils.mjs',
        'src/lib/head-tags.mjs',
        'src/lib/reading-tracker.mjs',
        'src/faq-schema.mjs',
        'src/howto-schema.mjs',
        'src/sidebar.mjs',
      ],
      exclude: ['scripts/sync.mjs', '**/*.test.*'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 78,
        statements: 80,
      },
    },
  },
});
