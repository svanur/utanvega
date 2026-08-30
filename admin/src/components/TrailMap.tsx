import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import { Box, Typography } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { apiFetch } from '../hooks/api';

export type GeoJsonGeometry = {
    type: string;
    coordinates: number[][]; // [lon, lat, ele]
};

function ChangeView({ bounds, padded }: { bounds: [number, number][]; padded: boolean }) {
    const map = useMap();
    useEffect(() => {
        // The container's real size isn't known until the surrounding flex/grid layout
        // settles, which can happen after Leaflet's own initial size measurement — without
        // this the tile grid gets computed against a stale size (partial tiles, wrong bounds).
        map.invalidateSize();
        if (bounds.length > 0) {
            map.fitBounds(bounds as L.LatLngBoundsExpression, padded ? { padding: [30, 30] } : undefined);
        }
    }, [bounds, padded, map]);
    return null;
}

export default function TrailMap({ trailId, trailName: _trailName, showMarkers = true, height = 400, onDataLoaded }: { trailId: string, trailName: string, showMarkers?: boolean, height?: number, onDataLoaded?: (data: GeoJsonGeometry) => void }) {
    const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGeometry = async () => {
            try {
                setLoading(true);
                const data = await apiFetch<GeoJsonGeometry>(`/api/v1/admin/trails/${trailId}/geometry`);
                setGeometry(data);
                if (onDataLoaded) onDataLoaded(data);
            } catch (err) {
                console.error('Failed to fetch geometry:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchGeometry();
    // onDataLoaded is a callback that may change on every render; only re-fetch when trailId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trailId]);

    if (loading) return <Typography>Loading Map...</Typography>;
    if (!geometry) return <Typography>No GPS data available for this trail.</Typography>;

    // Convert GeoJSON [lon, lat] to Leaflet [lat, lon]
    const positions = geometry.coordinates.map(coord => [coord[1], coord[0]] as [number, number]);
    const start = showMarkers && positions.length > 0 ? positions[0] : null;
    const end = showMarkers && positions.length > 0 ? positions[positions.length - 1] : null;

    return (
        <Box sx={{ height, width: '100%', mt: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid #ccc' }}>
            <MapContainer
                center={[64.1265, -21.8174]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Polyline positions={positions} color={showMarkers ? '#1976d2' : 'red'} weight={showMarkers ? 4 : 3} />
                {start && <CircleMarker center={start} radius={8} pathOptions={{ color: '#2e7d32', fillColor: '#4caf50', fillOpacity: 1 }} />}
                {end && <CircleMarker center={end} radius={8} pathOptions={{ color: '#c62828', fillColor: '#ef5350', fillOpacity: 1 }} />}
                <ChangeView bounds={positions} padded={showMarkers} />
            </MapContainer>
        </Box>
    );
}
