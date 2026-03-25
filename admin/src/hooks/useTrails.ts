import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export type Trail = {
    id: string;
    name: string;
    slug: string;
    length: number;
    elevationGain: number;
    elevationLoss: number;
    status: 'Draft' | 'Published' | 'Flagged' | 'Archived';
    activityType: 'Running' | 'Cycling' | 'Hiking' | 'Skiing';
};

export function useTrails() {
    const [trails, setTrails] = useState<Trail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTrails = async () => {
        try {
            setLoading(true);
            const data = await apiFetch<Trail[]>('/api/v1/admin/trails');
            setTrails(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrails();
    }, []);

    return { trails, loading, error, refresh: fetchTrails };
}
