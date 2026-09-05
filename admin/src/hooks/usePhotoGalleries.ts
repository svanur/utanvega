import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export interface PhotoGalleryDto {
    id: string;
    eventEditionId: string;
    url: string;
    photographerId: string | null;
    photographerName: string | null;
    title: string | null;
    titleEn: string | null;
    sortOrder: number;
    createdAt: string;
    createdBy: string | null;
}

export interface CreatePhotoGalleryInput {
    eventEditionId: string;
    url: string;
    photographerId?: string | null;
    title?: string | null;
    titleEn?: string | null;
    sortOrder?: number;
}

export interface UpdatePhotoGalleryInput {
    id: string;
    url: string;
    photographerId?: string | null;
    title?: string | null;
    titleEn?: string | null;
    sortOrder?: number;
}

// Per-row outcome of updatePhotoGalleriesBatch — lets a caller reconcile its own optimistic
// state precisely on partial failure, rather than treating the whole batch as one unit (#608).
export interface BatchUpdateResult {
    id: string;
    success: boolean;
    error?: string;
}

export interface PhotoGalleryByPhotographerDto {
    id: string;
    eventEditionId: string;
    url: string;
    title: string | null;
    titleEn: string | null;
    sortOrder: number;
    eventId: string;
    eventName: string;
    eventNameEn: string | null;
    eventSlug: string;
    editionYear: number | null;
    editionDate: string | null;
}

const photoGalleriesQueryKey = (editionId: string) => ['admin', 'photo-galleries', editionId] as const;
export const photoGalleriesByPhotographerQueryKey = (photographerId: string) => ['admin', 'photo-galleries', 'by-photographer', photographerId] as const;

// Galleries aren't nested on PhotographerDto either — fetched separately, once, when the
// photographer detail page is open, rather than per-row in a list.
//
// onMutated mirrors usePhotoGalleries' escape hatch (see its own comment below), but since this
// hook's rows span multiple events, there's no single fixed slug to invalidate for the whole
// hook — it's invoked per-edit with the eventSlug of the specific row just saved, letting the
// caller invalidate that one event's ['admin','event', slug] entry (#642).
export function usePhotoGalleriesByPhotographer(photographerId: string | null, onMutated?: (eventSlug: string) => void) {
    const queryClient = useQueryClient();

    const { data: galleries = [], isLoading: loading, error: queryError } = useQuery({
        queryKey: photoGalleriesByPhotographerQueryKey(photographerId ?? ''),
        queryFn: () => apiFetch<PhotoGalleryByPhotographerDto[]>(`/api/v1/admin/photographers/${photographerId}/photo-galleries`),
        enabled: !!photographerId,
        staleTime: 30_000,
    });

    const error = queryError instanceof Error ? queryError.message : queryError ? 'Unknown error' : null;

    // Edition-agnostic counterpart to usePhotoGalleries' updatePhotoGallery: this page's rows
    // span multiple editions (one per event a photographer has shot), so there's no single
    // editionId to scope a query-invalidation to — it invalidates the by-photographer list
    // instead. photographerId and sortOrder are round-tripped unchanged from the already-loaded
    // row (UpdatePhotoGalleryCommand is a full overwrite — see the command's own comment), never
    // recomputed here.
    const updateGallery = async (input: UpdatePhotoGalleryInput, eventSlug: string): Promise<void> => {
        await apiFetch(`/api/v1/admin/photo-galleries/${input.id}`, {
            method: 'PUT',
            body: JSON.stringify(input),
        });
        if (photographerId) {
            await queryClient.invalidateQueries({ queryKey: photoGalleriesByPhotographerQueryKey(photographerId) });
        }
        onMutated?.(eventSlug);
    };

    return { galleries, loading, error, updateGallery };
}

// This hook's own PhotoGalleryDto (full CRUD shape, incl. photographerId, createdAt/By) isn't
// nested on EventEditionDto — it's fetched separately per edition here, only once we actually
// have an edition id (a not-yet-saved edition has nothing to fetch). EventEditionDto does carry
// a *narrower* `galleries` summary (mirroring the backend's PublicPhotoGalleryDto) for the
// read-only meta row in EventDetailPage, sourced from the admin event-detail query instead.
//
// onMutated is an escape hatch to keep that other, denormalized summary in sync: invalidating
// photoGalleriesQueryKey alone wouldn't refresh ['admin','event', slug], so callers thread a
// callback down (see PhotoGalleryManager's onGalleryMutated) rather than this hook needing to
// know about the event-detail cache.
export function usePhotoGalleries(editionId: string | null, onMutated?: () => void) {
    const queryClient = useQueryClient();

    const { data: galleries = [], isLoading: loading, error: queryError } = useQuery({
        queryKey: photoGalleriesQueryKey(editionId ?? ''),
        queryFn: () => apiFetch<PhotoGalleryDto[]>(`/api/v1/admin/editions/${editionId}/photo-galleries`),
        enabled: !!editionId,
        staleTime: 30_000,
    });

    const error = queryError instanceof Error ? queryError.message : queryError ? 'Unknown error' : null;

    const invalidate = () => editionId
        ? queryClient.invalidateQueries({ queryKey: photoGalleriesQueryKey(editionId) })
        : Promise.resolve();

    const createPhotoGallery = async (input: CreatePhotoGalleryInput): Promise<{ id: string }> => {
        const result = await apiFetch<{ id: string }>(`/api/v1/admin/editions/${input.eventEditionId}/photo-galleries`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
        await invalidate();
        onMutated?.();
        return result;
    };

    const updatePhotoGallery = async (input: UpdatePhotoGalleryInput): Promise<void> => {
        await apiFetch(`/api/v1/admin/photo-galleries/${input.id}`, {
            method: 'PUT',
            body: JSON.stringify(input),
        });
        await invalidate();
        onMutated?.();
    };

    // Drag-reorder touches every row between the drag source and target in one gesture, so it
    // fires this instead of updatePhotoGallery in a loop — one invalidate/onMutated for the whole
    // batch rather than one per row (see #596). PUTs still run in parallel via Promise.allSettled
    // (not Promise.all) so that a single rejected PUT can't skip invalidation for the rows whose
    // PUT *did* land — invalidate/onMutated now always run once every request has settled,
    // regardless of outcome, so the cache never lags behind what's actually persisted (#608).
    // The caller gets a per-row result back (rather than a thrown error) so it can reconcile its
    // own optimistic local state precisely — reverting only the rows that failed, not the batch.
    const updatePhotoGalleriesBatch = async (inputs: UpdatePhotoGalleryInput[]): Promise<BatchUpdateResult[]> => {
        if (inputs.length === 0) return [];
        const settled = await Promise.allSettled(inputs.map(input => apiFetch(`/api/v1/admin/photo-galleries/${input.id}`, {
            method: 'PUT',
            body: JSON.stringify(input),
        })));
        await invalidate();
        onMutated?.();
        return settled.map((result, idx) => result.status === 'fulfilled'
            ? { id: inputs[idx].id, success: true }
            : { id: inputs[idx].id, success: false, error: result.reason instanceof Error ? result.reason.message : 'Failed to update gallery' });
    };

    const deletePhotoGallery = async (id: string): Promise<void> => {
        await apiFetch(`/api/v1/admin/photo-galleries/${id}`, { method: 'DELETE' });
        await invalidate();
        onMutated?.();
    };

    return { galleries, loading, error, refresh: invalidate, createPhotoGallery, updatePhotoGallery, updatePhotoGalleriesBatch, deletePhotoGallery };
}
