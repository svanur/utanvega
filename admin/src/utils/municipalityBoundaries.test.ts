import { describe, it, expect } from 'vitest';
import { findBundledMunicipalityBoundary, MunicipalityBoundaryFeature } from './municipalityBoundaries';

// #1706: "Load official boundary" / soft-intersects-warning only apply to a Location typed
// Municipality that matches one of the 4 bundled pilot municipalities — everything else (wrong
// type, or a Municipality not in the bundle) must get no match, so no button/warning appears.
const reykjavik: MunicipalityBoundaryFeature = {
    type: 'Feature',
    properties: { slug: 'reykjavik', name: 'Reykjavík' },
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
};
const kopavogur: MunicipalityBoundaryFeature = {
    type: 'Feature',
    properties: { slug: 'kopavogur', name: 'Kópavogur' },
    geometry: { type: 'Polygon', coordinates: [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]] },
};
const bundled = [reykjavik, kopavogur];

describe('findBundledMunicipalityBoundary', () => {
    it('matches an existing Location by slug', () => {
        expect(findBundledMunicipalityBoundary('Municipality', 'reykjavik', 'Reykjavík', bundled)).toBe(reykjavik);
    });

    it('falls back to matching by name when the slug is empty (new, unsaved Location)', () => {
        expect(findBundledMunicipalityBoundary('Municipality', '', 'Kópavogur', bundled)).toBe(kopavogur);
    });

    it('matches case-insensitively on name', () => {
        expect(findBundledMunicipalityBoundary('Municipality', '', 'kópavogur', bundled)).toBe(kopavogur);
    });

    it('returns null when the type is not Municipality, even if the name matches', () => {
        expect(findBundledMunicipalityBoundary('Place', '', 'Reykjavík', bundled)).toBeNull();
    });

    it('returns null for a Municipality not in the bundle', () => {
        expect(findBundledMunicipalityBoundary('Municipality', 'akureyri', 'Akureyri', bundled)).toBeNull();
    });

    it('returns null when the bundle has not loaded yet', () => {
        expect(findBundledMunicipalityBoundary('Municipality', 'reykjavik', 'Reykjavík', [])).toBeNull();
    });
});
