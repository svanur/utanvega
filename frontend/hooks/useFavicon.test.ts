import { describe, it, expect } from 'vitest';
import { faviconForHostname } from './useFavicon';

// #1368: faviconForHostname is a thin wrapper over _site.ts's
// localeForHostname/FAVICON_PATH (already exercised against lookalike hosts
// in api/_site.test.ts), so this only needs to check the per-host PNG
// mapping, including the no-HOST_LOCALES-match fallback.
describe('faviconForHostname', () => {
    it.each([
        ['360runs.com', '/icons/360runs-icon-192.png'],
        ['www.360runs.com', '/icons/360runs-icon-192.png'],
        ['hlaupadagskra.is', '/icons/hlaupadagskra-icon-192.png'],
        ['www.hlaupadagskra.is', '/icons/hlaupadagskra-icon-192.png'],
        ['localhost', '/icons/hlaupadagskra-icon-192.png'],
        ['some-preview.vercel.app', '/icons/hlaupadagskra-icon-192.png'],
        // Lookalike host: contains "360runs.com" but is not a true subdomain
        // of it, so it must keep the Icelandic-brand icon, not the 360Runs one.
        ['evil360runs.com', '/icons/hlaupadagskra-icon-192.png'],
    ])('%s -> %s', (hostname, expected) => {
        expect(faviconForHostname(hostname)).toBe(expected);
    });

    it('is case-insensitive, matching localeForHostname', () => {
        expect(faviconForHostname('WWW.360RUNS.COM')).toBe('/icons/360runs-icon-192.png');
    });
});
