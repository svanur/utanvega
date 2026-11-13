// @vitest-environment jsdom
//
// #1741: backfills page-level test coverage for LocationsPage.tsx, which composes several pieces
// introduced across #1705/#1708/#1739 (boundary Polygon outlines, dot Markers, a single
// hoveredSlug shared between the map and the list Cards, and scrollToCard's click-to-scroll DOM
// highlight) with zero coverage of their own — only the underlying pure helper
// geoJsonBoundaryToLatLngParts has unit tests, in TrailMapView.test.tsx. Follows
// TrailMapView.test.tsx's react-leaflet mocking pattern and RacesPage.test.tsx's jsdom/RTL/real-i18n
// /Layout-passthrough page-level precedent; the rest of the frontend suite runs under
// vitest.config.ts's global `environment: 'node'`.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import { createAppTheme } from '../theme';
import type { Location } from '../hooks/useLocations';
import type { Trail } from '../hooks/useTrails';

// vitest.config.ts doesn't set `globals: true`, so @testing-library/react's automatic
// afterEach(cleanup) registration never fires — without this, a later test's screen queries can
// match leftover DOM nodes still mounted from an earlier test in this file. Mirrors
// TrailMapView.test.tsx:20 / RacesPage.test.tsx:35.
afterEach(() => {
    cleanup();
    mockFitBounds.mockClear();
});

// LocationsPage's t()/useLocalize() calls need a real, initialized i18next instance — initialized
// once with the real EN resources, same as RacesPage.test.tsx, rather than a hand-rolled stub.
void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

