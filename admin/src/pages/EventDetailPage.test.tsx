// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import EventDetailPage, { EditionDialogInner } from './EventDetailPage';
import { BilingualLangProvider } from '../contexts/BilingualLangContext';
import { EDITION_STATUS_LABELS } from '../utils/eventForms';
import { EVENTS_QUERY_KEY, type EventDetailDto, type EventEditionDto, type EventType, type RaceDto } from '../hooks/useEvents';
import { apiFetch } from '../hooks/api';

// #977: PR #976 (closing #970) gave EditionDialogInner's Status/Registration status Selects
// explicit labelId/id wiring so each has an accessible name reachable via getByLabelText — mirrors
// #964's fix for EventWizardPage's own EditionDetailsStep Status/Registration status Selects
// (EventWizardPage.test.tsx's getStatusCombobox/getRegistrationStatusCombobox), which already has
// a regression test. This file is the EventDetailPage half of that same follow-up: no test file
// existed for EventDetailPage at all before this.
//
// PhotoGalleryManager (rendered inside the dialog) pulls in usePhotographers, which fetches
// '/api/v1/admin/photographers' unconditionally on mount regardless of editionId — its own
// usePhotoGalleries call is gated on `enabled: !!editionId` and stays idle here (a brand-new,
// not-yet-created edition has editionId === null), but the photographers list is not, so the
// mock below still needs to answer that endpoint.
//
// #1024's describe block below (full EventDetailPage mount, not just EditionDialogInner) needs
// this same mock to also answer GET /api/v1/admin/events/:slug (useEventDetail) and PUT
// /api/v1/admin/editions/:id (handleCycleEditionStatus) with test-controlled data/success-vs-
// failure — mockState is declared via vi.hoisted so it's initialized before this vi.mock factory
// runs (vi.mock is hoisted above regular imports/consts, so a plain `const mockState = {...}`
// declared below it would still be undefined — a TDZ error — when the factory executes).
// Anything not matched (e.g. useTrails' GET /api/v1/admin/trails) falls through to the same
// Promise.resolve([]) the original, simpler mock always returned.
const mockState = vi.hoisted(() => ({
  eventDetail: null as EventDetailDto | null,
  editionPutShouldFail: false,
  editionDeleteShouldFail: false,
  editionCancelShouldFail: false,
  editionCompleteShouldFail: false,
  // #1627: records every PUT body sent to /api/v1/admin/editions/:id so the chip-handler tests
  // below can assert on exactly what was sent, not just on success/failure.
  editionPutBodies: [] as Record<string, unknown>[],
  // #1692: when true, the races PUT branch below never resolves — lets the drag-reorder
  // regression test assert while handleRaceDragEnd's own localRaceOrder override is still the
  // live source of the race order (its real await Promise.all(...)/refresh() round-trip would
  // otherwise race the assertions and intermittently resolve+clear it first), which is the exact
  // window #566/#1690's single-sourced getOrderedRaces matters for.
  raceReorderPutPending: false,
}));

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn((endpoint: string, options?: { method?: string; body?: string }) => {
    const method = options?.method ?? 'GET';
    if (method === 'GET' && /^\/api\/v1\/admin\/events\/[^/]+$/.test(endpoint)) {
      return Promise.resolve(mockState.eventDetail);
    }
    if (method === 'PUT' && /^\/api\/v1\/admin\/editions\/[^/]+$/.test(endpoint)) {
      if (typeof options?.body === 'string') {
        mockState.editionPutBodies.push(JSON.parse(options.body) as Record<string, unknown>);
      }
      return mockState.editionPutShouldFail
        ? Promise.reject(new Error('Failed to update edition status'))
        : Promise.resolve({});
    }
    // #1028: handleDeleteEdition/handleCancelEdition/handleCompleteEdition each hit their own
    // DELETE/POST endpoint — mirrors the PUT branch above's success-vs-failure toggle so each
    // handler's success and failure paths can be exercised independently.
    if (method === 'DELETE' && /^\/api\/v1\/admin\/editions\/[^/]+$/.test(endpoint)) {
      return mockState.editionDeleteShouldFail
        ? Promise.reject(new Error('Failed to delete edition'))
        : Promise.resolve({});
    }
    if (method === 'POST' && /^\/api\/v1\/admin\/editions\/[^/]+\/cancel$/.test(endpoint)) {
      return mockState.editionCancelShouldFail
        ? Promise.reject(new Error('Failed to cancel edition'))
        : Promise.resolve({});
    }
    if (method === 'POST' && /^\/api\/v1\/admin\/editions\/[^/]+\/complete$/.test(endpoint)) {
      return mockState.editionCompleteShouldFail
        ? Promise.reject(new Error('Failed to complete edition'))
        : Promise.resolve({});
    }
    // #1692: handleRaceDragEnd (EventDetailPage.tsx:1326) PUTs each reordered race's new
    // sortOrder, then calls refresh(). The drag-reorder regression test below sets
    // raceReorderPutPending so this never resolves — see that flag's own comment for why.
    if (method === 'PUT' && /^\/api\/v1\/admin\/races\/[^/]+$/.test(endpoint)) {
      if (mockState.raceReorderPutPending) return new Promise(() => { /* never resolves */ });
      return Promise.resolve({});
    }
    return Promise.resolve([]);
  }),
}));

// Mirrors EventWizardPage.test.tsx's renderEditionDetailsStep — a brand-new (isNew) edition is the
// simplest way to mount the dialog, since it needs no EventEditionDto fixture and none of the
// Status MenuItems are conditionally disabled (that only happens `!isNew`, see EditionDialogInner's
// own Status Select above).
//
// #1070: accepts an optional edition/eventType override so the Start/End date derived-and-disabled
// tests below can mount the same dialog against an *existing* Series edition instead.
function renderEditionDialog(overrides: { edition?: EventEditionDto; eventType?: EventType } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <BilingualLangProvider>
          <EditionDialogInner
            open
            edition={overrides.edition ?? null}
            eventType={overrides.eventType}
            eventId="event-1"
            onClose={() => {}}
            onSaved={() => {}}
            onGalleryMutated={() => {}}
            onNotify={() => {}}
            siblingEditions={[]}
          />
        </BilingualLangProvider>
      </LocalizationProvider>
    </QueryClientProvider>,
  );
}

