// @vitest-environment jsdom
//
// #1837: render-level coverage for the card-view location line (EditionsHistoryPage.tsx:311-328)
// — no test file existed for this page before this. Follows CompetitionDetailPage.test.tsx's (via
// EditionHistoryPage.test.tsx's) jsdom-opt-in + RTL + vi.hoisted mock pattern. This page reads
// useEditionsHistory/useEditionsHistoryAllYears/useEditionsHistoryYears (not useEventBySlug), so
// all three are stubbed here, plus Layout.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import { createAppTheme } from '../theme';
import type { EditionHistoryRow } from '../hooks/useEvents';

// Mirrors RacesPage.test.tsx:20-24 — vitest.config.ts doesn't set `globals: true`, so RTL's
// automatic afterEach(cleanup) never registers.
afterEach(cleanup);

void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

// Layout pulls in useMediaQuery (jsdom has no window.matchMedia) plus data-fetching hooks
// unrelated to the location link under test — mocked to a bare passthrough, same as
// CompetitionDetailPage.test.tsx/EditionHistoryPage.test.tsx.
vi.mock('../components/Layout', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const { mockRows } = vi.hoisted(() => ({
    mockRows: { current: [] as EditionHistoryRow[] },
}));
vi.mock('../hooks/useEvents', () => ({
    useEditionsHistory: () => ({ rows: mockRows.current, loading: false, error: null }),
    useEditionsHistoryAllYears: () => ({ rows: [], loading: false }),
    useEditionsHistoryYears: () => ({ years: [2026] }),
}));

import EditionsHistoryPage from './EditionsHistoryPage';

function makeRow(overrides: Partial<EditionHistoryRow> = {}): EditionHistoryRow {
    return {
        eventId: 'event-1',
        eventSlug: 'midnight-sun-trail',
        eventName: 'Midnight Sun Trail',
        eventNameEn: null,
        eventType: 'Race',
        editionId: 'edition-1',
        editionYear: 2026,
        rowDate: '2026-06-01',
        rowEndDate: null,
        locationName: 'Thingvellir',
        locationSlug: null,
        organizerName: null,
        organizerNameEn: null,
        organizerSlug: null,
        effectiveCancelled: false,
        distances: [],
        resultsUrl: null,
        galleries: [],
        activityTypes: null,
        eventActivityType: 'TrailRunning',
        raceId: null,
        raceName: null,
        raceNameEn: null,
        recordedEditionsCount: 0,
        recordedEditionsYears: [],
        primaryElevationProfile: null,
        primaryTerrainType: null,
        ...overrides,
    };
}

function renderEditionsHistoryPage(row: EditionHistoryRow) {
    mockRows.current = [row];
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const theme = createAppTheme('light');
    return render(
        <MemoryRouter initialEntries={['/editions/history/2026']}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider theme={theme}>
                    <Routes>
                        <Route
                            path="/editions/history/:year?"
                            element={<EditionsHistoryPage mode="light" onToggleMode={() => {}} />}
                        />
                    </Routes>
                </ThemeProvider>
            </QueryClientProvider>
        </MemoryRouter>,
    );
}

// #1837: mirrors the organizer link's already-shipped slug-present/slug-null split
// (EditionsHistoryPage.tsx:317-336) — location now gets the same treatment.
describe('EditionsHistoryPage card-view location link (#1837)', () => {
    it('renders the location as a link to /locations/<slug> when locationSlug is set', () => {
        renderEditionsHistoryPage(makeRow({ locationSlug: 'thingvellir' }));

        const link = screen.getByText('Thingvellir').closest('a');
        expect(link).not.toBeNull();
        expect(link?.getAttribute('href')).toBe('/locations/thingvellir');
    });

    it('renders the location as plain text with no anchor when locationSlug is null', () => {
        renderEditionsHistoryPage(makeRow({ locationSlug: null }));

        const text = screen.getByText('Thingvellir');
        expect(text.closest('a')).toBeNull();
    });
});
