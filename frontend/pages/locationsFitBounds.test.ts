import { describe, it, expect } from 'vitest';
import { computeFitBoundsPoints } from './locationsFitBounds';

describe('computeFitBoundsPoints (#1740)', () => {
    it('includes a boundary-only location (no lat/long) via its boundary ring points', () => {
        const boundaryOnly = {
            latitude: undefined,
            longitude: undefined,
            boundaryGeoJson: JSON.stringify({
                type: 'Polygon',
                coordinates: [[[-18.0, 65.0], [-17.5, 65.0], [-17.5, 65.5], [-18.0, 65.5], [-18.0, 65.0]]],
            }),
        };
        const points = computeFitBoundsPoints([boundaryOnly]);
        expect(points).toEqual([
            [65.0, -18.0],
            [65.0, -17.5],
            [65.5, -17.5],
            [65.5, -18.0],
            [65.0, -18.0],
        ]);
    });

    it('contributes only the point for a location with coordinates, even if it also has a boundary', () => {
        const withBoth = {
            latitude: 64.9,
            longitude: -18.5,
            boundaryGeoJson: JSON.stringify({
                type: 'Polygon',
                coordinates: [[[-19.0, 64.0], [-18.0, 64.0], [-18.0, 65.0], [-19.0, 65.0], [-19.0, 64.0]]],
            }),
        };
        expect(computeFitBoundsPoints([withBoth])).toEqual([[64.9, -18.5]]);
    });

    it('excludes a location with neither coordinates nor a boundary', () => {
        const neither = { latitude: undefined, longitude: undefined, boundaryGeoJson: null };
        expect(computeFitBoundsPoints([neither])).toEqual([]);
    });

    it('supports a MultiPolygon boundary (e.g. an exclave) on a boundary-only location', () => {
        const multiBoundaryOnly = {
            latitude: undefined,
            longitude: undefined,
            boundaryGeoJson: JSON.stringify({
                type: 'MultiPolygon',
                coordinates: [
                    [[[-18.0, 65.0], [-17.5, 65.0], [-17.5, 65.5], [-18.0, 65.0]]],
                    [[[-10.0, 66.0], [-9.5, 66.0], [-9.5, 66.5], [-10.0, 66.0]]],
                ],
            }),
        };
        const points = computeFitBoundsPoints([multiBoundaryOnly]);
        expect(points).toEqual([
            [65.0, -18.0],
            [65.0, -17.5],
            [65.5, -17.5],
            [65.0, -18.0],
            [66.0, -10.0],
            [66.0, -9.5],
            [66.5, -9.5],
            [66.0, -10.0],
        ]);
    });

    it('ignores malformed boundaryGeoJson instead of throwing', () => {
        const malformed = { latitude: undefined, longitude: undefined, boundaryGeoJson: 'not json' };
        expect(computeFitBoundsPoints([malformed])).toEqual([]);
    });
});
