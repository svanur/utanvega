// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import EventDetailPage, { EditionDialogInner } from './EventDetailPage';
import { BilingualLangProvider } from '../contexts/BilingualLangContext';
import { EDITION_STATUS_LABELS } from '../utils/eventForms';
import { EVENTS_QUERY_KEY, type EventDetailDto, type EventEditionDto } from '../hooks/useEvents';

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
    return Promise.resolve([]);
  }),
}));

// Mirrors EventWizardPage.test.tsx's renderEditionDetailsStep — a brand-new (isNew) edition is the
// simplest way to mount the dialog, since it needs no EventEditionDto fixture and none of the
// Status MenuItems are conditionally disabled (that only happens `!isNew`, see EditionDialogInner's
// own Status Select above).
function renderEditionDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <BilingualLangProvider>
          <EditionDialogInner
            open
            edition={null}
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

function renderEventDetailPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/events/${EVENT_SLUG}`]}>
        <Routes>
          <Route path="/events/:slug" element={<EventDetailPage onNotify={() => {}} />} />
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
