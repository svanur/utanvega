const CONNECTIVITY_ERROR_PATTERNS = [
    'failed to fetch',
    'networkerror',
    'load failed',
    'err_network',
    'failed to parse url',
    'typeerror: fetch',
];

function isConnectivityError(errorMessage: string): boolean {
    const normalized = errorMessage.toLowerCase();
    return CONNECTIVITY_ERROR_PATTERNS.some(pattern => normalized.includes(pattern));
}

export function toUserFriendlyFetchError(errorMessage: string, fallbackMessage: string): string {
    return isConnectivityError(errorMessage) ? fallbackMessage : errorMessage;
}
