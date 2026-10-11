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
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
const { mockFitBounds, mockGeometries, mockMap } = vi.hoisted(() => {
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
    Polyline: () => null,
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
