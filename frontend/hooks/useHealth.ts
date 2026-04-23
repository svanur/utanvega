import { useQuery } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export type HealthStatus = {
    status: string;
    service: string;
    version: string;
    timestampUtc: string;
};

export function useHealth() {
    const { data = null, isPending, error: queryError } = useQuery<HealthStatus | null>({
        queryKey: ['health'],
        queryFn: ({ signal }) => fetch(`${API_URL}/api/v1/health`, { signal })
            .then(res => {
                if (!res.ok) throw new Error(`Health check failed with status ${res.status}`);
                return res.json() as Promise<HealthStatus>;
            }),
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 60_000,
    });
    return {
        data,
        loading: isPending,
        error: queryError instanceof Error ? queryError.message : queryError ? 'Unknown error' : null,
    };
}
