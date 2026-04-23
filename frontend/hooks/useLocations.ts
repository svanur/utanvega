import { useQuery } from '@tanstack/react-query';
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

export interface LocationTreeNode {
    id: string;
    name: string;
    slug: string;
    type: string;
    trailsCount: number;
    totalTrailsCount: number;
    children: LocationTreeNode[];
}

export interface LocationWithTrails {
    location: Location;
    childLocations: Location[];
    trails: Trail[];
}

export function useLocations() {
    const { data: locations = [], isPending, error: queryError } = useQuery<Location[]>({
        queryKey: ['locations'],
        queryFn: () => fetch(`${API_URL}/api/v1/locations`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch locations');
                return res.json() as Promise<Location[]>;
            }),
        staleTime: 10 * 60 * 1000,
    });
    return {
        locations,
        loading: isPending,
        error: queryError instanceof Error ? queryError.message : null,
    };
}

export function useLocationTree() {
    const { data: tree = [], isPending, error: queryError } = useQuery<LocationTreeNode[]>({
        queryKey: ['location-tree'],
        queryFn: () => fetch(`${API_URL}/api/v1/locations/tree`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch location tree');
                return res.json() as Promise<LocationTreeNode[]>;
            }),
        staleTime: 10 * 60 * 1000,
    });
    return {
        tree,
        loading: isPending,
        error: queryError instanceof Error ? queryError.message : null,
    };
}

export function useLocationBySlug(slug: string | undefined) {
    const { data: locationWithTrails = null, isPending, error: queryError } = useQuery<LocationWithTrails | null>({
        queryKey: ['location', slug],
        queryFn: () => fetch(`${API_URL}/api/v1/locations/${slug}`)
            .then(res => {
                if (!res.ok) {
                    if (res.status === 404) throw new Error('Location not found');
                    throw new Error('Failed to fetch location');
                }
                return res.json() as Promise<LocationWithTrails>;
            }),
        enabled: !!slug,
        staleTime: 5 * 60 * 1000,
    });
    return {
        ...locationWithTrails,
        loading: isPending && !!slug,
        error: queryError instanceof Error ? queryError.message : null,
    };
}
