import { defineConfig } from 'vitest/config';

// Minimal, frontend-scoped test config. Pure data/logic tests (e.g. frontend/data/*)
// only need a Node environment — no DOM/jsdom dependency has been added.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
