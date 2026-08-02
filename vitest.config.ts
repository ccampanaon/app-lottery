import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    /*
     * Node by default — booting jsdom costs ~40s a run, and most of the suite is
     * pure logic (validation, statistics, prediction strategies). Component
     * tests opt in per file with a `@vitest-environment jsdom` docblock.
     */
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
