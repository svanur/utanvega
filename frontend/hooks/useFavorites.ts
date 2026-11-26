import { useState, useCallback } from 'react';

const STORAGE_KEY = 'utanvega_favorites';

function readFromStorage(): string[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error('Failed to parse favorites from localStorage', e);
        return [];
    }
}

export function useFavorites() {
    // Lazy initializer: reads localStorage synchronously on first render so a returning visitor's
    // already-favorited trails render as favorited immediately — no post-mount effect flipping them
    // from an empty list on the first paint (mirrors useAdventCalendar.ts's #1884 fix).
    const [favorites, setFavorites] = useState<string[]>(() => readFromStorage());

    const toggleFavorite = useCallback((slug: string) => {
        setFavorites(prev => {
            const next = prev.includes(slug)
                ? prev.filter(s => s !== slug)
                : [...prev, slug];

            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const isFavorite = useCallback((slug: string) => favorites.includes(slug), [favorites]);

    return { favorites, toggleFavorite, isFavorite };
}
