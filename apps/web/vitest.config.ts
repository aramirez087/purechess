import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['node_modules', 'dist', '.next', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@purechess/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
