import { useEffect } from 'react';
import { localeForHostname } from '../api/_site';

// 360runs.com is the English-language production host (see HOST_LOCALES in
// _site.ts); every other host — including hlaupadagskra.is, previews and
// localhost — keeps the Icelandic-brand title.
const SITE = localeForHostname(window.location.hostname) === 'en' ? '360Runs' : 'Hlaupadagskra.is';

export function usePageTitle(title?: string) {
    useEffect(() => {
        document.title = title ? `${title} | ${SITE}` : SITE;
        return () => { document.title = SITE; };
    }, [title]);
}
