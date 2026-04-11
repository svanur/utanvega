import { MapContainer, TileLayer, Polyline, useMap, Marker, useMapEvents } from 'react-leaflet';
import { Box, Typography, Paper, IconButton, useTheme } from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

// Start marker: green circle
const StartIcon = L.divIcon({
    html: '<div style="width:14px;height:14px;background:#4caf50;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: '',
});

// End marker: red flag-style
const EndIcon = L.divIcon({
    html: '<div style="width:14px;height:14px;background:#f44336;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: '',
});

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
            map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [20, 20] });
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
    activityType?: string;
}

const activityEmoji: Record<string, string> = {
    trailrunning: '🏃‍♀️',
    running: '🏃‍♂️',
    hiking: '🥾',
    cycling: '🚴',
};

function HoverMarker({ point, activityType }: { point: { lat: number; lng: number } | null | undefined; activityType?: string }) {
    if (!point) return null;

    const emoji = activityEmoji[(activityType || '').toLowerCase()] || '📍';
    const icon = L.divIcon({
        html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">${emoji}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        className: '',
    });

    return <Marker position={[point.lat, point.lng]} icon={icon} zIndexOffset={1000} />;
}

export default function TrailMap({ slug, onDataLoaded, hoverPoint, activityType }: TrailMapProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
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
            } catch (err: unknown) {
                // Offline fallback: try IndexedDB
                try {
                    const db = await new Promise<IDBDatabase>((resolve, reject) => {
                        const req = indexedDB.open('utanvega-offline', 1);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });
                    const tx = db.transaction('trails', 'readonly');
                    const item = await new Promise<{ geometry: GeoJsonGeometry } | undefined>((resolve, reject) => {
                        const req = tx.objectStore('trails').get(slug);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });
                    if (item?.geometry) {
                        setGeometry(item.geometry);
                        if (onDataLoaded) onDataLoaded(item.geometry);
                        return;
                    }
                } catch {
                    // IndexedDB not available
                }
                console.error('Failed to fetch geometry:', err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setLoading(false);
            }
        };
        fetchGeometry();
    // onDataLoaded is a callback that may change on every render; only re-fetch when slug changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    if (loading) return <Typography>{t('trail.loadingMap')}</Typography>;
    if (error || !geometry) return <Typography color="error">{t('trail.noGpsData')}</Typography>;

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
                    title={followMe ? t('map.stopFollowing') : t('map.followLocation')}
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
                    key={isDark ? 'dark' : 'light'}
                    attribution={isDark
                        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
                        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
                    url={isDark
                        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
                />
                <Polyline positions={positions} color="#2196f3" weight={5} opacity={0.7} />
                
                {positions.length > 0 && (
                    <>
                        <Marker position={positions[0]} icon={StartIcon} />
                        <Marker position={positions[positions.length - 1]} icon={EndIcon} />
                    </>
                )}
                
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
                <HoverMarker point={hoverPoint} activityType={activityType} />
            </MapContainer>
        </Box>
    );
}
