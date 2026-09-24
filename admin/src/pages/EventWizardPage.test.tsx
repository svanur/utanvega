// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { EditionDetailsStep, EventDetailsStep, RacesStep } from './EventWizardPage';
import { BilingualLangProvider } from '../contexts/BilingualLangContext';
import { EDITION_STATUS_LABELS } from '../utils/eventForms';
import type {
  ActivityType,
  EditionStatus,
  EventDetailDto,
  EventStatus,
  EventType,
  RaceDto,
  RegistrationStatus,
} from '../hooks/useEvents';
import type { Trail } from '../hooks/useTrails';

// #953 round 2: round 1's fix (PR #961) seeded RacesStep's "Added this session" list by reading
// useEventDetail's reactive `detail` value directly. That query has a 30s staleTime
// (useEvents.ts:473-481) that neither createRace nor deleteRace invalidates, so a Step 3 -> 2 -> 3
// round trip completed within 30s of the page load would silently reseed from the still-cached
// pre-mutation snapshot — reproducing the exact bug #953 reports, just gated behind timing instead
// of fixed. This test locks in the actual fix: the seed effect must await an explicit refetch()
// (which always hits the network, bypassing staleTime) and seed from *that* call's resolved data,
// not from the passively-cached `detail`. Against the round-1 implementation, this test times out
// waiting for the race name to reappear after remount.

const EVENT_SLUG = 'test-event';
const EDITION_ID = 'edition-1';
const RACE_NAME = 'Test Trail';

function makeRace(id: string, name: string, sortOrder: number): RaceDto {
  return {
    id,
    eventEditionId: EDITION_ID,
    trailId: 'trail-1',
    trailName: name,
    trailSlug: 'test-trail',
    name,
    nameEn: null,
    distanceLabel: null,
    distanceLabelEn: null,
    cutoffMinutes: null,
    description: null,
    descriptionEn: null,
    status: 'Active',
    sortOrder,
    ticketStatus: 'NotStarted',
    resultType: 'Time',
    maxParticipants: null,
    itraPoints: null,
    certifiedBy: null,
    certifiedByEn: null,
    prizeMoney: 0,
    championshipCategory: null,
    championshipCategoryEn: null,
    dateOfRace: null,
    startTime: null,
    trailDistanceMeters: null,
    trailElevationGain: null,
    activityType: null,
  };
}

