// @vitest-environment jsdom
//
// #1299: backfills test coverage for PR #1298's follow-me gating
// (`{userLocation !== null && (...)}`, TrailMapView.tsx:267). The rest of the frontend suite runs
// under vitest.config.ts's global `environment: 'node'` (see ElevationCurveBackground.test.tsx);
// this file opts into jsdom on its own via the docblock above so the "click actually toggles the
// button" assertion can use @testing-library/react, without adding a DOM dependency to every other
// test file.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Trail } from '../hooks/useTrails';

// vitest.config.ts doesn't set `globals: true`, so @testing-library/react's automatic
// afterEach(cleanup) registration (which relies on a global test-framework hook) never fires —
// without this, a later test's screen.getByRole(...) query can match leftover DOM nodes still
// mounted from an earlier test in this same file.
afterEach(cleanup);

// #1303: mockFitBounds and mockGeometries are read by the react-leaflet/useTrailGeometries mocks
// below. vi.hoisted is required because vi.mock(...) factories are hoisted above imports/consts —
// referencing an un-hoisted outer variable from inside them throws a ReferenceError.
const { mockFitBounds, mockGeometries, mockMap, polylineSpy } = vi.hoisted(() => {
    const fitBounds = vi.fn();
    return {
        mockFitBounds: fitBounds,
        mockGeometries: { current: [] as Array<{ slug: string; activityType: string; coordinates: [number, number][] }> },
        // A stable object, not a fresh literal per useMap() call — real Leaflet's useMap() always
        // returns the same map instance, so ChangeView's `useEffect([bounds, map, followMe], ...)`
        // (TrailMapView.tsx:48-52) only re-fires on an actual bounds/followMe change. A new literal
        // per call would make `map` look like a changed dependency on every re-render, masking
        // #1303's showTracks-triggered-refit bug behind an unrelated false positive.
        mockMap: { fitBounds, setView: vi.fn(), getZoom: () => 10, invalidateSize: vi.fn() },
        // #1543: captures every <Polyline> render's props (pathOptions, positions, eventHandlers)
        // so tests can assert per-slug color/dashArray without needing Leaflet's real SVG renderer,
        // and can simulate a track click by calling the captured eventHandlers.click directly.
        polylineSpy: vi.fn(),
    };
});

// TrailMapView calls useTrailGeometries(), which uses @tanstack/react-query's useQuery and throws
// without a QueryClientProvider ancestor — mocked rather than standing up a real QueryClient,
// following the vi.mock() convention in frontend/api/og-image.test.ts.
vi.mock('../hooks/useTrailGeometries', () => ({
    useTrailGeometries: () => ({ geometries: mockGeometries.current, loading: false }),
}));

