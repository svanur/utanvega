import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface FeatureFlag {
    id: string;
    name: string;
    enabled: boolean;
    description: string | null;
    updatedAt: string;
}

export function useFeatureFlags() {
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFlags = async () => {
        try {
            setLoading(true);
            const data = await apiFetch<FeatureFlag[]>('/api/v1/admin/features');
            setFlags(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFlags();
    }, []);

    const toggleFlag = async (id: string, enabled: boolean) => {
        await apiFetch(`/api/v1/admin/features/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ enabled }),
        });
        setFlags(prev => prev.map(f => f.id === id ? { ...f, enabled, updatedAt: new Date().toISOString() } : f));
    };

    const createFlag = async (name: string, description?: string) => {
        const flag = await apiFetch<FeatureFlag>('/api/v1/admin/features', {
            method: 'POST',
            body: JSON.stringify({ name, description }),
        });
        setFlags(prev => [...prev, flag].sort((a, b) => a.name.localeCompare(b.name)));
        return flag;
    };

    const deleteFlag = async (id: string) => {
        await apiFetch(`/api/v1/admin/features/${id}`, { method: 'DELETE' });
        setFlags(prev => prev.filter(f => f.id !== id));
    };

    const updateDescription = async (id: string, description: string) => {
        await apiFetch(`/api/v1/admin/features/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ description }),
        });
        setFlags(prev => prev.map(f => f.id === id ? { ...f, description } : f));
    };

    return { flags, loading, error, refresh: fetchFlags, toggleFlag, createFlag, deleteFlag, updateDescription };
}