// #962: a minimal Trail fixture for RacesStep's Autocomplete — only the fields the trail-selection
// UI and its filter (selectableTrails, RacesStep.tsx) actually read are populated meaningfully.
function makeTrail(id: string, name: string): Trail {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    length: 5000,
    elevationGain: 100,
    elevationLoss: 100,
    status: 'Published',
    activityType: 'TrailRunning',
    trailType: 'Loop',
    locations: [],
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function makeDetail(races: RaceDto[]): EventDetailDto {
  return {
    id: 'event-1',
    name: 'Test Event',
    nameEn: null,
    slug: EVENT_SLUG,
    description: null,
    descriptionEn: null,
    type: 'Race',
    activityType: 'TrailRunning',
    status: 'Hidden',
    organizerName: null,
    organizerNameEn: null,
    organizerWebsite: null,
    organizerId: null,
    organizerSlug: null,
    alertMessage: null,
    alertMessageEn: null,
    alertSeverity: null,
    locationId: null,
    locationName: null,
    scheduleRule: null,
    socialLinks: null,
    nextEditionDate: null,
    daysUntil: null,
    editionCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: null,
    seriesRaces: null,
    gpxPointLat: null,
    gpxPointLng: null,
    isMountainRace: false,
    terrainType: null,
    hasFutureEdition: false,
    endDisplayDate: null,
    editionStatus: 'Hidden',
    editionEffectiveCancelled: false,
    anyEditionNeedsReview: false,
    upcomingDates: [],
    editions: [
      {
        id: EDITION_ID,
        eventId: 'event-1',
        year: 2026,
        date: null,
        endDate: null,
        title: null,
        titleEn: null,
        registrationUrl: null,
        resultsUrl: null,
        notes: null,
        notesEn: null,
        registrationStatus: 'NotStarted',
        registrationOpens: null,
        registrationCloses: null,
        trailId: null,
        trailName: null,
        trailSlug: null,
        races,
        galleries: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
        status: 'Hidden',
        effectiveCancelled: false,
        needsReview: false,
      },
    ],
  };
}

// Mutable "current server state" — read fresh on every apiFetch call, rather than an
// index/count-based response list, so the test doesn't depend on exactly how many network calls a
// given mount happens to make (react-query dedupes concurrent fetches for the same key, so mount
// #1's own automatic fetch and RacesStep's explicit refetch() may or may not coalesce into one).
let currentRaces: RaceDto[] = [];
let eventDetailFetches = 0;
// #962: trails offered by the Autocomplete, and the sortOrder handleAddRaces actually POSTed for
// each created race — read fresh per test rather than snapshotted, same reasoning as currentRaces.
let mockTrails: Trail[] = [];
let capturedSortOrders: number[] = [];
let nextRaceId = 0;
// #968: when true, the *next* eventDetail apiFetch call returns a promise this test holds open
// (via pendingEventDetailResolve) instead of resolving immediately — lets a test fire
// handleAddRaces/handleRemove while the seed effect's own refetchEventDetail() is still in flight,
// reproducing the exact ordering the fix closes.
let deferEventDetailFetch = false;
let pendingEventDetailResolve: ((value: EventDetailDto) => void) | null = null;
// #975: lets a single test force the seed effect's `await refetchEventDetail()` to reject, so it
// can be proven the effect swallows a hypothetical rejection rather than letting it become an
// unhandled promise rejection. The real refetch() (useEvents.ts's useEventDetail, plain
// react-query with no throwOnError) never actually rejects — this flag is the only way to exercise
// that path at all. Left false, every other describe block below gets the real hook back
// unchanged.
let rejectNextEventDetailRefetch = false;

vi.mock('../hooks/useEvents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useEvents')>();
  return {
    ...actual,
    useEventDetail: (slug: string) => {
      const result = actual.useEventDetail(slug);
      if (rejectNextEventDetailRefetch) {
        rejectNextEventDetailRefetch = false;
        return { ...result, refetch: () => Promise.reject(new Error('simulated refetch rejection (#975)')) };
      }
      return result;
    },
  };
});

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn((endpoint: string, options?: { method?: string; body?: string }) => {
    if (endpoint === '/api/v1/admin/events') return Promise.resolve([]);
    if (endpoint.startsWith('/api/v1/admin/trails')) return Promise.resolve(mockTrails);
    if (endpoint === `/api/v1/admin/events/${EVENT_SLUG}`) {
      eventDetailFetches += 1;
      if (deferEventDetailFetch) {
        deferEventDetailFetch = false;
        return new Promise<EventDetailDto>(resolve => { pendingEventDetailResolve = resolve; });
      }
      return Promise.resolve(makeDetail(currentRaces));
    }
    if (options?.method === 'POST' && endpoint === `/api/v1/admin/editions/${EDITION_ID}/races`) {
      const body = JSON.parse(options.body ?? '{}') as { sortOrder: number };
      capturedSortOrders.push(body.sortOrder);
      nextRaceId += 1;
      return Promise.resolve({ id: `race-${nextRaceId}` });
    }
    if (options?.method === 'DELETE' && endpoint.startsWith('/api/v1/admin/races/')) {
      return Promise.resolve({});
    }
    return Promise.resolve([]);
  }),
}));

function renderRacesStep(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RacesStep
          onNotify={() => {}}
          eventSlug={EVENT_SLUG}
          editionId={EDITION_ID}
          editionStatus="Hidden"
          editionYear="2026"
          onBack={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RacesStep — added-races seed survives a fast Step 3 -> 2 -> 3 round trip', () => {
  afterEach(() => {
    cleanup();
    currentRaces = [];
    eventDetailFetches = 0;
    mockTrails = [];
    capturedSortOrders = [];
    nextRaceId = 0;
  });

  it('seeds from a forced refetch on remount, not from the (still within staleTime) cached detail', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = renderRacesStep(queryClient);

    await waitFor(() => expect(eventDetailFetches).toBeGreaterThan(0));
    expect(screen.queryByText('Added this session')).toBeNull();

    // Simulate the race having already been persisted server-side (a real "Add races" click, or —
    // as here — any other admin action) in the moments between the two mounts. react-query's own
    // cache for ['admin','event',EVENT_SLUG] is still well within its 30s staleTime at this point,
    // so a naive remount that only reads the cached `detail` reactively would still see the
    // now-outdated empty snapshot from mount #1 above.
    currentRaces = [makeRace('race-1', RACE_NAME, 0)];

    // Step 3 -> 2 -> 3: RacesStep unmounts, then remounts against the *same* QueryClient — a real
    // round trip shares the app's single QueryClient the same way.
    unmount();
    renderRacesStep(queryClient);

    await waitFor(() => expect(screen.getByText('Added this session')).toBeTruthy());
    expect(screen.getByText(RACE_NAME)).toBeTruthy();
  });
});

