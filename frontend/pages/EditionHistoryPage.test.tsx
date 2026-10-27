// @vitest-environment jsdom
//
// #1532: render-level coverage for HistoryRaceCard's trailElevationGain/trailDistanceMeters/
// cutoffMinutes Chip guards (EditionHistoryPage.tsx:390-404) — this page had no test file at all
// before this. Follows CompetitionDetailPage.test.tsx's (itself following RacesPage.test.tsx's)
// jsdom-opt-in + RTL + vi.hoisted mock pattern, but needs far fewer mocks: EditionHistoryPage only
// calls useEventBySlug (no useFavoriteEvents/useTrails/useLocations/useFeatureFlags), so only
// Layout and useEvents are stubbed here.
//
// As of #1541 (merged to develop before this branch was cut), all three guards in both
// CompetitionDetailPage.tsx and EditionHistoryPage.tsx read `!= null` — the trailDistanceMeters
// truthy guard this issue's CONTEXT describes as still-outstanding was fixed separately in
// #1540/#1541. These tests assert the actual current `!= null` behaviour for all three fields
// (Chip renders at 0, Chip absent at null/undefined) rather than the stale truthy behaviour the
// issue text describes for trailDistanceMeters.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import { createAppTheme } from '../theme';
import type { EventDetail, EventEditionDto, RaceDto } from '../hooks/useEvents';

// Mirrors RacesPage.test.tsx:20-24 — vitest.config.ts doesn't set `globals: true`, so RTL's
// automatic afterEach(cleanup) never registers.
afterEach(cleanup);

// Real, initialized i18next (not a stub) — formatCutoff's t('races.cutoffHours', { count }) needs
// back a real pluralized string, not the raw key.
void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

// Layout pulls in useMediaQuery (jsdom has no window.matchMedia) plus data-fetching hooks
// unrelated to the Chip block under test — mocked to a bare passthrough, same as
// CompetitionDetailPage.test.tsx/RacesPage.test.tsx.
vi.mock('../components/Layout', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const { mockEvent } = vi.hoisted(() => ({
    mockEvent: { current: null as EventDetail | null },
}));
vi.mock('../hooks/useEvents', () => ({
    useEventBySlug: () => ({ event: mockEvent.current, loading: false, error: null }),
}));

import EditionHistoryPage from './EditionHistoryPage';

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

function makeEdition(overrides: Partial<EventEditionDto> = {}): EventEditionDto {
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

function makeEvent(edition: EventEditionDto, overrides: Partial<EventDetail> = {}): EventDetail {
    return {
        id: 'event-1',
        name: 'Midnight Sun Trail',
        nameEn: null,
        slug: 'midnight-sun-trail',
        description: null,
        descriptionEn: null,
        type: 'Race',
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
        nextEditionDate: edition.date,
        daysUntil: 26,
        displayDate: edition.date,
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
        gpxPointLat: null,
        gpxPointLng: null,
        isMountainRace: false,
        endDisplayDate: null,
        editionStatus: null,
        editionEffectiveCancelled: false,
        upcomingDates: [],
        editions: [edition],
        ...overrides,
    };
}

// EditionHistoryPage looks up the edition from useParams().editionKey by matching
// edition.date/year/id (EditionHistoryPage.tsx:62-68) — edition.date is used here so the route
// param lines up with the fixture's own date.
function renderEditionHistoryPage(race: Partial<RaceDto>) {
    const edition = makeEdition({ races: [makeRace(race)] });
    mockEvent.current = makeEvent(edition);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const theme = createAppTheme('light');
    return render(
        <MemoryRouter initialEntries={[`/events/${mockEvent.current.slug}/history/${edition.date}`]}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider theme={theme}>
                    <Routes>
                        <Route
                            path="/events/:slug/history/:editionKey"
                            element={<EditionHistoryPage mode="light" onToggleMode={() => {}} />}
                        />
                    </Routes>
                </ThemeProvider>
            </QueryClientProvider>
        </MemoryRouter>,
    );
}

// #1530/#1531 fixed this exact guard from a truthy `race.trailElevationGain &&` (which swallowed a
// legitimate 0 m elevation gain as a stray falsy value, rendering no Chip) to `!= null`. A
// regression back to the truthy form would make the first assertion below fail (0 is falsy).
describe('HistoryRaceCard elevation gain Chip guard (#1530/#1531 regression guard)', () => {
    it('renders the elevation Chip when trailElevationGain is 0', () => {
        renderEditionHistoryPage({ trailElevationGain: 0 });

        expect(screen.getByText('↑ 0 m')).not.toBeNull();
    });

    it('omits the elevation Chip when trailElevationGain is null', () => {
        renderEditionHistoryPage({ trailElevationGain: null });

        expect(screen.queryByText(/↑ .* m/)).toBeNull();
    });

    it('omits the elevation Chip when trailElevationGain is undefined', () => {
        renderEditionHistoryPage({ trailElevationGain: undefined });

        expect(screen.queryByText(/↑ .* m/)).toBeNull();
    });
});

// Same guard shape, for cutoffMinutes. formatCutoff(0, t) returns t('races.cutoffHours', { count:
// 0 }) -> en.json's plural "other" form, "0 hours time limit".
describe('HistoryRaceCard cutoff Chip guard', () => {
    it('renders the cutoff Chip when cutoffMinutes is 0', () => {
        renderEditionHistoryPage({ cutoffMinutes: 0 });

        expect(screen.getByText('0 hours time limit')).not.toBeNull();
    });

    it('omits the cutoff Chip when cutoffMinutes is null', () => {
        renderEditionHistoryPage({ cutoffMinutes: null });

        expect(screen.queryByText(/time limit/)).toBeNull();
    });

    it('omits the cutoff Chip when cutoffMinutes is undefined', () => {
        renderEditionHistoryPage({ cutoffMinutes: undefined });

        expect(screen.queryByText(/time limit/)).toBeNull();
    });
});

// trailDistanceMeters was fixed to `!= null` in #1540/#1541 (previously the truthy
// `race.trailDistanceMeters &&` left over from #1530/#1531, which only touched elevationGain) —
// so a genuine 0 m trail distance now also renders its Chip instead of being swallowed.
describe('HistoryRaceCard trail distance Chip guard (#1540/#1541)', () => {
    it('renders the distance Chip for a positive trailDistanceMeters', () => {
        renderEditionHistoryPage({ trailDistanceMeters: 5000 });

        expect(screen.getByText('5.0 km')).not.toBeNull();
    });

    it('renders the distance Chip when trailDistanceMeters is 0', () => {
        renderEditionHistoryPage({ trailDistanceMeters: 0 });

        expect(screen.getByText('0.0 km')).not.toBeNull();
    });

    it('omits the distance Chip when trailDistanceMeters is null', () => {
        renderEditionHistoryPage({ trailDistanceMeters: null });

        expect(screen.queryByText(/km$/)).toBeNull();
    });

    it('omits the distance Chip when trailDistanceMeters is undefined', () => {
        renderEditionHistoryPage({ trailDistanceMeters: undefined });

        expect(screen.queryByText(/km$/)).toBeNull();
    });
});
