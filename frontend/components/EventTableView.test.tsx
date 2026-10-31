// @vitest-environment jsdom
//
// #1601: table view's Register button/"Sold out" chip cell (EventTableView.tsx:530-556) only
// gated on isAllSoldOut (SoldOut/Closed), so an edition whose races are all #1553's per-race
// 'NotStarted' ticketStatus — registration not yet open — still showed a live Register button.
// These cover the table view's share of the fix (isAllUnavailableForRegistration added alongside
// the untouched isAllSoldOut chip check); RacesPage.test.tsx covers the two list-view call sites.
// Follows RacesPage.test.tsx's jsdom-opt-in + RTL + real-i18n pattern.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import { createAppTheme } from '../theme';
import type { EventSummary } from '../hooks/useEvents';

afterEach(cleanup);

void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

// EventTableView reads getHolidays/isEnabled but nothing about them is under test here — mocked to
// bare passthroughs, mirroring RacesPage.test.tsx's equivalent mocks for the same two hooks.
import { vi } from 'vitest';
vi.mock('../hooks/useFeatureFlags', () => ({
    useFeatureFlags: () => ({ flags: {}, loaded: true, isEnabled: () => false }),
}));
vi.mock('../hooks/useIcelandicHolidays', () => ({
    useIcelandicHolidays: () => ({ getHolidays: () => [], isHoliday: () => false }),
}));

import EventTableView from './EventTableView';

function makeEvent(overrides: Partial<EventSummary> = {}): EventSummary {
    return {
        id: overrides.slug ?? 'event-1',
        name: 'Event',
        nameEn: null,
        slug: 'event-1',
        description: null,
        descriptionEn: null,
        type: 'Single',
        activityType: 'Running',
        activityTypes: null,
        status: 'Published',
        organizerId: null,
        organizerName: null,
        organizerNameEn: null,
        organizerWebsite: null,
        organizerSlug: null,
        alertMessage: null,
        alertMessageEn: null,
        alertSeverity: null,
        locationId: null,
        locationName: 'Reykjavik',
        scheduleRule: null,
        socialLinks: null,
        nextEditionDate: '2026-11-15',
        daysUntil: 10,
        displayDate: '2026-11-15',
        editionCount: 1,
        distances: [{ label: '10 km', ticketStatus: null }],
        registrationUrl: 'https://example.com/register',
        registrationStatus: 'Open',
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
        ...overrides,
    };
}

function renderTable(events: EventSummary[]) {
    const theme = createAppTheme('light');
    return render(
        <MemoryRouter>
            <ThemeProvider theme={theme}>
                <EventTableView
                    events={events}
                    userLocation={null}
                    onToggleFavorite={() => {}}
                    isFavoriteEvent={() => false}
                    weekRange={null}
                    months={[]}
                />
            </ThemeProvider>
        </MemoryRouter>
    );
}

describe('EventTableView Register button respects per-race NotStarted ticketStatus (#1601)', () => {
    it('hides the Register button when every race is NotStarted and registration is Open', () => {
        renderTable([makeEvent({
            distances: [{ label: '10 km', ticketStatus: 'NotStarted' }, { label: '21 km', ticketStatus: 'NotStarted' }],
        })]);

        expect(screen.queryByText('Register')).toBeNull();
        // Not fully sold out either, so the chip must not fill in for the hidden button.
        expect(screen.queryByText('SOLD OUT')).toBeNull();
    });

    it('hides the Register button for a mix of SoldOut/NotStarted with zero Available/AlmostSoldOut races', () => {
        renderTable([makeEvent({
            distances: [{ label: '10 km', ticketStatus: 'SoldOut' }, { label: '21 km', ticketStatus: 'NotStarted' }],
        })]);

        expect(screen.queryByText('Register')).toBeNull();
        // Mixed, not uniformly SoldOut — isAllSoldOut must stay false, so no chip either.
        expect(screen.queryByText('SOLD OUT')).toBeNull();
    });

    it('still shows the Register button when at least one race is Available (regression guard)', () => {
        renderTable([makeEvent({
            distances: [{ label: '10 km', ticketStatus: 'NotStarted' }, { label: '21 km', ticketStatus: 'Available' }],
        })]);

        expect(screen.getByText('Register')).not.toBeNull();
    });

    it('still shows the "Sold out" chip, not a button, for a fully SoldOut edition with no NotStarted races', () => {
        renderTable([makeEvent({
            distances: [{ label: '10 km', ticketStatus: 'SoldOut' }, { label: '21 km', ticketStatus: 'SoldOut' }],
        })]);

        expect(screen.getByText('SOLD OUT')).not.toBeNull();
        expect(screen.queryByText('Register')).toBeNull();
    });

    it('shows the Register button when distances is empty, unchanged from before #1601', () => {
        renderTable([makeEvent({ distances: [] })]);

        expect(screen.getByText('Register')).not.toBeNull();
    });
});