// #968: a narrower reappearance of #953/#962 (PR #967's round-1 review flagged it as still open).
// handleAddRaces sets seedingDoneRef.current = true *synchronously*, before any network call of its
// own starts — so clicking "Add races" quickly enough after a Step 3 -> 2 -> 3 remount, before the
// seed effect's own `await refetchEventDetail()` resolves, makes the effect's post-await
// `seedingDoneRef.current` check see true and bail out, silently dropping its seed. Both
// addedRaces (stays []) and nextSortOrderRef (stays at its initial 0) are then left unseeded for
// the rest of the mount. Against the fix (handleAddRaces awaiting the seed effect's own in-flight
// promise first), this test passes; reverting that await makes it fail exactly as described above —
// Trail A disappears from "Added this session" and Trail B's sortOrder collides with Trail A's.
describe('RacesStep — fast Add races cannot race ahead of an in-flight seed fetch (#968)', () => {
  afterEach(() => {
    cleanup();
    currentRaces = [];
    eventDetailFetches = 0;
    mockTrails = [];
    capturedSortOrders = [];
    nextRaceId = 0;
    deferEventDetailFetch = false;
    pendingEventDetailResolve = null;
  });

  // Same Autocomplete-driving helpers as the #962 describe block below — duplicated locally rather
  // than hoisted, since they're small and each describe block already owns its own repro sequence.
  function selectTrail(name: string) {
    const input = screen.getByRole('combobox', { name: 'Search trails to add' });
    fireEvent.change(input, { target: { value: name } });
    const option = screen.getAllByRole('option').find(o => o.textContent?.includes(name));
    if (!option) throw new Error(`Trail option not found in Autocomplete: ${name}`);
    fireEvent.click(option);
    fireEvent.change(input, { target: { value: '' } });
  }

  function clickAddRaces() {
    fireEvent.click(screen.getByRole('button', { name: /^Add \d+ race/ }));
  }

  it('still shows an earlier mount\'s race and avoids a sortOrder collision when Add races fires before the remount\'s seed fetch resolves', async () => {
    mockTrails = [makeTrail('trail-a', 'Trail A'), makeTrail('trail-b', 'Trail B')];
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = renderRacesStep(queryClient);
    await waitFor(() => expect(eventDetailFetches).toBeGreaterThan(0));

    // Trail A was added and persisted in an earlier mount of this step, at sortOrder 0.
    currentRaces = [makeRace('race-a', 'Trail A', 0)];

    // Step 3 -> 2 -> 3: unmount, then remount — deferring the remount's own seed refetch so it
    // doesn't resolve until this test explicitly lets it below.
    unmount();
    deferEventDetailFetch = true;
    renderRacesStep(queryClient);

    // Fire "Add races" for a second trail *before* the deferred refetch above has resolved — the
    // exact #968 repro. Without the fix, seedingDoneRef flips true here, synchronously, before the
    // seed effect's own post-await check ever runs.
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Search trails to add' })).toBeTruthy());
    selectTrail('Trail B');
    clickAddRaces();

    // Only now let the deferred seed fetch resolve, with handleAddRaces already in flight above.
    await waitFor(() => expect(pendingEventDetailResolve).not.toBeNull());
    pendingEventDetailResolve?.(makeDetail(currentRaces));

    await waitFor(() => expect(screen.getByLabelText('Remove Trail B')).toBeTruthy());

    // (a) Trail A, added in the earlier mount, must still be shown in "Added this session".
    expect(screen.getByText('Trail A')).toBeTruthy();
    // (b) Trail B's sortOrder must not collide with Trail A's already-persisted sortOrder 0.
    expect(capturedSortOrders).toEqual([1]);
  });
});

