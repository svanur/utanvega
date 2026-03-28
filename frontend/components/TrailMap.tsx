import { MapContainer, TileLayer, Polyline, useMap, Marker } from 'react-leaflet';
import { Box, Typography } from '@mui/material';
import { useEffect, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIconRetina,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

export type GeoJsonGeometry = {
    type: string;
    coordinates: number[][]; // [lon, lat, ele]
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

interface TrailMapProps {
    slug: string;
    onDataLoaded?: (data: GeoJsonGeometry) => void;
    hoverPoint?: { lat: number; lng: number } | null;
}

export default function TrailMap({ slug, onDataLoaded, hoverPoint }: TrailMapProps) {
    const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Convert GeoJSON [lon, lat] to Leaflet [lat, lon]
    const positions = useMemo(() => 
        geometry?.coordinates.map(coord => [coord[1], coord[0]] as [number, number]) || [], 
        [geometry]
    );

    useEffect(() => {
        const fetchGeometry = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${API_URL}/api/v1/trails/${slug}/geometry`);
                if (!res.ok) throw new Error('Failed to fetch geometry');
                const data = await res.json();
                setGeometry(data);
                if (onDataLoaded) onDataLoaded(data);
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
                {hoverPoint && <Marker position={[hoverPoint.lat, hoverPoint.lng]} />}
            </MapContainer>
        </Box>
    );
}
