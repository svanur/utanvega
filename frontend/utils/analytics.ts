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

export function trackTrailShareClick(slug?: string) {
    track('Trail Share Click', slug ? { slug } : {});
}

export function trackTrailQRClick(slug: string) {
    track('Trail QR Click', { slug });
}

export function trackTrailGpxDownload(slug: string) {
    track('Trail GPX Download', { slug });
}

export function trackTrailCompareClick(slug: string) {
    track('Trail Compare Click', { slug });
}

export function trackTrailPredictorClick(slug: string) {
    track('Trail Predictor Click', { slug });
}

export function trackTrailOfflineSave(slug: string) {
    track('Trail Offline Save', { slug });
}

export function trackTrailDirectionsClick(slug: string) {
    track('Trail Directions Click', { slug });
}

export function trackSiteQROpen() {
    track('Site QR Open');
}