// #968 round 2 (PR #974 review): the round-1 fix above had handleAddRaces await
// seedInFlightRef.current *before* calling setAdding(true), so "Add races" stayed enabled for the
// whole await. Two clicks in quick succession while a seed fetch is in flight — exactly this
// issue's own scenario, right after a Step 3 -> 2 -> 3 remount — would both close over the same
// selectedTrails, both await the same seedInFlightRef.current promise, and both go on to createRace
// the same trail once it resolved: a real double-submit producing a duplicate persisted race (no
// (editionId, trailId) uniqueness constraint on Race catches this at the database level). Against
// the fix (setAdding(true) — and the `|| adding` guard — running before the seed await), the second
// click is a no-op and only one race is created; reverting that ordering makes this test fail with
// two captured sortOrders for the same trail.
describe('RacesStep — double-clicking Add races while a seed fetch is in flight does not double-submit (#968 round 2)', () => {
  afterEach(() => {
    cleanup();
    currentRaces = [];
    eventDetailFetches = 0;
    mockTrails = [];
    capturedSortOrders = [];
    nextRaceId = 0;
    deferEventDetailFetch = false;
    pendingEventDetailResolve = null;
  });

  function selectTrail(name: string) {
    const input = screen.getByRole('combobox', { name: 'Search trails to add' });
    fireEvent.change(input, { target: { value: name } });
    const option = screen.getAllByRole('option').find(o => o.textContent?.includes(name));
    if (!option) throw new Error(`Trail option not found in Autocomplete: ${name}`);
    fireEvent.click(option);
    fireEvent.change(input, { target: { value: '' } });
  }

  it('creates only one race when Add races is clicked twice before the remount\'s seed fetch resolves', async () => {
    mockTrails = [makeTrail('trail-a', 'Trail A')];
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = renderRacesStep(queryClient);
    await waitFor(() => expect(eventDetailFetches).toBeGreaterThan(0));

    // Step 3 -> 2 -> 3: unmount, then remount — deferring the remount's own seed refetch exactly
    // as the round-1 test above does, so it doesn't resolve until this test explicitly lets it.
    unmount();
    deferEventDetailFetch = true;
    renderRacesStep(queryClient);

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Search trails to add' })).toBeTruthy());
    selectTrail('Trail A');

    // Grab the button once by its pre-click accessible name ("Add 1 race") rather than re-querying
    // by role/name for the second click — the fix makes the button swap to a bare CircularProgress
    // (no accessible name) the instant the first click's setAdding(true) is flushed, so a second
    // getByRole(..., { name: /^Add/ }) would no longer find it at all. Clicking the same element
    // reference twice instead reproduces a real user's fast double-click on one physical button.
    const addButton = screen.getByRole('button', { name: /^Add \d+ race/ });

    // Two rapid clicks while the seed fetch above is still pending. Each fireEvent.click is
    // act()-flushed before the next one fires, so this reproduces a real user's fast double-click:
    // the first click's setAdding(true) — running before the seed await, per the fix — disables the
    // button before the second click lands, and the `|| adding` guard covers the case where the
    // click still reaches the handler regardless.
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    // Only now let the deferred seed fetch resolve, with both clicks already dispatched above.
    await waitFor(() => expect(pendingEventDetailResolve).not.toBeNull());
    pendingEventDetailResolve?.(makeDetail(currentRaces));

    await waitFor(() => expect(screen.getByLabelText('Remove Trail A')).toBeTruthy());

    // Exactly one race created for Trail A — not two.
    expect(capturedSortOrders).toEqual([0]);
  });
});

// #975: PR #974's review flagged that the seed effect's `void seedPromise.finally(...)` doesn't
// catch a hypothetical rejection — .finally() re-throws after running rather than swallowing, so a
// rejected refetchEventDetail() would surface as an unhandled promise rejection, and would also
// leave seedInFlightRef pointing at a rejected promise for any handleAddRaces/handleRemove call
// still to come this mount. refetchEventDetail() never actually rejects today (useEventDetail is a
// plain react-query useQuery with no throwOnError) — this is a hardening test against that latent
// gap, not a currently-reachable bug, forcing the rejection via the '../hooks/useEvents' mock above
// since nothing in real usage can trigger it.
describe('RacesStep — a rejected seed refetch does not become an unhandled rejection (#975)', () => {
  afterEach(() => {
    cleanup();
    currentRaces = [];
    eventDetailFetches = 0;
    mockTrails = [];
    capturedSortOrders = [];
    nextRaceId = 0;
    rejectNextEventDetailRefetch = false;
  });

  // Same Autocomplete-driving helpers as the describe blocks above.
  function selectTrail(name: string) {
    const input = screen.getByRole('combobox', { name: 'Search trails to add' });
    fireEvent.change(input, { target: { value: name } });
    const option = screen.getAllByRole('option').find(o => o.textContent?.includes(name));
    if (!option) throw new Error(`Trail option not found in Autocomplete: ${name}`);
    fireEvent.click(option);
    fireEvent.change(input, { target: { value: '' } });
  }

  function clickAddRaces() {
    fireEvent.click(screen.getByRole('button', { name: /^Add \d+ race/ }));
  }

  it('swallows the rejection (no unhandled promise rejection) and still lets a subsequent Add races proceed normally', async () => {
    // Verified against a reverted fix: jsdom (this file runs under `@vitest-environment jsdom`)
    // does not actually re-dispatch Node's unhandled-rejection tracking as a window event in this
    // Vitest setup — `process.on('unhandledRejection', ...)` is what genuinely fires (it's also
    // what makes Vitest itself report an "Unhandled Rejection" and fail the run when this fix is
    // reverted), so that's what this test listens on instead.
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => { unhandledRejections.push(reason); };
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      mockTrails = [makeTrail('trail-a', 'Trail A')];
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      rejectNextEventDetailRefetch = true;
      renderRacesStep(queryClient);

      await waitFor(() => expect(eventDetailFetches).toBeGreaterThan(0));
      await waitFor(() => expect(screen.getByRole('combobox', { name: 'Search trails to add' })).toBeTruthy());

      // If seedInFlightRef were left pointing at the rejected promise instead of being cleared back
      // to null (the #975 concern), this `await seedInFlightRef.current` inside handleAddRaces would
      // itself throw — uncaught, since handleAddRaces has no catch around that await — surfacing as
      // a second unhandled rejection and leaving Trail A never created below.
      selectTrail('Trail A');
      clickAddRaces();

      await waitFor(() => expect(screen.getByLabelText('Remove Trail A')).toBeTruthy());
      expect(capturedSortOrders).toEqual([0]);

      // addedRaces/nextSortOrderRef stayed at their pre-seed defaults (nothing to seed from a
      // rejected refetch) — Trail A above got sortOrder 0, not some value inherited from a seed
      // that couldn't have happened.
      //
      // A plain assertion here would trivially pass even against a reverted fix, since
      // 'unhandledrejection' fires asynchronously (after the microtask queue drains) — this needs
      // an explicit tick for that event to actually have a chance to arrive before asserting none
      // did.
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });
});

