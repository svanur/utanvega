import { describe, it, expect } from 'vitest';
import { isStagingHost } from './hostEnv';

// #1046: isStagingHost derives from the same HOST_LOCALES allow-list as
// _site.ts's isIndexableHost/localeForHostname (see api/_site.test.ts), so the
// host list and lookalike-domain edge cases mirror those tests.
describe('isStagingHost', () => {
    it.each([
        ['hlaupadagskra.is', false],
        ['www.hlaupadagskra.is', false],
        ['360runs.com', false],
        ['www.360runs.com', false],
        // Genuine staging/preview hosts must still show the banner.
        ['some-preview.vercel.app', true],
        ['localhost', true],
        // Lookalike hosts: contain a real suffix but are not a true (sub)domain
        // of it, so matchesHostSuffix's anchoring must reject them as production.
        ['evilhlaupadagskra.is', true],
        ['hlaupadagskra.is.evil.com', true],
        ['evil360runs.com', true],
        ['360runs.com.evil.net', true],
    ])('%s -> isStaging %s', (hostname, expected) => {
        expect(isStagingHost(hostname)).toBe(expected);
    });
});
