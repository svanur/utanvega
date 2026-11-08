import { LocationType } from '../hooks/useLocations';

export interface MunicipalityBoundaryProperties {
    slug: string;
    name: string;
}

export type MunicipalityBoundaryFeature = GeoJSON.Feature<GeoJSON.Polygon, MunicipalityBoundaryProperties>;

/**
 * Matches a Location against the 4 pilot municipalities bundled in
 * public/data/municipality-boundaries.geojson (#1706). A Location matches if it's typed
 * Municipality and either its slug or its name lines up with a bundled feature. Matching on slug
 * covers the normal case (the Location already exists, e.g. via #1705's import script); matching
 * on name is a fallback for a location being created fresh, before it has a real slug.
 */
export function findBundledMunicipalityBoundary(
    type: LocationType,
    slug: string,
    name: string,
    bundled: MunicipalityBoundaryFeature[]
): MunicipalityBoundaryFeature | null {
    if (type !== 'Municipality') return null;
    const trimmedSlug = slug.trim().toLowerCase();
    const bySlug = bundled.find(f => f.properties.slug === trimmedSlug);
    if (bySlug) return bySlug;
    const trimmedName = name.trim().toLowerCase();
    return bundled.find(f => f.properties.name.toLowerCase() === trimmedName) ?? null;
}