// Layout pulls in useMediaQuery (jsdom has no window.matchMedia implementation, so a real Layout
// render throws) plus a dozen data-fetching hooks that have nothing to do with the map/card
// composition under test — mocked to a bare passthrough, same as RacesPage.test.tsx:55-57.
vi.mock('../components/Layout', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const { mockLocations, mockTrails, mockFitBounds, mockMap } = vi.hoisted(() => {
    const fitBounds = vi.fn();
    return {
        // Mutable so individual tests can swap fixtures without re-mocking; .current is read fresh
        // on every useLocations()/useTrails() call below.
        mockLocations: { current: [] as Location[] },
        mockTrails: { current: [] as Trail[] },
        mockFitBounds: fitBounds,
        // #1786: a stable object, not a fresh literal per useMap() call — real Leaflet's useMap()
        // always returns the same map instance, so FitBounds's `useEffect([bounds, map], ...)`
        // (LocationsPage.tsx) only re-fires on an actual bounds change. A new literal per call
        // would make `map` look like a changed dependency on every re-render, masking the
        // hover-resets-zoom/pan bug behind an unrelated false positive. Mirrors
        // TrailMapView.test.tsx's mockMap.
        mockMap: { fitBounds },
    };
});

vi.mock('../hooks/useLocations', () => ({
    useLocations: () => ({ locations: mockLocations.current, loading: false, error: null }),
}));
vi.mock('../hooks/useTrails', () => ({
    useTrails: () => ({ trails: mockTrails.current, loading: false, error: null }),
}));

vi.mock('@changey/react-leaflet-markercluster', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Thin, queryable stand-ins rather than real Leaflet rendering — mirrors TrailMapView.test.tsx's
// react-leaflet mock. Marker/Polygon forward their eventHandlers.click/mouseover/mouseout to plain
// DOM handlers so fireEvent can invoke the exact same closures LocationsPage wires up
// (LocationsPage.tsx:318-320 for Marker, :349-353 for Polygon), and surface pathOptions.fillOpacity
// /weight as data-* attributes so a hover test can assert the isHovered argument's effect without
// needing Leaflet's real SVG renderer.
vi.mock('react-leaflet', () => ({
    MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => null,
    useMap: () => mockMap,
    LayersControl: Object.assign(
        ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
        { BaseLayer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> },
    ),
    Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Marker: (props: { children?: React.ReactNode; eventHandlers?: { click?: () => void } }) => (
        <div data-testid="marker" onClick={() => props.eventHandlers?.click?.()}>
            {props.children}
        </div>
    ),
    Polygon: (props: {
        children?: React.ReactNode;
        pathOptions?: { fillOpacity?: number; weight?: number; dashArray?: string };
        eventHandlers?: { mouseover?: () => void; mouseout?: () => void; click?: () => void };
    }) => (
        <div
            data-testid="polygon"
            data-fill-opacity={props.pathOptions?.fillOpacity}
            data-weight={props.pathOptions?.weight}
            data-dash={props.pathOptions?.dashArray ?? ''}
            onMouseOver={() => props.eventHandlers?.mouseover?.()}
            onMouseOut={() => props.eventHandlers?.mouseout?.()}
            onClick={() => props.eventHandlers?.click?.()}
        >
            {props.children}
        </div>
    ),
}));

import LocationsPage from './LocationsPage';

function makeLocation(overrides: Partial<Location> = {}): Location {
    return {
        id: 'loc-1',
        name: 'Location',
        nameEn: null,
        slug: 'loc-1',
        type: 'Area',
        childrenCount: 0,
        trailsCount: 0,
        boundaryGeoJson: null,
        ...overrides,
    };
}

function boundary(coords: [number, number][]): string {
    return JSON.stringify({ type: 'Polygon', coordinates: [coords] });
}

const coordsOnly = makeLocation({
    id: 'loc-coords', slug: 'coords-only', name: 'Coords Only',
    latitude: 64.0, longitude: -19.0,
});
const boundaryOnly = makeLocation({
    id: 'loc-boundary', slug: 'boundary-only', name: 'Boundary Only',
    boundaryGeoJson: boundary([[-19.0, 64.0], [-19.1, 64.1], [-19.2, 64.0], [-19.0, 64.0]]),
});
const both = makeLocation({
    id: 'loc-both', slug: 'both-loc', name: 'Both Loc',
    latitude: 64.2, longitude: -19.2,
    boundaryGeoJson: boundary([[-19.3, 64.3], [-19.4, 64.4], [-19.5, 64.3], [-19.3, 64.3]]),
});
const neither = makeLocation({ id: 'loc-neither', slug: 'neither-loc', name: 'Neither Loc' });

function renderLocationsPage() {
    const theme = createAppTheme('light');
    return render(
        <MemoryRouter>
            <ThemeProvider theme={theme}>
                <LocationsPage mode="light" onToggleMode={() => {}} />
            </ThemeProvider>
        </MemoryRouter>
    );
}

// Each fixture's name string only ever appears once per rendered map stand-in (a boundary-only
// location has no marker, a coords-only location has no polygon), plus once more in its list Card
// — so scoping by the nearest ancestor testid/class disambiguates which of the (up to three) text
// matches is which.
function cardFor(name: string): HTMLElement {
    const node = screen.getAllByText(name).find(n =>
        n.closest('.MuiCard-root') && !n.closest('[data-testid="marker"]') && !n.closest('[data-testid="polygon"]')
    );
    if (!node) throw new Error(`card not found for "${name}"`);
    return node.closest('.MuiCard-root') as HTMLElement;
}
function markerFor(name: string): HTMLElement | undefined {
    const node = screen.getAllByText(name).find(n => n.closest('[data-testid="marker"]'));
    return node?.closest('[data-testid="marker"]') as HTMLElement | undefined;
}
function polygonFor(name: string): HTMLElement | undefined {
    const node = screen.getAllByText(name).find(n => n.closest('[data-testid="polygon"]'));
    return node?.closest('[data-testid="polygon"]') as HTMLElement | undefined;
}

// jsdom's CSSOM doesn't expand the `outline` shorthand into `outlineStyle`/`outlineWidth`/etc
// sub-properties the way a real browser would (verified against this repo's own emotion+MUI
// setup) — `outline` itself still resolves to the full shorthand string, e.g. "3px solid
// #9c27b0" when hovered, "" when not, driven by the card's conditional sx
// (LocationsPage.tsx:434-437).
function cardIsHoverHighlighted(name: string): boolean {
    return getComputedStyle(cardFor(name)).outline !== '';
}

beforeEach(() => {
    mockLocations.current = [coordsOnly, boundaryOnly, both, neither];
    mockTrails.current = [];
});

describe('LocationsPage map Marker/Polygon rendering (#1741)', () => {
    it('renders a Polygon stand-in only for locations with boundaryGeoJson', () => {
        renderLocationsPage();

        expect(screen.getAllByTestId('polygon')).toHaveLength(2);
        expect(polygonFor('Boundary Only')).not.toBeUndefined();
        expect(polygonFor('Both Loc')).not.toBeUndefined();
        expect(polygonFor('Coords Only')).toBeUndefined();
        expect(polygonFor('Neither Loc')).toBeUndefined();
    });

    it('renders a Marker stand-in only for locations with latitude and longitude', () => {
        renderLocationsPage();

        expect(screen.getAllByTestId('marker')).toHaveLength(2);
        expect(markerFor('Coords Only')).not.toBeUndefined();
        expect(markerFor('Both Loc')).not.toBeUndefined();
        expect(markerFor('Boundary Only')).toBeUndefined();
        expect(markerFor('Neither Loc')).toBeUndefined();
    });

    it('a location with neither coordinates nor a boundary renders no Marker or Polygon', () => {
        renderLocationsPage();

        expect(markerFor('Neither Loc')).toBeUndefined();
        expect(polygonFor('Neither Loc')).toBeUndefined();
    });
});

// #1708: hoveredSlug is shared between the boundary Polygon's mouseover/mouseout handlers
// (LocationsPage.tsx:350-351) and the list Card's onMouseEnter/onMouseLeave (:426-427) — hovering
// either one must highlight both.
describe('LocationsPage hover sync between boundary Polygon and card (#1741, #1708)', () => {
    it('hovering the Polygon brightens its own pathOptions and highlights the matching card', () => {
        renderLocationsPage();
        const polygon = polygonFor('Boundary Only')!;

        // Default (unhovered) styling first, per getBoundaryPathOptions(false).
        expect(polygon.getAttribute('data-fill-opacity')).toBe('0.08');
        expect(polygon.getAttribute('data-weight')).toBe('2');
        expect(cardIsHoverHighlighted('Boundary Only')).toBe(false);

        fireEvent.mouseOver(polygon);

        // getBoundaryPathOptions(true): brighter fill, thicker line, no dash.
        expect(polygon.getAttribute('data-fill-opacity')).toBe('0.35');
        expect(polygon.getAttribute('data-weight')).toBe('3');
        expect(polygon.getAttribute('data-dash')).toBe('');
        expect(cardIsHoverHighlighted('Boundary Only')).toBe(true);

        // The other boundary location must be unaffected — hoveredSlug is per-slug, not global.
        expect(polygonFor('Both Loc')!.getAttribute('data-fill-opacity')).toBe('0.08');
        expect(cardIsHoverHighlighted('Both Loc')).toBe(false);
    });

    it('moving the pointer away (mouseout) reverts the highlight on both the Polygon and the card', () => {
        renderLocationsPage();
        const polygon = polygonFor('Boundary Only')!;

        fireEvent.mouseOver(polygon);
        expect(polygon.getAttribute('data-fill-opacity')).toBe('0.35');
        expect(cardIsHoverHighlighted('Boundary Only')).toBe(true);

        fireEvent.mouseOut(polygon);

        expect(polygon.getAttribute('data-fill-opacity')).toBe('0.08');
        expect(polygon.getAttribute('data-weight')).toBe('2');
        expect(cardIsHoverHighlighted('Boundary Only')).toBe(false);
    });

    it('hovering the card highlights the matching Polygon via the isHovered pathOptions argument (reverse direction)', () => {
        renderLocationsPage();
        const card = cardFor('Both Loc');
        const polygon = polygonFor('Both Loc')!;

        expect(polygon.getAttribute('data-fill-opacity')).toBe('0.08');

        fireEvent.mouseEnter(card);

        expect(polygon.getAttribute('data-fill-opacity')).toBe('0.35');
        expect(polygon.getAttribute('data-weight')).toBe('3');

        fireEvent.mouseLeave(card);

        expect(polygon.getAttribute('data-fill-opacity')).toBe('0.08');
        expect(polygon.getAttribute('data-weight')).toBe('2');
    });

    it('leaves a location with neither coordinates nor a boundary unaffected by hover on another card', () => {
        renderLocationsPage();
        const neitherCard = cardFor('Neither Loc');

        fireEvent.mouseOver(polygonFor('Boundary Only')!);
        fireEvent.mouseEnter(cardFor('Both Loc'));

        expect(getComputedStyle(neitherCard).outline).toBe('');
    });
});

// scrollToCard (LocationsPage.tsx:186-202) writes a temporary outline/boxShadow/transform directly
// onto the matching `.MuiCard-root` element via the DOM, wired to both Marker and Polygon click
// handlers. Asserted via that direct style write (the "Direct DOM highlight" scrollToCard itself
// comments on) rather than real scrollIntoView, which jsdom only stubs as a no-op.
describe('LocationsPage click/tap on a Marker or Polygon scrolls to the matching card (#1741)', () => {
    it('clicking a boundary Polygon applies the scroll-highlight style to the matching card only', () => {
        renderLocationsPage();

        fireEvent.click(polygonFor('Boundary Only')!);

        expect(cardFor('Boundary Only').style.outline).not.toBe('');
        expect(cardFor('Both Loc').style.outline).toBe('');
        expect(cardFor('Coords Only').style.outline).toBe('');
    });

    it('clicking a Marker applies the scroll-highlight style to the matching card only', () => {
        renderLocationsPage();

        fireEvent.click(markerFor('Coords Only')!);

        expect(cardFor('Coords Only').style.outline).not.toBe('');
        expect(cardFor('Both Loc').style.outline).toBe('');
        expect(cardFor('Boundary Only').style.outline).toBe('');
    });
});

// #1754: the Map Hero render gate (LocationsPage.tsx:254) originally only checked
// locationsWithCoords.length > 0, so a dataset where every location is boundary-only (no
// lat/long anywhere) never mounted MapContainer at all — hiding the boundary Polygon outlines,
// markers, and FitBounds (#1740/#1753) that would otherwise render fine once mounted.
describe('LocationsPage Map Hero render gate (#1754)', () => {
    it('renders the Map Hero when every location is boundary-only (no lat/long anywhere)', () => {
        mockLocations.current = [boundaryOnly];
        renderLocationsPage();

        expect(screen.getByTestId('map-container')).toBeDefined();
        expect(polygonFor('Boundary Only')).not.toBeUndefined();
    });

    it('hides the Map Hero when every location has neither coordinates nor a boundary', () => {
        mockLocations.current = [neither];
        renderLocationsPage();

        expect(screen.queryByTestId('map-container')).toBeNull();
    });

    it('still renders the Map Hero for a coordinate-bearing dataset (no regression)', () => {
        mockLocations.current = [coordsOnly];
        renderLocationsPage();

        expect(screen.getByTestId('map-container')).toBeDefined();
        expect(markerFor('Coords Only')).not.toBeUndefined();
    });
});

// #1786: FitBounds (LocationsPage.tsx) used to call map.fitBounds directly in its render body
// with no guard, so any LocationsPage re-render — including hoveredSlug flipping on every Polygon
// mouseover/mouseout (#1708) — reset the user's zoom/pan. Fixed to call fitBounds from a
// useEffect keyed on a bounds value memoized off `locations` alone, mirroring TrailMapView's
// ChangeView.
describe('LocationsPage FitBounds hover-safety (#1786)', () => {
    it('fits bounds once on initial render and not again on hover-only state changes', () => {
        renderLocationsPage();
        expect(mockFitBounds).toHaveBeenCalledTimes(1);

        // Polygon hover (mouseover/mouseout) and Card hover (mouseenter/mouseleave) both only
        // flip hoveredSlug — neither should trigger a re-fit.
        fireEvent.mouseOver(polygonFor('Boundary Only')!);
        expect(mockFitBounds).toHaveBeenCalledTimes(1);

        fireEvent.mouseOut(polygonFor('Boundary Only')!);
        expect(mockFitBounds).toHaveBeenCalledTimes(1);

        fireEvent.mouseEnter(cardFor('Both Loc'));
        expect(mockFitBounds).toHaveBeenCalledTimes(1);

        fireEvent.mouseLeave(cardFor('Both Loc'));
        expect(mockFitBounds).toHaveBeenCalledTimes(1);
    });

    it('re-fits bounds when the shown location set changes (search/filter)', () => {
        renderLocationsPage();
        expect(mockFitBounds).toHaveBeenCalledTimes(1);

        const searchInput = screen.getByPlaceholderText(en.locations.searchPlaceholder);
        fireEvent.change(searchInput, { target: { value: 'Both' } });

        expect(mockFitBounds.mock.calls.length).toBeGreaterThan(1);
    });
});
