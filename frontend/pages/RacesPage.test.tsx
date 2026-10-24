// @vitest-environment jsdom
//
// #1235: backfills test coverage for #1026's URL<->state hydration/sync effects
// (RacesPage.tsx:274-316 and :319-352), which previously had zero automated coverage — only the
// pure `eventFiltersEqual` helper they lean on is unit-tested (eventFilters.test.ts). Follows
// TrailMapView.test.tsx's jsdom-opt-in + RTL + vi.hoisted pattern; the rest of the frontend suite
// runs under vitest.config.ts's global `environment: 'node'`.
import React, { useEffect } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import { createAppTheme } from '../theme';
import type { EventSummary } from '../hooks/useEvents';

// vitest.config.ts doesn't set `globals: true`, so @testing-library/react's automatic
// afterEach(cleanup) registration never fires — without this, a later test's screen queries can
// match leftover DOM nodes still mounted from an earlier test in this file. Mirrors
// TrailMapView.test.tsx:20.
afterEach(cleanup);

// RacesPage's t()/useLocalize() calls need a real, initialized i18next instance (react-i18next's
// useTranslation() otherwise falls back to raw keys, e.g. `t('races.months', { returnObjects:
// true })` would return the key string instead of an array, breaking the month-chip rendering
// below it) — initialized once with the real EN resources rather than a hand-rolled stub, so the
// hydration/sync tests below exercise the same strings production does.
void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

// #1299/#1303's TrailMapView.test.tsx precedent mocks out components/hooks that are heavy but
// orthogonal to what's under test; Layout pulls in useMediaQuery (jsdom has no window.matchMedia
// implementation, so a real Layout render throws) plus a dozen more data-fetching hooks
// (useHeaderWeather, useInstallPrompt, useLoginEnabled, ...) that have nothing to do with the
// hydration/sync effects this file targets. Mocked to a bare passthrough so RacesPage's own
// content — the thing under test — still renders.
vi.mock('../components/Layout', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const { mockEvents } = vi.hoisted(() => ({
    // Mutable so individual tests can swap fixtures without re-mocking; mockEvents.current is read
    // fresh on every useEvents() call below.
    mockEvents: { current: [] as EventSummary[] },
}));

vi.mock('../hooks/useEvents', () => ({
    useEvents: () => ({ events: mockEvents.current, loading: false, error: null, refresh: vi.fn() }),
}));
vi.mock('../hooks/useFeatureFlags', () => ({
    useFeatureFlags: () => ({ flags: {}, loaded: true, isEnabled: () => true }),
}));
vi.mock('../hooks/useFavoriteEvents', () => ({
    useFavoriteEvents: () => ({ favoriteEvents: [], toggleFavoriteEvent: vi.fn(), isFavoriteEvent: () => false }),
}));
vi.mock('../hooks/useIcelandicHolidays', () => ({
    useIcelandicHolidays: () => ({ getHolidays: () => [], isHoliday: () => false }),
}));

// #1235 test 2 (no ping-pong): react-router-dom's real useSearchParams is kept (the hydration/sync
// effects under test must actually run against it), but its setter is wrapped so the test can
// count how many times RacesPage actually calls setSearchParams — the observable proxy for "did
// the URL<->state dance settle or loop".
const { setSearchParamsSpy } = vi.hoisted(() => ({ setSearchParamsSpy: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useSearchParams: (...args: Parameters<typeof actual.useSearchParams>) => {
            const [params, setParams] = actual.useSearchParams(...args);
            const wrappedSetParams: typeof setParams = (...setArgs) => {
                setSearchParamsSpy(...setArgs);
                return setParams(...setArgs);
            };
            return [params, wrappedSetParams] as const;
        },
    };
});

import RacesPage from './RacesPage';

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
        ...overrides,
    };
}

const runningEvent = makeEvent({
    id: 'event-running', slug: 'midnight-sun-run', name: 'Midnight Sun Run',
    activityType: 'Running', daysUntil: 10, displayDate: '2026-11-15', nextEditionDate: '2026-11-15',
});
const trailEvent = makeEvent({
    id: 'event-trail', slug: 'laugavegur-ultra', name: 'Laugavegur Ultra',
    activityType: 'TrailRunning', daysUntil: 20, displayDate: '2026-11-25', nextEditionDate: '2026-11-25',
});

function NavigateCapture({ navigateRef }: { navigateRef: { current: ((to: string) => void) | null } }) {
    const navigate = useNavigate();
    // Assigned in an effect, not during render — a ref write during render is a React lint error
    // (react-hooks/refs) even though it's otherwise harmless here (navigateRef itself isn't read
    // until after the initial render, from inside an `act()` call in the tests below).
    useEffect(() => { navigateRef.current = navigate; }, [navigate, navigateRef]);
    return null;
}

function renderRacesPage(initialPath: string) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const theme = createAppTheme('light');
    const navigateRef: { current: ((to: string) => void) | null } = { current: null };
    const utils = render(
        <MemoryRouter initialEntries={[initialPath]}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider theme={theme}>
                    <NavigateCapture navigateRef={navigateRef} />
                    <RacesPage mode="light" onToggleMode={() => {}} />
                </ThemeProvider>
            </QueryClientProvider>
        </MemoryRouter>
    );
    return { ...utils, navigateRef };
}