// Same [role="combobox"] disambiguation as EventWizardPage.test.tsx's getStatusCombobox/
// getRegistrationStatusCombobox — jsdom never fires the transitionend that would otherwise unmount
// a just-closed MUI Menu listbox, so one can linger in the DOM sharing the same aria-labelledby as
// its Select after chooseMenuOption below.
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

describe('EditionDialogInner — Status/Registration status Selects are reachable via getByLabelText (#977)', () => {
  afterEach(cleanup);

  it('locates Status by label and changes it', () => {
    renderEditionDialog();

    expect(getStatusCombobox().textContent).toBe(EDITION_STATUS_LABELS.Hidden);

    chooseMenuOption(getStatusCombobox(), EDITION_STATUS_LABELS.Confirmed);
    expect(getStatusCombobox().textContent).toBe(EDITION_STATUS_LABELS.Confirmed);
  });

  it('locates Registration status by label and changes it', () => {
    renderEditionDialog();

    expect(getRegistrationStatusCombobox().textContent).toBe('NotStarted');

    chooseMenuOption(getRegistrationStatusCombobox(), 'Open');
    expect(getRegistrationStatusCombobox().textContent).toBe('Open');
  });
});

// #1070: a Series edition's Start/End date must stop being independently editable once it has at
// least one dated race — the backend (EditionStatusHelpers.ComputeEffectiveEditionDates) derives
// Date/EndDate live from those races on every read, so an admin-entered value here would just be
// silently overruled. Covers the dialog-level half of #1070; ComputeEffectiveEditionDates itself
// has its own xUnit coverage in backend.Tests/Services/EditionStatusHelpersTests.cs.
function buildRaceFixture(overrides: Partial<RaceDto> = {}): RaceDto {
  return {
    id: 'race-1',
    eventEditionId: 'edition-1',
    trailId: null,
    trailName: null,
    trailSlug: null,
    name: 'Leg 1',
    nameEn: null,
    distanceLabel: '10K',
    distanceLabelEn: null,
    cutoffMinutes: null,
    description: null,
    descriptionEn: null,
    status: 'Active',
    sortOrder: 0,
    ticketStatus: 'Available',
    resultType: 'Time',
    maxParticipants: null,
    itraPoints: null,
    certifiedBy: null,
    certifiedByEn: null,
    prizeMoney: 0,
    championshipCategory: null,
    championshipCategoryEn: null,
    dateOfRace: '2026-04-01',
    startTime: null,
    trailDistanceMeters: null,
    trailElevationGain: null,
    activityType: null,
    registrationOpensMinutesBeforeRace: null,
    ...overrides,
  };
}

function getStartDateInput() {
  return screen.getByLabelText('Start date') as HTMLInputElement;
}
function getEndDateInput() {
  return screen.getByLabelText('End date (multi-day)') as HTMLInputElement;
}

describe('EditionDialogInner — Start/End date disabled and derived for a Series edition with dated races (#1070)', () => {
  afterEach(cleanup);

  it('stays editable for a brand-new Series edition with no races yet', () => {
    renderEditionDialog({ eventType: 'Series' });

    expect(getStartDateInput().disabled).toBe(false);
    expect(getEndDateInput().disabled).toBe(false);
  });

  it('stays editable for a non-Series edition even with races, as a regression guard', () => {
    const edition = buildEditionFixture({
      races: [buildRaceFixture({ dateOfRace: '2026-04-01' }), buildRaceFixture({ id: 'race-2', dateOfRace: '2026-08-20' })],
    });
    renderEditionDialog({ edition, eventType: 'Race' });

    expect(getStartDateInput().disabled).toBe(false);
    expect(getEndDateInput().disabled).toBe(false);
  });

  it('falls back to editable for an existing Series edition with zero dated races (chicken-and-egg case)', () => {
    const edition = buildEditionFixture({ races: [] });
    renderEditionDialog({ edition, eventType: 'Series' });

    expect(getStartDateInput().disabled).toBe(false);
    expect(getEndDateInput().disabled).toBe(false);
  });

  it('disables Start/End date and shows the min/max of the races as the derived value', () => {
    const edition = buildEditionFixture({
      date: '2026-01-01',
      endDate: '2026-01-02',
      races: [
        buildRaceFixture({ id: 'race-1', dateOfRace: '2026-06-15' }),
        buildRaceFixture({ id: 'race-2', dateOfRace: '2026-04-01' }),
        buildRaceFixture({ id: 'race-3', dateOfRace: '2026-08-20' }),
      ],
    });
    renderEditionDialog({ edition, eventType: 'Series' });

    expect(getStartDateInput().disabled).toBe(true);
    expect(getEndDateInput().disabled).toBe(true);
    // Derived min/max of the three races' dateOfRace above (2026-06-15/2026-04-01/2026-08-20),
    // not the edition's stale stored date/endDate (2026-01-01/2026-01-02) seeded above.
    expect(getStartDateInput().value).toBe('04/01/2026');
    expect(getEndDateInput().value).toBe('08/20/2026');
  });
});

// #1571: the #1569 Registration-section fallback note (Series editions only) states how many of
// the edition's races have their own "Registration opens" offset set
// (registrationOpensMinutesBeforeRace !== null on RaceDto), rather than only describing the
// fallback relationship in the abstract. The count is derived straight from edition.races, which
// is already loaded for this dialog — no extra fetch. #1579: the note also states the total race
// count (the denominator), not just the numerator, so "N of M" is fully explicit.
function getRegistrationFallbackNote() {
  // Not an exact-string match: the counts sit between literal text fragments inside the same
  // FormHelperText, so RTL's getByText normalizer concatenates them into one text node, but a
  // regex still reads more intention-revealing here than the full literal string would.
  return screen.getByText(/races have their own offset set\./);
}

