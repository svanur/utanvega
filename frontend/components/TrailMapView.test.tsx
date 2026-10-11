// @vitest-environment jsdom
//
// #1299: backfills test coverage for PR #1298's follow-me gating
// (`{userLocation !== null && (...)}`, TrailMapView.tsx:267). The rest of the frontend suite runs
// under vitest.config.ts's global `environment: 'node'` (see ElevationCurveBackground.test.tsx);
// this file opts into jsdom on its own via the docblock above so the "click actually toggles the
// button" assertion can use @testing-library/react, without adding a DOM dependency to every other
// test file.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Trail } from '../hooks/useTrails';

// TrailMapView calls useTrailGeometries(), which uses @tanstack/react-query's useQuery and throws
// without a QueryClientProvider ancestor — mocked rather than standing up a real QueryClient,
// following the vi.mock() convention in frontend/api/og-image.test.ts.
vi.mock('../hooks/useTrailGeometries', () => ({
    useTrailGeometries: () => ({ geometries: [], loading: false }),
}));

// The follow-me button under test (TrailMapView.tsx:250-301) is a sibling of <MapContainer>, not
// a child of it, so none of Leaflet's real map/clustering machinery is needed to exercise it.
// Stubbing both out keeps this test from depending on jsdom's partial layout support (Leaflet
// measures real pixel dimensions on mount) and from actually loading tiles over the network.
vi.mock('react-leaflet', () => ({
    MapContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    TileLayer: () => null,
    Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Polyline: () => null,
    useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn(), getZoom: () => 10, invalidateSize: vi.fn() }),
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
