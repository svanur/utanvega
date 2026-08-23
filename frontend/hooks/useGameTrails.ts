import { useState, useEffect } from 'react';
import { API_URL } from './useTrails';
import type { Trail } from './useTrails';

const BASE_FILTER = (t: Trail) =>
    t.activityType === 'Running' || t.activityType === 'TrailRunning';

export function useGameTrails(extraFilter?: (t: Trail) => boolean): Trail[] {
    const [trails, setTrails] = useState<Trail[]>([]);

    useEffect(() => {
        fetch(`${API_URL}/api/v1/trails`)
            .then(res => res.json())
            .then((data: Trail[]) => {
                const base = data.filter(BASE_FILTER);
                setTrails(extraFilter ? base.filter(extraFilter) : base);
            })
            .catch(err => console.error('Failed to load trails:', err));
    // extraFilter is read once on mount; no re-fetch on filter reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return trails;
}
