import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

export type Trail = {
    id: string;
    name: string;
    nameEn?: string | null;
    description?: string;
    descriptionEn?: string | null;
    slug: string;
    translationHashes?: Record<string, string>;
    length: number;
    elevationGain: number;
    elevationLoss: number;
    status: 'Draft' | 'Published' | 'Flagged' | 'Archived' | 'EventOnly';
    activityType: 'TrailRunning' | 'Running' | 'Cycling' | 'Hiking';
    trailType: 'OutAndBack' | 'Loop' | 'PointToPoint';
    difficulty?: string;
    startLatitude?: number | null;
    startLongitude?: number | null;
    locations: { id: string, name: string, slug: string, role: string }[];
    tags?: { name: string, slug: string, color: string | null }[];
    youtubeUrl?: string | null;
    terrainType?: string | null;
    updatedAt?: string | null;
};

export function trailsQueryKey(includeArchived: boolean) {
    return ['admin', 'trails', { includeArchived }] as const;
}

export function useTrails(includeArchived: boolean = false) {
    const queryClient = useQueryClient();
    const queryKey = trailsQueryKey(includeArchived);

    const { data: trails = [], isLoading: loading, error: queryError } = useQuery({
        queryKey,
        queryFn: () => apiFetch<Trail[]>(`/api/v1/admin/trails?includeArchived=${includeArchived}`),
        staleTime: 60_000,
    });

    const error = queryError instanceof Error ? queryError.message : queryError ? 'Unknown error' : null;

    const setTrails = (updater: Trail[] | ((prev: Trail[]) => Trail[])) => {
        queryClient.setQueryData<Trail[]>(queryKey, prev => {
            const current = prev ?? [];
            return typeof updater === 'function' ? updater(current) : updater;
        });
    };

    const refresh = () => queryClient.invalidateQueries({ queryKey });

    return { trails, setTrails, loading, error, refresh };
}
