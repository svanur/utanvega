import { useState, useEffect } from 'react';

const STORAGE_KEY = 'utanvega_favorite_events';

export function useFavoriteEvents() {
    const [favoriteEvents, setFavoriteEvents] = useState<string[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setFavoriteEvents(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse favorite events from localStorage', e);
            }
        }
    }, []);

    const toggleFavoriteEvent = (slug: string) => {
        setFavoriteEvents(prev => {
            const next = prev.includes(slug)
                ? prev.filter(s => s !== slug)
                : [...prev, slug];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const isFavoriteEvent = (slug: string) => favoriteEvents.includes(slug);

    return { favoriteEvents, toggleFavoriteEvent, isFavoriteEvent };
}
