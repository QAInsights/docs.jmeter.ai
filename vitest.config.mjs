import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['tools/convert.mjs'],
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
