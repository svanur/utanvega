import { useState, useEffect, useMemo } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type FeatureFlags = Record<string, boolean>;

export function useFeatureFlags() {
    const [flags, setFlags] = useState<FeatureFlags>({});
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/api/v1/features`)
            .then(res => res.ok ? res.json() : {})
            .then(data => { setFlags(data); setLoaded(true); })
            .catch(() => setLoaded(true));
    }, []);

    const isEnabled = useMemo(() => {
        return (name: string, defaultValue = true) => {
            if (!loaded) return defaultValue;
            return flags[name] ?? defaultValue;
        };
    }, [flags, loaded]);

    return { flags, loaded, isEnabled };
}
