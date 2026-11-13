// @vitest-environment jsdom
//
// #1776: boundary Polygon overlays on /events?view=map, adapting LocationsPage.tsx's boundary
// outline + hover-sync pattern (#1708) from "every location" to "every location behind the
// currently-listed events". Follows LocationsPage.test.tsx's react-leaflet mocking pattern —
// Marker/Polygon stand-ins forward their eventHandlers so fireEvent can invoke the exact closures
// EventMapView wires up, and surface pathOptions.fillOpacity/weight as data-* attributes so a
// hover test can assert the isHovered argument's effect without Leaflet's real SVG renderer.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import { createAppTheme } from '../theme';
import { SIMPLEMAPS_CC_BY_ATTRIBUTION } from './locationBoundary';
import type { Location } from '../hooks/useLocations';
import type { EventSummary } from '../hooks/useEvents';

// vitest.config.ts doesn't set `globals: true`, so @testing-library/react's automatic
// afterEach(cleanup) registration never fires — mirrors LocationsPage.test.tsx:27.
afterEach(() => {
    cleanup();
    mockAddAttribution.mockClear();
    mockRemoveAttribution.mockClear();
});

void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

const { mockLocations, mockAddAttribution, mockRemoveAttribution } = vi.hoisted(() => ({
    mockLocations: { current: [] as Location[] },
    mockAddAttribution: vi.fn(),
    mockRemoveAttribution: vi.fn(),
}));

vi.mock('../hooks/useLocations', () => ({
    useLocations: () => ({ locations: mockLocations.current, loading: false, error: null }),
}));

