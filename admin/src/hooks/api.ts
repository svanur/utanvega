const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const DEV_TOKEN = 'dev-admin-token';

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    const headers = {
        'X-Dev-Token': DEV_TOKEN,
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
}
