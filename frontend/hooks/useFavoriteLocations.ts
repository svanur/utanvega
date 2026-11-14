import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'utanvega_favorite_locations';

export function useFavoriteLocations() {
    const [favoriteLocations, setFavoriteLocations] = useState<string[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setFavoriteLocations(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse favorite locations from localStorage', e);
            }
        }
    }, []);

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
