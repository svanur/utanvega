// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TrailHealth, { getHealthChecks, getHealthScore, scoreColor, type TrailHealthInput } from './TrailHealth';

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

  // #1397's fileParallelism: false fix (admin/vitest.config.ts) removed the cross-file CPU
  // contention these overrides originally guarded against, so most of this describe block
  // now runs comfortably under the suite's 5000ms default (see the un-overridden
  // 'enables all six buttons when idle' case below). But these six cases each open a
  // confirmation dialog, click its "run" button, then do five more findByRole lookups via
  // assertOtherFiveDisabled — measured landing right at the 5000ms boundary even running
  // this file alone and sequentially (one actually clocked in at 5024ms), with a different
  // one of the six tripping it on different runs rather than the same one each time. That's
  // real per-test margin, not file-level contention, so each of the six keeps its own
  // explicit timeout rather than relying on the default.
  it('disables the other five buttons while detectingLocations is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.detectingLocations });
    await triggerFlag('detectingLocations');
    await assertOtherFiveDisabled('detectingLocations');
  }, 10000);

  it('disables the other five buttons while detectingTerrain is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.detectingTerrain });
    await triggerFlag('detectingTerrain');
    await assertOtherFiveDisabled('detectingTerrain');
  }, 10000);

  it('disables the other five buttons while backfillingProfiles is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.backfillingProfiles });
    await triggerFlag('backfillingProfiles');
    await assertOtherFiveDisabled('backfillingProfiles');
  }, 10000);

  it('disables the other five buttons while detecting is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.detecting });
    await triggerFlag('detecting');
    await assertOtherFiveDisabled('detecting');
  }, 10000);

  it('disables the other five buttons while recalculating is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.recalculating });
    await triggerFlag('recalculating');
    await assertOtherFiveDisabled('recalculating');
  }, 10000);

  it('disables the other five buttons while scanningDuplicates is in flight', async () => {
    renderTrailHealth();
    await screen.findByRole('button', { name: BUTTON_NAMES.scanningDuplicates });
    await triggerFlag('scanningDuplicates');
    await assertOtherFiveDisabled('scanningDuplicates');
  }, 10000);

  it('enables all six buttons when idle', async () => {
    renderTrailHealth();
    for (const name of ALL_BUTTON_NAMES) {
      const button = await screen.findByRole<HTMLButtonElement>('button', { name });
      expect(button.disabled).toBe(false);
    }
  });
});

// #1842: getHealthChecks/getHealthScore/scoreColor are exported from here for reuse by
// TrailDetailPage.tsx's inline completeness banner, which assembles a TrailHealthInput from
// TrailDetail fields rather than the admin trails list's Trail — these exercise that narrower
// input shape directly, the same pure-function style as EditionHealth.test.tsx's
// getEditionChecks/getRaceChecks coverage, rather than rendering a component.
function makeHealthInput(overrides: Partial<TrailHealthInput> = {}): TrailHealthInput {
  return {
    description: 'A fine trail through the hills.',
    startLatitude: 64.1,
    startLongitude: -21.9,
    elevationGain: 120,
    elevationLoss: 110,
    locations: [{ name: 'Reykjavík' }],
    length: 5000,
    status: 'Published',
    terrainType: 'Hilly',
    ...overrides,
  };
}

describe('getHealthChecks / getHealthScore / scoreColor — TrailHealthInput', () => {
  it('scores 100 and reports every check passed for a fully-complete trail', () => {
    const checks = getHealthChecks(makeHealthInput());

    expect(checks.every(c => c.passed)).toBe(true);
    expect(getHealthScore(makeHealthInput())).toBe(100);
    expect(scoreColor(100)).toBe('success');
  });

  it('fails the Description check for an empty description, without affecting other checks', () => {
    const checks = getHealthChecks(makeHealthInput({ description: '' }));

    expect(checks.find(c => c.label === 'Description')!.passed).toBe(false);
    expect(checks.find(c => c.label === 'GPX Data')!.passed).toBe(true);
  });

  it('fails GPX Data and treats Terrain as N/A (passed) when there is no start coordinate', () => {
    const checks = getHealthChecks(makeHealthInput({ startLatitude: null, startLongitude: null }));

    expect(checks.find(c => c.label === 'GPX Data')!.passed).toBe(false);
    const terrain = checks.find(c => c.label === 'Terrain')!;
    expect(terrain.passed).toBe(true);
    expect(terrain.tooltip).toContain('N/A');
  });

  it('fails Terrain when GPX data exists but terrainType is unset', () => {
    const checks = getHealthChecks(makeHealthInput({ terrainType: null }));

    expect(checks.find(c => c.label === 'Terrain')!.passed).toBe(false);
  });

  it('fails Location when the trail has no locations linked', () => {
    const checks = getHealthChecks(makeHealthInput({ locations: [] }));

    expect(checks.find(c => c.label === 'Location')!.passed).toBe(false);
  });

  it('fails Published when status is not Published, dragging the score below 100', () => {
    const score = getHealthScore(makeHealthInput({ status: 'Draft' }));

    expect(score).toBeLessThan(100);
    expect(scoreColor(score)).not.toBe('success');
  });
});
