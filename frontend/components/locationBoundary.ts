import type L from 'leaflet';
import type { Theme } from '@mui/material/styles';

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

// #1790: flattens geoJsonBoundaryToLatLngParts's output (one part per polygon, one ring-set per
// part, holes included) into a single [lat, lng][] list — the shape computeMapBounds's
// `boundaryLatLngs` param needs to min/max over, without caring about ring/part structure. Holes
// are included too (their points still lie within the polygon's own extent, so they're harmless
// here) rather than filtered out, since doing so would need the ring's position within its part
// and buys nothing.
export function flattenBoundaryParts(parts: L.LatLngExpression[][][]): [number, number][] {
    return parts.flatMap(part => part.flatMap(ring => ring as unknown as [number, number][]));
}

// #1708: default vs. hover-highlighted boundary styling — same theme color (secondary),
// brighter/more opaque on hover, so it reads as a state swap rather than a different shape.
// Takes `theme` as a parameter (rather than closing over it) so it works the same from any
// component that reads `useTheme()` — LocationsPage (several locations, hover-synced with its
// list Cards) and, per #1776, EventMapView (one location at a time, synced with local hover state).
export function getBoundaryPathOptions(theme: Theme, isHovered: boolean) {
    return {
        color: isHovered ? theme.palette.secondary.light : theme.palette.secondary.main,
        weight: isHovered ? 3 : 2,
        dashArray: isHovered ? undefined : '6 6',
        fillColor: isHovered ? theme.palette.secondary.light : theme.palette.secondary.main,
        fillOpacity: isHovered ? 0.35 : 0.08,
    };
}
