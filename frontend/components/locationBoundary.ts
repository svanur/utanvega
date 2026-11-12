import type L from 'leaflet';

// CC BY 4.0 requires visible attribution wherever the licensed work (or an adaptation of it,
// which a rendered boundary outline is) is shown to the public — a source-code comment on the
// committed data file doesn't satisfy that for a site visitor. Shared so LocationDetailsPage
// (single Region boundary) and LocationsPage (any Region among several boundaries shown at once)
// both credit the source the same way.
export const SIMPLEMAPS_CC_BY_ATTRIBUTION =
    '&copy; <a href="https://simplemaps.com/gis/country/is#admin1">simplemaps.com</a> boundary data (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>)';

// #1739: Polygon and MultiPolygon, normalized to one ring-set ("part") per polygon — a plain
// Polygon comes back as a single-part array so callers always loop over parts the same way,
// regardless of whether the boundary has one shape (Polygon) or several (MultiPolygon, e.g. a
// municipality with a disconnected exclave). GeoJSON coordinates are rings of [lng, lat] tuples
// (exterior ring first, then holes); Leaflet's <Polygon positions> expects the opposite order,
// [lat, lng], as the same ring shape — each part applies that swap, including any holes (rings
// after the first per part).
export function geoJsonBoundaryToLatLngParts(geoJson: string): L.LatLngExpression[][][] | null {
    try {
        const parsed = JSON.parse(geoJson) as GeoJSON.Polygon | GeoJSON.MultiPolygon;
        const ringToLatLngs = (ring: number[][]) => ring.map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
        if (parsed?.type === 'Polygon' && Array.isArray(parsed.coordinates)) {
            return [parsed.coordinates.map(ringToLatLngs)];
        }
        if (parsed?.type === 'MultiPolygon' && Array.isArray(parsed.coordinates)) {
            return parsed.coordinates.map(polygon => polygon.map(ringToLatLngs));
        }
        return null;
    } catch {
        return null;
    }
}
