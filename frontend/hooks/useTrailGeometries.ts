import { useQuery } from '@tanstack/react-query';
import { API_URL } from './useTrails';

export interface TrailGeometryFeature {
    slug: string;
    activityType: string;
    coordinates: [number, number][]; // [lat, lng]
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
