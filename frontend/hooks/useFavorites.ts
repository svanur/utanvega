import { useState, useEffect } from 'react';

const STORAGE_KEY = 'utanvega_favorites';

export function useFavorites() {
    const [favorites, setFavorites] = useState<string[]>([]);

    // Initialize from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setFavorites(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse favorites from localStorage', e);
            }
        }
    }, []);

    const toggleFavorite = (slug: string) => {
        setFavorites(prev => {
            const next = prev.includes(slug)
                ? prev.filter(s => s !== slug)
                : [...prev, slug];
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const isFavorite = (slug: string) => favorites.includes(slug);

    return { favorites, toggleFavorite, isFavorite };
}
