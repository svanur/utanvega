import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type FeatureFlags = Record<string, boolean>;

export function useFeatureFlags() {
    const { data: flags = {}, status } = useQuery<FeatureFlags>({
        queryKey: ['feature-flags'],
        queryFn: () => fetch(`${API_URL}/api/v1/features`)
            .then(res => res.ok ? res.json() as Promise<FeatureFlags> : {}),
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
    const loaded = status !== 'pending';
    const isEnabled = useMemo(() => {
        return (name: string, defaultValue = true) => {
            if (!loaded) return defaultValue;
            return flags[name] ?? defaultValue;
        };
    }, [flags, loaded]);
    return { flags, loaded, isEnabled };
}
