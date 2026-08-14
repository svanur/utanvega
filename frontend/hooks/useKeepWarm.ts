import { useEffect } from 'react';
import { API_URL } from './useTrails';

const PING_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes — Fly.io sleeps after 5 min of inactivity

export function useKeepWarm() {
    useEffect(() => {
        const ping = () => fetch(`${API_URL}/api/v1/health`, { method: 'GET' }).catch(() => {});
        const id = setInterval(ping, PING_INTERVAL_MS);
        return () => clearInterval(id);
    }, []);
}
