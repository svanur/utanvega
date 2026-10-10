// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import EventDetailPage, { EditionDialogInner } from './EventDetailPage';
import { BilingualLangProvider } from '../contexts/BilingualLangContext';
import { EDITION_STATUS_LABELS } from '../utils/eventForms';
import { EVENTS_QUERY_KEY, type EventDetailDto, type EventEditionDto, type EventType, type RaceDto } from '../hooks/useEvents';

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
}));

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn((endpoint: string, options?: { method?: string }) => {
    const method = options?.method ?? 'GET';
    if (method === 'GET' && /^\/api\/v1\/admin\/events\/[^/]+$/.test(endpoint)) {
      return Promise.resolve(mockState.eventDetail);
    }
    if (method === 'PUT' && /^\/api\/v1\/admin\/editions\/[^/]+$/.test(endpoint)) {
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

    chooseMenuOption(getStatusCombobox(), EDITION_STATUS_LABELS.Active);
    expect(getStatusCombobox().textContent).toBe(EDITION_STATUS_LABELS.Active);
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

// #1024: handleCycleEditionStatus (the chip labeled with the edition's own EditionStatus, e.g.
// "Active" — not the Status *Select* covered above) fires a bare, non-awaited apiFetch PUT and,
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
    status: 'Active',
    effectiveCancelled: false,
    needsReview: false,
    ...overrides,
  };
}

function buildEventDetailFixture(): EventDetailDto {
  return {
    id: 'event-1',
    name: 'Test Trail Race',
    nameEn: null,
    slug: EVENT_SLUG,
    description: null,
    descriptionEn: null,
    type: 'Race',
    activityType: 'TrailRunning',
    status: 'Confirmed',
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
    editionStatus: 'Active',
    editionEffectiveCancelled: false,
    anyEditionNeedsReview: false,
    anyEditionUnconfirmed: false,
    upcomingDates: [],
    editions: [buildEditionFixture()],
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

    // The edition's own EditionStatus chip — labeled "Active" here — not the Status Select
    // covered by the describe block above. With no edition expanded and no races rendered, this
    // is the only element in the tree with that exact text once the initial fetch resolves.
    const statusChip = await screen.findByText('Active');
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

    const statusChip = await screen.findByText('Active');
    fireEvent.click(statusChip);

    // The optimistic update flips the chip to "Unconfirmed" immediately, then the rejected PUT's
    // .catch() rolls it back to "Active" — waiting for that reappearance is also proof the
    // rollback ran, not just that invalidateEventsList wasn't called.
    await screen.findByText('Active');
    expect(invalidateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: EVENTS_QUERY_KEY }));
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

  it('handleDeleteEdition invalidates EVENTS_QUERY_KEY after a successful delete', async () => {
    mockState.eventDetail = buildEventDetailFixture();
    mockState.editionDeleteShouldFail = false;

    const queryClient = seedQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderEventDetailPage(queryClient);
    await screen.findByText('Active');

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
    await screen.findByText('Active');

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
    await screen.findByText('Active');

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
    await screen.findByText('Active');

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
    await screen.findByText('Active');

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
    await screen.findByText('Active');

    const completeButton = getEditionIconButton('Mark edition Completed');
    fireEvent.click(completeButton);
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith('Failed to complete edition', 'error');
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: EVENTS_QUERY_KEY }));
  });
});
