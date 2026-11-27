import { useState, useCallback } from 'react';

const STORAGE_KEY = 'utanvega_favorite_locations';

function readFromStorage(): string[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error('Failed to parse favorite locations from localStorage', e);
        return [];
    }
}

export function useFavoriteLocations() {
    // Lazy initializer: reads localStorage synchronously on first render so a returning visitor's
    // already-favorited locations render as favorited immediately — no post-mount effect flipping them
    // from an empty list on the first paint (mirrors useFavorites.ts's #1903 fix).
    const [favoriteLocations, setFavoriteLocations] = useState<string[]>(() => readFromStorage());

    const toggleFavoriteLocation = useCallback((slug: string) => {
        setFavoriteLocations(prev => {
            const next = prev.includes(slug)
                ? prev.filter(s => s !== slug)
                : [...prev, slug];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const isFavoriteLocation = useCallback((slug: string) => favoriteLocations.includes(slug), [favoriteLocations]);

    return { favoriteLocations, toggleFavoriteLocation, isFavoriteLocation };
}
