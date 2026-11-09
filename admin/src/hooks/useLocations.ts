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

export function locationByIdQueryKey(idOrSlug: string) {
    return ['admin', 'locations', idOrSlug] as const;
}

// #1729: single-record fetch for LocationDetailPage, instead of pulling the entire unfiltered
// admin locations list (useLocations() with no args) just to find one row by id. Named
// useLocationById rather than useLocation to avoid colliding in intent (not scope — this is a
// different module) with react-router-dom's own useLocation hook.
// #1746: also accepts a slug, mirroring GetAdminTrail's idOrSlug route — the backend endpoint
// resolves either shape to the same LocationDto.
export function useLocationById(idOrSlug: string | undefined) {
    const queryClient = useQueryClient();
    const queryKey = locationByIdQueryKey(idOrSlug ?? '');

    const { data: location, isLoading: loading, error: queryError } = useQuery({
        queryKey,
        queryFn: () => apiFetch<LocationDto>(`/api/v1/admin/locations/${idOrSlug}`),
        enabled: !!idOrSlug,
        staleTime: 60_000,
    });

    const error = queryError instanceof Error ? queryError.message : queryError ? 'Unknown error' : null;
    const refresh = () => queryClient.invalidateQueries({ queryKey });

    return { location, loading, error, refresh };
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
