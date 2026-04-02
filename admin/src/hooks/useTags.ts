import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface TagDto {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    trailCount: number;
}

export function useTags() {
    const [tags, setTags] = useState<TagDto[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTags = async () => {
        try {
            setLoading(true);
            const data = await apiFetch<TagDto[]>('/api/v1/admin/tags');
            setTags(data);
        } catch (err) {
            console.error('Failed to load tags', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTags(); }, []);

    return { tags, loading, refresh: fetchTags };
}
