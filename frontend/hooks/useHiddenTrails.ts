import { useState, useEffect } from 'react';

const STORAGE_KEY = 'utanvega_hidden_trails';

export function useHiddenTrails() {
    const [hiddenSlugs, setHiddenSlugs] = useState<string[]>([]);

    // Initialize from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setHiddenSlugs(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse hidden trails from localStorage', e);
            }
        }
    }, []);

    const hideTrail = (slug: string) => {
        setHiddenSlugs(prev => {
            if (prev.includes(slug)) return prev;
            const next = [...prev, slug];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const showTrail = (slug: string) => {
        setHiddenSlugs(prev => {
            const next = prev.filter(s => s !== slug);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const isHidden = (slug: string) => hiddenSlugs.includes(slug);

    const clearHidden = () => {
        setHiddenSlugs([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    return { hiddenSlugs, hideTrail, showTrail, isHidden, clearHidden };
}
