// @vitest-environment jsdom
//
// #1497: backfills RTL coverage for TrailList.tsx's "Copy link" (:755-773) and "Copy list"
// (:777-804) clipboard buttons, which had zero test coverage despite the equivalent RacesPage
// buttons being covered since #1489 (RacesPage.test.tsx:236-292) — both already use the correct
// writeText().then()/.catch() pattern (fixed alongside RacesPage in #1489/#1496), this file only
// adds the missing regression guard. Follows RacesPage.test.tsx's jsdom-opt-in + RTL + vi.hoisted
// pattern; the rest of the frontend suite runs under vitest.config.ts's global `environment: 'node'`.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import { createAppTheme } from '../theme';
import type { Trail } from '../hooks/useTrails';

// vitest.config.ts doesn't set `globals: true`, so @testing-library/react's automatic
// afterEach(cleanup) registration never fires — without this, a later test's screen queries can
// match leftover DOM nodes still mounted from an earlier test in this file. Mirrors
// RacesPage.test.tsx:24.
afterEach(cleanup);

// TrailList's t()/useLocalize() calls need a real, initialized i18next instance (react-i18next's
// useTranslation() otherwise falls back to raw keys) — initialized once with the real EN
// resources, same as RacesPage.test.tsx:31-36, so the assertions below exercise the same strings
// production does.
void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

// TrailCard pulls in a long chain of its own hooks/components (useTickedTrails -> useAuth ->
// AuthContext, QRCodeShare's own ContentCopyIcon/CheckIcon, TrailQuickView, ElevationSparkline,
// ...) that are orthogonal to the two search-bar copy buttons under test here and would otherwise
// need their own provider/mock setup just to mount — stubbed to a bare passthrough that renders
// the trail name, same "heavy but orthogonal" precedent as RacesPage.test.tsx mocking Layout.
vi.mock('./TrailCard', () => ({
    TrailCard: ({ trail }: { trail: Trail }) => <div>{trail.name}</div>,
}));

// vi.mock factories are hoisted above regular module-level declarations, so anything they
// reference (DEFAULT_FILTERS, mockTrailsState) must live inside vi.hoisted too — a plain top-level
// const here would throw "Cannot access before initialization" once the mock factory below runs.
// mockTrailsState is mutable so individual tests can swap fixtures/filters without re-mocking;
// it's read fresh on every useTrails() call. filters.locationSlugs starts non-empty so
// activeFilterCount > 0 by default — that's what gates the "Copy link" button (TrailList.tsx:755).
const { DEFAULT_FILTERS, mockTrailsState, mockLocationsState } = vi.hoisted(() => {
    const defaultFilters = {
        lengthBuckets: [],
        elevationGainBuckets: [],
        climbRatioBuckets: [],
        distanceBuckets: [],
        difficulties: [],
        locationSlugs: [],
        favoritesOnly: false,
        offlineOnly: false,
        selectedTags: [],
        selectedActivityTypes: [],
        sortBy: 'distance',
    };
    return {
        DEFAULT_FILTERS: defaultFilters,
        mockTrailsState: {
            trails: [] as unknown[],
            filters: { ...defaultFilters } as Record<string, unknown>,
        },
        // #1507: mutable so the location-chip test below can flip on `locations_page` and seed a
        // location tree without disturbing every other test in this file, which relies on the
        // Advanced Filters "Location" Autocomplete (TrailList.tsx:840) staying unrendered — it's
        // gated on both `isEnabled('locations_page')` and a non-empty locationMenuItems list.
        mockLocationsState: {
            locationsPageEnabled: false,
            tree: [] as { slug: string; name: string; nameEn: string | null; totalTrailsCount: number; children: unknown[] }[],
        },
    };
});

function makeTrail(overrides: Partial<Trail> = {}): Trail {
    return {
        id: 'trail-1',
        name: 'Esjan',
        slug: 'esjan',
        length: 8000,
        elevationGain: 780,
        elevationLoss: 780,
        status: 'Published',
        activityType: 'TrailRunning',
        trailType: 'OutAndBack',
        difficulty: 'Moderate',
        startLatitude: 64.2,
        startLongitude: -21.7,
        locations: [],
        ...overrides,
    };
}

vi.mock('../hooks/useTrails', () => ({
    ALL_ACTIVITY_TYPES: ['TrailRunning', 'Running', 'Hiking', 'Cycling', 'FunRun', 'ObstacleCourse', 'CrossCountryRun'],
    DEFAULT_FILTERS,
    useTrendingTrails: () => ({ trending: [] }),
    useTrails: () => ({
        trails: mockTrailsState.trails,
        loading: false,
        refreshing: false,
        refresh: vi.fn(),
        error: null,
        userLocation: null,
        locationDenied: false,
        requestLocation: vi.fn(),
        searchQuery: '',
        setSearchQuery: vi.fn(),
        filters: mockTrailsState.filters,
        setFilters: vi.fn(),
        resetFilters: vi.fn(),
    }),
}));

