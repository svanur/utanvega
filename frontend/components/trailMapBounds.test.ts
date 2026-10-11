// #1301: pure-function tests for computeMapBounds, extracted from TrailMapView.tsx's `bounds`
// memo. Node-only, no DOM/jsdom — kept in its own file (rather than TrailMapView.test.tsx) to
// avoid any setup collision with that file's jsdom-based follow-me-button tests (#1299/PR #1300).
import { describe, it, expect } from 'vitest';
import { computeMapBounds, TrailLocationPoint } from './trailMapBounds';

function makeTrail(overrides: Partial<TrailLocationPoint> = {}): TrailLocationPoint {
    return {
        slug: 'test-trail',
        startLatitude: 64.1,
        startLongitude: -21.9,
        ...overrides,
    };
}

describe('computeMapBounds', () => {
    it('returns null when there are no trails with a location', () => {
        expect(computeMapBounds([], [], null)).toBeNull();
    });

    it('folds in the full route geometry for a single trail, not just its start point', () => {
        const trail = makeTrail({ slug: 'laugavegur', startLatitude: 64.0, startLongitude: -19.0 });
        const geometries = [
            { slug: 'laugavegur', coordinates: [[64.0, -19.0], [63.8, -19.3], [63.5, -19.6]] as [number, number][] },
        ];

        const result = computeMapBounds([trail], geometries, null);

        // Bounds must stretch to the full route, well beyond the start point alone.
        expect(result).toEqual([[63.5, -19.6], [64.0, -19.0]]);
    });

    it('falls back to the start point alone when a trail has no matching geometry loaded', () => {
        const trail = makeTrail({ slug: 'no-geometry-trail', startLatitude: 65.0, startLongitude: -18.0 });

        const result = computeMapBounds([trail], [], null);

        expect(result).toEqual([[65.0, -18.0], [65.0, -18.0]]);
    });

    it('combines multiple trails — some with full geometry, some start-point-only — into one bounding box', () => {
        const trailWithGeometry = makeTrail({ slug: 'with-geometry', startLatitude: 64.0, startLongitude: -20.0 });
        const trailWithoutGeometry = makeTrail({ slug: 'without-geometry', startLatitude: 66.0, startLongitude: -15.0 });
        const geometries = [
            { slug: 'with-geometry', coordinates: [[64.0, -20.0], [63.9, -20.5]] as [number, number][] },
        ];

        const result = computeMapBounds([trailWithGeometry, trailWithoutGeometry], geometries, null);

        expect(result).toEqual([[63.9, -20.5], [66.0, -15.0]]);
    });

    it('includes userLocation as an extra point in the bounds when present', () => {
        const trail = makeTrail({ slug: 'test-trail', startLatitude: 64.0, startLongitude: -20.0 });

        const result = computeMapBounds([trail], [], { lat: 64.5, lng: -19.5 });

        expect(result).toEqual([[64.0, -20.0], [64.5, -19.5]]);
    });

    it('excludes userLocation from the bounds when null', () => {
        const trail = makeTrail({ slug: 'test-trail', startLatitude: 64.0, startLongitude: -20.0 });

        const result = computeMapBounds([trail], [], null);

        expect(result).toEqual([[64.0, -20.0], [64.0, -20.0]]);
    });

    it('ignores a trail with no geometry and no start point', () => {
        const trail = makeTrail({ slug: 'no-location', startLatitude: null, startLongitude: null });

        expect(computeMapBounds([trail], [], null)).toBeNull();
    });

    // #1309: an event with no linked trail (and so no trailsWithLocation) still has its own known
    // location — the fallbackCenter point — which should anchor the bounds instead of leaving them
    // null (and the map sitting at its hardcoded default view).
    describe('fallbackCenter (#1309)', () => {
        it('uses fallbackCenter as the bounds when there are no trails and no userLocation', () => {
            const result = computeMapBounds([], [], null, { lat: 64.118779, lng: -21.837029 });

            expect(result).toEqual([[64.118779, -21.837029], [64.118779, -21.837029]]);
        });

        it('is ignored when at least one trail already has a location', () => {
            const trail = makeTrail({ slug: 'test-trail', startLatitude: 64.0, startLongitude: -20.0 });

            const result = computeMapBounds([trail], [], null, { lat: 10, lng: 10 });

            expect(result).toEqual([[64.0, -20.0], [64.0, -20.0]]);
        });

        it('is ignored when userLocation is already present, even with no trails', () => {
            const result = computeMapBounds([], [], { lat: 64.5, lng: -19.5 }, { lat: 10, lng: 10 });

            expect(result).toEqual([[64.5, -19.5], [64.5, -19.5]]);
        });

        it('returns null when there are no trails, no userLocation, and no fallbackCenter', () => {
            expect(computeMapBounds([], [], null, null)).toBeNull();
        });
    });
});
