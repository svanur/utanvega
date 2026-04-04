import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { Box, Typography } from '@mui/material';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { apiFetch } from '../hooks/api';

type GeoJsonGeometry = {
    type: string;
    coordinates: [number, number][];
};

function ChangeView({ bounds }: { bounds: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
        if (bounds.length > 0) {
            map.fitBounds(bounds as L.LatLngBoundsExpression);
        }
    }, [bounds, map]);
    return null;
}

export default function TrailMap({ trailId, trailName: _trailName }: { trailId: string, trailName: string }) {
    const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGeometry = async () => {
            try {
                setLoading(true);
                const data = await apiFetch<GeoJsonGeometry>(`/api/v1/admin/trails/${trailId}/geometry`);
                setGeometry(data);
            } catch (err) {
                console.error('Failed to fetch geometry:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchGeometry();
    }, [trailId]);

    if (loading) return <Typography>Loading Map...</Typography>;
    if (!geometry) return <Typography>No GPS data available for this trail.</Typography>;

    // Convert GeoJSON [lon, lat] to Leaflet [lat, lon]
    const positions = geometry.coordinates.map(coord => [coord[1], coord[0]] as [number, number]);

    return (
        <Box sx={{ height: 400, width: '100%', mt: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid #ccc' }}>
            <MapContainer 
                center={[64.1265, -21.8174]} 
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Polyline positions={positions} color="red" />
                <ChangeView bounds={positions} />
            </MapContainer>
        </Box>
    );
}