describe('EditionDialogInner — Registration fallback note counts races with their own offset (#1571, #1579)', () => {
  afterEach(cleanup);

  it('states a non-zero count out of the total when at least one race has its own offset set', () => {
    const edition = buildEditionFixture({
      races: [
        buildRaceFixture({ id: 'race-1', registrationOpensMinutesBeforeRace: 1440 }),
        buildRaceFixture({ id: 'race-2', registrationOpensMinutesBeforeRace: null }),
      ],
    });
    renderEditionDialog({ edition, eventType: 'Series' });

    expect(getRegistrationFallbackNote().textContent).toContain('1 of 2');
  });

  it('states "0 of" the total rather than a blank or stale note when no race has its own offset set', () => {
    const edition = buildEditionFixture({
      races: [
        buildRaceFixture({ id: 'race-1', registrationOpensMinutesBeforeRace: null }),
        buildRaceFixture({ id: 'race-2', registrationOpensMinutesBeforeRace: null }),
      ],
    });
    renderEditionDialog({ edition, eventType: 'Series' });

    expect(getRegistrationFallbackNote().textContent).toContain('0 of 2');
  });

  it('renders "0 of 0" without throwing for a brand-new (isNew, edition === null) Series edition', () => {
    renderEditionDialog({ eventType: 'Series' });

    expect(getRegistrationFallbackNote().textContent).toContain('0 of 0');
  });
});

// #1365: the issue owner's decision — events are scheduled start-first, so End date with no
// Start date isn't a real scheduling pattern. Blocks Save client-side rather than letting a
// 400 from CreateEditionCommandValidator/UpdateEditionCommandValidator surface after submit.
function getSaveButton() {
  return screen.getByRole('button', { name: /add edition|save edition/i }) as HTMLButtonElement;
}

describe('EditionDialogInner — Start date required once End date is set (#1365)', () => {
  afterEach(cleanup);

  it('disables Save and shows an inline error once End date is set with no Start date', () => {
    renderEditionDialog();

    expect(getSaveButton().disabled).toBe(false);

    fireEvent.change(getEndDateInput(), { target: { value: '08/01/2026' } });

    expect(getSaveButton().disabled).toBe(true);
    expect(screen.getByText('Start date is required when an End date is set.')).not.toBe(null);
  });

  it('re-enables Save once Start date is filled in', () => {
    renderEditionDialog();

    fireEvent.change(getEndDateInput(), { target: { value: '08/01/2026' } });
    expect(getSaveButton().disabled).toBe(true);

    fireEvent.change(getStartDateInput(), { target: { value: '07/01/2026' } });

    expect(getSaveButton().disabled).toBe(false);
    expect(screen.queryByText('Start date is required when an End date is set.')).toBe(null);
  });
});

// #1071 review fix: RegistrationOpens/Closes come back from the GET DTO as Kind=Utc (Z-suffixed)
// via EditionStatusHelpers.AsUtc's relabel-not-convert contract. Parsing that with plain dayjs(...)
// would read the literal digits back through the browser's own local timezone, shifting the
// displayed time for any admin not sitting at UTC+0. Force a non-UTC TZ here so the regression
// actually exercises that class of bug rather than passing by accident in a UTC CI runner.
function getRegistrationOpensInput() {
  return screen.getByLabelText('Registration opens') as HTMLInputElement;
}
function getRegistrationClosesInput() {
  return screen.getByLabelText('Registration closes') as HTMLInputElement;
}

describe('EditionDialogInner — Registration opens/closes round-trip a stored instant without timezone drift (#1071)', () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    // America/New_York (UTC-5 in March, no DST yet) — any accidental local-timezone conversion
    // of the Z-suffixed stored value would shift the displayed hour by 5, not just the minutes.
    process.env.TZ = 'America/New_York';
  });
  afterEach(() => {
    process.env.TZ = originalTz;
    cleanup();
  });

  it('shows the exact stored time, not midnight and not shifted by the admin browser\'s timezone', () => {
    const edition = buildEditionFixture({
      registrationOpens: '2026-03-01T09:00:00Z',
      registrationCloses: '2026-03-15T17:30:00Z',
    });
    renderEditionDialog({ edition });

    // The literal UTC digits stored (09:00 / 17:30), not midnight (the old date-only bug) and not
    // shifted to 04:00/12:30 (what plain local-timezone dayjs(...) parsing would have shown).
    expect(getRegistrationOpensInput().value).toBe('03/01/2026 09:00 AM');
    expect(getRegistrationClosesInput().value).toBe('03/15/2026 05:30 PM');
  });
});

// #1024: handleCycleEditionStatus (the chip labeled with the edition's own EditionStatus, e.g.
// "Confirmed" — not the Status *Select* covered above) fires a bare, non-awaited apiFetch PUT and,
// unlike its sibling handleToggleEditionNeedsReview, never called invalidateEventsList() on
// success — so a status cycle from this page left EventsListPage's cached
// anyEditionUnconfirmed/hasFutureEdition/editionStatus-derived chips stale for up to its 30s
// staleTime. These tests mount the real EventDetailPage (not just EditionDialogInner) so the
// real handler, the real useEventDetail/invalidateEventsList wiring, and a real QueryClient are
// all exercised together — a shallower test against a hand-rolled callback wouldn't prove the
// call is actually reachable from a click on the rendered chip.
const EVENT_SLUG = 'test-trail-race';

function buildEditionFixture(overrides: Partial<EventEditionDto> = {}): EventEditionDto {
  return {
    id: 'edition-1',
    eventId: 'event-1',
    year: 2026,
    date: '2026-06-01',
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
    races: [],
    galleries: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: null,
    translationHashes: {},
    status: 'Confirmed',
    effectiveCancelled: false,
    needsReview: false,
    ...overrides,
  };
}

function buildEventDetailFixture(overrides: Partial<EventDetailDto> = {}): EventDetailDto {
  return {
    id: 'event-1',
    name: 'Test Trail Race',
    nameEn: null,
    slug: EVENT_SLUG,
    description: null,
    descriptionEn: null,
    type: 'Race',
    activityType: 'TrailRunning',
    status: 'Active',
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
    locationType: null,
    scheduleRule: null,
    socialLinks: null,
    nextEditionDate: null,
    daysUntil: null,
    editionCount: 1,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: null,
    seriesRaces: null,
    gpxPointLat: null,
    gpxPointLng: null,
    isMountainRace: false,
    terrainType: null,
    hasFutureEdition: true,
    endDisplayDate: null,
    translationHashes: {},
    editionStatus: 'Confirmed',
    editionEffectiveCancelled: false,
    anyEditionNeedsReview: false,
    anyEditionUnconfirmed: false,
    upcomingDates: [],
    editions: [buildEditionFixture()],
    ...overrides,
  };
}