// #962: PR #961's body flagged this as a known, unfixed edge case while #953 was being fixed —
// handleAddRaces derived each new race's sortOrder from addedRaces.length, but handleRemove
// shortens addedRaces by filtering it locally without renumbering anything server-side, so a
// remove-then-re-add in the same uninterrupted session (no Step 3 -> 2 -> 3 remount, so the seed
// effect above never re-fires) reused a smaller length as the next base offset and collided with a
// race added earlier in the same session. Repro: add A, B (sortOrder 0, 1) -> remove A
// (addedRaces.length now 1, but B is still persisted at sortOrder 1) -> add C -> C got
// sortOrder = 1 + 0 = 1, colliding with B.
describe('RacesStep — sortOrder after a remove-then-re-add in the same session (#962)', () => {
  afterEach(() => {
    cleanup();
    currentRaces = [];
    eventDetailFetches = 0;
    mockTrails = [];
    capturedSortOrders = [];
    nextRaceId = 0;
  });

  // Opens the trail Autocomplete's dropdown and clicks the option matching `name` — options keep
  // the role="option" MUI's useAutocomplete assigns even though RacesStep customizes renderOption
  // (the props spread onto the custom Box below still carries it), so this is a stable handle
  // regardless of the extra checkbox/km-label markup inside each option.
  function selectTrail(name: string) {
    const input = screen.getByRole('combobox', { name: 'Search trails to add' });
    // Typing (rather than mouseDown) reliably reopens the popup on every call — after the first
    // selection MUI resets the Autocomplete's inputValue back to '' for a multiple-select, and a
    // bare mouseDown on the now-blurred input doesn't reopen it the way an actual value change does.
    fireEvent.change(input, { target: { value: name } });
    const option = screen.getAllByRole('option').find(o => o.textContent?.includes(name));
    if (!option) throw new Error(`Trail option not found in Autocomplete: ${name}`);
    fireEvent.click(option);
    fireEvent.change(input, { target: { value: '' } });
  }

  function clickAddRaces() {
    fireEvent.click(screen.getByRole('button', { name: /^Add \d+ race/ }));
  }

  it('does not reuse a still-persisted sortOrder after removing an earlier race this session', async () => {
    // Explicit timeout: this drives three full add/remove round trips through the real Autocomplete
    // and IconButton, each awaiting its own network mock + refresh() — comfortably under the
    // default 5s in isolation, but tight once the whole suite's import/transform overhead is
    // added in (as seen when this file runs alongside the others).
    mockTrails = [makeTrail('trail-a', 'Trail A'), makeTrail('trail-b', 'Trail B'), makeTrail('trail-c', 'Trail C')];
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderRacesStep(queryClient);
    await waitFor(() => expect(eventDetailFetches).toBeGreaterThan(0));

    // Add A, then B, each in its own "Add races" click — mirrors the #962 repro exactly.
    selectTrail('Trail A');
    clickAddRaces();
    await waitFor(() => expect(screen.getByLabelText('Remove Trail A')).toBeTruthy());

    selectTrail('Trail B');
    clickAddRaces();
    await waitFor(() => expect(screen.getByLabelText('Remove Trail B')).toBeTruthy());

    // Acceptance criterion #2: a fresh batch with no removal yet is still gap-free and collision-free.
    expect(capturedSortOrders).toEqual([0, 1]);

    // Remove A — addedRaces.length drops from 2 to 1, but B is still persisted server-side at
    // sortOrder 1. Before the #962 fix, the next add below would rebase off that shrunk length.
    fireEvent.click(screen.getByLabelText('Remove Trail A'));
    await waitFor(() => expect(screen.queryByLabelText('Remove Trail A')).toBeNull());

    selectTrail('Trail C');
    clickAddRaces();
    await waitFor(() => expect(screen.getByLabelText('Remove Trail C')).toBeTruthy());

    // The regression: C must land on sortOrder 2, not collide with B's still-persisted 1.
    expect(capturedSortOrders).toEqual([0, 1, 2]);
    expect(new Set(capturedSortOrders).size).toBe(capturedSortOrders.length);
  }, 15000);
});

