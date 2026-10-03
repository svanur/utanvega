import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// #1133: brandNameForHostname is a thin wrapper over _site.ts's localeForHostname (already
// exercised against lookalike hosts in api/_site.test.ts), same composition as usePageTitle.ts's
// siteForHostname (see usePageTitle.test.ts) — so this only needs to check the host -> brand
// mapping, not re-derive the full lookalike-host matrix.
//
// Unlike siteForHostname, i18n.ts computes its module-scope `brandName` (and `initialLang`) as an
// import-time side effect, deliberately — see i18n.ts:34-41's comment on why brandName must be
// read once at module load rather than lazily per-call. That means merely importing the module
// needs `window.location.hostname` and `localStorage.getItem` to exist as globals, even though
// brandNameForHostname itself (the function under test) is pure and takes `hostname` as a plain
// argument. Stub both once, before the single dynamic import below, so the module's own load-time
// code doesn't throw under vitest's Node environment (no `window` global) — same vi.stubGlobal
// pattern as api/og.test.ts.
let brandNameForHostname: (hostname: string) => string;

beforeAll(async () => {
    vi.stubGlobal('window', { location: { hostname: 'hlaupadagskra.is' } });
    vi.stubGlobal('localStorage', { getItem: () => null });
    ({ brandNameForHostname } = await import('./i18n'));
});

afterAll(() => {
    vi.unstubAllGlobals();
});

describe('brandNameForHostname', () => {
    it.each([
        ['360runs.com', '360Runs'],
        ['www.360runs.com', '360Runs'],
        ['hlaupadagskra.is', 'Hlaupadagskra.is'],
        ['www.hlaupadagskra.is', 'Hlaupadagskra.is'],
        ['localhost', 'Hlaupadagskra.is'],
        ['some-preview.vercel.app', 'Hlaupadagskra.is'],
        // Lookalike host: contains "360runs.com" but is not a true subdomain of
        // it, so it must keep the Icelandic brand, not "360Runs".
        ['evil360runs.com', 'Hlaupadagskra.is'],
    ])('%s -> %s', (hostname, expected) => {
        expect(brandNameForHostname(hostname)).toBe(expected);
    });

    it('is case-insensitive, matching localeForHostname', () => {
        expect(brandNameForHostname('WWW.360RUNS.COM')).toBe('360Runs');
    });
});
