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

export interface PhotoGalleryByPhotographerDto {
    id: string;
    eventEditionId: string;
    url: string;
    title: string | null;
    titleEn: string | null;
    eventId: string;
    eventName: string;
    eventNameEn: string | null;
    eventSlug: string;
    editionYear: number | null;
    editionDate: string | null;
}

const photoGalleriesQueryKey = (editionId: string) => ['admin', 'photo-galleries', editionId] as const;
const photoGalleriesByPhotographerQueryKey = (photographerId: string) => ['admin', 'photo-galleries', 'by-photographer', photographerId] as const;

// Galleries aren't nested on PhotographerDto either — fetched separately, once, when the
// photographer detail page is open, rather than per-row in a list.
export function usePhotoGalleriesByPhotographer(photographerId: string | null) {
    const { data: galleries = [], isLoading: loading, error: queryError } = useQuery({
        queryKey: photoGalleriesByPhotographerQueryKey(photographerId ?? ''),
        queryFn: () => apiFetch<PhotoGalleryByPhotographerDto[]>(`/api/v1/admin/photographers/${photographerId}/photo-galleries`),
        enabled: !!photographerId,
        staleTime: 30_000,
    });

    const error = queryError instanceof Error ? queryError.message : queryError ? 'Unknown error' : null;

    return { galleries, loading, error };
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

    const deletePhotoGallery = async (id: string): Promise<void> => {
        await apiFetch(`/api/v1/admin/photo-galleries/${id}`, { method: 'DELETE' });
        await invalidate();
        onMutated?.();
    };

    return { galleries, loading, error, refresh: invalidate, createPhotoGallery, updatePhotoGallery, deletePhotoGallery };
}