describe('RacesPage URL->state hydration effect (#1026, #1235)', () => {
    it('re-derives filters from a changed searchParams without remounting the component', async () => {
        mockEvents.current = [runningEvent, trailEvent];
        const { navigateRef } = renderRacesPage('/events?activity=Running');

        // Initial URL filters to activityType=Running: only the Running event shows. Plain
        // getByText/queryByText assertions (no @testing-library/jest-dom in this repo, see
        // TrailMapView.test.tsx's equivalent className/toContain checks) — getByText already
        // throws if the node is missing, and queryByText returns null when absent.
        expect(screen.getByText('Midnight Sun Run')).not.toBeNull();
        expect(screen.queryByText('Laugavegur Ultra')).toBeNull();

        // Same-route navigate() — React Router doesn't remount RacesPage for this, it just hands
        // it a new `searchParams`. This is exactly what SpotlightSearch / the nav menu do (#1026).
        act(() => { navigateRef.current!('/events?activity=TrailRunning'); });

        await waitFor(() => {
            expect(screen.getByText('Laugavegur Ultra')).not.toBeNull();
            expect(screen.queryByText('Midnight Sun Run')).toBeNull();
        });
    });
});

describe('RacesPage URL<->state sync effects settle without ping-ponging (#1026, #1235)', () => {
    it('normalizes a stale empty "q" param exactly once, then calls setSearchParams no further times', async () => {
        mockEvents.current = [runningEvent, trailEvent];
        setSearchParamsSpy.mockClear();

        // An empty "q=" is semantically "no search" (search state ends up '' either way) but isn't
        // the sync effect's own canonical serialization of that state (which omits the key
        // entirely) — so mounting here forces exactly one state->URL write to drop it, then the
        // URL->state effect above must read that cleaned-up URL back into equal-by-value state and
        // bail out via eventFiltersEqual, rather than writing the URL again (the #1026 ping-pong
        // this issue is about).
        renderRacesPage('/events?q=&activity=Running');

        await waitFor(() => expect(setSearchParamsSpy).toHaveBeenCalledTimes(1));

        const callsAfterSettling = setSearchParamsSpy.mock.calls.length;
        // Flush any further pending effects/microtasks — a looping pair of effects would keep
        // calling setSearchParams here instead of staying at 1.
        await act(async () => { await Promise.resolve(); });

        expect(setSearchParamsSpy).toHaveBeenCalledTimes(callsAfterSettling);
        expect(setSearchParamsSpy).toHaveBeenCalledTimes(1);
    });

    it('does not call setSearchParams on mount when the URL is already in canonical form', async () => {
        mockEvents.current = [runningEvent, trailEvent];
        setSearchParamsSpy.mockClear();

        renderRacesPage('/events?activity=Running');

        expect(screen.getByText('Midnight Sun Run')).not.toBeNull();
        await act(async () => { await Promise.resolve(); });

        expect(setSearchParamsSpy).not.toHaveBeenCalled();
    });
});

// #1489: navigator.clipboard.writeText(...) is a Promise-returning API; the Copy URL and Copy
// list buttons used to flip to the "copied" checkmark unconditionally, right after firing the
// call, so a rejected promise (permission denied, insecure context, etc.) still showed a success
// checkmark for a copy that never happened. These stub writeText to reject and assert the
// checkmark (CheckIcon, data-testid from @mui/icons-material's createSvgIcon) never appears, while
// the pre-copy icon (ContentCopyIcon / FormatListBulletedIcon) stays put.
describe('RacesPage copy buttons do not show success on a rejected clipboard write (#1489)', () => {
    afterEach(() => {
        // @ts-expect-error -- test-only override of a browser API jsdom doesn't implement
        delete navigator.clipboard;
    });

    function stubRejectingClipboard() {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
            configurable: true,
        });
    }

    it('Copy URL button keeps the pre-copy icon when writeText rejects', async () => {
        stubRejectingClipboard();
        mockEvents.current = [runningEvent, trailEvent];
        // activity=Running makes activeFilterCount > 0, which is what gates the Copy URL button.
        renderRacesPage('/events?activity=Running');

        const copyIcon = screen.getByTestId('ContentCopyIcon');
        const copyButton = copyIcon.closest('button');
        expect(copyButton).not.toBeNull();

        await act(async () => {
            fireEvent.click(copyButton!);
            // Flush the rejected microtask through the .catch() handler.
            await Promise.resolve().catch(() => {});
        });

        expect(screen.queryByTestId('CheckIcon')).toBeNull();
        expect(screen.getByTestId('ContentCopyIcon')).not.toBeNull();
    });

    it('Copy list button keeps the pre-copy icon when writeText rejects', async () => {
        stubRejectingClipboard();
        mockEvents.current = [runningEvent, trailEvent];
        renderRacesPage('/events?activity=Running');

        const listIcon = screen.getByTestId('FormatListBulletedIcon');
        const listButton = listIcon.closest('button');
        expect(listButton).not.toBeNull();

        await act(async () => {
            fireEvent.click(listButton!);
            await Promise.resolve().catch(() => {});
        });

        expect(screen.queryByTestId('CheckIcon')).toBeNull();
        expect(screen.getByTestId('FormatListBulletedIcon')).not.toBeNull();
    });
});
