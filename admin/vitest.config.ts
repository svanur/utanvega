import { defineConfig } from 'vitest/config';

// Minimal, admin-scoped test config, mirroring frontend/vitest.config.ts. Pure data/logic
// tests (e.g. admin/src/utils/*) only need a Node environment — no DOM/jsdom dependency has
// been added. This is the first test in admin; extend it (jsdom, testing-library, etc.) only
// when a future test actually needs it.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
