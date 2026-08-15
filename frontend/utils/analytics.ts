import { track } from '@vercel/analytics';

// Thin, typed wrappers around Vercel's track() so event names/shapes stay
// consistent instead of being spelled out ad-hoc at each call site. Device,
// browser, OS, and referrer are captured automatically by Vercel for every
// event — no need to pass them manually.

type ViewModePage = 'events' | 'trails';
type ViewMode = 'list' | 'map' | 'table';

export function trackViewModeChange(page: ViewModePage, mode: ViewMode) {
    track('View Mode Change', { page, mode });
}

export function trackStoreIconClick() {
    track('Store Icon Click');
}