// #956: eventForms.test.ts unit-tests titleSyncForYear/editionStatusForYear/shouldNudgeStatusForYear
// in isolation, but its own header comment flags that the "don't re-fire once manually overridden"
// gating "lives alongside [the] form state (a ref) and isn't unit-testable at this layer." These
// tests mount EditionDetailsStep itself and drive its real Year TextField/Status/Registration
// status Selects, to prove the onChange handler actually wires those three pure helpers together
// with statusManuallySetRef correctly — not just that the helpers are individually correct.
interface HarnessEditionForm {
  year: string;
  date: string;
  endDate: string;
  title: string;
  titleEn: string;
  status: EditionStatus;
  registrationStatus: RegistrationStatus;
  registrationOpens: string;
  registrationCloses: string;
  registrationUrl: string;
  resultsUrl: string;
  notes: string;
  notesEn: string;
}

function emptyHarnessForm(): HarnessEditionForm {
  return {
    year: '', date: '', endDate: '', title: '', titleEn: '',
    status: 'Hidden', registrationStatus: 'NotStarted',
    registrationOpens: '', registrationCloses: '',
    registrationUrl: '', resultsUrl: '', notes: '', notesEn: '',
  };
}

// Owns form/setForm (and, per #957, statusManuallySetRef) itself rather than lifting them the way
// EventWizardPage's own default export does for its real Step 1/2/3 — EditionDetailsStep's props
// only require a controlled form/setter plus that ref, so a small harness reproducing that contract
// is enough to exercise the real onChange without having to drive Step 1 first just to reach Step 2.
function EditionDetailsStepHarness({ editionId }: { editionId?: string }) {
  const [form, setForm] = useState<HarnessEditionForm>(emptyHarnessForm());
  const statusManuallySetRef = useRef(false);
  return (
    <EditionDetailsStep
      onNotify={() => {}}
      eventId="event-1"
      eventSlug={EVENT_SLUG}
      form={form}
      setForm={setForm}
      onBack={() => {}}
      onCreated={() => {}}
      editionId={editionId}
      statusManuallySetRef={statusManuallySetRef}
    />
  );
}

