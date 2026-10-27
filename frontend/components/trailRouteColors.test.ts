import { describe, it, expect } from 'vitest';
import {
    TRAIL_ROUTE_PALETTE,
    TRAIL_DASH_PATTERNS,
    getTrailRouteStyle,
    toggleTrailSelection,
    computeSortedSlugs,
} from './trailRouteColors';

// #1543: these three functions are the single source of truth both TrailMapView (its own
// Polyline rendering) and EventTrailLegend (its swatches) build on — covered directly here so a
// regression shows up without needing a full map render.
describe('getTrailRouteStyle (#1543)', () => {
    it('assigns distinct colors to distinct slugs within the palette size', () => {
        const slugs = ['a', 'b', 'c'];
        const colors = slugs.map(slug => getTrailRouteStyle(slug, slugs).color);
        expect(new Set(colors).size).toBe(3);
    });

    it('is stable for the same slug given the same sorted slug list', () => {
        const slugs = ['a', 'b', 'c'];
        const first = getTrailRouteStyle('b', slugs);
        const second = getTrailRouteStyle('b', slugs);
        expect(second).toEqual(first);
    });

    it('is solid (no dashArray) for the first pass through the palette', () => {
        const slugs = TRAIL_ROUTE_PALETTE.map((_, i) => `slug-${i}`);
        for (const slug of slugs) {
            expect(getTrailRouteStyle(slug, slugs).dashArray).toBeUndefined();
        }
    });

    it('reuses a color but switches dashArray once slugs exceed the palette size', () => {
        const slugs = Array.from({ length: TRAIL_ROUTE_PALETTE.length + 1 }, (_, i) => `slug-${i}`);
        const first = getTrailRouteStyle(slugs[0], slugs);
        const wrapped = getTrailRouteStyle(slugs[TRAIL_ROUTE_PALETTE.length], slugs);

        expect(wrapped.color).toBe(first.color);
        expect(wrapped.dashArray).not.toBe(first.dashArray);
        expect(wrapped.dashArray).toBe(TRAIL_DASH_PATTERNS[1]);
    });

    it('falls back to the first palette entry for a slug not present in sortedSlugs', () => {
        const style = getTrailRouteStyle('unknown', ['a', 'b']);
        expect(style.color).toBe(getTrailRouteStyle('a', ['a', 'b']).color);
    });
});

describe('toggleTrailSelection (#1543)', () => {
    it('selects the clicked slug with source "track" when nothing was selected', () => {
        expect(toggleTrailSelection(null, 'a')).toEqual({ slug: 'a', source: 'track' });
    });

    it('selects a different slug when a different one was previously selected', () => {
        expect(toggleTrailSelection('a', 'b')).toEqual({ slug: 'b', source: 'track' });
    });

    it('clears the selection when the already-selected slug is clicked again', () => {
        expect(toggleTrailSelection('a', 'a')).toEqual({ slug: null, source: null });
    });
});

describe('computeSortedSlugs (#1543)', () => {
    it('returns only slugs present in both trails and geometries, sorted and deduplicated', () => {
        const trails = [{ slug: 'b' }, { slug: 'a' }, { slug: 'c' }];
        const geometries = [{ slug: 'b' }, { slug: 'b' }, { slug: 'a' }, { slug: 'not-a-trail' }];
        expect(computeSortedSlugs(trails, geometries)).toEqual(['a', 'b']);
    });

    it('returns an empty array when there is no overlap', () => {
        expect(computeSortedSlugs([{ slug: 'a' }], [{ slug: 'b' }])).toEqual([]);
    });
});