function renderEventDetailPage(queryClient: QueryClient, onNotify: (msg: ReactNode, severity?: 'success' | 'error') => void = () => {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/events/${EVENT_SLUG}`]}>
        <Routes>
          <Route path="/events/:slug" element={<EventDetailPage onNotify={onNotify} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The edition's own EditionStatus chip — its visible label is "Confirmed" (renamed from "Active"
// by #1604). Before that rename both this chip and the header's own Event status chip
// (buildEventDetailFixture's `status: 'Active'`, #793's EventStatus.Confirmed-renamed-to-Active)
// rendered the same "Active" text, making a plain findByText('Active') ambiguous. MUI's Tooltip
// mirrors its `title` into the wrapped Chip's aria-label, and cycleTooltip() always starts that
// title with the label passed in ('Edition status' vs 'Event status'), so matching on the chip's
// accessible name disambiguates reliably regardless of either status's current text.
function findEditionStatusChip() {
  return screen.findByRole('button', { name: /^Edition status:/ });
}

describe('EventDetailPage — handleCycleEditionStatus invalidates the events list cache (#1024)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('invalidates EVENTS_QUERY_KEY after a successful edition status cycle', async () => {
    mockState.eventDetail = buildEventDetailFixture();
    mockState.editionPutShouldFail = false;

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Seed the events list cache the same way useEvents' own useQuery would populate it — an
    // absent cache entry can't demonstrate invalidation, since invalidateQueries would have
    // nothing to mark stale.
    queryClient.setQueryData(EVENTS_QUERY_KEY, []);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderEventDetailPage(queryClient);

    // The edition's own EditionStatus chip — not the Event status chip covered elsewhere — see
    // findEditionStatusChip's own comment for why a plain findByText('Active') is now ambiguous.
    const statusChip = await findEditionStatusChip();
    fireEvent.click(statusChip);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: EVENTS_QUERY_KEY }));
    });
  });

  it('does not invalidate EVENTS_QUERY_KEY when the edition status PUT fails', async () => {
    mockState.eventDetail = buildEventDetailFixture();
    mockState.editionPutShouldFail = true;

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(EVENTS_QUERY_KEY, []);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderEventDetailPage(queryClient);

    const statusChip = await findEditionStatusChip();
    fireEvent.click(statusChip);

    // The optimistic update flips the chip to "Unconfirmed" immediately, then the rejected PUT's
    // .catch() rolls it back to "Confirmed" — waiting for that reappearance is also proof the
    // rollback ran, not just that invalidateEventsList wasn't called.
    await findEditionStatusChip();
    expect(invalidateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: EVENTS_QUERY_KEY }));
  });
});

// The Registration status chip (adjacent to the Edition status chip above, same row) — its
// accessible name starts with the Tooltip title, which is either cycleTooltip('Registration
// status', ...) or one of two fixed override strings, so matching on /^Registration status:/
// disambiguates it the same way findEditionStatusChip does for its sibling.
function findRegistrationStatusChip() {
  return screen.findByRole('button', { name: /^Registration status:/ });
}

// #1626: when an edition has both registrationOpens and registrationCloses set, its effective
// registrationStatus is computed live server-side (ComputeEffectiveRegistrationStatus) — the Edit
// edition dialog's own Select already disables for this case (EditionDialogInner, :668/:679), but
// this chip's handleCycleRegStatus cycle-on-click had no equivalent guard, so clicking it on a
// windowed edition silently fired a PUT that both fights the server's computed value and — fixed
// separately in #1627, see that describe block below — omitted registrationOpens/
// registrationCloses from its body, wiping the window on save. These tests prove the chip itself
// is now unreachable for a windowed edition, and that a non-windowed edition's chip is untouched
// by this change.
describe('EventDetailPage — Registration status chip disabled when registration window is set (#1626)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('disables the chip, shows the computed-from-window tooltip, and never fires handleCycleRegStatus\'s PUT', async () => {
    mockState.eventDetail = buildEventDetailFixture({
      editions: [buildEditionFixture({
        registrationStatus: 'NotStarted',
        registrationOpens: '2026-01-01T00:00:00',
        registrationCloses: '2026-05-01T00:00:00',
      })],
    });

    const { container } = renderEventDetailPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    // Without an onClick, MUI's Chip stops exposing role="button"/tabIndex (see the
    // TrailRunning/Race Chips elsewhere on the same page, which never had one to begin with) — so
    // unlike findEditionStatusChip's findByRole, this disabled chip is found via the Tooltip's own
    // aria-label mirror onto its child instead. No @testing-library/jest-dom in this repo (see
    // DashboardPage.test.tsx's own note), hence the plain attribute selector rather than
    // toHaveAccessibleName.
    const regChip = await waitFor(() => {
      const el = container.querySelector(
        '[aria-label="Registration status: computed from Registration opens/closes — change via Edit edition"]',
      );
      if (!el) throw new Error('disabled Registration status chip not found yet');
      return el;
    });
    expect(regChip.getAttribute('role')).not.toBe('button');

    fireEvent.click(regChip);

    // Not NotStarted → Open: proof the click never reached handleCycleRegStatus, not just that
    // the label happens to read the same by coincidence.
    expect(regChip.textContent).toBe('NotStarted');
    expect(apiFetch).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\/admin\/editions\//),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('leaves a non-windowed edition\'s chip clickable and cycling as before', async () => {
    mockState.eventDetail = buildEventDetailFixture({
      editions: [buildEditionFixture({
        registrationStatus: 'NotStarted',
        registrationOpens: null,
        registrationCloses: null,
      })],
    });
    mockState.editionPutShouldFail = false;

    renderEventDetailPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    const regChip = await findRegistrationStatusChip();
    fireEvent.click(regChip);

    // Optimistic update flips NotStarted → Open immediately; a disabled chip (onClick undefined)
    // would never flip at all.
    await waitFor(() => expect(screen.getByRole('button', { name: /^Registration status:/ }).textContent).toBe('Open'));
  });
});

// #1627: both handleCycleEditionStatus's and handleCycleRegStatus's hand-written PUT bodies
// omitted registrationOpens/registrationCloses entirely. UpdateEditionCommandHandler
// (UpdateEditionCommand.cs:84-85) writes both fields unconditionally with no null-guard, so a
// missing field in either body nulled out any existing registration window the moment either chip
// was clicked — same root cause as #1622 (TranslationHealth.tsx's savePatch, fixed in PR #1623),
// found here in EventDetailPage's two chip handlers instead.
describe('EventDetailPage — Edition/Registration status chips preserve the registration window on save (#1627)', () => {
  beforeEach(() => {
    // Earlier describe blocks' PUT clicks also land in this same recorder (the mock records every
    // PUT to the editions endpoint, not just this block's), so it must be zeroed before each test
    // here too, not only after.
    mockState.editionPutBodies = [];
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockState.editionPutBodies = [];
  });

  it('Edition status chip: PUT body carries an existing registration window unchanged', async () => {
    mockState.eventDetail = buildEventDetailFixture({
      editions: [buildEditionFixture({
        status: 'Confirmed',
        registrationOpens: '2026-01-01T00:00:00',
        registrationCloses: '2026-05-01T00:00:00',
      })],
    });
    mockState.editionPutShouldFail = false;

    renderEventDetailPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    const statusChip = await findEditionStatusChip();
    fireEvent.click(statusChip);

    await waitFor(() => expect(mockState.editionPutBodies).toHaveLength(1));
    const [body] = mockState.editionPutBodies;
    expect(body.status).toBe('Unconfirmed'); // the status actually being cycled still updates
    expect(body.registrationOpens).toBe('2026-01-01T00:00:00');
    expect(body.registrationCloses).toBe('2026-05-01T00:00:00');
  });

  it('Edition status chip: PUT body still sends no window for a no-window edition (regression)', async () => {
    mockState.eventDetail = buildEventDetailFixture({
      editions: [buildEditionFixture({
        status: 'Confirmed',
        registrationOpens: null,
        registrationCloses: null,
      })],
    });
    mockState.editionPutShouldFail = false;

    renderEventDetailPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    const statusChip = await findEditionStatusChip();
    fireEvent.click(statusChip);

    await waitFor(() => expect(mockState.editionPutBodies).toHaveLength(1));
    const [body] = mockState.editionPutBodies;
    expect(body.status).toBe('Unconfirmed');
    expect(body.registrationOpens).toBeUndefined();
    expect(body.registrationCloses).toBeUndefined();
  });

  // #1626 fully disables the Registration status chip once *both* registrationOpens and
  // registrationCloses are set (EventDetailPage.tsx's `windowed` check) — so a complete window can
  // no longer reach handleCycleRegStatus's PUT through the UI at all, and re-enabling it for that
  // case is explicitly out of scope here. A partial window (only one bound set) is not "windowed"
  // by that same check and still cycles normally, making it the only reachable state that still
  // exercises this handler's body with a real registrationOpens/registrationCloses value.
  it('Registration status chip: PUT body carries a partial registration window unchanged', async () => {
    mockState.eventDetail = buildEventDetailFixture({
      editions: [buildEditionFixture({
        registrationStatus: 'NotStarted',
        registrationOpens: '2026-01-01T00:00:00',
        registrationCloses: null,
      })],
    });
    mockState.editionPutShouldFail = false;

    renderEventDetailPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    const regChip = await findRegistrationStatusChip();
    fireEvent.click(regChip);

    await waitFor(() => expect(mockState.editionPutBodies).toHaveLength(1));
    const [body] = mockState.editionPutBodies;
    expect(body.registrationStatus).toBe('Open'); // the status actually being cycled still updates
    expect(body.registrationOpens).toBe('2026-01-01T00:00:00');
    expect(body.registrationCloses).toBeUndefined();
  });

  it('Registration status chip: PUT body still sends no window for a no-window edition (regression)', async () => {
    mockState.eventDetail = buildEventDetailFixture({
      editions: [buildEditionFixture({
        registrationStatus: 'NotStarted',
        registrationOpens: null,
        registrationCloses: null,
      })],
    });
    mockState.editionPutShouldFail = false;

    renderEventDetailPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    const regChip = await findRegistrationStatusChip();
    fireEvent.click(regChip);

    await waitFor(() => expect(mockState.editionPutBodies).toHaveLength(1));
    const [body] = mockState.editionPutBodies;
    expect(body.registrationStatus).toBe('Open');
    expect(body.registrationOpens).toBeUndefined();
    expect(body.registrationCloses).toBeUndefined();
  });
});

// #1028: handleDeleteEdition/handleCancelEdition/handleCompleteEdition each only called
// `await refresh()` on success, never invalidateEventsList() — unlike their sibling
// handleToggleEditionNeedsReview (#923) and handleCycleEditionStatus (#1024) above, both of which
// already invalidate EVENTS_QUERY_KEY. EventsListPage derives hasFutureEdition/
// anyEditionUnconfirmed chips from that same cached list, so deleting, cancelling or completing an
// edition left those chips stale for up to the list's 30s staleTime. Each button is a
// confirm-then-click control (first click arms deletingEditionId/cancelingEditionId/
// completingEditionId, second click actually fires the request — see the `if (xId !== edition.id)`
// guards at the top of each handler), so every test here clicks its icon button twice.
describe('EventDetailPage — handleDeleteEdition/handleCancelEdition/handleCompleteEdition invalidate the events list cache (#1028)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function seedQueryClient() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Seed the events list cache the same way useEvents' own useQuery would populate it — an
    // absent cache entry can't demonstrate invalidation, since invalidateQueries would have
    // nothing to mark stale.
    queryClient.setQueryData(EVENTS_QUERY_KEY, []);
    return queryClient;
  }

  // #1238: each edition-row IconButton now carries its own static aria-label (static even for
  // Complete/Cancel/Delete, whose Tooltip title toggles to a "Click again to confirm…" string
  // while armed — the label is for selector stability, not for mirroring tooltip confirm-state).
  // Selecting by accessible name via getByRole is correct regardless of DOM order, unlike the
  // former getAllByTestId(...)[length - 1] workaround this replaced, which only happened to work
  // because the single fixture edition from buildEventDetailFixture put the edition-row icon last.
  function getEditionIconButton(name: string) {
    return screen.getByRole('button', { name });
  }

  // #1238 follow-up: Complete/Cancel/Delete's aria-label is static (asserted by the tests below),
  // so unlike an unlabelled button, Tooltip's dynamic "click again to confirm" title no longer
  // gets merged into the accessible name when the button arms — the button instead carries an
  // aria-describedby pointing at a visually-hidden aria-live="polite" status element, which is
  // what this helper reads to prove that arm-state text is still reachable by assistive tech.
  function getDescribedByText(button: HTMLElement) {
    const describedById = button.getAttribute('aria-describedby');
    if (!describedById) throw new Error('Button has no aria-describedby');
    const el = document.getElementById(describedById);
    if (!el) throw new Error(`No element found with id ${describedById}`);
    return el.textContent;
  }

  it('handleDeleteEdition invalidates EVENTS_QUERY_KEY after a successful delete', async () => {
    mockState.eventDetail = buildEventDetailFixture();
    mockState.editionDeleteShouldFail = false;

    const queryClient = seedQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderEventDetailPage(queryClient);
    await findEditionStatusChip();

    const deleteButton = getEditionIconButton('Delete edition');
    fireEvent.click(deleteButton); // arms deletingEditionId
    fireEvent.click(deleteButton); // fires the DELETE

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: EVENTS_QUERY_KEY }));
    });
  });

  it('handleDeleteEdition does not invalidate EVENTS_QUERY_KEY when the DELETE fails', async () => {
    mockState.eventDetail = buildEventDetailFixture();
    mockState.editionDeleteShouldFail = true;

    const queryClient = seedQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onNotify = vi.fn();

    renderEventDetailPage(queryClient, onNotify);
    await findEditionStatusChip();

    const deleteButton = getEditionIconButton('Delete edition');
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    // Waiting for the catch block's onNotify call is the deterministic signal that the rejected
    // DELETE has settled — the MUI Tooltip's own text isn't in the DOM without a hover/focus, so
    // it can't stand in for that like the chip-rollback check in the #1024 tests above does.
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith('Failed to delete edition', 'error');
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: EVENTS_QUERY_KEY }));
  });

  it('handleCancelEdition invalidates EVENTS_QUERY_KEY after a successful cancel', async () => {
    mockState.eventDetail = buildEventDetailFixture();
    mockState.editionCancelShouldFail = false;

    const queryClient = seedQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderEventDetailPage(queryClient);
    await findEditionStatusChip();

    const cancelButton = getEditionIconButton('Cancel edition');
    fireEvent.click(cancelButton); // arms cancelingEditionId
    fireEvent.click(cancelButton); // fires the POST .../cancel

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: EVENTS_QUERY_KEY }));
    });
  });

  it('handleCancelEdition does not invalidate EVENTS_QUERY_KEY when the cancel POST fails', async () => {
    mockState.eventDetail = buildEventDetailFixture();
    mockState.editionCancelShouldFail = true;

    const queryClient = seedQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onNotify = vi.fn();

    renderEventDetailPage(queryClient, onNotify);
    await findEditionStatusChip();

    const cancelButton = getEditionIconButton('Cancel edition');
    fireEvent.click(cancelButton);
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith('Failed to cancel edition', 'error');
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: EVENTS_QUERY_KEY }));
  });

  it('handleCompleteEdition invalidates EVENTS_QUERY_KEY after a successful complete', async () => {
    // isPast (and the Complete button it gates) is derived from edition.date vs today — the
    // default fixture's '2026-06-01' is already in the past relative to this suite's fixed clock.
    mockState.eventDetail = buildEventDetailFixture();
    mockState.editionCompleteShouldFail = false;

    const queryClient = seedQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderEventDetailPage(queryClient);
    await findEditionStatusChip();

    const completeButton = getEditionIconButton('Mark edition Completed');
    fireEvent.click(completeButton); // arms completingEditionId
    fireEvent.click(completeButton); // fires the POST .../complete

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: EVENTS_QUERY_KEY }));
    });
  });

  it('handleCompleteEdition does not invalidate EVENTS_QUERY_KEY when the complete POST fails', async () => {
    mockState.eventDetail = buildEventDetailFixture();
    mockState.editionCompleteShouldFail = true;

    const queryClient = seedQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onNotify = vi.fn();

    renderEventDetailPage(queryClient, onNotify);
    await findEditionStatusChip();

    const completeButton = getEditionIconButton('Mark edition Completed');
    fireEvent.click(completeButton);
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith('Failed to complete edition', 'error');
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: EVENTS_QUERY_KEY }));
  });

  // #1238 follow-up: a static aria-label on Delete/Cancel/Complete (added so getEditionIconButton
  // above can select by accessible name instead of DOM order) stops Tooltip's dynamic "click again
  // to confirm" title from reaching the accessible name the way it would for an unlabelled button
  // — these three tests prove the arm-state text is still exposed to assistive tech via each
  // button's aria-describedby-linked aria-live region, not just sighted-only in the Tooltip.
  it('exposes Delete edition\'s armed/confirm state via its aria-live status region, while its aria-label stays static', async () => {
    mockState.eventDetail = buildEventDetailFixture();

    renderEventDetailPage(seedQueryClient());
    await findEditionStatusChip();

    const deleteButton = getEditionIconButton('Delete edition');
    expect(getDescribedByText(deleteButton)).toBe('');

    fireEvent.click(deleteButton); // arms deletingEditionId

    // Same element, same accessible name — getByRole must still resolve it post-arm.
    expect(screen.getByRole('button', { name: 'Delete edition' })).toBe(deleteButton);
    expect(getDescribedByText(deleteButton)).toBe('Click again to confirm — or wait 3 seconds to cancel');
  });

  it('exposes Cancel edition\'s armed/confirm state via its aria-live status region, while its aria-label stays static', async () => {
    mockState.eventDetail = buildEventDetailFixture();

    renderEventDetailPage(seedQueryClient());
    await findEditionStatusChip();

    const cancelButton = getEditionIconButton('Cancel edition');
    expect(getDescribedByText(cancelButton)).toBe('');

    fireEvent.click(cancelButton); // arms cancelingEditionId

    expect(screen.getByRole('button', { name: 'Cancel edition' })).toBe(cancelButton);
    // Default fixture edition has no races, so the race-count placeholder reads "0 races".
    expect(getDescribedByText(cancelButton)).toBe('Click again to confirm — cancels 0 races and closes registration too (or wait 3 seconds to cancel)');
  });

  it('exposes Mark edition Completed\'s armed/confirm state via its aria-live status region, while its aria-label stays static', async () => {
    mockState.eventDetail = buildEventDetailFixture();

    renderEventDetailPage(seedQueryClient());
    await findEditionStatusChip();

    const completeButton = getEditionIconButton('Mark edition Completed');
    expect(getDescribedByText(completeButton)).toBe('');

    fireEvent.click(completeButton); // arms completingEditionId

    expect(screen.getByRole('button', { name: 'Mark edition Completed' })).toBe(completeButton);
    expect(getDescribedByText(completeButton)).toBe('Click again to confirm — sets 0 Active races to Completed and closes registration (or wait 3 s to cancel)');
  });

  // #1384: #1278/PR #1383 fixed VISUALLY_HIDDEN_SX's width/height/margin (previously 100%/100%/
  // -8px, which visibly reserved layout space instead of clipping to a 1px offscreen box) but left
  // no regression test — a future edit could reintroduce the bug silently. This asserts the
  // *computed* style of one of the three aria-live status boxes the constant is applied to; the
  // other two (cancelStatusId, deleteStatusId) share the same sx constant, so one box is enough.
  //
  // #1402 follow-up: the original version of this test couldn't assert margin at all — Stack's
  // injected spacing rules (specificity 0,1,2) always beat the element's own sx rule (0,1,0), so
  // getComputedStyle never reflected VISUALLY_HIDDEN_SX's declared `margin: -1px`, and the test
  // fell back to scanning document.styleSheets for the emotion-generated rule instead. The owner's
  // fix was to drop `margin` from VISUALLY_HIDDEN_SX entirely — width/height/clip/overflow alone
  // already fully hide the element, so the negative margin was never load-bearing. That removes
  // the need for the workaround: there's nothing left on the element's own rule to lose the
  // cascade to, so getComputedStyle now faithfully shows whichever margin Stack actually applies.
  it('renders the Mark edition Completed status region visually hidden via a 1px clip box (#1384)', async () => {
    mockState.eventDetail = buildEventDetailFixture();

    renderEventDetailPage(seedQueryClient());
    await findEditionStatusChip();

    const completeButton = getEditionIconButton('Mark edition Completed');
    const describedById = completeButton.getAttribute('aria-describedby');
    if (!describedById) throw new Error('Button has no aria-describedby');
    const statusBox = document.getElementById(describedById);
    if (!statusBox) throw new Error(`No element found with id ${describedById}`);

    // width/height are unaffected by any ancestor rule, so the resolved computed style is a
    // direct, faithful readout of VISUALLY_HIDDEN_SX.
    const computed = getComputedStyle(statusBox);
    expect(computed.width).toBe('1px');
    expect(computed.height).toBe('1px');

    // margin: VISUALLY_HIDDEN_SX no longer declares one (#1402) — this Box sits inside a
    // `<Stack spacing={0.5}>` (the edition-row action Stack), whose injected
    // `> :not(style) ~ :not(style) { margin-left: 4px }` + `> :not(style) { margin: 0 }` rules
    // (specificity 0,1,2) always beat this element's own single-class sx rule (0,1,0) regardless
    // of what VISUALLY_HIDDEN_SX declares — so asserting the resolved value here, rather than
    // asserting it mirrors VISUALLY_HIDDEN_SX, is what makes this test honest about who actually
    // controls margin on this element. The Complete button isn't the Stack's first child, so
    // Stack's sibling-margin rule applies: 0 on three sides, 4px (0.5 * 8px theme spacing) on the
    // left.
    expect(computed.margin).toBe('0px 0px 0px 4px');
  });
});

// #1692: regression guard for the #566 scenario that PR #1690 (e5ab871b) fixed by extracting
// getOrderedRaces (EventDetailPage.tsx:158) as the single place focusRows (:1049, feeding
// useIdRowFocus's j/k walk), the SortableContext items (:2079) and the table render (:2081) all
// derive their race ordering from. Before that refactor the same derivation was duplicated three
// times; an edit landing in only one copy would have let the keyboard focus order and the visible
// row order silently disagree after a drag-reorder. This test drives an actual drag through
// @dnd-kit's own PointerSensor pipeline (see simulateRaceDrag below for why — not a shortcut
// around it) and then asserts the j/k walk visits rows in the resulting order, not the original
// fixture order, so a future re-duplication of getOrderedRaces's logic would fail this test
// rather than passing CI silently.
describe('EventDetailPage — j/k focus order matches the post-drag-reorder race order (#566, #1690 regression)', () => {
  // jsdom doesn't implement scrollIntoView at all — EventDetailPage.tsx:1071's focusedId effect
  // calls it unconditionally once useIdRowFocus reports a focused row, which every other describe
  // block in this file avoids simply by never pressing j/k. Stubbing it here is a jsdom-gap
  // workaround, not a behavioural mock: the effect's actual argument/call is never asserted on.
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockState.editionPutBodies = [];
    mockState.raceReorderPutPending = false;
  });

  // @dnd-kit/sortable's useSortable measures each row via plain Element.getBoundingClientRect
  // (confirmed by reading the vendored core.cjs.development.js — this version's droppable/
  // draggable rect measuring has no ResizeObserver dependency, only a guarded, feature-detected
  // one for *re*-measuring on resize, which jsdom's lack of ResizeObserver here just skips), so
  // stubbing that per-row is enough to make closestCenter's collision detection deterministic.
  // The exact pixel values don't matter, only that row 2 sits below row 1.
  function stubRowRect(row: HTMLElement, top: number) {
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: top, top, left: 0, right: 300, bottom: top + 40, width: 300, height: 40,
      toJSON() { return this; },
    } as DOMRect);
  }

  function getRaceRow(raceName: string): HTMLElement {
    const row = screen.getByText(raceName).closest('tr');
    if (!row) throw new Error(`row for "${raceName}" not found`);
    return row;
  }

  // The race rows in their current *visual* (DOM) order — as opposed to getRaceRow's lookup by
  // name, this is what lets the assertions below also catch a #566 divergence sitting in the
  // table/SortableContext render instead of in focusRows: if the render still showed the stale
  // pre-drag order while focusRows alone had the reordered one, getRaceRow('Leg 2') would still
  // correctly report itself focused (isFocused matches by race id, wherever its row ends up in
  // the DOM) — only checking *position* 0 against the race actually rendered there exposes that.
  function getRaceRowsInDomOrder(): HTMLElement[] {
    return screen.getAllByText(/^Leg [12]$/).map(cell => {
      const row = cell.closest('tr');
      if (!row) throw new Error('race row not found');
      return row;
    });
  }

  function getDragHandleCell(row: HTMLElement): HTMLElement {
    const cell = within(row).getByTestId('DragIndicatorIcon').closest('td');
    if (!cell) throw new Error('drag handle cell not found');
    return cell;
  }

  // isFocused (EventDetailPage.tsx:2089/:800) sets the row's `outline` as a shorthand
  // (`2px solid ${theme.palette.primary.main}`), not individual longhand properties — jsdom's
  // CSSOM doesn't expand that shorthand into a readable `outlineStyle` (that longhand always
  // comes back empty here, shorthand or not), so this reads the shorthand's own computed value
  // instead of the longhand.
  function isRowFocused(row: HTMLElement): boolean {
    return getComputedStyle(row).outline.includes('solid');
  }

  // Drives the exact sequence @dnd-kit/core's PointerSensor itself listens for (see
  // AbstractPointerSensor.attach/handleStart/handleMove in core.cjs.development.js), rather than
  // reaching into EventDetailPage to call handleRaceDragEnd directly — it's a local closure, not
  // exported, and the point of this test is to prove the real DndContext → onDragEnd →
  // handleRaceDragEnd wiring stays correct, not just the handler in isolation. The issue allows
  // skipping literal @dnd-kit pointer-drag simulation if impractical; this one pans out (see the
  // rect-stubbing comment above for the one piece that made it practical here), so no fallback
  // approximation is needed.
  function simulateRaceDrag(activeHandle: HTMLElement) {
    // pointerdown on the drag handle — PointerSensor.activators requires isPrimary/button:0.
    fireEvent.pointerDown(activeHandle, { pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: 20 });
    // A first pointermove past the 5px activationConstraint (EventDetailPage.tsx:1324) only
    // activates the drag (AbstractPointerSensor.handleMove's hasExceededDistance branch calls
    // handleStart and returns without reporting a position yet).
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 10, clientY: 30, cancelable: true });
    // A second pointermove, now activated, reports the current position — translating row 1's
    // collision rect down to row 2's stubbed center and making it the closestCenter match.
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 10, clientY: 60, cancelable: true });
    // pointerup is what actually fires DndContext's onDragEnd with the over id collision
    // detection most recently settled on.
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 10, clientY: 60 });
  }

  // 10s rather than this file's default 5s test timeout — mounting the full page plus driving
  // @dnd-kit's real PointerSensor pipeline (see simulateRaceDrag) is slower than this suite's
  // otherwise-synchronous tests, especially under CI load.
  it('drag-reorders two races, then j/k visits them in the new order, not the original fixture order', async () => {
    // Left pending for this whole test (see the flag's own comment) — handleRaceDragEnd's real
    // await Promise.all(...)/refresh() round-trip clears its optimistic localRaceOrder override
    // as soon as it resolves, and once that happens getOrderedRaces' plain sortRaces fallback
    // alone decides the order for every caller, masking exactly the divergence #566/#1690 is
    // about: *while the override is live*, focusRows, the SortableContext items and the table
    // render must all read that same override, or a future edit duplicating getOrderedRaces's
    // logic into only one of those three call sites would show the old order in the other two
    // without this test ever noticing.
    mockState.raceReorderPutPending = true;

    mockState.eventDetail = buildEventDetailFixture({
      editions: [buildEditionFixture({
        title: 'Reorder Test Edition',
        races: [
          buildRaceFixture({ id: 'race-1', name: 'Leg 1', sortOrder: 0 }),
          buildRaceFixture({ id: 'race-2', name: 'Leg 2', sortOrder: 1 }),
        ],
      })],
    });

    renderEventDetailPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    await findEditionStatusChip();

    // Expand the edition so its races (and their DndContext/SortableContext) actually mount —
    // collapsed editions render neither.
    fireEvent.click(screen.getByText('Reorder Test Edition'));

    const row1 = getRaceRow('Leg 1');
    const row2 = getRaceRow('Leg 2');
    stubRowRect(row1, 0);
    stubRowRect(row2, 40);

    // Drag "Leg 1" down past "Leg 2". handleRaceDragEnd's setLocalRaceOrder call happens
    // synchronously, before its first await, so the table/SortableContext already show the
    // reordered rows by the time simulateRaceDrag's pointerup event handler returns — no
    // waitFor needed, and none would help anyway since the PUT this would otherwise wait on
    // never resolves in this test.
    simulateRaceDrag(getDragHandleCell(row1));

    const raceNameCells = screen.getAllByText(/^Leg [12]$/);
    expect(raceNameCells.map(c => c.textContent)).toEqual(['Leg 2', 'Leg 1']);

    // j/k starts at index 0 with no prior focus (useIdRowFocus's own clamp-at-both-ends
    // behaviour) — first 'j' focuses the edition row, the second focuses the first race row,
    // which must be "Leg 2" to match the reordered table above, not "Leg 1" (the original
    // fixture order, and what a reintroduced #566 divergence in focusRows alone would still
    // report here).
    fireEvent.keyDown(window, { key: 'j' });
    fireEvent.keyDown(window, { key: 'j' });
    expect(isRowFocused(getRaceRow('Leg 2'))).toBe(true);
    expect(isRowFocused(getRaceRow('Leg 1'))).toBe(false);
    // Ties the above to *visual* position too (see getRaceRowsInDomOrder's own comment) — the
    // focused row must be whichever one is actually rendered first, not just "Leg 2"'s row
    // wherever that ends up.
    expect(isRowFocused(getRaceRowsInDomOrder()[0]!)).toBe(true);

    // A third 'j' moves on to "Leg 1", now the *second* race row.
    fireEvent.keyDown(window, { key: 'j' });
    expect(isRowFocused(getRaceRow('Leg 1'))).toBe(true);
    expect(isRowFocused(getRaceRow('Leg 2'))).toBe(false);

    // 'k' walks back the same (reordered) path, not the original fixture order.
    fireEvent.keyDown(window, { key: 'k' });
    expect(isRowFocused(getRaceRow('Leg 2'))).toBe(true);
    expect(isRowFocused(getRaceRow('Leg 1'))).toBe(false);
  }, 10000);
});
