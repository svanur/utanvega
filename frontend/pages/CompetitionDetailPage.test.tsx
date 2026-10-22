// @vitest-environment jsdom
//
// #1442: replaces the two source-text regex tests (#1299, #1438) with a render-level harness.
// CompetitionDetailPage has no render harness of its own — reaching the TrailMapView/ClimateCard
// sections means mocking every data-fetching hook it calls (useEventBySlug, useEventSuggestions,
// useFavoriteEvents, useTrailWeather/useEventClimate/useTrailsBySlugs, useLocations,
// useFeatureFlags) plus Layout (pulls in useMediaQuery; jsdom has no matchMedia) and the two
// target child components themselves, so their rendered props can be captured directly instead of
// grepping the page's own source text. Follows RacesPage.test.tsx's jsdom-opt-in + RTL +
// vi.hoisted mock pattern (itself following TrailMapView.test.tsx). Mocks are scoped to exactly
// what's needed to reach the two target sections with a minimal, non-race, non-Series,
// non-cancelled event fixture — not a general-purpose page harness (out of scope per #1442).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import { createAppTheme } from '../theme';
import type { EventDetail } from '../hooks/useEvents';
import type { EventClimate } from '../hooks/useTrails';

// Mirrors RacesPage.test.tsx:20-24 — vitest.config.ts doesn't set `globals: true`, so RTL's
// automatic afterEach(cleanup) never registers.
afterEach(cleanup);

// Real, initialized i18next (not a stub) — EditionMeta/EventDateBadge/etc. call
// t('races.weekdays', { returnObjects: true }) and need back a real array, not the raw key.
void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

