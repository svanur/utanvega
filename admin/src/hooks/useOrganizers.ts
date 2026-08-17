import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export interface OrganizerDto {
    id: string;
    name: string;
    slug: string;
    kennitala: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    description: string | null;
    descriptionEn: string | null;
    contactName: string | null;
    eventCount: number;
    createdAt: string;
    updatedAt: string | null;
    translationHashes?: Record<string, string>;
}

export interface CreateOrganizerInput {
    name: string;
    kennitala?: string;
    phone?: string;
    email?: string;
    website?: string;
    description?: string;
    descriptionEn?: string;
    contactName?: string;
}

export interface UpdateOrganizerInput extends CreateOrganizerInput {
    id: string;
    slug?: string;
}

const ORGANIZERS_QUERY_KEY = ['admin', 'organizers'] as const;

export function useOrganizers() {
    const queryClient = useQueryClient();

    const { data: organizers = [], isLoading: loading, error: queryError } = useQuery({
        queryKey: ORGANIZERS_QUERY_KEY,
        queryFn: () => apiFetch<OrganizerDto[]>('/api/v1/admin/organizers'),
        staleTime: 120_000,
    });

    const error = queryError instanceof Error ? queryError.message : queryError ? 'Unknown error' : null;

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ORGANIZERS_QUERY_KEY });

    const createOrganizer = async (input: CreateOrganizerInput): Promise<{ id: string; slug: string }> => {
        const result = await apiFetch<{ id: string; slug: string }>('/api/v1/admin/organizers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        await invalidate();
        return result;
    };

    const updateOrganizer = async (input: UpdateOrganizerInput): Promise<void> => {
        await apiFetch(`/api/v1/admin/organizers/${input.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        await invalidate();
        await queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    };

    const deleteOrganizer = async (id: string): Promise<void> => {
        await apiFetch(`/api/v1/admin/organizers/${id}`, { method: 'DELETE' });
        await invalidate();
        await queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    };

    return { organizers, loading, error, refresh: invalidate, createOrganizer, updateOrganizer, deleteOrganizer };
}
