// @vitest-environment jsdom
//
// #1807: useFavorites, useFavoriteEvents, and useFavoriteLocations are three near-identical
// localStorage-backed hooks (read on mount with a try/catch around JSON.parse, toggle updates
// state + writes back to localStorage, an isFavorite* boolean lookup) that had no coverage at
// all. Rather than triplicate the same five assertions three times, `runFavoriteHookSuite` below
// drives all three through one shared set of behaviours, keyed off each hook's own storage key
// and returned field names (frontend/hooks/useFavoriteLocations.ts:11-16 is the JSON.parse
// try/catch this file targets for the malformed-JSON case).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useFavorites } from './useFavorites';
import { useFavoriteEvents } from './useFavoriteEvents';
import { useFavoriteLocations } from './useFavoriteLocations';

afterEach(cleanup);

beforeEach(() => {
    localStorage.clear();
});

type FavoritesResult<ListKey extends string, IsFavKey extends string, ToggleKey extends string> = {
    [K in ListKey]: string[];
} & {
    [K in IsFavKey]: (slug: string) => boolean;
} & {
    [K in ToggleKey]: (slug: string) => void;
};

function runFavoriteHookSuite<ListKey extends string, IsFavKey extends string, ToggleKey extends string>(config: {
    label: string;
    storageKey: string;
    listKey: ListKey;
    isFavKey: IsFavKey;
    useHook: () => FavoritesResult<ListKey, IsFavKey, ToggleKey>;
    toggleKey: ToggleKey;
}) {
    const { label, storageKey, listKey, isFavKey, useHook, toggleKey } = config;

    describe(label, () => {
        it('loads an empty list when localStorage has nothing stored', () => {
            const { result } = renderHook(() => useHook());

            expect(result.current[listKey]).toEqual([]);
        });

        it('loads the persisted list from localStorage on mount', () => {
            localStorage.setItem(storageKey, JSON.stringify(['a-trail', 'b-trail']));

            const { result } = renderHook(() => useHook());

            expect(result.current[listKey]).toEqual(['a-trail', 'b-trail']);
        });

        it('recovers from malformed JSON in localStorage without throwing, falling back to an empty list', () => {
            localStorage.setItem(storageKey, '{not valid json');

            let result: { current: FavoritesResult<ListKey, IsFavKey, ToggleKey> } | undefined;
            expect(() => {
                result = renderHook(() => useHook()).result;
            }).not.toThrow();

            expect(result!.current[listKey]).toEqual([]);
        });

        it('toggle-add: adds a not-yet-favorited slug, updates state, and persists to localStorage', () => {
            const { result } = renderHook(() => useHook());

            expect(result.current[isFavKey]('new-slug')).toBe(false);

            act(() => {
                result.current[toggleKey]('new-slug');
            });

            expect(result.current[listKey]).toEqual(['new-slug']);
            expect(result.current[isFavKey]('new-slug')).toBe(true);
            expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(['new-slug']);
        });

        it('toggle-remove: removes an already-favorited slug, updates state, and persists to localStorage', () => {
            localStorage.setItem(storageKey, JSON.stringify(['existing-slug']));
            const { result } = renderHook(() => useHook());

            expect(result.current[isFavKey]('existing-slug')).toBe(true);

            act(() => {
                result.current[toggleKey]('existing-slug');
            });

            expect(result.current[listKey]).toEqual([]);
            expect(result.current[isFavKey]('existing-slug')).toBe(false);
            expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual([]);
        });
    });
}

runFavoriteHookSuite({
    label: 'useFavorites',
    storageKey: 'utanvega_favorites',
    listKey: 'favorites',
    isFavKey: 'isFavorite',
    toggleKey: 'toggleFavorite',
    useHook: useFavorites,
});

describe('useFavorites hydration', () => {
    // #1903: favorites must hydrate synchronously from localStorage so the very first render
    // already reflects a returning visitor's stored list — no one-frame empty-favorites flash
    // while a post-mount effect catches up (the bug useAdventCalendar.ts fixed for #1884).
    it('reflects previously-stored favorites on the very first render, with no empty-array render first', () => {
        localStorage.setItem('utanvega_favorites', JSON.stringify(['a-trail', 'b-trail']));

        const { result } = renderHook(() => useFavorites());

        // Asserted immediately after renderHook, without act()/waitFor — if hydration happened
        // in a useEffect instead of the lazy useState initializer, this first render would still
        // show [].
        expect(result.current.favorites).toEqual(['a-trail', 'b-trail']);
    });
});

runFavoriteHookSuite({
    label: 'useFavoriteEvents',
    storageKey: 'utanvega_favorite_events',
    listKey: 'favoriteEvents',
    isFavKey: 'isFavoriteEvent',
    toggleKey: 'toggleFavoriteEvent',
    useHook: useFavoriteEvents,
});

describe('useFavoriteEvents hydration', () => {
    // #1915: same hydration-flash bug as useFavorites (#1903) — favorite events must hydrate
    // synchronously from localStorage so the very first render already reflects a returning
    // visitor's stored list, with no one-frame empty-favorites flash from a post-mount effect.
    it('reflects previously-stored favorite events on the very first render, with no empty-array render first', () => {
        localStorage.setItem('utanvega_favorite_events', JSON.stringify(['event-a', 'event-b']));

        const { result } = renderHook(() => useFavoriteEvents());

        // Asserted immediately after renderHook, without act()/waitFor — if hydration happened
        // in a useEffect instead of the lazy useState initializer, this first render would still
        // show [].
        expect(result.current.favoriteEvents).toEqual(['event-a', 'event-b']);
    });
});

runFavoriteHookSuite({
    label: 'useFavoriteLocations',
    storageKey: 'utanvega_favorite_locations',
    listKey: 'favoriteLocations',
    isFavKey: 'isFavoriteLocation',
    toggleKey: 'toggleFavoriteLocation',
    useHook: useFavoriteLocations,
});

describe('useFavoriteLocations hydration', () => {
    // #1915: same hydration-flash bug as useFavorites (#1903) — favorite locations must hydrate
    // synchronously from localStorage so the very first render already reflects a returning
    // visitor's stored list, with no one-frame empty-favorites flash from a post-mount effect.
    it('reflects previously-stored favorite locations on the very first render, with no empty-array render first', () => {
        localStorage.setItem('utanvega_favorite_locations', JSON.stringify(['loc-a', 'loc-b']));

        const { result } = renderHook(() => useFavoriteLocations());

        // Asserted immediately after renderHook, without act()/waitFor — if hydration happened
        // in a useEffect instead of the lazy useState initializer, this first render would still
        // show [].
        expect(result.current.favoriteLocations).toEqual(['loc-a', 'loc-b']);
    });
});
