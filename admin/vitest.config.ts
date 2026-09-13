import { defineConfig } from 'vitest/config';

// Minimal, admin-scoped test config, mirroring frontend/vitest.config.ts. Pure data/logic
// tests (e.g. admin/src/utils/*.test.ts) only need a Node environment, so that stays the
// default. Component tests that render into the DOM (e.g.
// admin/src/components/**/*.test.tsx) need jsdom instead — see #809, which added the first
// one, to verify RaceFormCard's ITRA points paste wiring end to end rather than only
// unit-testing the pure function it calls.
//
// `environmentMatchGlobs` (the config-level way to split this by glob) was removed in
// Vitest 4, so `.test.tsx` files opt into jsdom individually via a per-file
// `// @vitest-environment jsdom` docblock comment at the top of the file instead — this
// leaves every existing `.test.ts` file's Node environment completely untouched.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
});
