import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface OrganizerDto {
    id: string;
    name: string;
    kennitala: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    description: string | null;
    descriptionEn: string | null;
    contactName: string | null;
    createdAt: string;
    updatedAt: string | null;
}

export interface CreateOrganizerInput {
    name: string;
    kennitala?: string;
    phone?: string;
    email?: string;
    website?: string;
    description?: string;
    contactName?: string;
}

export interface UpdateOrganizerInput extends CreateOrganizerInput {
    id: string;
}

export function useOrganizers() {
    const [organizers, setOrganizers] = useState<OrganizerDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrganizers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiFetch<OrganizerDto[]>('/api/v1/admin/organizers');
            setOrganizers(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrganizers();
    }, [fetchOrganizers]);

    const createOrganizer = async (input: CreateOrganizerInput): Promise<string> => {
        const result = await apiFetch<{ id: string }>('/api/v1/admin/organizers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        await fetchOrganizers();
        return result.id;
    };

    const updateOrganizer = async (input: UpdateOrganizerInput): Promise<void> => {
        await apiFetch(`/api/v1/admin/organizers/${input.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        await fetchOrganizers();
    };

    const deleteOrganizer = async (id: string): Promise<void> => {
        await apiFetch(`/api/v1/admin/organizers/${id}`, { method: 'DELETE' });
        await fetchOrganizers();
    };

    return { organizers, loading, error, refresh: fetchOrganizers, createOrganizer, updateOrganizer, deleteOrganizer };
}
