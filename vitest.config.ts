import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['json', 'lcov', 'text', 'clover'],
      include: ['src/**/*.ts'],
      exclude: ['src/docgen/*.ts'],
    },
    setupFiles: ['./vitest.setup.ts'],
  },
});
