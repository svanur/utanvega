// #1543: per-trail-slug route styling, shared by TrailMapView's <Polyline> rendering and
// EventTrailLegend's swatches so the two always agree on which color/dash a given slug gets.
//
// Deliberately a fixed hex palette, not MUI theme tokens (per #1543's repo-specific requirement)
// — route colors must stay visually distinct and stable in both light and dark mode, which rules
// out theme.palette values that flip between modes.
//
// Palette is Paul Tol's "muted" qualitative scheme (https://personal.sron.nl/~pault/), chosen over
// the more common Okabe-Ito 8-color set because it avoids pure black/white, which can vanish
// against the dark map tile layer (LayersControl's "dark" basemap, TrailMapView.tsx:340-345).
export const TRAIL_ROUTE_PALETTE: readonly string[] = [
    '#CC6677', // rose
    '#332288', // indigo
    '#DDCC77', // sand
    '#117733', // green
    '#88CCEE', // cyan
    '#882255', // wine
    '#44AA99', // teal
    '#999933', // olive
    '#AA4499', // purple
];

// Leaflet Polyline `dashArray` values: solid (undefined — Leaflet draws a solid line when the
// option is omitted), dashed, dotted. Cycled in once a palette color repeats (more trails than
// colors) so no two visible routes are ever pixel-identical.
export const TRAIL_DASH_PATTERNS: readonly (string | undefined)[] = [undefined, '10 8', '2 7'];

// #1543: the activity-type legend (TrailRunning/Running/Hiking/Cycling) — out of scope for this
// issue (route coloring below now uses TRAIL_ROUTE_PALETTE instead), moved here unchanged from
// TrailMapView.tsx purely to avoid tripping that file's react-refresh/only-export-components lint
// rule, which only allows component files to export components. Not currently consumed elsewhere;
// kept available for a future activity-type legend.
export const ACTIVITY_COLORS: Record<string, string> = {
    TrailRunning: '#e65100', // deep orange
    Running: '#1565c0',     // blue
    Hiking: '#2e7d32',      // green
    Cycling: '#6a1b9a',     // purple
};

export interface TrailRouteStyle {
    color: string;
    dashArray?: string;
}

// Shared by TrailMapView (internally, for its own `sortedSlugs` memo) and CompetitionDetailPage
// (to pass the identical list into EventTrailLegend) so both always agree on which index — and
// therefore which color/dash — a given slug gets, without duplicating the derivation logic.
export function computeSortedSlugs(
    trails: readonly { slug: string }[],
    geometries: readonly { slug: string }[],
): string[] {
    const slugSet = new Set(trails.map(t => t.slug));
    const geometrySlugs = geometries.filter(g => slugSet.has(g.slug)).map(g => g.slug);
    return [...new Set(geometrySlugs)].sort();
}

// `sortedSlugs` must be a stable, memoized list for a given render pass (e.g. sorted once per the
// event's full geometry set) so a trail's color/dash never shifts across re-renders just because
// `trails` or `geometries` resolved in a different order.
export function getTrailRouteStyle(slug: string, sortedSlugs: readonly string[]): TrailRouteStyle {
    const index = sortedSlugs.indexOf(slug);
    const i = index === -1 ? 0 : index;
    const color = TRAIL_ROUTE_PALETTE[i % TRAIL_ROUTE_PALETTE.length];
    const dashIndex = Math.floor(i / TRAIL_ROUTE_PALETTE.length) % TRAIL_DASH_PATTERNS.length;
    return { color, dashArray: TRAIL_DASH_PATTERNS[dashIndex] };
}

// Same toggle-off-on-reclick semantics as TrailMapView's existing Polyline click handler
// (TrailMapView.tsx:390-391) — shared so EventTrailLegend's list click and the map's own track
// click can never drift apart.
export function toggleTrailSelection(currentSlug: string | null, slug: string): { slug: string | null; source: 'track' | null } {
    return currentSlug === slug ? { slug: null, source: null } : { slug, source: 'track' };
}
