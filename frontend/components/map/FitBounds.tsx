import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';

interface FitBoundsProps {
    positions: LatLngTuple[];
    invalidateSize?: boolean;
}

export default function FitBounds({ positions, invalidateSize = false }: FitBoundsProps) {
    const map = useMap();
    useEffect(() => {
        if (positions.length > 1) {
            if (invalidateSize) map.invalidateSize();
            const bounds = L.latLngBounds(positions);
            map.fitBounds(bounds, { padding: [30, 30], animate: false });
        }
    }, [map, positions, invalidateSize]);
    return null;
}
