// @vitest-environment jsdom
//
// #1235: backfills test coverage for #1026's URL<->state hydration/sync effects
// (RacesPage.tsx:274-316 and :319-352), which previously had zero automated coverage — only the
// pure `eventFiltersEqual` helper they lean on is unit-tested (eventFilters.test.ts). Follows
// TrailMapView.test.tsx's jsdom-opt-in + RTL + vi.hoisted pattern; the rest of the frontend suite
// runs under vitest.config.ts's global `environment: 'node'`.
import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
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

// #1514: the `months` URL param used to serialize filters.months' internal 0-indexed
// (Date.getMonth()) values verbatim, so a shareable URL read e.g. `months=11` for December —
// leaking a JS convention into a human-facing URL. The fix converts only at the URL boundary
// (RacesPage.tsx's parse/serialize effects); pill selection and eventHasMonthInSet stay 0-indexed.
describe('RacesPage months URL param is 1-indexed (#1514)', () => {
    const decEvent = makeEvent({
        id: 'event-dec', slug: 'december-run', name: 'December Run',
        daysUntil: 40, displayDate: '2026-12-20', nextEditionDate: '2026-12-20',
    });
    const janEvent = makeEvent({
        id: 'event-jan', slug: 'january-run', name: 'January Run',
        daysUntil: 70, displayDate: '2026-01-10', nextEditionDate: '2026-01-10',
    });

    it('selects the December pill and filters to December events for ?months=12', async () => {
        mockEvents.current = [decEvent, janEvent];
        renderRacesPage('/events?months=12');

        await waitFor(() => {
            expect(screen.getByText('December Run')).not.toBeNull();
            expect(screen.queryByText('January Run')).toBeNull();
        });

        // "Dec" renders in two places (the always-mounted filter-drawer month list and the
        // quick-filter pills row) — both are driven by the same filters.months value, so every
        // match must agree on the selected (filled) state.
        const decChips = screen.getAllByText('Dec').map(el => el.closest('.MuiChip-root'));
        expect(decChips.length).toBeGreaterThan(0);
        for (const chip of decChips) {
            expect(chip).not.toBeNull();
            expect(chip!.className).toContain('MuiChip-filled');
        }
    });

    it('selects the January pill (low end unaffected) for ?months=1', async () => {
        mockEvents.current = [decEvent, janEvent];
        renderRacesPage('/events?months=1');

        await waitFor(() => {
            expect(screen.getByText('January Run')).not.toBeNull();
            expect(screen.queryByText('December Run')).toBeNull();
        });

        const janChips = screen.getAllByText('Jan').map(el => el.closest('.MuiChip-root'));
        expect(janChips.length).toBeGreaterThan(0);
        for (const chip of janChips) {
            expect(chip).not.toBeNull();
            expect(chip!.className).toContain('MuiChip-filled');
        }
    });

    it('writes months=12 to the URL, not the internal 0-indexed 11, when December is selected', async () => {
        mockEvents.current = [decEvent, janEvent];
        setSearchParamsSpy.mockClear();
        renderRacesPage('/events?months=12');

        // The parse effect reads months=12 into internal index 11; the serialize effect must then
        // write 12 back out, not the internal 11 — this is the canonical-URL round-trip the issue
        // is about, and a regression here would be a sync effect that re-writes `months=11`.
        await act(async () => { await Promise.resolve(); });
        const monthsWrites = setSearchParamsSpy.mock.calls
            .map(([params]) => (params as URLSearchParams).get('months'))
            .filter((v): v is string => v !== null);
        for (const v of monthsWrites) {
            expect(v).toBe('12');
        }
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

    // #1498: same silent-failure pattern as the two call sites above, found in the Site QR
    // dialog's "Copy site URL" button. That button is only reachable once the dialog is open, so
    // this opens it via the unconditional Site QR Fab (aria-label t('races.shareQR')) first.
    it('Site QR dialog copy button keeps the pre-copy icon when writeText rejects', async () => {
        stubRejectingClipboard();
        mockEvents.current = [runningEvent, trailEvent];
        renderRacesPage('/events?activity=Running');

        const shareQRIcon = screen.getByTestId('QrCode2Icon');
        const shareQRFab = shareQRIcon.closest('button');
        expect(shareQRFab).not.toBeNull();
        fireEvent.click(shareQRFab!);

        // activity=Running also renders the page's own "Copy filter URL" button sharing the same
        // ContentCopyIcon testid, so the copy button under test must be scoped to the dialog.
        const dialog = screen.getByRole('dialog');
        const copyIcon = within(dialog).getByTestId('ContentCopyIcon');
        const copyButton = copyIcon.closest('button');
        expect(copyButton).not.toBeNull();

        await act(async () => {
            fireEvent.click(copyButton!);
            await Promise.resolve().catch(() => {});
        });

        expect(within(dialog).queryByTestId('CheckIcon')).toBeNull();
        expect(within(dialog).getByTestId('ContentCopyIcon')).not.toBeNull();
    });
});

// #1512: the reject-path tests above only prove the buttons don't show a false positive — they
// don't prove the success state ever renders at all. These cover the resolve path (mirroring
// TrailList.test.tsx's #1497 "copy buttons show the copied checkmark when writeText resolves"
// block) so a regression that broke the "copied" checkmark entirely, not just the reject-path
// bug, would also be caught.
describe('RacesPage copy buttons show the copied checkmark when writeText resolves (#1512)', () => {
    // #1521: each handler below arms a real 2000ms setTimeout (RacesPage.tsx:710-715/:732-742/
    // :1909-1913) to reset the checkmark back to the copy icon, and that setTimeout is still live
    // when the test returns if nothing advances it. Fake timers here, advanced well past 2000ms
    // and torn down in afterEach, so nothing outlives the test.
    //
    // This also happens to settle RacesPage.tsx:268-280's one-time swipe-hint timer (1200ms, then
    // a nested 800ms) — reachable in principle on every renderRacesPage() call in this file, but
    // under *real* timers (every other describe block above) the component unmounts via the
    // top-level afterEach(cleanup) well before 1200ms of real wall-clock time passes, and the
    // effect's own `return () => clearTimeout(timer)` cancels it — so it was never actually
    // left pending in those blocks. Here, advancing fake time by more than 2000ms does fire it for
    // real; advancing comfortably past both its 1200ms and nested 800ms (i.e. past the 2000ms
    // mark) rather than stopping exactly at 2000ms keeps that settle deterministic too.
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        // @ts-expect-error -- test-only override of a browser API jsdom doesn't implement
        delete navigator.clipboard;
        vi.useRealTimers();
    });

    function stubResolvingClipboard() {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
            configurable: true,
        });
    }

    it('Copy URL button swaps to CheckIcon when writeText resolves', async () => {
        stubResolvingClipboard();
        mockEvents.current = [runningEvent, trailEvent];
        renderRacesPage('/events?activity=Running');

        const copyIcon = screen.getByTestId('ContentCopyIcon');
        const copyButton = copyIcon.closest('button');
        expect(copyButton).not.toBeNull();

        await act(async () => {
            fireEvent.click(copyButton!);
            // Flush the resolved microtask through the .then() handler.
            await Promise.resolve();
        });

        expect(screen.getByTestId('CheckIcon')).not.toBeNull();
        expect(screen.queryByTestId('ContentCopyIcon')).toBeNull();

        // Run the 2000ms reset timer (RacesPage.tsx:710-715) to completion inside act() — the
        // callback updates React state — plus the swipe-hint timer chain past its own 2000ms
        // total, so neither is left pending once the test returns.
        await act(async () => {
            vi.advanceTimersByTime(2100);
        });
    });

    it('Copy list button swaps to CheckIcon when writeText resolves', async () => {
        stubResolvingClipboard();
        mockEvents.current = [runningEvent, trailEvent];
        renderRacesPage('/events?activity=Running');

        const listIcon = screen.getByTestId('FormatListBulletedIcon');
        const listButton = listIcon.closest('button');
        expect(listButton).not.toBeNull();

        await act(async () => {
            fireEvent.click(listButton!);
            await Promise.resolve();
        });

        expect(screen.getByTestId('CheckIcon')).not.toBeNull();
        expect(screen.queryByTestId('FormatListBulletedIcon')).toBeNull();

        // Run the 2000ms reset timer (RacesPage.tsx:732-742) to completion inside act() — same
        // reasoning as the Copy URL test above.
        await act(async () => {
            vi.advanceTimersByTime(2100);
        });
    });

    // #1498/#1512: same resolve-path parity for the Site QR dialog's copy button as the two
    // call sites above — opened via the Site QR Fab (aria-label t('races.shareQR')) first.
    it('Site QR dialog copy button swaps to CheckIcon when writeText resolves', async () => {
        stubResolvingClipboard();
        mockEvents.current = [runningEvent, trailEvent];
        renderRacesPage('/events?activity=Running');

        const shareQRIcon = screen.getByTestId('QrCode2Icon');
        const shareQRFab = shareQRIcon.closest('button');
        expect(shareQRFab).not.toBeNull();
        fireEvent.click(shareQRFab!);

        // activity=Running also renders the page's own "Copy filter URL" button sharing the same
        // ContentCopyIcon testid, so the copy button under test must be scoped to the dialog.
        const dialog = screen.getByRole('dialog');
        const copyIcon = within(dialog).getByTestId('ContentCopyIcon');
        const copyButton = copyIcon.closest('button');
        expect(copyButton).not.toBeNull();

        await act(async () => {
            fireEvent.click(copyButton!);
            await Promise.resolve();
        });

        expect(within(dialog).getByTestId('CheckIcon')).not.toBeNull();
        expect(within(dialog).queryByTestId('ContentCopyIcon')).toBeNull();

        // Run the dialog's own 2000ms reset timer (RacesPage.tsx:1909-1913) to completion inside
        // act() — same reasoning as the two tests above.
        await act(async () => {
            vi.advanceTimersByTime(2100);
        });
    });
});

