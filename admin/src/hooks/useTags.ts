import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export interface TagDto {
    id: string;
    name: string;
    nameEn: string | null;
    slug: string;
    color: string | null;
    trailCount: number;
    translationHashes?: Record<string, string>;
}

const TAGS_QUERY_KEY = ['admin', 'tags'] as const;

export function useTags() {
    const queryClient = useQueryClient();

    const { data: tags = [], isLoading: loading } = useQuery({
        queryKey: TAGS_QUERY_KEY,
        queryFn: () => apiFetch<TagDto[]>('/api/v1/admin/tags'),
        staleTime: 120_000,
    });

    const refresh = () => queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY });

    return { tags, loading, refresh };
}