function renderEditionDetailsStep(editionId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <BilingualLangProvider>
            <EditionDetailsStepHarness editionId={editionId} />
          </BilingualLangProvider>
        </LocalizationProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// #966: a sibling harness for the "does not clobber ... across an unmount/remount" test below —
// EditionDetailsStepHarness above deliberately owns form/statusManuallySetRef *inside* itself, so a
// fresh render() of it can never reuse the same ref (or form) object across an unmount, by
// construction. The real production parent (EventWizardPage) is different: it owns editionForm and
// statusManuallySetRef itself (EventWizardPage.tsx:831,836) and never unmounts across the
// Step2 -> Back -> Step1 -> Step2 round trip — only the child EditionDetailsStep does, gated by
// `activeStep === 1 && createdEvent && <EditionDetailsStep .../>`. This harness reproduces that
// shape: a wrapper that owns form/ref itself and never unmounts, toggling only whether the child
// beneath it is mounted — exactly the persistent-parent / remounting-child split #957 relies on.
function EditionDetailsRoundTripHarness({ mounted }: { mounted: boolean }) {
  const [form, setForm] = useState<HarnessEditionForm>(emptyHarnessForm());
  const statusManuallySetRef = useRef(false);
  return mounted ? (
    <EditionDetailsStep
      onNotify={() => {}}
      eventId="event-1"
      eventSlug={EVENT_SLUG}
      form={form}
      setForm={setForm}
      onBack={() => {}}
      onCreated={() => {}}
      statusManuallySetRef={statusManuallySetRef}
    />
  ) : null;
}

function roundTripHarnessTree(queryClient: QueryClient, mounted: boolean) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <BilingualLangProvider>
            <EditionDetailsRoundTripHarness mounted={mounted} />
          </BilingualLangProvider>
        </LocalizationProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Toggles the child's mounted state via RTL's rerender() rather than unmount()+render() — rerender()
// keeps EditionDetailsRoundTripHarness itself as the same live component instance across the toggle
// (same position in the tree, same type, so React reconciles rather than tearing it down), exactly
// like EventWizardPage never unmounting across a real Step2 -> Back -> Step1 -> Step2 round trip.
// unmount()+render() would instead destroy and recreate the wrapper too, defeating the point — its
// own form/statusManuallySetRef would reset right along with the child's, and the test would no
// longer be distinguishing "ref survives because it's parent-owned" from "ref survives because
// nothing actually unmounted at all".
function renderRoundTripHarness(queryClient: QueryClient) {
  return render(roundTripHarnessTree(queryClient, true));
}

// #964: Status and Registration status are each wired to their InputLabel via an explicit
// `labelId` prop (EventWizardPage.tsx), so getByLabelText finds them directly — no more relying on
// DOM order via getAllByRole('combobox')[n], which broke if the fields were ever reordered. The
// `[role="combobox"]` selector disambiguates from a still-open (mid-exit-transition) MUI Menu
// listbox that shares the same aria-labelledby as its Select — jsdom never fires the transitionend
// that would otherwise unmount it, so one lingers in the DOM after chooseMenuOption below.
function getStatusCombobox() {
  return screen.getByLabelText('Status', { selector: '[role="combobox"]' });
}
function getRegistrationStatusCombobox() {
  return screen.getByLabelText('Registration status', { selector: '[role="combobox"]' });
}

function chooseMenuOption(combobox: HTMLElement, optionText: string) {
  fireEvent.mouseDown(combobox);
  const listbox = screen.getByRole('listbox');
  fireEvent.click(within(listbox).getByText(optionText));
}

describe('EditionDetailsStep — Year field wiring', () => {
  afterEach(cleanup);

  it('auto-fills Title/TitleEn from the Year field while Title is still empty', () => {
    renderEditionDetailsStep();
    const futureYear = String(new Date().getFullYear() + 5);

    fireEvent.change(screen.getByLabelText('Year'), { target: { value: futureYear } });

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe(futureYear);

    // Title/TitleEn are the same BilingualTextField toggled by the shared IS/EN chip — switch to
    // EN to prove titleEn was synced too, not just the currently-visible IS field.
    fireEvent.click(screen.getAllByText('EN')[0]);
    expect((screen.getByLabelText('Title (EN)') as HTMLInputElement).value).toBe(futureYear);
  });

  it('nudges Status/Registration status into the completed bucket for a past year on a first (non-edit) visit', () => {
    renderEditionDetailsStep(); // no editionId -> isEdit === false
    const pastYear = String(new Date().getFullYear() - 5);

    fireEvent.change(screen.getByLabelText('Year'), { target: { value: pastYear } });

    expect(getStatusCombobox().textContent).toBe(EDITION_STATUS_LABELS.Completed);
    expect(getRegistrationStatusCombobox().textContent).toBe('Closed');
  });

  it('does not clobber a manually-set Status when Year is edited again afterwards', () => {
    renderEditionDetailsStep();
    chooseMenuOption(getStatusCombobox(), EDITION_STATUS_LABELS.Active);
    expect(getStatusCombobox().textContent).toBe(EDITION_STATUS_LABELS.Active);

    const pastYear = String(new Date().getFullYear() - 5);
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: pastYear } });

    // Both nudged fields are gated by the same statusManuallySetRef, so a manual Status change
    // must also keep Registration status at its untouched initial value, not just Status itself.
    expect(getStatusCombobox().textContent).toBe(EDITION_STATUS_LABELS.Active);
    expect(getRegistrationStatusCombobox().textContent).toBe('NotStarted');
  });

  it('does not clobber a manually-set Registration status when Year is edited again afterwards', () => {
    renderEditionDetailsStep();
    chooseMenuOption(getRegistrationStatusCombobox(), 'Open');
    expect(getRegistrationStatusCombobox().textContent).toBe('Open');

    const pastYear = String(new Date().getFullYear() - 5);
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: pastYear } });

    expect(getRegistrationStatusCombobox().textContent).toBe('Open');
    expect(getStatusCombobox().textContent).toBe(EDITION_STATUS_LABELS.Hidden);
  });

  // #966: the two "does not clobber" tests above only ever exercise statusManuallySetRef within a
  // single mount, so they'd keep passing even if #957's fix were reverted to a component-local
  // useRef(false) inside EditionDetailsStep — that local ref still survives *within* one mount, it
  // just forgets everything the instant the component actually unmounts. This test reproduces the
  // real Step2 -> Back -> Step1 -> Step2 round trip via EditionDetailsRoundTripHarness above:
  // EditionDetailsStep genuinely unmounts (mirroring the real page's
  // `activeStep === 1 && createdEvent && <EditionDetailsStep .../>` gate) and then remounts, with
  // the wrapper's own statusManuallySetRef object — never recreated, since the wrapper itself never
  // unmounts — handed back in unchanged. Against a reverted, component-local ref this fails because
  // the fresh child instance's own useRef(false) can't possibly remember the earlier manual choice;
  // against the checked-in #957 fix it passes because the same ref object threads across the
  // remount exactly as EventWizardPage's real parent does.
  it('does not clobber a manually-set Status across an unmount/remount that reuses the same statusManuallySetRef', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = renderRoundTripHarness(queryClient);

    chooseMenuOption(getStatusCombobox(), EDITION_STATUS_LABELS.Active);
    expect(getStatusCombobox().textContent).toBe(EDITION_STATUS_LABELS.Active);

    // Step2 -> Back -> Step1: only the child EditionDetailsStep unmounts here (mounted={false}) —
    // EditionDetailsRoundTripHarness stays mounted throughout, so its statusManuallySetRef (and
    // form) survive exactly as EventWizardPage's own would across the real round trip.
    rerender(roundTripHarnessTree(queryClient, false));
    expect(screen.queryByLabelText('Year')).toBeNull();

    // Step1 -> Step2: a brand-new EditionDetailsStep instance, but the wrapper hands it back the
    // same statusManuallySetRef object it already held (and the same form state) — never a fresh one.
    rerender(roundTripHarnessTree(queryClient, true));

    const pastYear = String(new Date().getFullYear() - 5);
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: pastYear } });

    // The manual choice from before the unmount must still be honored — the nudge logic on this
    // remounted instance must not overwrite it back to the year-derived default.
    expect(getStatusCombobox().textContent).toBe(EDITION_STATUS_LABELS.Active);
    expect(getRegistrationStatusCombobox().textContent).toBe('NotStarted');
  });
});

