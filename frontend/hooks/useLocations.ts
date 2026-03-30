import { useState, useEffect } from 'react';
import { API_URL, Trail } from './useTrails';

export interface Location {
    id: string;
    name: string;
    slug: string;
    description?: string;
    type: string;
    parentId?: string;
    parentName?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    childrenCount: number;
    trailsCount: number;
}

export interface LocationWithTrails {
    location: Location;
    trails: Trail[];
}

export function useLocations() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${API_URL}/api/v1/locations`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch locations');
                return res.json();
            })
            .then(data => {
                setLocations(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    return { locations, loading, error };
}

export function useLocationBySlug(slug: string | undefined) {
    const [locationWithTrails, setLocationWithTrails] = useState<LocationWithTrails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) return;

        setLoading(true);
        fetch(`${API_URL}/api/v1/locations/${slug}`)
            .then(res => {
                if (!res.ok) {
                    if (res.status === 404) throw new Error('Location not found');
                    throw new Error('Failed to fetch location');
                }
                return res.json();
            })
            .then(data => {
                setLocationWithTrails(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [slug]);

    return { ...locationWithTrails, loading, error };
}
