import { useQuery } from '@tanstack/react-query';
import { API_URL } from './useTrails';

export interface TrailGeometryFeature {
    slug: string;
    activityType: string;
    coordinates: [number, number][]; // [lat, lng]
}

// Full GeoJSON geometry for a single trail: coordinates are [lon, lat, ele]
export interface SingleTrailGeometry {
    type: string;
    coordinates: number[][];
}

export function useTrailGeometries() {
    const { data: geometries = [], isPending: loading } = useQuery<TrailGeometryFeature[]>({
        queryKey: ['geometries'],
        queryFn: () => fetch(`${API_URL}/api/v1/trails/geometries`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch geometries');
                return res.json() as Promise<TrailGeometryFeature[]>;
            }),
        staleTime: 30 * 60 * 1000,
        gcTime: 2 * 60 * 60 * 1000,
    });
    return { geometries, loading };
}

export function useTrailGeometry(slug: string | null | undefined) {
    const { data, isPending, error } = useQuery<SingleTrailGeometry>({
        queryKey: ['trail-geometry', slug],
        queryFn: () => fetch(`${API_URL}/api/v1/trails/${slug}/geometry`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch geometry');
                return res.json() as Promise<SingleTrailGeometry>;
            }),
        enabled: !!slug,
        staleTime: 30 * 60 * 1000,
        gcTime: 2 * 60 * 60 * 1000,
    });
    return {
        coordinates: data?.coordinates ?? null,
        loading: isPending && !!slug,
        failed: !!error,
    };
}