vi.mock('@changey/react-leaflet-markercluster', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Thin, queryable stand-ins rather than real Leaflet rendering — mirrors LocationsPage.test.tsx's
// react-leaflet mock. Polygon forwards its eventHandlers.mouseover/mouseout so fireEvent can
// invoke the exact closures EventMapView.tsx wires up, and surfaces pathOptions.fillOpacity/
// weight as data-* attributes so a hover test can assert getBoundaryPathOptions's isHovered
// argument without Leaflet's real SVG renderer. useMap/useMapEvents are stubbed no-ops so
// MapFollowController (which calls both) doesn't throw outside a real MapContainer; useMap's
// attributionControl stub lets the real (unmocked) MapAttributionSync from TrailMapView.tsx run
// against mock addAttribution/removeAttribution spies, so the CC BY credit wiring can be asserted
// without a real Leaflet attribution control.
vi.mock('react-leaflet', () => ({
    MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => null,
    useMap: () => ({
        setView: vi.fn(),
        getZoom: () => 6,
        attributionControl: { addAttribution: mockAddAttribution, removeAttribution: mockRemoveAttribution },
    }),
    useMapEvents: () => null,
    Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid="marker">{children}</div>,
    Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Polygon: (props: {
        children?: React.ReactNode;
        pathOptions?: { fillOpacity?: number; weight?: number; dashArray?: string };
        eventHandlers?: { mouseover?: () => void; mouseout?: () => void };
    }) => (
        <div
            data-testid="polygon"
            data-fill-opacity={props.pathOptions?.fillOpacity}
            data-weight={props.pathOptions?.weight}
            data-dash={props.pathOptions?.dashArray ?? ''}
            onMouseOver={() => props.eventHandlers?.mouseover?.()}
            onMouseOut={() => props.eventHandlers?.mouseout?.()}
        >
            {props.children}
        </div>
    ),
}));

import EventMapView from './EventMapView';

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

function multiPolygonBoundary(parts: [number, number][][]): string {
    return JSON.stringify({ type: 'MultiPolygon', coordinates: parts.map(coords => [coords]) });
}

function makeEvent(overrides: Partial<EventSummary> = {}): EventSummary {
    return {
        id: 'event-1',
        name: 'Event',
        nameEn: null,
        slug: 'event-1',
        description: null,
        descriptionEn: null,
        type: 'Race',
        activityType: 'running',
        activityTypes: null,
        status: 'Scheduled',
        organizerId: null,
        organizerName: null,
        organizerNameEn: null,
        organizerWebsite: null,
        organizerSlug: null,
        alertMessage: null,
        alertMessageEn: null,
        alertSeverity: null,
        locationId: null,
        locationName: null,
        scheduleRule: null,
        socialLinks: null,
        nextEditionDate: null,
        daysUntil: null,
        displayDate: null,
        editionCount: 0,
        distances: null,
        registrationUrl: null,
        registrationStatus: null,
        registrationCloses: null,
        resultsUrl: null,
        galleries: [],
        certifications: null,
        youtubeUrl: null,
        championshipCategories: null,
        itraPoints: null,
        ...overrides,
    } as EventSummary;
}

const boundaryLocationA = makeLocation({
    id: 'loc-a', slug: 'loc-a', name: 'Location A',
    boundaryGeoJson: boundary([[-19.0, 64.0], [-19.1, 64.1], [-19.2, 64.0], [-19.0, 64.0]]),
});
const boundaryLocationB = makeLocation({
    id: 'loc-b', slug: 'loc-b', name: 'Location B',
    boundaryGeoJson: boundary([[-20.0, 65.0], [-20.1, 65.1], [-20.2, 65.0], [-20.0, 65.0]]),
});
const noBoundaryLocation = makeLocation({ id: 'loc-c', slug: 'loc-c', name: 'Location C' });
const regionBoundaryLocation = makeLocation({
    id: 'loc-region', slug: 'loc-region', name: 'Region Loc', type: 'Region',
    boundaryGeoJson: boundary([[-23.0, 68.0], [-23.1, 68.1], [-23.2, 68.0], [-23.0, 68.0]]),
});
const multiPolygonLocation = makeLocation({
    id: 'loc-multi', slug: 'loc-multi', name: 'Location Multi',
    boundaryGeoJson: multiPolygonBoundary([
        [[-21.0, 66.0], [-21.1, 66.1], [-21.2, 66.0], [-21.0, 66.0]],
        [[-22.0, 67.0], [-22.1, 67.1], [-22.2, 67.0], [-22.0, 67.0]],
    ]),
});

function renderEventMapView(events: EventSummary[]) {
    const theme = createAppTheme('light');
    return render(
        <ThemeProvider theme={theme}>
            <EventMapView events={events} />
        </ThemeProvider>
    );
}

describe('EventMapView boundary Polygon rendering (#1776)', () => {
    it('renders a boundary Polygon for each distinct event location that has a saved boundary', () => {
        mockLocations.current = [boundaryLocationA, boundaryLocationB, noBoundaryLocation];

        renderEventMapView([
            makeEvent({ id: 'e1', locationId: 'loc-a' }),
            makeEvent({ id: 'e2', locationId: 'loc-b' }),
        ]);

        expect(screen.getAllByTestId('polygon')).toHaveLength(2);
        expect(screen.getByText('Location A')).toBeDefined();
        expect(screen.getByText('Location B')).toBeDefined();
    });

    it('draws no shape for an event location with no saved boundary (no fallback circle, no error)', () => {
        mockLocations.current = [noBoundaryLocation];

        renderEventMapView([makeEvent({ id: 'e1', locationId: 'loc-c' })]);

        expect(screen.queryAllByTestId('polygon')).toHaveLength(0);
    });

    it('renders only one Polygon per distinct location even with several events at the same location', () => {
        mockLocations.current = [boundaryLocationA];

        renderEventMapView([
            makeEvent({ id: 'e1', locationId: 'loc-a' }),
            makeEvent({ id: 'e2', locationId: 'loc-a' }),
        ]);

        expect(screen.getAllByTestId('polygon')).toHaveLength(1);
    });

    it('renders a MultiPolygon boundary as multiple disconnected Polygon stand-ins', () => {
        mockLocations.current = [multiPolygonLocation];

        renderEventMapView([makeEvent({ id: 'e1', locationId: 'loc-multi' })]);

        expect(screen.getAllByTestId('polygon')).toHaveLength(2);
    });
});

describe('EventMapView boundary hover highlight (#1776)', () => {
    it('hovering a Polygon brightens its own pathOptions via getBoundaryPathOptions(isHovered)', () => {
        mockLocations.current = [boundaryLocationA, boundaryLocationB];

        renderEventMapView([
            makeEvent({ id: 'e1', locationId: 'loc-a' }),
            makeEvent({ id: 'e2', locationId: 'loc-b' }),
        ]);

        const [polygonA, polygonB] = screen.getAllByTestId('polygon');

        // Default (unhovered) styling first, per getBoundaryPathOptions(theme, false).
        expect(polygonA.getAttribute('data-fill-opacity')).toBe('0.08');
        expect(polygonA.getAttribute('data-weight')).toBe('2');

        fireEvent.mouseOver(polygonA);

        // getBoundaryPathOptions(theme, true): brighter fill, thicker line, no dash.
        expect(polygonA.getAttribute('data-fill-opacity')).toBe('0.35');
        expect(polygonA.getAttribute('data-weight')).toBe('3');
        expect(polygonA.getAttribute('data-dash')).toBe('');

        // The other location's shape must be unaffected — hoveredLocationId is per-location.
        expect(polygonB.getAttribute('data-fill-opacity')).toBe('0.08');
    });

    it('moving the pointer away (mouseout) reverts the Polygon to its default styling', () => {
        mockLocations.current = [boundaryLocationA];

        renderEventMapView([makeEvent({ id: 'e1', locationId: 'loc-a' })]);
        const polygon = screen.getByTestId('polygon');

        fireEvent.mouseOver(polygon);
        expect(polygon.getAttribute('data-fill-opacity')).toBe('0.35');

        fireEvent.mouseOut(polygon);
        expect(polygon.getAttribute('data-fill-opacity')).toBe('0.08');
        expect(polygon.getAttribute('data-weight')).toBe('2');
    });

    it('hovering any part of a MultiPolygon highlights all of its parts together', () => {
        mockLocations.current = [multiPolygonLocation];

        renderEventMapView([makeEvent({ id: 'e1', locationId: 'loc-multi' })]);
        const [partOne, partTwo] = screen.getAllByTestId('polygon');

        fireEvent.mouseOver(partOne);

        expect(partOne.getAttribute('data-fill-opacity')).toBe('0.35');
        expect(partTwo.getAttribute('data-fill-opacity')).toBe('0.35');
    });
});

// Tester review round 1 (PR #1778): EventMapView rendered simplemaps-sourced Region boundary
// polygons without surfacing SIMPLEMAPS_CC_BY_ATTRIBUTION, unlike LocationsPage.tsx/
// LocationDetailsPage.tsx, which gate on `location.type === 'Region'` and inject it via
// MapAttributionSync — a CC BY 4.0 license-compliance gap. Asserted here via MapAttributionSync's
// own addAttribution/removeAttribution calls (mocked through useMap's attributionControl stub)
// rather than DOM output, since the real Leaflet attribution control isn't rendered in this suite.
describe('EventMapView simplemaps CC BY attribution (#1778 review fix)', () => {
    it('adds the simplemaps CC BY attribution when a Region boundary is among the rendered shapes', () => {
        mockLocations.current = [regionBoundaryLocation];

        renderEventMapView([makeEvent({ id: 'e1', locationId: 'loc-region' })]);

        expect(mockAddAttribution).toHaveBeenCalledWith(SIMPLEMAPS_CC_BY_ATTRIBUTION);
    });

    it('does not add the simplemaps attribution when the only boundary is not a Region (e.g. a municipality)', () => {
        mockLocations.current = [boundaryLocationA];

        renderEventMapView([makeEvent({ id: 'e1', locationId: 'loc-a' })]);

        expect(mockAddAttribution).not.toHaveBeenCalled();
    });

    it('does not add the simplemaps attribution when no event location has a boundary at all', () => {
        mockLocations.current = [noBoundaryLocation];

        renderEventMapView([makeEvent({ id: 'e1', locationId: 'loc-c' })]);

        expect(mockAddAttribution).not.toHaveBeenCalled();
    });
});