// #1524: linkCopiedTimer/listCopiedTimer (RacesPage.tsx:197/199) and the Site QR dialog's own
// siteQRCopiedTimer each arm a real 2000ms setTimeout on a successful copy but were never cleared
// on unmount — so unmounting within that window left the timer live, and its callback's
// setXCopied(false) then fired a React "state update on an unmounted component" warning (surfaced
// via console.error). Fake timers so the still-pending callback can be advanced past 2000ms
// *after* unmount, inside the same act() call, without waiting on real wall-clock time.
describe('RacesPage copy buttons do not leak timer state updates after unmount (#1524)', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        // @ts-expect-error -- test-only override of a browser API jsdom doesn't implement
        delete navigator.clipboard;
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        vi.useRealTimers();
    });

    function stubResolvingClipboard() {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
            configurable: true,
        });
    }

    it('Copy URL button: unmounting right after a successful copy logs no console error/warn', async () => {
        stubResolvingClipboard();
        mockEvents.current = [runningEvent, trailEvent];
        const { unmount } = renderRacesPage('/events?activity=Running');

        const copyButton = screen.getByTestId('ContentCopyIcon').closest('button');
        expect(copyButton).not.toBeNull();

        await act(async () => {
            fireEvent.click(copyButton!);
            await Promise.resolve();
        });

        unmount();

        // The pre-#1524 bug only surfaces once the orphaned 2000ms timer actually fires.
        await act(async () => {
            vi.advanceTimersByTime(2100);
        });

        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('Copy list button: unmounting right after a successful copy logs no console error/warn', async () => {
        stubResolvingClipboard();
        mockEvents.current = [runningEvent, trailEvent];
        const { unmount } = renderRacesPage('/events?activity=Running');

        const listButton = screen.getByTestId('FormatListBulletedIcon').closest('button');
        expect(listButton).not.toBeNull();

        await act(async () => {
            fireEvent.click(listButton!);
            await Promise.resolve();
        });

        unmount();

        await act(async () => {
            vi.advanceTimersByTime(2100);
        });

        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    // #1524: the Site QR dialog copy button had no timer ref at all before this fix, so it's the
    // most direct regression guard for the acceptance criterion that it's now stored in a ref and
    // cleared on unmount — opened via the Site QR Fab (aria-label t('races.shareQR')) first, same
    // as the resolve/reject-path tests above.
    it('Site QR dialog copy button: unmounting right after a successful copy logs no console error/warn', async () => {
        stubResolvingClipboard();
        mockEvents.current = [runningEvent, trailEvent];
        const { unmount } = renderRacesPage('/events?activity=Running');

        const shareQRIcon = screen.getByTestId('QrCode2Icon');
        const shareQRFab = shareQRIcon.closest('button');
        expect(shareQRFab).not.toBeNull();
        fireEvent.click(shareQRFab!);

        const dialog = screen.getByRole('dialog');
        const copyIcon = within(dialog).getByTestId('ContentCopyIcon');
        const copyButton = copyIcon.closest('button');
        expect(copyButton).not.toBeNull();

        await act(async () => {
            fireEvent.click(copyButton!);
            await Promise.resolve();
        });

        unmount();

        await act(async () => {
            vi.advanceTimersByTime(2100);
        });

        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
});

// #1601: list view's Register button (RacesPage.tsx:1597's swipe leftActions and :1743's inline
// card button, both gated on the same comp.distances) used to ignore #1553's per-race 'NotStarted'
// ticketStatus — an edition whose races hadn't opened registration yet still showed a live button.
// The swipe leftActions copy of the button only renders once the card is swipe-revealed (not on a
// plain mount — see SwipeableCard's showLeftPanel), so these assert against the always-rendered
// inline button; both call sites share the same isAllUnavailableForRegistration(comp.distances)
// condition, so this is a regression guard for both.
describe('RacesPage list view Register button respects per-race NotStarted ticketStatus (#1601)', () => {
    function makeRegisterableEvent(overrides: Partial<EventSummary> = {}): EventSummary {
        return makeEvent({
            registrationUrl: 'https://example.com/register',
            registrationStatus: 'Open',
            daysUntil: 10,
            ...overrides,
        });
    }

    it('hides the Register button when every race is NotStarted and registration is Open', async () => {
        mockEvents.current = [makeRegisterableEvent({
            distances: [{ label: '10 km', ticketStatus: 'NotStarted' }, { label: '21 km', ticketStatus: 'NotStarted' }],
        })];
        renderRacesPage('/events');

        await waitFor(() => expect(screen.getByText('Event')).not.toBeNull());
        expect(screen.queryByText('Register')).toBeNull();
    });

    it('hides the Register button for a mix of SoldOut/NotStarted with zero Available/AlmostSoldOut races', async () => {
        mockEvents.current = [makeRegisterableEvent({
            distances: [{ label: '10 km', ticketStatus: 'SoldOut' }, { label: '21 km', ticketStatus: 'NotStarted' }],
        })];
        renderRacesPage('/events');

        await waitFor(() => expect(screen.getByText('Event')).not.toBeNull());
        expect(screen.queryByText('Register')).toBeNull();
    });

    it('still shows the Register button when at least one race is Available (regression guard)', async () => {
        mockEvents.current = [makeRegisterableEvent({
            distances: [{ label: '10 km', ticketStatus: 'NotStarted' }, { label: '21 km', ticketStatus: 'Available' }],
        })];
        renderRacesPage('/events');

        await waitFor(() => expect(screen.getByText('Register')).not.toBeNull());
    });

    it('shows the Register button when distances is empty, unchanged from before #1601', async () => {
        mockEvents.current = [makeRegisterableEvent({ distances: [] })];
        renderRacesPage('/events');

        await waitFor(() => expect(screen.getByText('Register')).not.toBeNull());
    });
});
