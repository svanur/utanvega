// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TrailHealth from './TrailHealth';

// #1295: the six long-running action buttons on this page (TrailHealth.tsx:290,299,308,318,327,448)
// each disable themselves against the other five in-flight flags (detecting, detectingLocations,
// detectingTerrain, backfillingProfiles, recalculating, scanningDuplicates — declared lines 122-132).
// This matrix already drifted once (#1263 -> #1264, fixed by #1294) with nothing locking it in. This
// renders the real component, drives each flag true via its actual click path (opening the
// confirmation dialog where one exists), and asserts the other five buttons go disabled — the same
// shape as EventHealth.test.tsx's wiring test, rather than testing the disabled expressions in
// isolation.

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn((endpoint: string) => {
    if (endpoint === '/api/v1/admin/trails?includeArchived=false') return Promise.resolve([]);
    if (endpoint === '/api/v1/admin/trails/duplicates?threshold=90') return Promise.resolve([]);
    // Every write/action endpoint (detect-*, backfill-*, recalculate-*, the force=true re-scan)
    // intentionally never resolves within a test, so the flag it drives stays true while we
    // assert the sibling buttons are disabled.
    return new Promise(() => {});
  }),
}));

function renderTrailHealth() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <TrailHealth onNotify={() => {}} />
    </QueryClientProvider>,
  );
}

const BUTTON_NAMES = {
  detectingLocations: 'Re-detect Locations',
  detectingTerrain: 'Re-detect Terrain (Flat / Hilly / Mountainous)',
  backfillingProfiles: 'Backfill Elevation Profiles',
  detecting: 'Re-detect Route Shape (Loop / Out-and-back / Point-to-point)',
  recalculating: 'Recalculate Difficulties',
  scanningDuplicates: 'Scan again',
} as const;

type Flag = keyof typeof BUTTON_NAMES;

const ALL_BUTTON_NAMES = Object.values(BUTTON_NAMES);

// Dialog "run" button text for the five flags gated behind a confirmation dialog.
// scanningDuplicates has no dialog — its button triggers the handler directly.
const DIALOG_RUN_BUTTON_NAME: Partial<Record<Flag, string>> = {
  detectingLocations: 'Run detection',
  detectingTerrain: 'Run detection',
  backfillingProfiles: 'Run backfill',
  detecting: 'Run detection',
  recalculating: 'Recalculate',
};

/** Drives the given flag true via the component's real click path. */
async function triggerFlag(flag: Flag) {
  if (flag === 'scanningDuplicates') {
    fireEvent.click(screen.getByRole('button', { name: BUTTON_NAMES.scanningDuplicates }));
    return;
  }
  fireEvent.click(screen.getByRole('button', { name: BUTTON_NAMES[flag] }));
  const runButtonName = DIALOG_RUN_BUTTON_NAME[flag]!;
  fireEvent.click(await screen.findByRole('button', { name: runButtonName }));
}

/** Asserts the five buttons other than the one driving `activeFlag` are disabled. */
async function assertOtherFiveDisabled(activeFlag: Flag) {
  const others = ALL_BUTTON_NAMES.filter(name => name !== BUTTON_NAMES[activeFlag]);
  for (const name of others) {
    const button = await screen.findByRole<HTMLButtonElement>('button', { name });
    expect(button.disabled).toBe(true);
  }
}

describe('TrailHealth — six-button disabled matrix (#1263/#1264/#1294 regression)', () => {
  afterEach(cleanup);

  // Each case opens a confirmation dialog, clicks its "run" button, then does six more
  // findByRole lookups — above the 5000ms default on a loaded machine (MUI + the duplicates
  // query both need to settle first), so these get an explicit timeout rather than flaking.
  it('disables the other five buttons while detectingLocations is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.detectingLocations });
    await triggerFlag('detectingLocations');
    await assertOtherFiveDisabled('detectingLocations');
  }, 15000);

  it('disables the other five buttons while detectingTerrain is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.detectingTerrain });
    await triggerFlag('detectingTerrain');
    await assertOtherFiveDisabled('detectingTerrain');
  }, 15000);

  it('disables the other five buttons while backfillingProfiles is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.backfillingProfiles });
    await triggerFlag('backfillingProfiles');
    await assertOtherFiveDisabled('backfillingProfiles');
  }, 15000);

  it('disables the other five buttons while detecting is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.detecting });
    await triggerFlag('detecting');
    await assertOtherFiveDisabled('detecting');
  }, 15000);

  it('disables the other five buttons while recalculating is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.recalculating });
    await triggerFlag('recalculating');
    await assertOtherFiveDisabled('recalculating');
  }, 15000);

  it('disables the other five buttons while scanningDuplicates is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.scanningDuplicates });
    await triggerFlag('scanningDuplicates');
    await assertOtherFiveDisabled('scanningDuplicates');
  }, 15000);

  it('enables all six buttons when idle', async () => {
    renderTrailHealth();
    for (const name of ALL_BUTTON_NAMES) {
      const button = await screen.findByRole<HTMLButtonElement>('button', { name });
      expect(button.disabled).toBe(false);
    }
  }, 15000);
});
