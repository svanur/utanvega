import { defineConfig } from 'vitest/config';

// Minimal, frontend-scoped test config. Pure data/logic tests (e.g. frontend/data/*), as well as
// component rendering tests that only need react-dom/server's renderToStaticMarkup (e.g.
// ElevationCurveBackground.test.tsx, #1013), only need a Node environment — no DOM/jsdom
// dependency has been added.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
});
