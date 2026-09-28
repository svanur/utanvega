import { describe, it, expect } from 'vitest';
import { siteForHostname } from './usePageTitle';

// #1046: siteForHostname is a thin wrapper over _site.ts's localeForHostname
// (already exercised against lookalike hosts in api/_site.test.ts), so this
// only needs to check the extra "en" -> "360Runs" / else -> "Hlaupadagskra.is"
// mapping, not re-derive the full lookalike-host matrix.
describe('siteForHostname', () => {
    it.each([
        ['360runs.com', '360Runs'],
        ['www.360runs.com', '360Runs'],
        ['hlaupadagskra.is', 'Hlaupadagskra.is'],
        ['www.hlaupadagskra.is', 'Hlaupadagskra.is'],
        ['localhost', 'Hlaupadagskra.is'],
        ['some-preview.vercel.app', 'Hlaupadagskra.is'],
        // Lookalike host: contains "360runs.com" but is not a true subdomain of
        // it, so it must keep the Icelandic-brand title, not "360Runs".
        ['evil360runs.com', 'Hlaupadagskra.is'],
    ])('%s -> %s', (hostname, expected) => {
        expect(siteForHostname(hostname)).toBe(expected);
    });

    it('is case-insensitive, matching localeForHostname', () => {
        expect(siteForHostname('WWW.360RUNS.COM')).toBe('360Runs');
    });
});
