import type { TFunction } from 'i18next';

/**
 * Downloads a trail's GPX file via fetch() (rather than a plain <a href download>
 * anchor) so a non-ok response (stale slug, GPX regeneration race, etc.) shows an
 * in-app toast instead of replacing the whole SPA with the browser's native error
 * page (#1552). Extracted out of TrailDetailsPage's handleGpxDownload (#1559) so
 * the fetch/error-branching logic is unit-testable independently of the component
 * — see trailGpxDownload.test.ts.
 *
 * `createObjectUrl`/`triggerDownload` are injectable (defaulting to the real
 * browser APIs) purely so this can be exercised under vitest's Node test
 * environment, which has neither `URL.createObjectURL` nor `document` — same
 * reasoning as calendarLinks.ts's window.location.hostname lazy-read. Production
 * callers never need to pass them.
 */
export interface GpxDownloadOptions {
    fetchImpl: typeof fetch;
    apiUrl: string;
    slug: string;
    language: string;
    t: TFunction;
    setToastSeverity: (severity: 'info' | 'error') => void;
    setToastMessage: (message: string | null) => void;
    trackTrailGpxDownload: (slug: string) => void;
    createObjectUrl?: (blob: Blob) => string;
    triggerDownload?: (objectUrl: string, filename: string) => void;
}

function defaultTriggerDownload(objectUrl: string, filename: string): void {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function downloadTrailGpx(options: GpxDownloadOptions): Promise<void> {
    const {
        fetchImpl,
        apiUrl,
        slug,
        language,
        t,
        setToastSeverity,
        setToastMessage,
        trackTrailGpxDownload,
        createObjectUrl = (blob: Blob) => URL.createObjectURL(blob),
        triggerDownload = defaultTriggerDownload,
    } = options;

    const url = `${apiUrl}/api/v1/trails/${slug}/gpx${language === 'en' ? '?lang=en' : ''}`;
    try {
        const response = await fetchImpl(url);
        if (!response.ok) {
            setToastSeverity('error');
            setToastMessage(t('trail.gpxDownloadFailed'));
            return;
        }
        const blob = await response.blob();
        const objectUrl = createObjectUrl(blob);
        triggerDownload(objectUrl, `${slug}.gpx`);
        trackTrailGpxDownload(slug);
    } catch {
        setToastSeverity('error');
        setToastMessage(t('trail.gpxDownloadFailed'));
    }
}
