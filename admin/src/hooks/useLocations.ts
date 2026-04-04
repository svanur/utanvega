import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export type LocationType = 'Country' | 'Area' | 'Region' | 'Municipality' | 'Place' | 'Other';

export interface LocationDto {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    type: LocationType;
    parentId: string | null;
    parentName: string | null;
    latitude: number | null;
    longitude: number | null;
    radius: number | null;
    childrenCount: number;
}

export function useLocations(parentId: string | null = null, search: string | null = null) {
    const [locations, setLocations] = useState<LocationDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLocations = async () => {
        try {
            setLoading(true);
            let url = `/api/v1/admin/locations`;
            const params = new URLSearchParams();
            if (parentId) params.append('parentId', parentId);
            if (search) params.append('search', search);
            
            const queryString = params.toString();
            if (queryString) url += `?${queryString}`;

            const data = await apiFetch<LocationDto[]>(url);
            setLocations(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocations();
    }, [parentId, search]); // eslint-disable-line react-hooks/exhaustive-deps -- only run on mount and when params change

    return { locations, loading, error, refresh: fetchLocations };
}
