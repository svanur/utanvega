import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'utanvega_recently_viewed';
const MAX_RECENT = 10;

export function useRecentlyViewed() {
    const [recentSlugs, setRecentSlugs] = useState<string[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setRecentSlugs(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse recently viewed from localStorage', e);
            }
        }
    }, []);

    const addRecent = useCallback((slug: string) => {
        setRecentSlugs(prev => {
            const next = [slug, ...prev.filter(s => s !== slug)].slice(0, MAX_RECENT);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    return { recentSlugs, addRecent };
}
