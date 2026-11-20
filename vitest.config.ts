import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environmentMatchGlobs: [['src/react/**', 'jsdom']], testTimeout: 30000 },
});
