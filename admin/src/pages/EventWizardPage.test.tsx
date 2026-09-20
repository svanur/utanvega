// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { RacesStep } from './EventWizardPage';
import type { EventDetailDto, RaceDto } from '../hooks/useEvents';

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

vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn((endpoint: string) => {
    if (endpoint === '/api/v1/admin/events') return Promise.resolve([]);
    if (endpoint.startsWith('/api/v1/admin/trails')) return Promise.resolve([]);
    if (endpoint === `/api/v1/admin/events/${EVENT_SLUG}`) {
      eventDetailFetches += 1;
      return Promise.resolve(makeDetail(currentRaces));
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