vi.mock('../hooks/useFavorites', () => ({
    useFavorites: () => ({ favorites: [], toggleFavorite: vi.fn() }),
}));
vi.mock('../hooks/useHiddenTrails', () => ({
    useHiddenTrails: () => ({ hiddenSlugs: [] }),
}));
vi.mock('../hooks/useRecentlyViewed', () => ({
    useRecentlyViewed: () => ({ recentSlugs: [] }),
}));
vi.mock('../hooks/useLocations', () => ({
    useLocationTree: () => ({ tree: mockLocationsState.tree }),
}));
vi.mock('../hooks/useFeatureFlags', () => ({
    useFeatureFlags: () => ({
        flags: {},
        loaded: true,
        isEnabled: (flag: string) => flag === 'locations_page' && mockLocationsState.locationsPageEnabled,
    }),
}));
vi.mock('../hooks/useEvents', () => ({
    useEvents: () => ({ events: [], loading: false, error: null, refresh: vi.fn() }),
}));
vi.mock('../hooks/useOfflineTrails', () => ({
    useOfflineTrails: () => ({ offlineSlugs: new Set<string>(), isOffline: () => false }),
}));

import { TrailList } from './TrailList';

function renderTrailList() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const theme = createAppTheme('light');
    return render(
        <MemoryRouter initialEntries={['/']}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider theme={theme}>
                    <TrailList />
                </ThemeProvider>
            </QueryClientProvider>
        </MemoryRouter>
    );
}

