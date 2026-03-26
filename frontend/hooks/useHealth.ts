import { useEffect, useState } from 'react';

export type HealthStatus = {
    status: string;
    service: string;
    version: string;
    timestampUtc: string;
};

type HealthState = {
    data: HealthStatus | null;
    loading: boolean;
    error: string | null;
};

export function useHealth() {
    const [state, setState] = useState<HealthState>({
        data: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
        const controller = new AbortController();

        async function loadHealth() {
            try {
                const response = await fetch(`${baseUrl}/api/v1/health`, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Health check failed with status ${response.status}`);
                }

                const data = (await response.json()) as HealthStatus;

                setState({
                    data,
                    loading: false,
                    error: null,
                });
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    return;
                }

                setState({
                    data: null,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        loadHealth();

        return () => controller.abort();
    }, []);

    return state;
}
