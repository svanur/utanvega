import { MapContainer, TileLayer, Polyline, useMap, Marker, useMapEvents } from 'react-leaflet';
import { Box, Typography, Paper, IconButton } from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { useEffect, useState, useMemo } from 'react';
import L, { LatLngExpression } from 'leaflet';
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

// @ts-ignore
L.Marker.prototype.options.icon = DefaultIcon;

export type GeoJsonGeometry = {
    type: string;
    coordinates: number[][]; // [lon, lat, ele]
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function ChangeView({ bounds, followMe, userLocation }: { 
    bounds: [number, number][],
    followMe: boolean,
    userLocation: { lat: number; lng: number } | null
}) {
    const map = useMap();
    useEffect(() => {
        if (!followMe && bounds.length > 0) {
            map.fitBounds(bounds as any, { padding: [20, 20] });
        }
    }, [bounds, map, followMe]);

    useEffect(() => {
        if (followMe && userLocation) {
            map.setView([userLocation.lat, userLocation.lng], map.getZoom());
        }
    }, [followMe, userLocation, map]);

    return null;
}

interface TrailMapProps {
    slug: string;
    onDataLoaded?: (data: GeoJsonGeometry) => void;
    hoverPoint?: { lat: number; lng: number } | null;
}

function HoverMarker({ point }: { point: { lat: number; lng: number } | null | undefined }) {
    const map = useMap();
    
    useEffect(() => {
        if (point) {
            const latLng: LatLngExpression = [point.lat, point.lng];
            // Only pan if the point is not currently in the view, or just slightly pan to keep it centered if needed
            // For smoother experience, we might not want to pan at all unless it's outside
            if (!map.getBounds().contains(latLng)) {
                map.panTo(latLng);
            }
        }
    }, [point, map]);

    if (!point) return null;

    const hoverIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    return <Marker position={[point.lat, point.lng]} icon={hoverIcon} zIndexOffset={1000} />;
}

export default function TrailMap({ slug, onDataLoaded, hoverPoint }: TrailMapProps) {
    const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [followMe, setFollowMe] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    // Get user location for this component specifically
    useEffect(() => {
        if (navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (err) => console.warn('Geolocation failed in TrailMap:', err),
                { enableHighAccuracy: true }
            );
            return () => navigator.geolocation.clearWatch(watchId);
        }
    }, []);

    const handleFollowMeClick = () => {
        setFollowMe(prev => !prev);
    };

    const MapEvents = () => {
        useMapEvents({
            dragstart: () => {
                if (followMe) setFollowMe(false);
            },
        });
        return null;
    };

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
        <Box sx={{ height: 400, width: '100%', mt: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid #ccc', position: 'relative' }}>
            <Paper 
                elevation={3} 
                sx={{ 
                    position: 'absolute', 
                    top: 10, 
                    right: 10, 
                    zIndex: 1100,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: 'white'
                }}
            >
                <IconButton 
                    onClick={handleFollowMeClick}
                    color={followMe ? "primary" : "default"}
                    sx={{ 
                        backgroundColor: followMe ? 'rgba(25, 118, 210, 0.1)' : 'white',
                        '&:hover': {
                            backgroundColor: followMe ? 'rgba(25, 118, 210, 0.2)' : '#f5f5f5',
                        }
                    }}
                    title={followMe ? "Stop following my location" : "Follow my location"}
                    aria-label="follow my location"
                >
                    <MyLocationIcon />
                </IconButton>
            </Paper>

            <MapContainer 
                center={[64.1265, -21.8174]} 
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
            >
                <MapEvents />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Polyline positions={positions} color="#2196f3" weight={5} opacity={0.7} />
                
                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} 
                        icon={L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })} 
                    />
                )}

                <ChangeView bounds={positions} followMe={followMe} userLocation={userLocation} />
                <HoverMarker point={hoverPoint} />
            </MapContainer>
        </Box>
    );
}