// #1497: navigator.clipboard.writeText(...) is a Promise-returning API; both buttons already
// pipe it through .then()/.catch() (fixed in #1489/#1496, confirmed at TrailList.tsx:761-765 and
// :792-796), but had no regression test guarding against a future reintroduction of the earlier
// bug where a rejected promise still flipped the UI to the "copied" checkmark. Same technique as
// RacesPage.test.tsx:242-292: stub writeText to reject and assert CheckIcon never appears while
// the pre-copy icon (ContentCopyIcon / FormatListBulletedIcon) stays put.
describe('TrailList copy buttons do not show success on a rejected clipboard write (#1497)', () => {
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

    it('Copy link button keeps the pre-copy icon when writeText rejects', async () => {
        stubRejectingClipboard();
        mockTrailsState.trails = [makeTrail()];
        // Non-empty locationSlugs makes activeFilterCount > 0, which is what gates the Copy link
        // button (TrailList.tsx:755).
        mockTrailsState.filters = { ...DEFAULT_FILTERS, locationSlugs: ['reykjavik'] };
        renderTrailList();

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
        mockTrailsState.trails = [makeTrail()];
        // #1483: the Copy list button only needs a non-empty result set, not activeFilterCount > 0
        // (TrailList.tsx:777) — default (no active filters) is deliberate here.
        mockTrailsState.filters = { ...DEFAULT_FILTERS };
        renderTrailList();

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

// #1497 round 1 review: the reject-path tests above only prove the buttons don't show a false
// positive — they don't prove the success state ever renders at all. These cover the resolve
// path so a regression that broke the "copied" checkmark entirely (not just the reject-path
// bug) would also be caught.
describe('TrailList copy buttons show the copied checkmark when writeText resolves (#1497)', () => {
    afterEach(() => {
        // @ts-expect-error -- test-only override of a browser API jsdom doesn't implement
        delete navigator.clipboard;
    });

    function stubResolvingClipboard() {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
            configurable: true,
        });
    }

    it('Copy link button swaps to CheckIcon when writeText resolves', async () => {
        stubResolvingClipboard();
        mockTrailsState.trails = [makeTrail()];
        mockTrailsState.filters = { ...DEFAULT_FILTERS, locationSlugs: ['reykjavik'] };
        renderTrailList();

        const copyButton = screen.getByTestId('ContentCopyIcon').closest('button');
        expect(copyButton).not.toBeNull();

        await act(async () => {
            fireEvent.click(copyButton!);
            // Flush the resolved microtask through the .then() handler.
            await Promise.resolve();
        });

        expect(screen.getByTestId('CheckIcon')).not.toBeNull();
        expect(screen.queryByTestId('ContentCopyIcon')).toBeNull();
    });

    it('Copy list button swaps to CheckIcon when writeText resolves', async () => {
        stubResolvingClipboard();
        mockTrailsState.trails = [makeTrail()];
        mockTrailsState.filters = { ...DEFAULT_FILTERS };
        renderTrailList();

        const listButton = screen.getByTestId('FormatListBulletedIcon').closest('button');
        expect(listButton).not.toBeNull();

        await act(async () => {
            fireEvent.click(listButton!);
            await Promise.resolve();
        });

        expect(screen.getByTestId('CheckIcon')).not.toBeNull();
        expect(screen.queryByTestId('FormatListBulletedIcon')).toBeNull();
    });
});

// #1507: the selected-location Chip's delete ("x") icon had a sub-44px tap target at 375px.
// Review round 1 tried a ::before overlay on `.MuiChip-deleteIcon` plus `overflow: hidden` on the
// chip root to stop it bleeding onto a neighbouring chip — but that clipped the overlay back down
// to the chip's own ~24px box, defeating the 44px goal jsdom's fireEvent.click couldn't catch
// (it skips layout/overflow clipping entirely). Round 2's real fix grows the chip itself
// (minHeight: 44, the same floor FILTER_CHIP_SX uses for the Advanced Filters toggle pills per
// #1487/PR #1505) and gives the delete icon a real 44x44 `Box` wrapper as a normal flex child —
// so the enlarged hit area is counted in the chip's own width and can never overflow onto a
// neighbour, no clipping hack required. jsdom still doesn't run layout, so pixel-accurate hit-area
// size can't be asserted here — this guards the behavior instead: selecting a location renders a
// removable Chip, and clicking its delete icon (now the wrapper `Box`, found the same way via the
// `CancelIcon` glyph's testid since clicks bubble to the wrapper) still removes it and clears the
// Autocomplete's selection, proving the markup change didn't break `renderTags`/`handleLocationSelect`.
describe('TrailList location filter Chip delete icon (#1507)', () => {
    afterEach(() => {
        mockLocationsState.locationsPageEnabled = false;
        mockLocationsState.tree = [];
    });

    it('selecting a location renders a Chip, and clicking its delete icon removes it', async () => {
        mockLocationsState.locationsPageEnabled = true;
        mockLocationsState.tree = [
            { slug: 'capital-region', name: 'Capital Region', nameEn: null, totalTrailsCount: 5, children: [] },
        ];
        mockTrailsState.trails = [makeTrail()];
        mockTrailsState.filters = { ...DEFAULT_FILTERS };
        renderTrailList();

        // The Location Autocomplete lives inside the Advanced Filters panel, collapsed by default.
        fireEvent.click(screen.getByRole('button', { name: 'filters' }));

        const input = screen.getByLabelText('Location');
        fireEvent.mouseDown(input);
        const option = await screen.findByText('Capital Region');
        fireEvent.click(option);

        expect(screen.getByText('Capital Region')).not.toBeNull();
        const deleteIcon = screen.getByTestId('CancelIcon');

        fireEvent.click(deleteIcon);

        expect(screen.queryByText('Capital Region')).toBeNull();
    });

    // With only one chip rendered, the test above can't catch an overlapping-hit-box regression
    // — e.g. if a future change went back to an overlay that bled past its own chip and stole a
    // neighbour's tap. jsdom doesn't lay out boxes, so pixel-level overlap can't be asserted
    // directly; this instead pins each delete icon to its own Chip's DOM subtree (not the next
    // chip's) and confirms clicking one only ever removes that chip, leaving its neighbour
    // untouched — the behavior the round-2 `Box` wrapper (TrailList.tsx, `deleteIcon` prop) keeps
    // guaranteed by construction, since the hit area is part of this chip's own layout box and
    // never needs to overflow into the next one.
    it('with two selected locations, deleting one chip leaves the other intact', async () => {
        mockLocationsState.locationsPageEnabled = true;
        mockLocationsState.tree = [
            { slug: 'capital-region', name: 'Capital Region', nameEn: null, totalTrailsCount: 5, children: [] },
            { slug: 'south', name: 'South', nameEn: null, totalTrailsCount: 3, children: [] },
        ];
        mockTrailsState.trails = [makeTrail()];
        mockTrailsState.filters = { ...DEFAULT_FILTERS };
        renderTrailList();

        fireEvent.click(screen.getByRole('button', { name: 'filters' }));

        const input = screen.getByLabelText('Location');
        fireEvent.mouseDown(input);
        fireEvent.click(await screen.findByText('Capital Region'));
        fireEvent.mouseDown(input);
        fireEvent.click(await screen.findByText('South'));

        expect(screen.getByText('Capital Region')).not.toBeNull();
        expect(screen.getByText('South')).not.toBeNull();

        // Each Chip (getTagProps) owns exactly one CancelIcon; find the one that lives inside
        // "South"'s own chip, not "Capital Region"'s, and confirm deleting it is scoped correctly.
        const southChip = screen.getByText('South').closest('.MuiChip-root');
        expect(southChip).not.toBeNull();
        const southDeleteIcon = southChip!.querySelector('[data-testid="CancelIcon"]');
        expect(southDeleteIcon).not.toBeNull();

        fireEvent.click(southDeleteIcon!);

        expect(screen.queryByText('South')).toBeNull();
        expect(screen.getByText('Capital Region')).not.toBeNull();
    });
});
