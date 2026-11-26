import { useState, useCallback } from 'react';

const STORAGE_KEY = 'utanvega_favorite_events';

function readFromStorage(): string[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error('Failed to parse favorite events from localStorage', e);
        return [];
    }
}

export function useFavoriteEvents() {
    // Lazy initializer: reads localStorage synchronously on first render so a returning visitor's
    // already-favorited events render as favorited immediately — no post-mount effect flipping them
    // from an empty list on the first paint (mirrors useFavorites.ts's #1903 fix).
    const [favoriteEvents, setFavoriteEvents] = useState<string[]>(() => readFromStorage());

    const toggleFavoriteEvent = useCallback((slug: string) => {
        setFavoriteEvents(prev => {
            const next = prev.includes(slug)
                ? prev.filter(s => s !== slug)
                : [...prev, slug];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const isFavoriteEvent = useCallback((slug: string) => favoriteEvents.includes(slug), [favoriteEvents]);

    return { favoriteEvents, toggleFavoriteEvent, isFavoriteEvent };
}
