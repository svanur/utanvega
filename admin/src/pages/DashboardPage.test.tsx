// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import DashboardPage from './DashboardPage';

// Issue #861: {today, in30days} used to be frozen for the lifetime of the mount via a one-shot
// useState lazy initializer (the #556 react-hooks/purity fix), so the "Upcoming Events (next 30
// days)" panel would silently go stale in a long-lived admin tab. DashboardPage.tsx now still
// lazy-initializes the window (keeping the render body free of direct Date.now()/new Date()
// calls) but also refreshes it from an effect (hourly interval + visibilitychange). This test
// mounts the page once with fake timers, advances wall-clock time past a day boundary without
// remounting, and asserts an event that started out >30 days away enters the window.

const UPCOMING_EVENT_NAME = 'Future Trail Race';
const FIXED_NEXT_EDITION_DATE = '2026-02-03';

vi.mock('../hooks/api', () => ({
    apiFetch: vi.fn((endpoint: string) => {
        if (endpoint.startsWith('/api/v1/admin/analytics')) {
            return Promise.resolve({
                summary: { totalViews: 0, viewsThisWeek: 0, viewsLastWeek: 0 },
                dailyViews: [],
            });
        }
        if (endpoint.startsWith('/api/v1/admin/events')) {
            return Promise.resolve([
                {
                    id: 'event-1',
                    name: UPCOMING_EVENT_NAME,
                    nameEn: null,
                    slug: 'future-trail-race',
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
                    nextEditionDate: FIXED_NEXT_EDITION_DATE,
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
                    editionStatus: null,
                    editionEffectiveCancelled: false,
                },
            ]);
        }
        if (endpoint.startsWith('/api/v1/admin/trails')) return Promise.resolve([]);
        if (endpoint.startsWith('/api/v1/admin/history')) return Promise.resolve([]);
        if (endpoint.startsWith('/api/v1/admin/health')) {
            return Promise.resolve({ status: 'ok', gitHash: 'abc1234', timestampUtc: '2026-01-01T00:00:00Z' });
        }
        if (endpoint.startsWith('/api/v1/admin/feedback')) {
            return Promise.resolve({
                items: [],
                total: 0,
                counts: { total: 0, new: 0, reviewed: 0, closed: 0, avgResolutionHours: null },
            });
        }
        return Promise.resolve([]);
    }),
}));

function renderDashboard() {
    render(
        <DashboardPage
            onNewEvent={() => {}}
            onUploadTrail={() => {}}
            onNavigate={() => {}}
        />,
    );
}

describe('DashboardPage — upcoming-events window stays current across a day boundary', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('brings a >30-day-out event into the window once the interval recomputes it, without remounting', async () => {
        renderDashboard();

        // Flush the mount-time apiFetch promise chains (plain microtasks — unaffected by fake
        // timers) so `events`/`eventsLoading` settle before asserting on them. testing-library's
        // `waitFor` polls via `setInterval`, which fake timers freeze, so it can't be used here.
        await act(async () => {
            for (let i = 0; i < 10; i++) await Promise.resolve();
        });

        // 2026-02-03 is 33 days after the fake "now" (2026-01-01) — outside the initial
        // [today, today+30d] window, so the panel should report no upcoming events once loaded.
        // (No @testing-library/jest-dom in this repo, so plain truthy checks rather than
        // toBeInTheDocument() — matches the assertion style already used elsewhere, e.g.
        // EventHealth.test.tsx.)
        expect(screen.getByText('No events in the next 30 days')).toBeTruthy();
        expect(screen.queryByText(UPCOMING_EVENT_NAME)).toBeNull();

        // Advance 5 days without remounting. DashboardPage's effect recomputes
        // {today, in30days} on an hourly interval, moving the window to
        // [2026-01-06, 2026-02-05], which now contains 2026-02-03.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5 * 24 * 60 * 60 * 1000);
        });

        expect(screen.getByText(UPCOMING_EVENT_NAME)).toBeTruthy();
    });
});
