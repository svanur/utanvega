import { describe, it, expect } from 'vitest';
import { brandImageSrcForHostname } from './cardCanvas';

// #1087: share cards must not draw the Hlaupadagskra logo on the 360Runs
// host, and must keep drawing it on Hlaupadagskra hosts (and anywhere else,
// since DEFAULT_LOCALE/siteForHostname fall back to the Icelandic brand).
// No 360Runs logo asset exists yet, so that host resolves to undefined —
// loadBrandImage's caller must skip the img.src assignment entirely rather
// than attempt a load, which is covered by this test staying undefined
// instead of pointing at a nonexistent file. Host list and lookalike-domain
// edge cases mirror hostEnv.test.ts / api/_site.test.ts.
describe('brandImageSrcForHostname', () => {
    it.each([
        ['hlaupadagskra.is', '/images/hlaupadagskra.avif'],
        ['www.hlaupadagskra.is', '/images/hlaupadagskra.avif'],
        ['360runs.com', undefined],
        ['www.360runs.com', undefined],
        // Genuine staging/preview hosts fall back to the Icelandic brand's logo.
        ['some-preview.vercel.app', '/images/hlaupadagskra.avif'],
        ['localhost', '/images/hlaupadagskra.avif'],
        // Lookalike hosts: contain a real suffix but are not a true (sub)domain
        // of it, so matchesHostSuffix's anchoring must reject them as 360Runs.
        ['evil360runs.com', '/images/hlaupadagskra.avif'],
        ['360runs.com.evil.net', '/images/hlaupadagskra.avif'],
    ])('%s -> %s', (hostname, expected) => {
        expect(brandImageSrcForHostname(hostname)).toBe(expected);
    });
});
