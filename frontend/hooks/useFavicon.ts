import { useEffect } from 'react';
import { FAVICON_PATH, localeForHostname } from '../api/_site';

/**
 * Favicon path for the tab icon on `hostname`: the 360Runs PNG on the
 * English production host (360runs.com/www., see HOST_LOCALES in _site.ts),
 * the Hlaupadagskra.is PNG everywhere else — previews, localhost, and the
 * Icelandic host itself. Exported so it's unit-testable independently of the
 * effect below, mirroring usePageTitle.ts's siteForHostname.
 */
export function faviconForHostname(hostname: string): string {
    return FAVICON_PATH[localeForHostname(hostname)];
}

/**
 * Swaps the static `<link rel="icon">` in index.html (always the Icelandic
 * PNG, since that's the only one a build-time default can serve) for the
 * per-host PNG once the client knows which host it's actually on. Hostname
 * doesn't change per route, so unlike usePageTitle this is called once at
 * the app root, not per-page.
 */
export function useFavicon() {
    useEffect(() => {
        // Read lazily, inside the effect, rather than as a module-scope constant:
        // keeps this module importable (for faviconForHostname's own unit test)
        // in vitest's Node environment, which has no `window` global.
        const href = faviconForHostname(window.location.hostname);
        const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (link) {
            link.href = href;
            link.type = 'image/png';
        }
    }, []);
}
