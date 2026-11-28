// @vitest-environment jsdom
//
// #1601: table view's Register button/"Sold out" chip cell (EventTableView.tsx:530-556) only
// gated on isAllSoldOut (SoldOut/Closed), so an edition whose races are all #1553's per-race
// 'NotStarted' ticketStatus — registration not yet open — still showed a live Register button.
// These cover the table view's share of the fix (isAllUnavailableForRegistration added alongside
// the untouched isAllSoldOut chip check); RacesPage.test.tsx covers the two list-view call sites.
// Follows RacesPage.test.tsx's jsdom-opt-in + RTL + real-i18n pattern.
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { unstable_HistoryRouter as HistoryRouter, UNSAFE_createMemoryHistory as createMemoryHistory } from 'react-router-dom';
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
        locationSlug: null,
        scheduleRule: null,
        socialLinks: null,
        nextEditionDate: '2026-11-15',
        daysUntil: 10,
        displayDate: '2026-11-15',
        editionCount: 1,
        distances: [{ label: '10 km', ticketStatus: null }],
        registrationUrl: 'https://example.com/register',
        registrationStatus: 'Open',
        registrationOpens: null,
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
        <HistoryRouter history={createMemoryHistory()}>
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
        </HistoryRouter>
    );
}

// #1925 round 2: spying on history.push directly (rather than observing useLocation() from
// inside the tree) sidesteps React 18's event-handler batching — two synchronous navigate()
// calls from the same click (row onClick + the link's own click-through, if stopPropagation were
// missing) each still call history.push once, even though React only re-renders once with the
// final location, which would make a useLocation()-based counter undercount the duplicate.
function renderTableWithHistorySpy(events: EventSummary[]) {
    const theme = createAppTheme('light');
    const history = createMemoryHistory();
    const pushSpy = vi.spyOn(history, 'push');
    const utils = render(
        <HistoryRouter history={history}>
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
        </HistoryRouter>
    );
    return { ...utils, pushSpy };
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

// #1926: the Links cell rendered nothing (null) for a NotStarted-status edition whose distances
// are therefore all NotStarted (isAllUnavailableForRegistration true) — the visitor had no idea
// registration was coming, only that it wasn't open yet. Mirrors CompetitionDetailPage's #1863 chip.
describe('EventTableView shows a "Registration opens" chip for NotStarted status (#1926)', () => {
    it('shows the chip when registrationStatus is NotStarted and registrationOpens is set', () => {
        renderTable([makeEvent({
            registrationStatus: 'NotStarted',
            registrationOpens: '2026-12-10T00:00:00Z',
            distances: [{ label: '10 km', ticketStatus: 'NotStarted' }],
        })]);

        expect(screen.getByText(/Registration opens/)).not.toBeNull();
        expect(screen.queryByText('Register')).toBeNull();
    });

    it('renders nothing when registrationStatus is NotStarted but registrationOpens is null (regression guard)', () => {
        renderTable([makeEvent({
            registrationStatus: 'NotStarted',
            registrationOpens: null,
            distances: [{ label: '10 km', ticketStatus: 'NotStarted' }],
        })]);

        expect(screen.queryByText(/Registration opens/)).toBeNull();
        expect(screen.queryByText('Register')).toBeNull();
    });

    it('does not show the chip for Open status, unchanged from before #1926', () => {
        renderTable([makeEvent({
            registrationStatus: 'Open',
            registrationOpens: '2026-12-10T00:00:00Z',
        })]);

        expect(screen.queryByText(/Registration opens/)).toBeNull();
        expect(screen.getByText('Register')).not.toBeNull();
    });

    it('does not show the chip for Closed status, unchanged from before #1926', () => {
        renderTable([makeEvent({
            registrationStatus: 'Closed',
            registrationOpens: '2026-12-10T00:00:00Z',
            distances: [{ label: '10 km', ticketStatus: 'Closed' }],
        })]);

        expect(screen.queryByText(/Registration opens/)).toBeNull();
    });

    it('does not show the chip for NotRequired status, unchanged from before #1926', () => {
        renderTable([makeEvent({
            registrationStatus: 'NotRequired',
            registrationOpens: '2026-12-10T00:00:00Z',
        })]);

        expect(screen.queryByText(/Registration opens/)).toBeNull();
    });

    it('does not show the chip for Invitational status, unchanged from before #1926', () => {
        renderTable([makeEvent({
            registrationStatus: 'Invitational',
            registrationOpens: '2026-12-10T00:00:00Z',
        })]);

        expect(screen.queryByText(/Registration opens/)).toBeNull();
    });

    // Review round 1 (PR #1936): isAllUnavailableForRegistration(null/[]) is false regardless of
    // registrationStatus, so a NotStarted edition with no races yet must fall into the Register
    // branch, not the chip branch — locks in the ternary-chain structure RacesPage.tsx was fixed
    // to mirror.
    it('shows the Register button, not the chip, when NotStarted but distances is null (mutual exclusion regression guard)', () => {
        renderTable([makeEvent({
            registrationStatus: 'NotStarted',
            registrationOpens: '2026-12-10T00:00:00Z',
            distances: null,
        })]);

        expect(screen.getByText('Register')).not.toBeNull();
        expect(screen.queryByText(/Registration opens/)).toBeNull();
    });
});

// #1925: the event-name cell previously only navigated via the <TableRow>'s own onClick — no
// <a> anywhere in the row, so right-click "open in new tab" / middle-click had nothing to attach
// to. The name cell now wraps its text in a RouterLink; the row's onClick stays for clicks
// elsewhere in the row.
describe('EventTableView event-name cell renders as a real anchor, not click-only (#1925)', () => {
    it('renders the regular-row event name as an <a href="/events/<slug>">', () => {
        const { container } = renderTable([makeEvent({ slug: 'regular-run', name: 'Regular Run' })]);

        expect(screen.getByText('Regular Run')).not.toBeNull();
        const link = container.querySelector('a[href="/events/regular-run"]');
        expect(link).not.toBeNull();
        expect(link!.tagName).toBe('A');
        expect(link!.textContent).toBe('Regular Run');
    });

    it('renders the series-grouped row event name as an <a href="/events/<slug>"> pointing at the parent event', () => {
        const { container } = renderTable([makeEvent({
            slug: 'series-run', name: 'Series Run', type: 'Series',
            seriesRaces: [{
                raceId: 'race-1',
                raceName: 'Series Race One',
                raceNameEn: null,
                dateOfRace: '2026-12-01',
                startTime: null,
                distanceLabel: '10 km',
                trailElevationGain: null,
                ticketStatus: 'Open',
                registrationUrl: null,
            }],
        })]);

        // This row's name cell renders "<event name> • <race name>" as one run of text inside a
        // single <a> (no nested element wraps the race name alone), so getByText('Series Race
        // One') can't match it the way the regular-row test above does — assert on the anchor's
        // own textContent instead.
        const link = container.querySelector('a[href="/events/series-run"]');
        expect(link).not.toBeNull();
        expect(link!.textContent).toContain('Series Race One');
    });

    // #1925 round 2 (tester-requested): the name link sits inside the <TableRow>'s own onClick,
    // and react-router's Link doesn't stop propagation on its own — without an explicit
    // stopPropagation on the link, a click on the name bubbles up and also fires the row's
    // onClick, pushing a *second* history.push on top of the Link's own navigation. Spying on
    // history.push (via renderTableWithHistorySpy) catches both calls even though React's event
    // batching would only ever render the final location once either way.
    it('calls history.push exactly once when clicking the regular-row name link, not twice via row onClick bubbling', () => {
        const { container, pushSpy } = renderTableWithHistorySpy([makeEvent({ slug: 'regular-run', name: 'Regular Run' })]);

        const link = container.querySelector('a[href="/events/regular-run"]') as HTMLAnchorElement;
        fireEvent.click(link);

        expect(pushSpy).toHaveBeenCalledTimes(1);
    });

    it('calls history.push exactly once when clicking the series-grouped row name link, not twice via row onClick bubbling', () => {
        const { container, pushSpy } = renderTableWithHistorySpy([makeEvent({
            slug: 'series-run', name: 'Series Run', type: 'Series',
            seriesRaces: [{
                raceId: 'race-1',
                raceName: 'Series Race One',
                raceNameEn: null,
                dateOfRace: '2026-12-01',
                startTime: null,
                distanceLabel: '10 km',
                trailElevationGain: null,
                ticketStatus: 'Open',
                registrationUrl: null,
            }],
        })]);

        const link = container.querySelector('a[href="/events/series-run"]') as HTMLAnchorElement;
        fireEvent.click(link);

        expect(pushSpy).toHaveBeenCalledTimes(1);
    });
});

// #1933: once the name cell got its own RouterLink (#1925/#1932), the row's own role="link" +
// tabIndex={0} became a second keyboard/AT focus stop for the same destination. Row keeps its
// onClick for mouse/touch clicks elsewhere, but must no longer expose itself as a focusable
// "link" — the anchor is the sole tab stop.
describe('EventTableView table row is not a second keyboard tab stop (#1933)', () => {
    it('regular row: TableRow has no role="link" or tabIndex, while its name anchor still has an href', () => {
        const { container } = renderTable([makeEvent({ slug: 'regular-run', name: 'Regular Run' })]);

        const row = container.querySelectorAll('tbody tr')[0];
        expect(row.getAttribute('role')).not.toBe('link');
        expect(row.getAttribute('tabindex')).toBeNull();
        expect(container.querySelector('a[href="/events/regular-run"]')).not.toBeNull();
    });

    it('series-grouped row: TableRow has no role="link" or tabIndex, while its name anchor still has an href', () => {
        const { container } = renderTable([makeEvent({
            slug: 'series-run', name: 'Series Run', type: 'Series',
            seriesRaces: [{
                raceId: 'race-1',
                raceName: 'Series Race One',
                raceNameEn: null,
                dateOfRace: '2026-12-01',
                startTime: null,
                distanceLabel: '10 km',
                trailElevationGain: null,
                ticketStatus: 'Open',
                registrationUrl: null,
            }],
        })]);

        const row = container.querySelectorAll('tbody tr')[0];
        expect(row.getAttribute('role')).not.toBe('link');
        expect(row.getAttribute('tabindex')).toBeNull();
        expect(container.querySelector('a[href="/events/series-run"]')).not.toBeNull();
    });
});
