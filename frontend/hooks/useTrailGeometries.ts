import { useState, useEffect } from 'react';
import { API_URL } from './useTrails';

export interface TrailGeometryFeature {
    slug: string;
    activityType: string;
    coordinates: [number, number][]; // [lat, lng]
}

let cachedGeometries: TrailGeometryFeature[] | null = null;

export function useTrailGeometries() {
    const [geometries, setGeometries] = useState<TrailGeometryFeature[]>(cachedGeometries ?? []);
    const [loading, setLoading] = useState(!cachedGeometries);

    useEffect(() => {
        if (cachedGeometries) return;

        fetch(`${API_URL}/api/v1/trails/geometries`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch geometries');
                return res.json();
            })
            .then((data: TrailGeometryFeature[]) => {
                cachedGeometries = data;
                setGeometries(data);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, []);

    return { geometries, loading };
}
