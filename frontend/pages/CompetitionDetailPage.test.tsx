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
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import { createAppTheme } from '../theme';
import type { EventDetail, EventEditionDto, RaceDto } from '../hooks/useEvents';
import type { EventClimate, TrailWeather } from '../hooks/useTrails';

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
// #1585: mockTrails defaults to [] (same as the old hardcoded return) so every pre-existing test
// above is unaffected; only the #1585 legend-entries suite below overrides it per-case.
const { mockTrails } = vi.hoisted(() => ({
    mockTrails: { current: [] as import('../hooks/useTrails').Trail[] },
}));
// #1670: defaults to the old hardcoded { weather: null, loading: false, error: null } so every
// pre-existing test above is unaffected; only the #1670 live-forecast-swap suite below overrides it.
const { mockWeatherResult } = vi.hoisted(() => ({
    mockWeatherResult: { current: { weather: null as import('../hooks/useTrails').TrailWeather | null, loading: false, error: null as string | null } },
}));
vi.mock('../hooks/useTrails', () => ({
    useTrailWeather: () => mockWeatherResult.current,
    useEventClimate: () => mockClimateResult.current,
    useTrailsBySlugs: () => ({ trails: mockTrails.current, loading: false, error: null }),
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

// Only climate_normals reads true by default, reaching the ClimateCard section; every other flag
// (share_trail, calendar_integration, directions_to_trailhead, tool_trail_predictor,
// locations_page, event_weather_forecast, ...) defaults false here, which is also what keeps the
// rest of the page's optional sections — irrelevant to #1299/#1438 — from rendering at all.
// #1670: mockEnabledFlags is a mutable Set (not a hardcoded name check) so the live-forecast-swap
// suite below can flip event_weather_forecast on per-test without touching every other flag's
// default-false behavior the rest of this file already relies on.
const { mockEnabledFlags } = vi.hoisted(() => ({
    mockEnabledFlags: { current: new Set<string>(['climate_normals']) },
}));
vi.mock('../hooks/useFeatureFlags', () => ({
    useFeatureFlags: () => ({ flags: {}, loaded: true, isEnabled: (name: string) => mockEnabledFlags.current.has(name) }),
}));

const { trailMapViewMock, climateCardMock, weatherCardMock, eventTrailLegendMock } = vi.hoisted(() => ({
    trailMapViewMock: vi.fn(),
    climateCardMock: vi.fn(),
    weatherCardMock: vi.fn(),
    eventTrailLegendMock: vi.fn(),
}));
vi.mock('../components/TrailMapView', () => ({
    TrailMapView: (props: unknown) => { trailMapViewMock(props); return null; },
}));
vi.mock('../components/ClimateCard', () => ({
    default: (props: unknown) => { climateCardMock(props); return null; },
}));
vi.mock('../components/WeatherCard', () => ({
    default: (props: unknown) => { weatherCardMock(props); return null; },
}));
// #1585: captures the `entries` prop CompetitionDetailPage builds, rather than asserting on
// EventTrailLegend's own rendering (unchanged, already covered by its own render — it just
// displays whatever `name` it's given) — same prop-capture pattern as trailMapViewMock above.
vi.mock('../components/EventTrailLegend', () => ({
    EventTrailLegend: (props: unknown) => { eventTrailLegendMock(props); return null; },
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

// #1670: minimal TrailWeather fixture for the live-forecast-swap suite below — only the fields
// WeatherCard's props/raceDate wiring actually touches at the mocked (prop-capture) level matter
// here; WeatherCard's own internal rendering (daily highlight, hourly strip, etc.) is covered
// directly by WeatherCard.test.tsx instead.
function makeWeather(overrides: Partial<TrailWeather> = {}): TrailWeather {
    return {
        current: {
            latitude: 64.25,
            longitude: -21.13,
            elevation: 50,
            temperature: 8,
            apparentTemperature: 6,
            windSpeed: 4,
            windGusts: 7,
            precipitation: 0,
            weatherCode: 1,
            cloudCover: 30,
            label: 'Trailhead',
        },
        hourly: [],
        daily: [],
        summit: null,
        condition: 'Good',
        ...overrides,
    };
}

// Offsets from "today" the same way #1533's checklist suite does — dynamic rather than a fixed
// literal date, so these tests don't bit-rot as the system clock moves forward.
function dateOffsetFromToday(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
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

// Minimal fixtures for the #1533 Series checklist case — a Series event's isRaceWeek comes from
// computeRaceDayFlags's own seriesRaceDates branch (derived from event.editions' races, not
// event.daysUntil — see eventUtils.ts:401-409), so exercising it needs real edition/race data
// rather than just a daysUntil override.
function makeRace(overrides: Partial<RaceDto> = {}): RaceDto {
    return {
        id: 'race-1',
        eventEditionId: 'edition-1',
        trailId: null,
        trailName: null,
        trailSlug: null,
        name: 'Race',
        nameEn: null,
        distanceLabel: null,
        cutoffMinutes: null,
        description: null,
        descriptionEn: null,
        status: 'Confirmed',
        sortOrder: 0,
        ticketStatus: null,
        maxParticipants: null,
        itraPoints: null,
        certifiedBy: null,
        certifiedByEn: null,
        prizeMoney: null,
        championshipCategory: null,
        championshipCategoryEn: null,
        dateOfRace: null,
        startTime: null,
        trailDistanceMeters: null,
        trailElevationGain: null,
        trailTerrainType: null,
        trailDifficulty: null,
        trailActivityType: null,
        activityType: null,
        ...overrides,
    };
}

// #1585: minimal Trail fixture for the legend-entries suite below — name deliberately follows
// the admin "{EventName} - {RaceName}" convention by default so the fallback-vs-race-name
// distinction has something to tell apart.
function makeTrail(overrides: Partial<import('../hooks/useTrails').Trail> = {}): import('../hooks/useTrails').Trail {
    return {
        id: 'trail-1',
        name: 'Midnight Sun Trail - 10K',
        slug: 'midnight-sun-trail-10k',
        length: 10000,
        elevationGain: 200,
        elevationLoss: 200,
        status: 'Active',
        activityType: 'TrailRunning',
        trailType: 'Loop',
        difficulty: 'Moderate',
        startLatitude: null,
        startLongitude: null,
        locations: [],
        ...overrides,
    };
}

function makeEdition(overrides: Partial<EventEditionDto> = {}): EventEditionDto {
    return {
        id: 'edition-1',
        eventId: 'event-1',
        year: 2026,
        date: null,
        endDate: null,
        title: null,
        titleEn: null,
        registrationUrl: null,
        resultsUrl: null,
        galleries: [],
        notes: null,
        notesEn: null,
        registrationStatus: null,
        trailId: null,
        trailName: null,
        trailSlug: null,
        races: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
        status: 'Active',
        effectiveCancelled: false,
        primaryElevationProfile: null,
        primaryTerrainType: null,
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
    weatherCardMock.mockClear();
    eventTrailLegendMock.mockClear();
    mockClimateResult.current = { climate: null, loading: false, error: null };
    mockTrails.current = [];
    mockWeatherResult.current = { weather: null, loading: false, error: null };
    mockEnabledFlags.current = new Set(['climate_normals']);
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

// #1533: showChecklist was missing the event.type gate every other race-only section already has
// (lines 789/1051/1058/1065/1092) — a Social event with a running activityType and daysUntil
// inside the 0-7 isRaceWeek window (see computeRaceDayFlags in eventUtils.ts) rendered the "Race
// day checklist" card anyway, live at /events/bleika-hlaupid. daysUntil=3 keeps isRaceDay (and so
// firstRaceStarted) false without needing to mock currentTime or visibleRaces.
describe('CompetitionDetailPage race day checklist (#1533)', () => {
    it('does not render the checklist for a Social event within its race week', () => {
        renderCompetitionDetailPage(makeEvent({ type: 'Social', daysUntil: 3 }));

        expect(screen.queryByText('Race day checklist')).toBeNull();
    });

    it('still renders the checklist for a Race event within its race week', () => {
        renderCompetitionDetailPage(makeEvent({ type: 'Race', daysUntil: 3 }));

        expect(screen.getByText('Race day checklist')).not.toBeNull();
    });

    it('still renders the checklist for a Series event within its race week', () => {
        const raceDate = new Date();
        raceDate.setDate(raceDate.getDate() + 3);
        const dateOfRace = raceDate.toISOString().slice(0, 10);
        const edition = makeEdition({ date: dateOfRace, races: [makeRace({ dateOfRace })] });

        renderCompetitionDetailPage(makeEvent({ type: 'Series', daysUntil: 3, editions: [edition] }));

        expect(screen.getByText('Race day checklist')).not.toBeNull();
    });
});

// #1532: render-level coverage for RaceCard's trailElevationGain/trailDistanceMeters/
// cutoffMinutes Chip guards (CompetitionDetailPage.tsx:1552-1571), which this file's #1442 header
// comment scopes out of its own TrailMapView/ClimateCard coverage.
//
// As of #1541 (merged to develop before this branch was cut), all three guards here read `!=
// null` — the trailDistanceMeters truthy guard this issue's CONTEXT describes as still-outstanding
// was fixed separately in #1540/#1541. These tests assert the actual current `!= null` behaviour
// for all three fields (Chip renders at 0, Chip absent at null/undefined) rather than the stale
// truthy behaviour the issue text describes for trailDistanceMeters.
//
// A single edition with a null date (hasNoDate -> current) and one race keeps currentEditions at
// length 1, so showEditionSections (CompetitionDetailPage.tsx:460, `currentEditions.length > 1`)
// stays false and rendering goes through the plain racesWithAnchors branch
// (CompetitionDetailPage.tsx:1093-1113) rather than the per-edition Paper sections — either branch
// renders the same RaceCard, so this is just the simpler path to it.
describe('CompetitionDetailPage race Chip guards (#1532)', () => {
    function renderWithRace(raceOverrides: Partial<RaceDto>) {
        const edition = makeEdition({ races: [makeRace(raceOverrides)] });
        renderCompetitionDetailPage(makeEvent({ editions: [edition] }));
    }

    // #1530/#1531 fixed this exact guard from a truthy `race.trailElevationGain &&` (which
    // swallowed a legitimate 0 m elevation gain as a stray falsy value, rendering no Chip) to
    // `!= null`. A regression back to the truthy form would make the first assertion below fail
    // (0 is falsy).
    describe('elevation gain Chip guard (#1530/#1531 regression guard)', () => {
        it('renders the elevation Chip when trailElevationGain is 0', () => {
            renderWithRace({ trailElevationGain: 0 });

            expect(screen.getByText('↑ 0 m')).not.toBeNull();
        });

        it('omits the elevation Chip when trailElevationGain is null', () => {
            renderWithRace({ trailElevationGain: null });

            expect(screen.queryByText(/↑ .* m/)).toBeNull();
        });

        it('omits the elevation Chip when trailElevationGain is undefined', () => {
            renderWithRace({ trailElevationGain: undefined });

            expect(screen.queryByText(/↑ .* m/)).toBeNull();
        });
    });

    // Same guard shape, for cutoffMinutes. formatCutoff(0, t) returns t('races.cutoffHours', {
    // count: 0 }) -> en.json's plural "other" form, "0 hours time limit".
    describe('cutoff Chip guard', () => {
        it('renders the cutoff Chip when cutoffMinutes is 0', () => {
            renderWithRace({ cutoffMinutes: 0 });

            expect(screen.getByText('0 hours time limit')).not.toBeNull();
        });

        it('omits the cutoff Chip when cutoffMinutes is null', () => {
            renderWithRace({ cutoffMinutes: null });

            expect(screen.queryByText(/time limit/)).toBeNull();
        });

        it('omits the cutoff Chip when cutoffMinutes is undefined', () => {
            renderWithRace({ cutoffMinutes: undefined });

            expect(screen.queryByText(/time limit/)).toBeNull();
        });
    });

    // trailDistanceMeters was fixed to `!= null` in #1540/#1541 (previously the truthy
    // `race.trailDistanceMeters &&` left over from #1530/#1531, which only touched
    // elevationGain) — so a genuine 0 m trail distance now also renders its Chip instead of
    // being swallowed.
    describe('trail distance Chip guard (#1540/#1541)', () => {
        it('renders the distance Chip for a positive trailDistanceMeters', () => {
            renderWithRace({ trailDistanceMeters: 5000 });

            expect(screen.getByText('5.0 km')).not.toBeNull();
        });

        it('renders the distance Chip when trailDistanceMeters is 0', () => {
            renderWithRace({ trailDistanceMeters: 0 });

            expect(screen.getByText('0.0 km')).not.toBeNull();
        });

        it('omits the distance Chip when trailDistanceMeters is null', () => {
            renderWithRace({ trailDistanceMeters: null });

            expect(screen.queryByText(/km$/)).toBeNull();
        });

        it('omits the distance Chip when trailDistanceMeters is undefined', () => {
            renderWithRace({ trailDistanceMeters: undefined });

            expect(screen.queryByText(/km$/)).toBeNull();
        });
    });
});

// #1585: Trail.name follows the admin "{EventName} - {RaceName}" convention (needed for Trail's
// own global listing/search), which is redundant and crowds this event-scoped legend — prefer the
// mapped race's own localized name per trailSlug instead, falling back to trail.name when no race
// maps to that slug.
describe('CompetitionDetailPage event trail legend entries (#1585)', () => {
    function lastLegendEntries() {
        expect(eventTrailLegendMock).toHaveBeenCalled();
        const props = eventTrailLegendMock.mock.calls.at(-1)![0] as { entries: { slug: string; name: string }[] };
        return props.entries;
    }

    it('prefers the mapped race name over the full "{Event} - {Race}" trail name', () => {
        const trailA = makeTrail({ slug: 'trail-10k', name: 'Midnight Sun Trail - 10K' });
        const trailB = makeTrail({ slug: 'trail-21k', name: 'Midnight Sun Trail - 21K' });
        mockTrails.current = [trailA, trailB];
        const edition = makeEdition({
            races: [
                makeRace({ id: 'race-10k', name: '10K', trailSlug: 'trail-10k' }),
                makeRace({ id: 'race-21k', name: '21K', trailSlug: 'trail-21k' }),
            ],
        });

        renderCompetitionDetailPage(makeEvent({ editions: [edition] }));

        const entries = lastLegendEntries();
        expect(entries).toEqual([
            { slug: 'trail-10k', name: '10K' },
            { slug: 'trail-21k', name: '21K' },
        ]);
    });

    it('falls back to trail.name when no race in the lookup points at that trailSlug', () => {
        const trail = makeTrail({ slug: 'edition-trail', name: 'Midnight Sun Trail - Edition Route' });
        mockTrails.current = [trail];
        // Edition links its own trailSlug directly, with no race pointing at it — mirrors
        // deriveEventTrailSlugs' edition-level tier, which exists independently of any race.
        const edition = makeEdition({ trailSlug: 'edition-trail', races: [] });

        renderCompetitionDetailPage(makeEvent({ editions: [edition] }));

        const entries = lastLegendEntries();
        expect(entries).toEqual([{ slug: 'edition-trail', name: 'Midnight Sun Trail - Edition Route' }]);
    });

    it('prefers the mapped race name even when the trail name does not follow the "{Event} - {Race}" convention', () => {
        const trail = makeTrail({ slug: 'standalone-trail', name: 'Laugavegur' });
        mockTrails.current = [trail];
        const edition = makeEdition({
            races: [makeRace({ id: 'race-1', name: 'Laugavegur Ultra', trailSlug: 'standalone-trail' })],
        });

        renderCompetitionDetailPage(makeEvent({ editions: [edition] }));

        const entries = lastLegendEntries();
        expect(entries).toEqual([{ slug: 'standalone-trail', name: 'Laugavegur Ultra' }]);
    });

    it('uses the first matching race when two races share a trailSlug, never merging the names', () => {
        const trail = makeTrail({ slug: 'shared-trail', name: 'Midnight Sun Trail - Shared' });
        mockTrails.current = [trail];
        const edition = makeEdition({
            races: [
                makeRace({ id: 'race-first', name: 'First Race', trailSlug: 'shared-trail', sortOrder: 0 }),
                makeRace({ id: 'race-second', name: 'Second Race', trailSlug: 'shared-trail', sortOrder: 1 }),
            ],
        });

        renderCompetitionDetailPage(makeEvent({ editions: [edition] }));

        const entries = lastLegendEntries();
        expect(entries).toEqual([{ slug: 'shared-trail', name: 'First Race' }]);
    });
});

// #1587: isAllSoldOut (ticketStatus.ts) already suppressed the register button on
// RacesPage/EventTableView once every race in scope is SoldOut/Closed — CompetitionDetailPage's
// own two register-button conditions (EditionMeta's at the per-edition Paper, and the
// primaryEdition-gated one above the race list) never got that guard, so a fully sold-out edition
// still showed a clickable "Register" button here. Both below only add `!isAllSoldOut(...)`
// alongside the existing registrationUrl/isRegistrationRequired gate.
describe('CompetitionDetailPage register button vs sold-out races (#1587)', () => {
    it('hides the EditionMeta register button for a sold-out edition, but keeps it for a sibling edition that is not (multi-edition path)', () => {
        // Two editions with a null date both land in currentEditions (hasNoDate -> current, see
        // #1532 fixture comment above), so showEditionSections (length > 1) is true and each
        // edition's own register button renders via EditionMeta, not the primaryEdition-gated one.
        const soldOutEdition = makeEdition({
            id: 'edition-1',
            registrationUrl: 'https://example.com/register-1',
            registrationStatus: 'Open',
            races: [makeRace({ id: 'race-1', ticketStatus: 'SoldOut' })],
        });
        const openEdition = makeEdition({
            id: 'edition-2',
            registrationUrl: 'https://example.com/register-2',
            registrationStatus: 'Open',
            races: [makeRace({ id: 'race-2', ticketStatus: 'Available' })],
        });

        renderCompetitionDetailPage(makeEvent({ type: 'Series', editions: [soldOutEdition, openEdition] }));

        // Exactly one Register button — the sold-out edition's is suppressed, the other edition's
        // is not.
        expect(screen.getAllByText('Register')).toHaveLength(1);
    });

    it('hides the primaryEdition-gated register button when every visible race is SoldOut or Closed (single-edition path)', () => {
        const edition = makeEdition({
            registrationUrl: 'https://example.com/register',
            registrationStatus: 'Open',
            races: [makeRace({ id: 'race-1', ticketStatus: 'SoldOut' }), makeRace({ id: 'race-2', ticketStatus: 'Closed' })],
        });

        renderCompetitionDetailPage(makeEvent({ editions: [edition] }));

        expect(screen.queryByText('Register')).toBeNull();
    });

    it('still shows the primaryEdition-gated register button when at least one visible race is not SoldOut/Closed', () => {
        const edition = makeEdition({
            registrationUrl: 'https://example.com/register',
            registrationStatus: 'Open',
            races: [makeRace({ id: 'race-1', ticketStatus: 'SoldOut' }), makeRace({ id: 'race-2', ticketStatus: 'AlmostSoldOut' })],
        });

        renderCompetitionDetailPage(makeEvent({ editions: [edition] }));

        expect(screen.getByText('Register')).not.toBeNull();
    });

    // Regression guard: isAllSoldOut([]) returns false (ticketStatus.ts:87), so an edition with no
    // races must not have this change suppress a register button that would otherwise show.
    it('still shows the register button for an edition with no races at all', () => {
        const edition = makeEdition({
            registrationUrl: 'https://example.com/register',
            registrationStatus: 'Open',
            races: [],
        });

        renderCompetitionDetailPage(makeEvent({ editions: [edition] }));

        expect(screen.getByText('Register')).not.toBeNull();
    });

    it('leaves the registration status Chip rendering (EditionMeta line 260-264) even when the register button is hidden for being sold out', () => {
        // EditionMeta's own register button (hideMeta=false) only renders in the showEditionSections
        // (>1 current edition) path — see the primaryEdition-gated test above for the single-edition
        // path, where EditionMeta is called with hideMeta and so renders neither button nor Chip.
        const soldOutEdition = makeEdition({
            id: 'edition-1',
            registrationUrl: 'https://example.com/register-1',
            registrationStatus: 'Open',
            races: [makeRace({ id: 'race-1', ticketStatus: 'SoldOut' })],
        });
        const otherEdition = makeEdition({
            id: 'edition-2',
            registrationUrl: 'https://example.com/register-2',
            registrationStatus: 'Open',
            races: [makeRace({ id: 'race-2', ticketStatus: 'Available' })],
        });

        renderCompetitionDetailPage(makeEvent({ type: 'Series', editions: [soldOutEdition, otherEdition] }));

        // One Register button (the non-sold-out edition's), but the Chip renders for both editions
        // regardless of sold-out status — isAllSoldOut only ever gates the button.
        expect(screen.getAllByText('Register')).toHaveLength(1);
        expect(screen.getAllByText('Registration is open')).toHaveLength(3);
    });

    // #1592: Cancelled races stay in visibleRaces (sorted last, #1587's block above is unaffected),
    // but a Cancelled race's own ticketStatus isn't guaranteed SoldOut/Closed — isAllSoldOut must
    // ignore it, not read it, or a mixed cancelled+sold-out edition fails the "every race" check
    // open and leaves a clickable Register button up for a race nobody can actually register for.
    it('hides the primaryEdition-gated register button for a mixed Cancelled+SoldOut edition (Cancelled race not SoldOut itself)', () => {
        const edition = makeEdition({
            registrationUrl: 'https://example.com/register',
            registrationStatus: 'Open',
            races: [
                makeRace({ id: 'race-1', status: 'Cancelled', ticketStatus: 'Available' }),
                makeRace({ id: 'race-2', ticketStatus: 'SoldOut' }),
            ],
        });

        renderCompetitionDetailPage(makeEvent({ editions: [edition] }));

        expect(screen.queryByText('Register')).toBeNull();
    });

    // A lone Cancelled race must not force sold-out messaging on an otherwise-open edition — it's
    // excluded from the check entirely, not treated as "SoldOut by default".
    it('still shows the primaryEdition-gated register button for a mixed Cancelled+Available edition', () => {
        const edition = makeEdition({
            registrationUrl: 'https://example.com/register',
            registrationStatus: 'Open',
            races: [
                makeRace({ id: 'race-1', status: 'Cancelled', ticketStatus: 'Available' }),
                makeRace({ id: 'race-2', ticketStatus: 'Available' }),
            ],
        });

        renderCompetitionDetailPage(makeEvent({ editions: [edition] }));

        expect(screen.getByText('Register')).not.toBeNull();
    });
});

// #1670: WeatherCard mounts in ClimateCard's exact slot (same Box sx={{ mt: 3 }}) once the
// event_weather_forecast flag is on, the (Series-aware) race date is within 7 days, and the
// existing useTrailWeather result has resolved — otherwise ClimateCard renders exactly as before.
// Never both, never neither.
describe('CompetitionDetailPage live forecast swap (#1670)', () => {
    it('shows ClimateCard, not WeatherCard, when event_weather_forecast is off (regression guard) even with daysUntil and weather both in range', () => {
        mockWeatherResult.current = { weather: makeWeather(), loading: false, error: null };
        mockClimateResult.current = { climate: makeClimate(), loading: false, error: null };
        // mockEnabledFlags defaults to climate_normals only (set in beforeEach) — event_weather_forecast stays off.

        renderCompetitionDetailPage(makeEvent({ displayDate: dateOffsetFromToday(3), nextEditionDate: dateOffsetFromToday(3), daysUntil: 3 }));

        expect(climateCardMock).toHaveBeenCalled();
        expect(weatherCardMock).not.toHaveBeenCalled();
    });

    it('shows WeatherCard, not ClimateCard, when the flag is on, daysUntil is within 0-7, and weather has resolved', () => {
        mockEnabledFlags.current = new Set(['climate_normals', 'event_weather_forecast']);
        mockWeatherResult.current = { weather: makeWeather(), loading: false, error: null };
        mockClimateResult.current = { climate: makeClimate(), loading: false, error: null };
        const raceDate = dateOffsetFromToday(3);

        renderCompetitionDetailPage(makeEvent({ displayDate: raceDate, nextEditionDate: raceDate, daysUntil: 3 }));

        expect(weatherCardMock).toHaveBeenCalled();
        expect(climateCardMock).not.toHaveBeenCalled();
        const props = weatherCardMock.mock.calls.at(-1)![0] as { raceDate: unknown };
        expect(props.raceDate).toBe(raceDate);
    });

    it('still shows ClimateCard when the flag is on and weather is within range but daysUntil is outside 0-7', () => {
        mockEnabledFlags.current = new Set(['climate_normals', 'event_weather_forecast']);
        mockWeatherResult.current = { weather: makeWeather(), loading: false, error: null };
        mockClimateResult.current = { climate: makeClimate(), loading: false, error: null };
        const raceDate = dateOffsetFromToday(14);

        renderCompetitionDetailPage(makeEvent({ displayDate: raceDate, nextEditionDate: raceDate, daysUntil: 14 }));

        expect(climateCardMock).toHaveBeenCalled();
        expect(weatherCardMock).not.toHaveBeenCalled();
    });

    it('still shows ClimateCard when the flag is on and daysUntil is within range but weather never resolved (no trail in the fallback chain)', () => {
        mockEnabledFlags.current = new Set(['climate_normals', 'event_weather_forecast']);
        mockWeatherResult.current = { weather: null, loading: false, error: null };
        mockClimateResult.current = { climate: makeClimate(), loading: false, error: null };
        const raceDate = dateOffsetFromToday(3);

        renderCompetitionDetailPage(makeEvent({ displayDate: raceDate, nextEditionDate: raceDate, daysUntil: 3 }));

        expect(climateCardMock).toHaveBeenCalled();
        expect(weatherCardMock).not.toHaveBeenCalled();
    });

    // A Series event's own event.daysUntil/displayDate/nextEditionDate are pinned to the season's
    // *first* race (stale for the rest of the season, see climateTarget's comment at
    // CompetitionDetailPage.tsx:550-556) — this leg is mid-season: its first race was 30 days ago,
    // its next leg is 3 days away. The swap (and raceDate) must key off that next leg's own date,
    // resolved the same Series-aware way climateTarget already does, not off nextRaceDate or the
    // stale event-level fields.
    it('keys the swap and raceDate off a Series event\'s next upcoming leg, not its season-start fields', () => {
        mockEnabledFlags.current = new Set(['climate_normals', 'event_weather_forecast']);
        mockWeatherResult.current = { weather: makeWeather(), loading: false, error: null };
        mockClimateResult.current = { climate: makeClimate(), loading: false, error: null };
        const firstLegDate = dateOffsetFromToday(-30);
        const nextLegDate = dateOffsetFromToday(3);
        const edition = makeEdition({
            races: [
                makeRace({ id: 'race-first', dateOfRace: firstLegDate }),
                makeRace({ id: 'race-next', dateOfRace: nextLegDate }),
            ],
        });

        renderCompetitionDetailPage(makeEvent({
            type: 'Series',
            displayDate: firstLegDate,
            nextEditionDate: firstLegDate,
            daysUntil: 0,
            editions: [edition],
        }));

        expect(weatherCardMock).toHaveBeenCalled();
        expect(climateCardMock).not.toHaveBeenCalled();
        const props = weatherCardMock.mock.calls.at(-1)![0] as { raceDate: unknown };
        expect(props.raceDate).toBe(nextLegDate);
    });

    // Checklist weather line (CompetitionDetailPage.tsx:1087-1092) reads the same weather/
    // weatherLoading state the swap above now also feeds — unchanged by this feature, regardless
    // of whether the flag is on or the swap fires.
    it('leaves the checklist weather line reading the same weather/weatherLoading state regardless of the flag', () => {
        mockEnabledFlags.current = new Set(['climate_normals', 'event_weather_forecast']);
        mockWeatherResult.current = {
            weather: makeWeather({ current: { ...makeWeather().current, temperature: 11.6, windSpeed: 5.4 } }),
            loading: false,
            error: null,
        };
        const raceDate = dateOffsetFromToday(3);

        renderCompetitionDetailPage(makeEvent({ type: 'Race', displayDate: raceDate, nextEditionDate: raceDate, daysUntil: 3 }));

        expect(screen.getByText('Current snapshot: 12 °C and 5 m/s wind.')).not.toBeNull();
    });
});

// #1673: the fallback countdown chip (none of isPostRace/isRaceDay/heroCancelled/
// Upcoming-or-heroUnconfirmed apply) used to render in the hero name row; it now renders on the
// "next race" date line instead, same label/color/pulse logic, to stop it crowding long event
// names. A heading element query (not getByText) distinguishes "not in the name row" from "not
// rendered anywhere", since the date-line copy is the relocation target, not a removal.
describe('CompetitionDetailPage hero countdown chip relocation (#1673)', () => {
    it('does not render the countdown chip inside the name-row heading, but does render it on the date line', () => {
        renderCompetitionDetailPage(makeEvent({ status: 'Confirmed', daysUntil: 26, displayDate: dateOffsetFromToday(26), nextEditionDate: dateOffsetFromToday(26) }));

        const heading = screen.getByRole('heading', { level: 4 });
        expect(heading.textContent).not.toContain('In 26 days');
        expect(screen.getByText('In 26 days')).not.toBeNull();
    });

    it('still shows the plain Upcoming/unconfirmed chip in the name row, unaffected by the relocation', () => {
        renderCompetitionDetailPage(makeEvent({ status: 'Upcoming', daysUntil: 26, displayDate: dateOffsetFromToday(26), nextEditionDate: dateOffsetFromToday(26) }));

        expect(screen.getByText('Date is unconfirmed')).not.toBeNull();
        expect(screen.queryByText('In 26 days')).toBeNull();
    });

    // Edge case called out in #1673: a Series event whose whole season has finished, with no next
    // season scheduled yet, has displayDate/nextEditionDate both null (so the date line itself
    // doesn't render) while resolveHeroDaysUntil still falls back to the season's last individual
    // race date (eventUtils.ts resolveSeriesClimateDate) — not null. The chip must still render
    // somewhere rather than disappear.
    it('renders the chip in a standalone fallback container when the season has ended and no date line renders', () => {
        const lastRaceDate = dateOffsetFromToday(-200);
        const edition = makeEdition({ date: null, races: [makeRace({ dateOfRace: lastRaceDate })] });

        renderCompetitionDetailPage(makeEvent({
            type: 'Series',
            status: 'Confirmed',
            daysUntil: null,
            displayDate: null,
            nextEditionDate: null,
            editions: [edition],
        }));

        expect(screen.queryByText('Next:')).toBeNull();
        expect(screen.queryByText('Last:')).toBeNull();
        expect(screen.getByText('200 days ago')).not.toBeNull();
    });
});
