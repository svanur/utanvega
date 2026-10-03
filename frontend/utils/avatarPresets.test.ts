import { describe, it, expect } from 'vitest';
import { allowedAvatarHostsFor, isAllowedAvatarValue } from './avatarPresets';

// #1155: avatarPresets.ts's module-scope ALLOWED_AVATAR_HOSTS derivation had no test coverage —
// same shape i18n.ts had before #1133/#1141 extracted its module-scope derivations into pure,
// arg-based functions, and LoginModal.tsx's authRedirectTo had before #1147. allowedAvatarHostsFor
// is pure (no import.meta.env/window reads inside it), so like authRedirectToFor this needs no
// vi.stubGlobal or dynamic import — it's importable directly under vitest's Node environment.
describe('allowedAvatarHostsFor', () => {
    it('falls through to the default hosts when the env value is unset', () => {
        expect(allowedAvatarHostsFor(undefined)).toEqual(
            new Set(['avatars.githubusercontent.com', 'secure.gravatar.com', 'images.unsplash.com', 'i.imgur.com'])
        );
    });

    it('falls through to the default hosts when the env value is empty', () => {
        expect(allowedAvatarHostsFor('')).toEqual(
            new Set(['avatars.githubusercontent.com', 'secure.gravatar.com', 'images.unsplash.com', 'i.imgur.com'])
        );
    });

    it('falls through to the default hosts when the env value is whitespace-only', () => {
        expect(allowedAvatarHostsFor('   ')).toEqual(
            new Set(['avatars.githubusercontent.com', 'secure.gravatar.com', 'images.unsplash.com', 'i.imgur.com'])
        );
    });

    it('uses a custom comma-separated list when the env value is set', () => {
        expect(allowedAvatarHostsFor('cdn.example.com,avatars.example.org')).toEqual(
            new Set(['cdn.example.com', 'avatars.example.org'])
        );
    });

    it('normalizes mixed-case and whitespace-padded hosts', () => {
        expect(allowedAvatarHostsFor('  CDN.Example.com , Avatars.EXAMPLE.org  ')).toEqual(
            new Set(['cdn.example.com', 'avatars.example.org'])
        );
    });

    it('drops empty entries produced by stray commas', () => {
        expect(allowedAvatarHostsFor('cdn.example.com,,avatars.example.org,')).toEqual(
            new Set(['cdn.example.com', 'avatars.example.org'])
        );
    });
});

describe('isAllowedAvatarValue', () => {
    it('allows a nullish/undefined avatar value', () => {
        expect(isAllowedAvatarValue(undefined)).toBe(true);
        expect(isAllowedAvatarValue(null)).toBe(true);
    });

    it('allows a preset value', () => {
        expect(isAllowedAvatarValue('preset:running-man')).toBe(true);
    });

    it('allows an https URL on an allow-listed host', () => {
        expect(isAllowedAvatarValue('https://avatars.githubusercontent.com/u/1234')).toBe(true);
    });

    it('is case-insensitive for the hostname', () => {
        expect(isAllowedAvatarValue('https://AVATARS.GITHUBUSERCONTENT.COM/u/1234')).toBe(true);
    });

    it('rejects an http URL even on an allow-listed host', () => {
        expect(isAllowedAvatarValue('http://avatars.githubusercontent.com/u/1234')).toBe(false);
    });

    it('rejects a URL on a host that is not allow-listed', () => {
        expect(isAllowedAvatarValue('https://evil.example.com/avatar.png')).toBe(false);
    });

    it('rejects an unparsable value', () => {
        expect(isAllowedAvatarValue('not a url')).toBe(false);
    });
});
