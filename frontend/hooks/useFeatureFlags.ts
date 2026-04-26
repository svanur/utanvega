import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const CACHE_KEY = 'utanvega-feature-flags';

type FeatureFlags = Record<string, boolean>;

function readFlagsFromCache(): FeatureFlags | undefined {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? (JSON.parse(raw) as FeatureFlags) : undefined;
    } catch {
        return undefined;
    }
}

export function useFeatureFlags() {
    const { data: flags = {}, status } = useQuery<FeatureFlags>({
        queryKey: ['feature-flags'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/v1/features`);
            const result: FeatureFlags = res.ok ? await (res.json() as Promise<FeatureFlags>) : {};
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch { /* ignore */ }
            return result;
        },
        initialData: readFlagsFromCache,
        initialDataUpdatedAt: 0,
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
