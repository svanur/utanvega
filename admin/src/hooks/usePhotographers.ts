import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { SocialLink } from './useEvents';

export interface PhotographerDto {
    id: string;
    name: string;
    slug: string;
    website: string | null;
    email: string | null;
    description: string | null;
    descriptionEn: string | null;
    galleryCount: number;
    createdAt: string;
    updatedAt: string | null;
    translationHashes?: Record<string, string>;
    socialLinks?: SocialLink[] | null;
}

export interface CreatePhotographerInput {
    name: string;
    website?: string;
    email?: string;
    description?: string;
    descriptionEn?: string;
}

export interface UpdatePhotographerInput extends CreatePhotographerInput {
    id: string;
    slug?: string;
    socialLinks?: SocialLink[] | null;
}

const PHOTOGRAPHERS_QUERY_KEY = ['admin', 'photographers'] as const;

export function usePhotographers() {
    const queryClient = useQueryClient();

    const { data: photographers = [], isLoading: loading, error: queryError } = useQuery({
        queryKey: PHOTOGRAPHERS_QUERY_KEY,
        queryFn: () => apiFetch<PhotographerDto[]>('/api/v1/admin/photographers'),
        staleTime: 120_000,
    });

    const error = queryError instanceof Error ? queryError.message : queryError ? 'Unknown error' : null;

    const invalidate = () => queryClient.invalidateQueries({ queryKey: PHOTOGRAPHERS_QUERY_KEY });

    const createPhotographer = async (input: CreatePhotographerInput): Promise<{ id: string; slug: string }> => {
        const result = await apiFetch<{ id: string; slug: string }>('/api/v1/admin/photographers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        await invalidate();
        return result;
    };

    const updatePhotographer = async (input: UpdatePhotographerInput): Promise<void> => {
        await apiFetch(`/api/v1/admin/photographers/${input.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        await invalidate();
    };

    const deletePhotographer = async (id: string, reassignToId?: string): Promise<void> => {
        const query = reassignToId ? `?reassignToId=${reassignToId}` : '';
        await apiFetch(`/api/v1/admin/photographers/${id}${query}`, { method: 'DELETE' });
        await invalidate();
    };

    return { photographers, loading, error, refresh: invalidate, createPhotographer, updatePhotographer, deletePhotographer };
}
