import type { Trail } from '../hooks/useTrails';
import type { TrailGeometryFeature } from '../hooks/useTrailGeometries';

// Only the fields computeMapBounds actually reads from Trail — kept narrow so callers (and tests)
// don't need to construct a full Trail object just to compute bounds.
export type TrailLocationPoint = Pick<Trail, 'slug' | 'startLatitude' | 'startLongitude'>;

/**
 * Computes the bounding box that fits every visible trail's full route geometry (when loaded),
 * falling back to just that trail's start point when no geometry is available — plus the user's
 * location, when known — plus, when there are no trails at all, a fallback center point (#1309:
 * an event's own gpxPointLat/Lng, used when no trail is linked so the map still zooms somewhere
 * meaningful instead of sitting at its hardcoded default view).
 *
 * Returns a plain [[south, west], [north, east]] tuple rather than an `L.LatLngBounds` instance so
 * this stays pure and Node-testable without a Leaflet/DOM dependency; callers wrap the result in
 * `L.latLngBounds(...)` themselves (see TrailMapView.tsx).
 */
export function computeMapBounds(
    trailsWithLocation: TrailLocationPoint[],
    visibleGeometries: Pick<TrailGeometryFeature, 'slug' | 'coordinates'>[],
    userLocation: { lat: number; lng: number } | null,
    fallbackCenter: { lat: number; lng: number } | null = null
): [[number, number], [number, number]] | null {
    const geometryBySlug = new Map(visibleGeometries.map(g => [g.slug, g.coordinates]));

    const latLngs: [number, number][] = [];
    for (const trail of trailsWithLocation) {
        const coordinates = geometryBySlug.get(trail.slug);
        if (coordinates && coordinates.length > 0) {
            latLngs.push(...coordinates);
        } else if (trail.startLatitude !== null && trail.startLongitude !== null) {
            latLngs.push([trail.startLatitude, trail.startLongitude]);
        }
    }

    if (userLocation) {
        latLngs.push([userLocation.lat, userLocation.lng]);
    }

    if (latLngs.length === 0 && fallbackCenter) {
        latLngs.push([fallbackCenter.lat, fallbackCenter.lng]);
    }

    if (latLngs.length === 0) return null;

    let minLat = latLngs[0][0];
    let maxLat = latLngs[0][0];
    let minLng = latLngs[0][1];
    let maxLng = latLngs[0][1];
    for (const [lat, lng] of latLngs) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    }

    return [[minLat, minLng], [maxLat, maxLng]];
}
