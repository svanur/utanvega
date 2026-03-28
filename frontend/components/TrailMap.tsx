import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';

type GeoJsonGeometry = {
    type: string;
    coordinates: [number, number][];
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function ChangeView({ bounds }: { bounds: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
        if (bounds.length > 0) {
            map.fitBounds(bounds as any, { padding: [20, 20] });
        }
    }, [bounds, map]);
    return null;
}

export default function TrailMap({ slug }: { slug: string }) {
    const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchGeometry = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${API_URL}/api/v1/trails/${slug}/geometry`);
                if (!res.ok) throw new Error('Failed to fetch geometry');
                const data = await res.json();
                setGeometry(data);
            } catch (err: any) {
                console.error('Failed to fetch geometry:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchGeometry();
    }, [slug]);

    if (loading) return <Typography>Loading Map...</Typography>;
    if (error || !geometry) return <Typography color="error">No GPS data available for this trail.</Typography>;

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
                <Polyline positions={positions} color="#2196f3" weight={5} opacity={0.7} />
                <ChangeView bounds={positions} />
            </MapContainer>
        </Box>
    );
}
