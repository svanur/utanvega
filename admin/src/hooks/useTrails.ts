import { useCallback, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

export type TrailLocationInfo = {
    locationId: string;
    role: 'Start' | 'End' | 'BelongsTo' | 'PassingThrough';
    order: number;
};

export type TrailTagInfo = {
    tagId: string;
    name: string;
    slug: string;
    color: string | null;
};

export type TrailDetail = {
    id: string;
    name: string;
    nameEn: string | null;
    slug: string;
    description: string;
    descriptionEn: string | null;
    activityType: string;
    status: string;
    type: string;
    difficulty: string;
    visibility: string;
    length: number;
    elevationGain: number;
    elevationLoss: number;
    youtubeUrl?: string | null;
    terrainType?: string | null;
    maxAltitude?: number | null;
    translationHashes?: Record<string, string> | null;
    needsReview: boolean;
    locations: TrailLocationInfo[];
    tags: TrailTagInfo[];
};

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
    needsReview?: boolean;
    updatedAt?: string | null;
    createdAt: string;
};

/**
 * Display labels for TrailStatus. The stored values are unchanged — 'Draft' is shown as
 * "Hidden" and 'EventOnly' as "Event Only" so trail statuses read the same way as the
 * Event/Edition/Race ones do.
 */
export const TRAIL_STATUS_LABELS: Record<string, string> = {
    Draft: 'Hidden',
    Published: 'Published',
    EventOnly: 'Event Only',
    Flagged: 'Flagged',
    Archived: 'Archived',
};

export const trailStatusLabel = (status: string) => TRAIL_STATUS_LABELS[status] ?? status;

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

export function useTrailDetail(idOrSlug: string | undefined) {
    const queryKey = useMemo(() => ['admin', 'trail', idOrSlug] as const, [idOrSlug]);

    const { data: detail = null, isLoading: loading, error: queryError, refetch } = useQuery({
        queryKey,
        queryFn: () => apiFetch<TrailDetail>(`/api/v1/admin/trails/${idOrSlug}`),
        enabled: !!idOrSlug,
        staleTime: 30_000,
    });

    const queryClient = useQueryClient();

    const error = queryError instanceof Error ? queryError.message : queryError ? 'Failed to load trail' : null;

    const setDetail = useCallback((updater: TrailDetail | null | ((prev: TrailDetail | null) => TrailDetail | null)) => {
        queryClient.setQueryData<TrailDetail | null>(queryKey, prev => {
            if (typeof updater === 'function') return updater(prev ?? null);
            return updater;
        });
    }, [queryClient, queryKey]);

    const refresh = useCallback(() => { void refetch(); }, [refetch]);

    return { detail, loading, error, refresh, setDetail };
}

export type TrailLinkedRace = {
    id: string;
    raceName: string;
    eventName: string;
    eventSlug: string;
    editionId: string;
    editionDate: string | null;
    editionYear: number | null;
    editionTitle: string | null;
};

export function useTrailRaces(idOrSlug: string | undefined) {
    const { data: races = [], isLoading: loading } = useQuery({
        queryKey: ['admin', 'trail-races', idOrSlug] as const,
        queryFn: () => apiFetch<TrailLinkedRace[]>(`/api/v1/admin/trails/${idOrSlug}/races`),
        enabled: !!idOrSlug,
        staleTime: 60_000,
    });

    return { races, loading };
}

/**
 * Invalidates cached trail data after a mutation so views showing it re-fetch.
 * Race links are keyed by whichever of id/slug the page was opened with, so they are
 * invalidated by key prefix rather than by an exact key the caller may not know.
 */
export function useInvalidateTrailData() {
    const queryClient = useQueryClient();

    const invalidateRaces = useCallback(
        () => queryClient.invalidateQueries({ queryKey: ['admin', 'trail-races'] }),
        [queryClient]
    );

    const invalidateLists = useCallback(
        () => queryClient.invalidateQueries({ queryKey: ['admin', 'trails'] }),
        [queryClient]
    );

    return { invalidateRaces, invalidateLists };
}
