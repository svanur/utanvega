import { describe, it, expect } from 'vitest';
import { authRedirectToFor } from './authRedirectTo';

// #1147: LoginModal.tsx:19's module-scope authRedirectTo derivation had no test coverage — same
// shape i18n.ts had before #1133/#1141 extracted its module-scope derivations into pure,
// hostname/arg-based functions. authRedirectToFor is pure (no import.meta.env/window reads inside
// it), so unlike i18n.test.ts/usePageTitle.ts's siteForHostname this needs no vi.stubGlobal or
// dynamic import — it's importable directly under vitest's Node environment.
describe('authRedirectToFor', () => {
    it('uses the env value verbatim, trimmed, when set', () => {
        expect(authRedirectToFor('  https://example.com/callback  ', 'https://hlaupadagskra.is')).toBe(
            'https://example.com/callback'
        );
    });

    it('falls through to origin when the env value is unset', () => {
        expect(authRedirectToFor(undefined, 'https://hlaupadagskra.is')).toBe('https://hlaupadagskra.is');
    });

    it('falls through to origin when the env value is empty', () => {
        expect(authRedirectToFor('', 'https://hlaupadagskra.is')).toBe('https://hlaupadagskra.is');
    });

    it('falls through to origin when the env value is whitespace-only', () => {
        expect(authRedirectToFor('   ', 'https://hlaupadagskra.is')).toBe('https://hlaupadagskra.is');
    });
});