// The follow-me button under test (TrailMapView.tsx:250-301) is a sibling of <MapContainer>, not
// a child of it, so none of Leaflet's real map/clustering machinery is needed to exercise it.
// Stubbing both out keeps this test from depending on jsdom's partial layout support (Leaflet
// measures real pixel dimensions on mount) and from actually loading tiles over the network.
vi.mock('react-leaflet', () => ({
    MapContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    TileLayer: () => null,
    // #1309: position/icon are surfaced as data-* attributes (rather than dropped, as the bare
    // `{children}` pass-through elsewhere in this mock would do) so the fallback-marker tests below
    // can assert *which* marker rendered, not just that some <div> did.
    Marker: ({ position, icon, children }: { position: [number, number]; icon?: { options?: { className?: string } }; children?: React.ReactNode }) => (
        <div data-testid="marker" data-lat={position[0]} data-lng={position[1]} data-icon-class={icon?.options?.className ?? ''}>
            {children}
        </div>
    ),
    Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    // #1543: renders a thin, queryable stand-in (rather than `() => null`) carrying pathOptions as
    // data-* attributes, plus forwards to polylineSpy so a test can also grab the raw eventHandlers
    // and fire a click without going through jsdom's (absent) SVG layout.
    Polyline: (props: { positions: unknown; pathOptions?: { color?: string; dashArray?: string; opacity?: number; weight?: number }; eventHandlers?: { click?: (e: unknown) => void } }) => {
        polylineSpy(props);
        return (
            <div
                data-testid="polyline"
                data-color={props.pathOptions?.color}
                data-dash={props.pathOptions?.dashArray ?? ''}
                data-opacity={props.pathOptions?.opacity}
            />
        );
    },
    useMap: () => mockMap,
    useMapEvents: () => null,
    LayersControl: Object.assign(
        ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
        { BaseLayer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> },
    ),
}));
vi.mock('@changey/react-leaflet-markercluster', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { TrailMapView } from './TrailMapView';

const noTrails: Trail[] = [];

describe('TrailMapView follow-me button (#1299)', () => {
    // Rendered via renderToStaticMarkup — the same technique ElevationCurveBackground.test.tsx
    // (#1013) uses — since proving the button is absent needs no events, just the markup string.
    it('is absent from the markup when userLocation is null', () => {
        const markup = renderToStaticMarkup(
            <TrailMapView trails={noTrails} userLocation={null} />
        );
        expect(markup).not.toContain('aria-label="follow my location"');
    });

    it('is present and toggles from color="default" to color="primary" when clicked, given a valid userLocation', () => {
        render(
            <TrailMapView trails={noTrails} userLocation={{ lat: 64.1265, lng: -21.8174 }} />
        );

        const button = screen.getByRole('button', { name: 'follow my location' });
        // MUI's IconButton only adds a `MuiIconButton-color<X>` class when color !== 'default'
        // (see @mui/material/IconButton/IconButton.js's useUtilityClasses), so its absence/presence
        // is the observable proxy for handleFollowMeClick's internal `followMe` toggle.
        expect(button.className).not.toMatch(/MuiIconButton-colorPrimary/);

        fireEvent.click(button);

        expect(button.className).toMatch(/MuiIconButton-colorPrimary/);
    });
});

function makeTrail(overrides: Partial<Trail> = {}): Trail {
    return {
        id: 'trail-1',
        name: 'Laugavegur',
        slug: 'laugavegur',
        length: 55000,
        elevationGain: 1200,
        elevationLoss: 1400,
        status: 'Published',
        activityType: 'Hiking',
        trailType: 'PointToPoint',
        difficulty: 'Hard',
        startLatitude: 64.0,
        startLongitude: -19.0,
        locations: [],
        ...overrides,
    };
}

describe('TrailMapView hide/show-tracks toggle does not re-fit the map (#1303)', () => {
    beforeEach(() => {
        mockFitBounds.mockClear();
        // Full route geometry, well beyond the start point alone — mirrors the trailMapBounds.test.ts
        // "folds in the full route geometry" fixture so the bounds the toggle must leave untouched
        // actually depend on the geometry, not just the start point.
        mockGeometries.current = [
            { slug: 'laugavegur', activityType: 'Hiking', coordinates: [[64.0, -19.0], [63.8, -19.3], [63.5, -19.6]] },
        ];
    });

    it('does not call fitBounds again when showTracks is toggled off and back on', () => {
        // Wrapped in MemoryRouter: unlike the follow-me tests above (noTrails), this trail has a
        // start location, so the real (unmocked) MarkerClusterGroup renders a Popup containing a
        // RouterLink, which throws without a router context ancestor.
        render(
            <MemoryRouter>
                <TrailMapView trails={[makeTrail()]} userLocation={null} />
            </MemoryRouter>
        );

        const callsBeforeToggle = mockFitBounds.mock.calls.length;
        expect(callsBeforeToggle).toBeGreaterThan(0);

        const toggleButton = screen.getByRole('button', { name: 'toggle tracks' });
        fireEvent.click(toggleButton); // hide tracks
        fireEvent.click(toggleButton); // show tracks again

        // The `bounds` memo (and therefore ChangeView's fitBounds effect) must not react to
        // showTracks — only `visibleGeometries` (which gates rendered <Polyline>s) should.
        expect(mockFitBounds.mock.calls.length).toBe(callsBeforeToggle);
    });
});

describe('TrailMapView re-fits bounds after container is corrected (#1535)', () => {
    beforeEach(() => {
        mockFitBounds.mockClear();
        mockGeometries.current = [
            { slug: 'laugavegur', activityType: 'Hiking', coordinates: [[64.0, -19.0], [63.8, -19.3], [63.5, -19.6]] },
        ];
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('calls fitBounds again once MapInvalidateSize\'s 200ms timer fires', () => {
        render(
            <MemoryRouter>
                <TrailMapView trails={[makeTrail()]} userLocation={null} />
            </MemoryRouter>
        );

        const callsOnMount = mockFitBounds.mock.calls.length;
        expect(callsOnMount).toBeGreaterThan(0);

        // Mirrors MapInvalidateSize's own setTimeout(..., 200) (TrailMapView.tsx:79-89) — this is
        // the container-size-correction tick that must trigger a re-fit, not merely an
        // invalidateSize(), or a lazy-loaded map can still show a cut-off route (#1535).
        act(() => { vi.advanceTimersByTime(200); });

        expect(mockFitBounds.mock.calls.length).toBeGreaterThan(callsOnMount);
    });
});

describe('TrailMapView fallbackCenter marker (#1309)', () => {
    const fallbackCenter = { lat: 64.118779, lng: -21.837029 };

    it('renders a marker at fallbackCenter when trails is empty', () => {
        render(
            <MemoryRouter>
                <TrailMapView trails={noTrails} userLocation={null} fallbackCenter={fallbackCenter} />
            </MemoryRouter>
        );

        const markers = screen.getAllByTestId('marker');
        expect(markers).toHaveLength(1);
        expect(markers[0].getAttribute('data-lat')).toBe(String(fallbackCenter.lat));
        expect(markers[0].getAttribute('data-lng')).toBe(String(fallbackCenter.lng));
        // Must reuse the distinct trailIcon (className 'trail-marker'), not silently fall back to
        // userLocationIcon — which means something different to the user (#1309 acceptance).
        expect(markers[0].getAttribute('data-icon-class')).toBe('trail-marker');
        // #1315: unlike the bare marker this started as, it must carry a Popup identifying the pin
        // (same shape as the userLocation marker's Popup above) rather than giving no click feedback.
        expect(markers[0].textContent).toBe('map.eventLocation');
    });

    it('does not render a fallback marker when trails is non-empty', () => {
        render(
            <MemoryRouter>
                <TrailMapView trails={[makeTrail()]} userLocation={null} fallbackCenter={fallbackCenter} />
            </MemoryRouter>
        );

        const markers = screen.getAllByTestId('marker');
        // Only the real trail's own marker should render — none at fallbackCenter.
        expect(markers).toHaveLength(1);
        expect(markers[0].getAttribute('data-lat')).toBe(String(makeTrail().startLatitude));
        expect(markers[0].getAttribute('data-lng')).toBe(String(makeTrail().startLongitude));
    });

    it('does not render a fallback marker when fallbackCenter is not provided', () => {
        render(
            <MemoryRouter>
                <TrailMapView trails={noTrails} userLocation={null} />
            </MemoryRouter>
        );

        expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    });
});

// #1543: two races sharing the same activityType must no longer render pixel-identical routes —
// verified against the rendered geo.slug set (distinct colors per slug), not just activityType.
describe('TrailMapView per-trail-slug route coloring (#1543)', () => {
    beforeEach(() => {
        polylineSpy.mockClear();
    });

    it('assigns a different color to each slug when activityType is identical', () => {
        mockGeometries.current = [
            { slug: 'race-a', activityType: 'TrailRunning', coordinates: [[64.0, -19.0], [63.9, -19.1]] },
            { slug: 'race-b', activityType: 'TrailRunning', coordinates: [[64.1, -19.2], [64.0, -19.3]] },
        ];

        render(
            <MemoryRouter>
                <TrailMapView
                    trails={[makeTrail({ id: 'a', slug: 'race-a' }), makeTrail({ id: 'b', slug: 'race-b' })]}
                    userLocation={null}
                />
            </MemoryRouter>
        );

        const polylines = screen.getAllByTestId('polyline');
        expect(polylines).toHaveLength(2);
        const colors = polylines.map(p => p.getAttribute('data-color'));
        expect(new Set(colors).size).toBe(2);
    });

    it('is stable per slug across a re-render triggered by an unrelated prop change', () => {
        mockGeometries.current = [
            { slug: 'race-a', activityType: 'TrailRunning', coordinates: [[64.0, -19.0], [63.9, -19.1]] },
            { slug: 'race-b', activityType: 'TrailRunning', coordinates: [[64.1, -19.2], [64.0, -19.3]] },
        ];
        const trails = [makeTrail({ id: 'a', slug: 'race-a' }), makeTrail({ id: 'b', slug: 'race-b' })];

        const { rerender } = render(
            <MemoryRouter>
                <TrailMapView trails={trails} userLocation={null} />
            </MemoryRouter>
        );
        const colorsBefore = screen.getAllByTestId('polyline').map(p => p.getAttribute('data-color'));

        // Same trails (new array reference), unrelated userLocation change — should not reshuffle
        // which color belongs to which slug.
        rerender(
            <MemoryRouter>
                <TrailMapView trails={[...trails]} userLocation={{ lat: 1, lng: 1 }} />
            </MemoryRouter>
        );
        const colorsAfter = screen.getAllByTestId('polyline').map(p => p.getAttribute('data-color'));

        expect(colorsAfter).toEqual(colorsBefore);
    });

    it('cycles dashArray (solid/dashed/dotted) once the number of distinct slugs exceeds the palette size', () => {
        const paletteSize = 9; // TRAIL_ROUTE_PALETTE.length in trailRouteColors.ts
        mockGeometries.current = Array.from({ length: paletteSize + 1 }, (_, i) => ({
            slug: `race-${i}`,
            activityType: 'TrailRunning',
            coordinates: [[64.0, -19.0], [63.9, -19.1]] as [number, number][],
        }));
        const trails = mockGeometries.current.map((g, i) => makeTrail({ id: String(i), slug: g.slug }));

        render(
            <MemoryRouter>
                <TrailMapView trails={trails} userLocation={null} />
            </MemoryRouter>
        );

        const polylines = screen.getAllByTestId('polyline');
        expect(polylines).toHaveLength(paletteSize + 1);
        // The (paletteSize+1)-th slug reuses the first slug's color but must not reuse its dash —
        // otherwise the two would render pixel-identical despite #1543's requirement.
        expect(polylines[paletteSize].getAttribute('data-color')).toBe(polylines[0].getAttribute('data-color'));
        expect(polylines[paletteSize].getAttribute('data-dash')).not.toBe(polylines[0].getAttribute('data-dash'));
    });

    it('turns the clicked route red and dims the others, then clears on re-click (uncontrolled)', () => {
        mockGeometries.current = [
            { slug: 'race-a', activityType: 'TrailRunning', coordinates: [[64.0, -19.0], [63.9, -19.1]] },
            { slug: 'race-b', activityType: 'TrailRunning', coordinates: [[64.1, -19.2], [64.0, -19.3]] },
        ];
        render(
            <MemoryRouter>
                <TrailMapView
                    trails={[makeTrail({ id: 'a', slug: 'race-a' }), makeTrail({ id: 'b', slug: 'race-b' })]}
                    userLocation={null}
                />
            </MemoryRouter>
        );

        // Each render re-invokes the Polyline mock for both slugs with a fresh (that render's)
        // closure — always read the *latest* pair of calls, not the first match, or a click would
        // fire a stale closure holding a stale `selectedSlug` and never toggle off.
        const latestCallFor = (slug: string) => {
            const latestPair = polylineSpy.mock.calls.slice(-2).map(([p]) => p);
            const geo = mockGeometries.current.find(g => g.slug === slug)!;
            return latestPair.find(p => p.positions === geo.coordinates)!;
        };

        const fakeEvent = { originalEvent: { stopPropagation: vi.fn() } };
        act(() => { latestCallFor('race-a').eventHandlers.click(fakeEvent); });

        const afterClick = screen.getAllByTestId('polyline');
        expect(afterClick[0].getAttribute('data-color')).toBe('#f44336');
        expect(afterClick[1].getAttribute('data-opacity')).toBe('0.15');

        // Re-clicking the same route clears the selection (toggle-off-on-reclick, same semantics
        // as TrailMapView.tsx's own click handler and EventTrailLegend's).
        act(() => { latestCallFor('race-a').eventHandlers.click(fakeEvent); });

        const afterSecondClick = screen.getAllByTestId('polyline');
        expect(afterSecondClick[0].getAttribute('data-color')).not.toBe('#f44336');
        expect(afterSecondClick[1].getAttribute('data-opacity')).not.toBe('0.15');
    });
});

// #1543: controlled selection — lets a sibling component (EventTrailLegend on CompetitionDetailPage)
// drive/read the same highlight state TrailMapView's own pin/track clicks use.
describe('TrailMapView controlled selection (#1543)', () => {
    beforeEach(() => {
        polylineSpy.mockClear();
        mockGeometries.current = [
            { slug: 'race-a', activityType: 'TrailRunning', coordinates: [[64.0, -19.0], [63.9, -19.1]] },
            { slug: 'race-b', activityType: 'TrailRunning', coordinates: [[64.1, -19.2], [64.0, -19.3]] },
        ];
    });

    it('highlights the slug passed via the selectedSlug prop, not internal state', () => {
        render(
            <MemoryRouter>
                <TrailMapView
                    trails={[makeTrail({ id: 'a', slug: 'race-a' }), makeTrail({ id: 'b', slug: 'race-b' })]}
                    userLocation={null}
                    selectedSlug="race-b"
                    selectionSource="track"
                    onSelectionChange={vi.fn()}
                />
            </MemoryRouter>
        );

        const polylines = screen.getAllByTestId('polyline');
        expect(polylines[0].getAttribute('data-opacity')).toBe('0.15');
        expect(polylines[1].getAttribute('data-color')).toBe('#f44336');
    });

    it('calls onSelectionChange instead of mutating its own state when a route is clicked', () => {
        const onSelectionChange = vi.fn();
        render(
            <MemoryRouter>
                <TrailMapView
                    trails={[makeTrail({ id: 'a', slug: 'race-a' }), makeTrail({ id: 'b', slug: 'race-b' })]}
                    userLocation={null}
                    selectedSlug={null}
                    selectionSource={null}
                    onSelectionChange={onSelectionChange}
                />
            </MemoryRouter>
        );

        const fakeEvent = { originalEvent: { stopPropagation: vi.fn() } };
        const latestPair = polylineSpy.mock.calls.slice(-2).map(([p]) => p);
        const raceAProps = latestPair.find(p => p.positions === mockGeometries.current[0].coordinates)!;
        act(() => { raceAProps.eventHandlers.click(fakeEvent); });

        expect(onSelectionChange).toHaveBeenCalledWith('race-a', 'track');
        // Controlled: the parent hasn't re-passed a new selectedSlug, so the map's own rendering
        // must not have highlighted anything on its own.
        expect(screen.getAllByTestId('polyline')[0].getAttribute('data-color')).not.toBe('#f44336');
    });
});