// Layout pulls in useMediaQuery (jsdom has no window.matchMedia) plus a dozen more
// data-fetching hooks unrelated to the two sections under test — mocked to a bare passthrough,
// same as RacesPage.test.tsx:44-46.
vi.mock('../components/Layout', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const { mockEvent } = vi.hoisted(() => ({
    mockEvent: { current: null as EventDetail | null },
}));
vi.mock('../hooks/useEvents', () => ({
    useEventBySlug: () => ({ event: mockEvent.current, loading: false, error: null }),
    useEventSuggestions: () => ({ suggestions: [], loading: false }),
}));

const { mockClimateResult } = vi.hoisted(() => ({
    mockClimateResult: { current: { climate: null as EventClimate | null, loading: false, error: null as string | null } },
}));
vi.mock('../hooks/useTrails', () => ({
    useTrailWeather: () => ({ weather: null, loading: false, error: null }),
    useEventClimate: () => mockClimateResult.current,
    useTrailsBySlugs: () => ({ trails: [], loading: false, error: null }),
    // SendTipButton (rendered unconditionally at CompetitionDetailPage.tsx:1276) imports API_URL
    // from this same module — never read during its own render, only inside its submit handler,
    // but exported here anyway so the mock module shape doesn't silently diverge from the real one.
    API_URL: 'http://localhost:8080',
}));

vi.mock('../hooks/useFavoriteEvents', () => ({
    useFavoriteEvents: () => ({ favoriteEvents: [], toggleFavoriteEvent: vi.fn(), isFavoriteEvent: () => false }),
}));

vi.mock('../hooks/useLocations', () => ({
    useLocations: () => ({ locations: [], loading: false, error: null }),
}));

// Only climate_normals needs to read true to reach the ClimateCard section; every other flag
// (share_trail, calendar_integration, directions_to_trailhead, tool_trail_predictor,
// locations_page, ...) defaults false here, which is also what keeps the rest of the page's
// optional sections — irrelevant to #1299/#1438 — from rendering at all.
vi.mock('../hooks/useFeatureFlags', () => ({
    useFeatureFlags: () => ({ flags: {}, loaded: true, isEnabled: (name: string) => name === 'climate_normals' }),
}));

const { trailMapViewMock, climateCardMock } = vi.hoisted(() => ({
    trailMapViewMock: vi.fn(),
    climateCardMock: vi.fn(),
}));
vi.mock('../components/TrailMapView', () => ({
    TrailMapView: (props: unknown) => { trailMapViewMock(props); return null; },
}));
vi.mock('../components/ClimateCard', () => ({
    default: (props: unknown) => { climateCardMock(props); return null; },
}));

import CompetitionDetailPage from './CompetitionDetailPage';

// A minimal Single (non-Race, non-Series), non-cancelled, upcoming event — editions/races empty
// so the races list and its own heavy children (RaceCard/RaceShareCard/RaceFinishCard/
// RaceProgressBar) never mount; gpxPointLat/Lng set so the map section's
// `(mapPin || eventTrails.length > 0)` gate (CompetitionDetailPage.tsx:842) is satisfied without
// needing a linked trail or a useLocations lookup.
function makeEvent(overrides: Partial<EventDetail> = {}): EventDetail {
    return {
        id: 'event-1',
        name: 'Midnight Sun Trail',
        nameEn: null,
        slug: 'midnight-sun-trail',
        description: null,
        descriptionEn: null,
        type: 'Single',
        activityType: 'TrailRunning',
        activityTypes: null,
        status: 'Upcoming',
        organizerId: null,
        organizerName: null,
        organizerNameEn: null,
        organizerWebsite: null,
        organizerSlug: null,
        alertMessage: null,
        alertMessageEn: null,
        alertSeverity: null,
        locationId: null,
        locationName: 'Thingvellir',
        scheduleRule: null,
        socialLinks: null,
        nextEditionDate: '2026-11-15',
        daysUntil: 26,
        displayDate: '2026-11-15',
        editionCount: 1,
        distances: null,
        registrationUrl: null,
        registrationStatus: null,
        registrationCloses: null,
        resultsUrl: null,
        galleries: [],
        certifications: null,
        youtubeUrl: null,
        championshipCategories: null,
        itraPoints: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
        seriesRaces: null,
        recentlyCompletedSeriesRace: null,
        gpxPointLat: 64.25,
        gpxPointLng: -21.13,
        isMountainRace: false,
        endDisplayDate: null,
        editionStatus: null,
        editionEffectiveCancelled: false,
        upcomingDates: [],
        editions: [],
        ...overrides,
    };
}

function makeClimate(overrides: Partial<EventClimate> = {}): EventClimate {
    return {
        averageHigh: 12,
        averageLow: 4,
        averagePrecipitation: 3.2,
        precipitationChance: 0.3,
        averageMaxWind: 8,
        averageSunshineHours: 5,
        yearsOfData: 15,
        targetMonth: 11,
        targetDay: 15,
        lat: 64.25,
        lon: -21.13,
        isApproximate: false,
        ...overrides,
    };
}

function renderCompetitionDetailPage(event: EventDetail) {
    mockEvent.current = event;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const theme = createAppTheme('light');
    return render(
        <MemoryRouter initialEntries={[`/events/${event.slug}`]}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider theme={theme}>
                    <Routes>
                        <Route
                            path="/events/:slug"
                            element={<CompetitionDetailPage mode="light" onToggleMode={() => {}} />}
                        />
                    </Routes>
                </ThemeProvider>
            </QueryClientProvider>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    trailMapViewMock.mockClear();
    climateCardMock.mockClear();
    mockClimateResult.current = { climate: null, loading: false, error: null };
});

// #1299: PR #1298 removed CompetitionDetailPage's own `userLocation` state and the
// geolocation-fetch effect that populated it, replacing the <TrailMapView> call with a permanent
// `userLocation={null}` — this page now never asks the browser for the visitor's location.
describe('CompetitionDetailPage map section (#1299)', () => {
    it('renders TrailMapView with userLocation={null} and never calls navigator.geolocation.getCurrentPosition', () => {
        const getCurrentPosition = vi.fn();
        Object.defineProperty(navigator, 'geolocation', {
            value: { getCurrentPosition, watchPosition: vi.fn(), clearWatch: vi.fn() },
            configurable: true,
        });

        renderCompetitionDetailPage(makeEvent());

        expect(trailMapViewMock).toHaveBeenCalled();
        const lastCallProps = trailMapViewMock.mock.calls.at(-1)![0] as { userLocation: unknown };
        expect(lastCallProps.userLocation).toBeNull();
        expect(getCurrentPosition).not.toHaveBeenCalled();
    });
});

// #1460: dropped the GPS-pin/point-to-point split — ClimateCard now only ever mounts for an event
// with a linked Location (event.locationName), and when it does, locationName is passed straight
// through unconditionally (no ternary driven by a start/finish split, since that split no longer
// exists). ClimateCard.test.tsx covers the fallback-to-coordinate rendering when locationName is
// null; this covers the render gate and prop-passing itself, from CompetitionDetailPage.
describe('CompetitionDetailPage climate section (#1460)', () => {
    it('mounts ClimateCard with locationName={event.locationName} when the event has a linked Location', () => {
        mockClimateResult.current = { climate: makeClimate(), loading: false, error: null };

        renderCompetitionDetailPage(makeEvent({ locationName: 'Thingvellir' }));

        expect(climateCardMock).toHaveBeenCalled();
        const lastCallProps = climateCardMock.mock.calls.at(-1)![0] as { locationName: unknown };
        expect(lastCallProps.locationName).toBe('Thingvellir');
    });

    it('never mounts ClimateCard when the event has no linked Location, even with gpxPointLat/Lng set', () => {
        mockClimateResult.current = { climate: makeClimate(), loading: false, error: null };

        renderCompetitionDetailPage(makeEvent({ locationName: null, gpxPointLat: 64.25, gpxPointLng: -21.13 }));

        expect(climateCardMock).not.toHaveBeenCalled();
    });
});