// #977: PR #976 (closing #970) gave Step 1's Type/Activity/Status Selects the same explicit
// labelId wiring #964 gave EditionDetailsStep's Status/Registration status further up this file —
// but only the latter ever got a regression test. These mount EventDetailsStep (Step 1) directly
// and drive its three Selects via getByLabelText, the same pattern as getStatusCombobox/
// getRegistrationStatusCombobox above, so a future accidental removal of labelId/id here is
// caught the same way it already would be for Step 2.
interface HarnessEventForm {
  name: string;
  nameEn: string;
  slug: string;
  type: EventType;
  activityType: ActivityType;
  status: EventStatus;
}

function emptyHarnessEventForm(): HarnessEventForm {
  return { name: '', nameEn: '', slug: '', type: 'Race', activityType: 'TrailRunning', status: 'Hidden' };
}

// Owns form/setForm itself, same reasoning as EditionDetailsStepHarness above — EventDetailsStep's
// props only require a controlled form/setter, so a small harness is enough to exercise the real
// onChange without going through EventWizardPage's default export.
function EventDetailsStepHarness() {
  const [form, setForm] = useState<HarnessEventForm>(emptyHarnessEventForm());
  return (
    <EventDetailsStep
      onNotify={() => {}}
      form={form}
      setForm={setForm}
      onCreated={() => {}}
    />
  );
}

function renderEventDetailsStep() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BilingualLangProvider>
          <EventDetailsStepHarness />
        </BilingualLangProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Type/Status render plain-text MenuItems, but Activity prefixes each with an emoji icon
// (ACTIVITY_ICONS in EventWizardPage.tsx) — the option's accessible text is the icon and the type
// name together, so chooseMenuOption below is called with that full text, not just the type name.
function getTypeCombobox() {
  return screen.getByLabelText('Type', { selector: '[role="combobox"]' });
}
function getActivityCombobox() {
  return screen.getByLabelText('Activity', { selector: '[role="combobox"]' });
}

describe('EventDetailsStep — Type/Activity/Status Selects are reachable via getByLabelText (#977)', () => {
  afterEach(cleanup);

  it('locates Type, Activity, and Status by label and changes Type', () => {
    renderEventDetailsStep();

    expect(getTypeCombobox().textContent).toBe('Race');
    expect(getActivityCombobox().textContent).toBe('🏃‍♂️ TrailRunning');
    expect(getStatusCombobox().textContent).toBe('Draft — hidden from all');

    chooseMenuOption(getTypeCombobox(), 'Series');
    expect(getTypeCombobox().textContent).toBe('Series');
  });

  it('changes Activity via the Select reachable by its label', () => {
    renderEventDetailsStep();

    chooseMenuOption(getActivityCombobox(), '🚴 Cycling');
    expect(getActivityCombobox().textContent).toBe('🚴 Cycling');
  });

  it('changes Status via the Select reachable by its label', () => {
    renderEventDetailsStep();

    chooseMenuOption(getStatusCombobox(), 'Confirmed');
    expect(getStatusCombobox().textContent).toBe('Confirmed');
  });
});
