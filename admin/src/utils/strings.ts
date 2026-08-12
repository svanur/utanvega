export function trimToUndefined(v: string): string | undefined {
    return v.trim() || undefined;
}

export function parseCoordPaste(text: string): { lat: number; lng: number } | null {
    // Google Maps URL: @64.1355,-21.8954,
    const mapsMatch = text.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (mapsMatch) return { lat: parseFloat(mapsMatch[1]), lng: parseFloat(mapsMatch[2]) };
    // Plain "lat, lng" or "lat lng"
    const plainMatch = text.trim().match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (plainMatch) return { lat: parseFloat(plainMatch[1]), lng: parseFloat(plainMatch[2]) };
    return null;
}
