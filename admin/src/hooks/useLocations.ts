import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export type LocationType = 'Country' | 'Area' | 'Region' | 'Municipality' | 'Place' | 'Other';

export interface LocationDto {
    id: string;
    name: string;
    nameEn: string | null;
    slug: string;
    description: string | null;
    descriptionEn: string | null;
    type: LocationType;
    parentId: string | null;
    parentName: string | null;
    parentNameEn?: string | null;
    latitude: number | null;
    longitude: number | null;
    radius: number | null;
    childrenCount: number;
    translationHashes?: Record<string, string>;
}

export function locationsQueryKey(parentId: string | null, search: string | null) {
    return ['admin', 'locations', { parentId, search }] as const;
}

export function useLocations(parentId: string | null = null, search: string | null = null) {
    const queryClient = useQueryClient();
    const queryKey = locationsQueryKey(parentId, search);

    const { data: locations = [], isLoading: loading, error: queryError } = useQuery({
        queryKey,
        queryFn: () => {
            let url = `/api/v1/admin/locations`;
            const params = new URLSearchParams();
            if (parentId) params.append('parentId', parentId);
            if (search) params.append('search', search);
            const queryString = params.toString();
            if (queryString) url += `?${queryString}`;
            return apiFetch<LocationDto[]>(url);
        },
        staleTime: 60_000,
    });

    const error = queryError instanceof Error ? queryError.message : queryError ? 'Unknown error' : null;
    const refresh = () => queryClient.invalidateQueries({ queryKey });

    return { locations, loading, error, refresh };
}
