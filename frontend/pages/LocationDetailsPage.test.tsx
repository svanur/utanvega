// @vitest-environment jsdom
//
// #1790: LocationDetailsPage used to gate its entire <TrailMapView> call on `trails.length > 0`,
// so a location with a saved boundary (or just a center point) but zero linked trails never
// mounted the map at all — hiding its own boundaryGeoJson. Verified at the page level (not just
// TrailMapView/trailMapBounds, which already cover the bounds-calculation side of this) by mocking
// TrailMapView to a prop-capturing stand-in, mirroring CompetitionDetailPage.test.tsx's own
// trailMapViewMock pattern, plus the jsdom/RTL/real-i18n/Layout-passthrough page-level precedent
// LocationsPage.test.tsx/RacesPage.test.tsx use.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import { createAppTheme } from '../theme';
import type { Location, LocationWithTrails } from '../hooks/useLocations';
import type { Trail } from '../hooks/useTrails';

afterEach(cleanup);

void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

// Layout pulls in useMediaQuery (jsdom has no window.matchMedia) plus a dozen more
// data-fetching hooks unrelated to the map gate under test — mocked to a bare passthrough,
// same as CompetitionDetailPage.test.tsx/RacesPage.test.tsx.
vi.mock('../components/Layout', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const { mockLocationWithTrails } = vi.hoisted(() => ({
    mockLocationWithTrails: { current: null as LocationWithTrails | null },
}));
vi.mock('../hooks/useLocations', () => ({
    useLocationBySlug: () => ({ ...mockLocationWithTrails.current, loading: false, error: null }),
    useLocationTree: () => ({ tree: [], loading: false, error: null }),
}));

// Every flag defaults false — this test only cares about the map gate, not share_trail/pools.
vi.mock('../hooks/useFeatureFlags', () => ({
    useFeatureFlags: () => ({ flags: {}, loaded: true, isEnabled: () => false }),
}));

const { trailMapViewMock } = vi.hoisted(() => ({
    trailMapViewMock: vi.fn(),
}));
vi.mock('../components/TrailMapView', () => ({
    TrailMapView: (props: unknown) => { trailMapViewMock(props); return <div data-testid="trail-map-view" />; },
}));

// TrailCard pulls in useTickedTrails -> useAuth, which throws outside an AuthProvider — mocked to
// a bare name-only stand-in, since the trail list's own rendering is unrelated to the map gate
// under test here.
vi.mock('../components/TrailCard', () => ({
    TrailCard: ({ trail }: { trail: { name: string } }) => <div>{trail.name}</div>,
}));

import LocationDetailsPage from './LocationDetailsPage';

function makeLocation(overrides: Partial<Location> = {}): Location {
    return {
        id: 'loc-1',
        name: 'Location',
        nameEn: null,
        slug: 'location',
        type: 'Area',
        childrenCount: 0,
        trailsCount: 0,
        boundaryGeoJson: null,
        ...overrides,
    };
}

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

const boundaryGeoJson = JSON.stringify({
    type: 'Polygon',
    coordinates: [[[-19.0, 64.0], [-19.1, 64.1], [-19.2, 64.0], [-19.0, 64.0]]],
});

function renderLocationDetailsPage(location: Location, trails: Trail[]) {
    mockLocationWithTrails.current = { location, childLocations: [], trails };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const theme = createAppTheme('light');
    return render(
        <MemoryRouter initialEntries={[`/locations/${location.slug}`]}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider theme={theme}>
                    <Routes>
                        <Route
                            path="/locations/:slug"
                            element={<LocationDetailsPage mode="light" onToggleMode={() => {}} />}
                        />
                    </Routes>
                </ThemeProvider>
            </QueryClientProvider>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    trailMapViewMock.mockClear();
});

describe('LocationDetailsPage map render gate (#1790)', () => {
    it('renders the map, framed on the boundary via fallbackCenter=null + locationBoundary, for a boundary-only location with zero trails', () => {
        const location = makeLocation({ boundaryGeoJson });

        renderLocationDetailsPage(location, []);

        expect(screen.getByTestId('trail-map-view')).toBeDefined();
        const props = trailMapViewMock.mock.calls.at(-1)![0] as { locationBoundary: unknown; fallbackCenter: unknown };
        expect(props.locationBoundary).toEqual({ geoJson: boundaryGeoJson, attribution: undefined });
        expect(props.fallbackCenter).toBeNull();
        // The "no trails yet" message must show alongside the map, not replace it.
        expect(screen.getByText(en.locations.noTrailsInLocation)).toBeDefined();
    });

    it('renders the map centered via fallbackCenter for a center-point-only location with zero trails (not boundary, not the TrailMapView hardcoded default)', () => {
        const location = makeLocation({ latitude: 64.5, longitude: -20.5 });

        renderLocationDetailsPage(location, []);

        expect(screen.getByTestId('trail-map-view')).toBeDefined();
        const props = trailMapViewMock.mock.calls.at(-1)![0] as { locationBoundary: unknown; fallbackCenter: unknown };
        expect(props.locationBoundary).toBeNull();
        expect(props.fallbackCenter).toEqual({ lat: 64.5, lng: -20.5 });
        expect(screen.getByText(en.locations.noTrailsInLocation)).toBeDefined();
    });

    it('renders no map for a location with neither a boundary nor a center point, even with zero trails', () => {
        const location = makeLocation();

        renderLocationDetailsPage(location, []);

        expect(screen.queryByTestId('trail-map-view')).toBeNull();
        expect(screen.getByText(en.locations.noTrailsInLocation)).toBeDefined();
    });

    // #1790 review: the backend serializes an unset latitude/longitude as explicit JSON `null`
    // (GetLocationBySlugQuery), not an omitted key — `!== undefined` would wrongly treat that as
    // "has a center point" (null !== undefined is true), so the map must stay hidden here too.
    it('renders no map for a location with explicit null latitude/longitude and no boundary', () => {
        const location = makeLocation({ latitude: null as unknown as number, longitude: null as unknown as number });

        renderLocationDetailsPage(location, []);

        expect(screen.queryByTestId('trail-map-view')).toBeNull();
    });

    // #1790 review (owner, post-merge-approval): showMap only accounted for the location's own
    // boundary/center, so a location with neither but with linked trails — previously shown via
    // the `trails.length > 0` gate, framed off trail route geometry/start points — regressed to
    // no map at all. filteredTrails.length > 0 restores that path without reintroducing the
    // original #1790 bug (it's additive to, not a replacement for, the boundary/center checks).
    it('renders the map for a location with trails but no boundary and no center point (regression: trail-only locations must still show a map)', () => {
        const location = makeLocation();
        const trail = makeTrail();

        renderLocationDetailsPage(location, [trail]);

        expect(screen.getByTestId('trail-map-view')).toBeDefined();
        const props = trailMapViewMock.mock.calls.at(-1)![0] as { trails: Trail[]; locationBoundary: unknown; fallbackCenter: unknown };
        expect(props.trails).toEqual([trail]);
        expect(props.locationBoundary).toBeNull();
        expect(props.fallbackCenter).toBeNull();
    });

    it('still renders the map with both boundary and trails together, with no "no trails" message (no regression)', () => {
        const location = makeLocation({ boundaryGeoJson });
        const trail = makeTrail();

        renderLocationDetailsPage(location, [trail]);

        expect(screen.getByTestId('trail-map-view')).toBeDefined();
        const props = trailMapViewMock.mock.calls.at(-1)![0] as { locationBoundary: unknown; trails: Trail[] };
        expect(props.locationBoundary).toEqual({ geoJson: boundaryGeoJson, attribution: undefined });
        expect(props.trails).toEqual([trail]);
        expect(screen.queryByText(en.locations.noTrailsInLocation)).toBeNull();
        expect(screen.getByText(trail.name)).toBeDefined();
    });

    it('passes a simplemaps attribution for a Region boundary, same as the pre-#1790 trails>0 path', () => {
        const location = makeLocation({ boundaryGeoJson, type: 'Region' });

        renderLocationDetailsPage(location, []);

        const props = trailMapViewMock.mock.calls.at(-1)![0] as { locationBoundary: { attribution: string } };
        expect(props.locationBoundary.attribution).toContain('simplemaps.com');
    });
});
