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
//
// #1393: `fileParallelism: false` makes vitest run test files one at a time instead of its
// default of spreading them across a worker-thread pool sized to the machine's CPU core count.
// With it left at the default, four of this suite's heavier jsdom+MUI test files
// (RaceFormCard.test.tsx, RaceDayPage.test.tsx, EventWizardPage.test.tsx,
// EventDetailPage.test.tsx) were measured timing out intermittently under `npm test` — each
// passes in well under 1-3s whenever its own file runs alone, but 15 files' worth of real
// LocalizationProvider/AdapterDayjs/Autocomplete mounts competing for the same CPU cores at once
// stretched individual tests' wall-clock duration past vitest's default 5000ms testTimeout, with
// the *same* test failing every time across repeated full-suite runs (not a different one each
// run) — a signature of CPU contention between concurrently-running files, not a logic bug or a
// genuine async race in any of the four tests themselves. Capping
// `poolOptions.threads.maxThreads` lower was tried first and made things worse (it only queues
// more file-runs onto fewer threads, without reducing the total CPU demand), so this instead
// removes the cross-file contention entirely by never running files concurrently in the first
// place. Verified against 5 consecutive full-suite runs, all passing with every test still at
// its original default 5000ms timeout (no per-test timeout overrides needed in any of the four
// files). Trade-off: the full suite's wall-clock time roughly doubles (local full-suite run:
// ~40-60s parallel, with intermittent failures, vs. ~90-100s sequential, with none) — accepted
// since this suite's total size (15 files, 159 tests) keeps the sequential run well within a
// normal CI budget, and correctness matters more here than shaving ~50s off a local test run.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    fileParallelism: false,
  },
});
