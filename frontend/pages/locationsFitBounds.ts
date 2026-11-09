import type { Location } from '../hooks/useLocations';

// Same [lng, lat] -> [lat, lng] swap TrailMapView.tsx's geoJsonBoundaryToLatLngParts applies for
// its own Polygon rendering (Polygon and MultiPolygon, holes included) — duplicated in miniature
// here rather than imported, because that module pulls in 'leaflet' at the top level, which throws
// outside a browser/jsdom `window` (see computeMapBounds's own reasoning in trailMapBounds.ts).
function boundaryRingPoints(geoJson: string): [number, number][] {
    try {
        const parsed = JSON.parse(geoJson) as GeoJSON.Polygon | GeoJSON.MultiPolygon;
        const points: [number, number][] = [];
        const addRings = (rings: number[][][]) => {
            for (const ring of rings) {
                for (const [lng, lat] of ring) points.push([lat, lng]);
            }
        };
        if (parsed?.type === 'Polygon' && Array.isArray(parsed.coordinates)) {
            addRings(parsed.coordinates);
        } else if (parsed?.type === 'MultiPolygon' && Array.isArray(parsed.coordinates)) {
            parsed.coordinates.forEach(addRings);
        }
        return points;
    } catch {
        return [];
    }
}

/**
 * #1740: points to feed the locations-index map's initial fit-bounds (LocationsPage.tsx's
 * FitBounds). A location with coordinates contributes just that point — today's only populated
 * case, kept unchanged so the fit doesn't regress. A location lacking coordinates but carrying a
 * saved boundary (#1705) contributes its boundary ring points instead, so a boundary-only
 * location's outline is visible without a manual pan/zoom. A location with neither stays
 * excluded, as before. Returns plain [lat, lng] tuples (not `L.LatLngBounds`) so this stays pure
 * and Node-testable without a Leaflet/DOM dependency — the same reasoning as trailMapBounds.ts's
 * computeMapBounds; callers wrap the result in `L.latLngBounds(...)` themselves.
 */
export function computeFitBoundsPoints(
    locations: Pick<Location, 'latitude' | 'longitude' | 'boundaryGeoJson'>[]
): [number, number][] {
    const points: [number, number][] = [];
    for (const loc of locations) {
        if (loc.latitude && loc.longitude) {
            points.push([loc.latitude, loc.longitude]);
        } else if (loc.boundaryGeoJson) {
            points.push(...boundaryRingPoints(loc.boundaryGeoJson));
        }
    }
    return points;
}
