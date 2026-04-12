import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export type Trail = {
    id: string;
    name: string;
    description?: string;
    slug: string;
    length: number;
    elevationGain: number;
    elevationLoss: number;
    status: 'Draft' | 'Published' | 'Flagged' | 'Archived' | 'Deleted';
    activityType: 'TrailRunning' | 'Running' | 'Cycling' | 'Hiking';
    trailType: 'OutAndBack' | 'Loop' | 'PointToPoint';
    difficulty?: string;
    startLatitude?: number | null;
    startLongitude?: number | null;
    locations: { id: string, name: string, slug: string, role: string }[];
    tags?: { name: string, slug: string, color: string | null }[];
};

export function useTrails(includeDeleted: boolean = false) {
    const [trails, setTrails] = useState<Trail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTrails = async () => {
        try {
            setLoading(true);
            const data = await apiFetch<Trail[]>(`/api/v1/admin/trails?includeDeleted=${includeDeleted}`);
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
    }, [includeDeleted]); // eslint-disable-line react-hooks/exhaustive-deps -- only run on mount and when includeDeleted changes

    return { trails, setTrails, loading, error, refresh: fetchTrails };
}
