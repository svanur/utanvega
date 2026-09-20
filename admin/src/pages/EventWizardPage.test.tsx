// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { EditionDetailsStep, RacesStep } from './EventWizardPage';
import { BilingualLangProvider } from '../contexts/BilingualLangContext';
import { EDITION_STATUS_LABELS } from '../utils/eventForms';
import type { EditionStatus, EventDetailDto, RaceDto, RegistrationStatus } from '../hooks/useEvents';
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

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn((endpoint: string, options?: { method?: string; body?: string }) => {
    if (endpoint === '/api/v1/admin/events') return Promise.resolve([]);
    if (endpoint.startsWith('/api/v1/admin/trails')) return Promise.resolve(mockTrails);
    if (endpoint === `/api/v1/admin/events/${EVENT_SLUG}`) {
      eventDetailFetches += 1;
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
});
