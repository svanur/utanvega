import { useEffect } from 'react';
import { BRAND_NAME, localeForHostname } from '../api/_site';

/**
 * Brand name for the tab title on `hostname`: "360Runs" on the English
 * production host (360runs.com/www., see HOST_LOCALES in _site.ts), the
 * Icelandic brand everywhere else — hlaupadagskra.is, previews, localhost.
 * Exported so it's unit-testable independently of the effect below.
 */
export function siteForHostname(hostname: string): string {
    return BRAND_NAME[localeForHostname(hostname)];
}

export function usePageTitle(title?: string) {
    useEffect(() => {
        // Read lazily, inside the effect, rather than as a module-scope constant:
        // keeps this module importable (for siteForHostname's own unit test) in
        // vitest's Node environment, which has no `window` global.
        const site = siteForHostname(window.location.hostname);
        document.title = title ? `${title} | ${site}` : site;
        return () => { document.title = site; };
    }, [title]);
}
