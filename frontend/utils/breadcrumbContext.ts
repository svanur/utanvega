import type { BreadcrumbItem } from '../components/Layout';

/**
 * Some detail pages are reachable from more than one parent — a trail lives
 * under both /trails and the event or location that references it. Rather than
 * hardcoding one canonical parent, the linking page passes the trail it came
 * through as router state, and the detail page prepends those crumbs.
 *
 * Context lives in history state, so it survives back/forward but not a fresh
 * load of a pasted URL. That is intentional: a cold URL has no path to reflect,
 * and the detail page falls back to its own default breadcrumb.
 */
export interface BreadcrumbContextState {
    fromCrumbs?: BreadcrumbItem[];
}

/** Builds the router `state` for a link that should carry breadcrumb context. */
export function breadcrumbContext(crumbs: BreadcrumbItem[]): BreadcrumbContextState {
    return { fromCrumbs: crumbs };
}

/**
 * Reads breadcrumb context off router state and appends `current`.
 * Returns `fallback` when there is no usable context.
 *
 * History state is same-origin but still app-external input, so the shape is
 * validated and only absolute in-app paths are accepted as links.
 */
export function breadcrumbFromState(
    state: unknown,
    current: BreadcrumbItem,
    fallback: BreadcrumbItem[],
): BreadcrumbItem[] {
    const raw = (state as BreadcrumbContextState | null)?.fromCrumbs;
    if (!Array.isArray(raw) || raw.length === 0) return fallback;

    const crumbs = raw
        .filter((c): c is BreadcrumbItem =>
            !!c && typeof c.label === 'string' && c.label.length > 0
            && (c.to === undefined || (typeof c.to === 'string' && c.to.startsWith('/'))))
        .map(c => ({ label: c.label, to: c.to }));

    return crumbs.length > 0 ? [...crumbs, current] : fallback;
}
