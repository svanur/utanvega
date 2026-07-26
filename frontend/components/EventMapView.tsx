import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Box, Typography, Chip, Button, Paper, IconButton } from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import type { EventSummary } from '../hooks/useEvents';
import { useLocations } from '../hooks/useLocations';
import { getCountdownColor } from '../utils/eventUtils';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons
// @ts-expect-error - Leaflet internal _getIconUrl not in type definitions
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIconRetina,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const userLocationIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

interface EventMapViewProps {
    events: EventSummary[];
}

const ICELAND_CENTER: [number, number] = [64.96, -18.5];
const ICELAND_ZOOM = 6;

function FollowController({
    followMe,
    userLocation,
    onDrag,
}: {
    followMe: boolean;
    userLocation: { lat: number; lng: number } | null;
    onDrag: () => void;
}) {
    const map = useMap();
    const wasFollowing = useRef(false);
    useMapEvents({ dragstart: onDrag });
    useEffect(() => {
        if (followMe && userLocation) {
            wasFollowing.current = true;
            map.setView([userLocation.lat, userLocation.lng], map.getZoom());
        } else if (!followMe && wasFollowing.current) {
            wasFollowing.current = false;
            map.setView(ICELAND_CENTER, ICELAND_ZOOM);
        }
    }, [followMe, userLocation, map]);
    return null;
}

const EventMapView: React.FC<EventMapViewProps> = ({ events }) => {
    const { t } = useTranslation();
    const { locations } = useLocations();
    const [followMe, setFollowMe] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.warn('Geolocation error:', err),
            { enableHighAccuracy: true },
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const eventsWithCoords = useMemo(() => {
        const locationMap = new Map(locations.map(l => [l.id, l]));
        return events
            .map(e => {
                if (e.gpxPointLat != null && e.gpxPointLng != null) {
                    return { ...e, lat: e.gpxPointLat, lng: e.gpxPointLng };
                }
                if (e.locationId) {
                    const loc = locationMap.get(e.locationId);
                    if (loc?.latitude != null && loc?.longitude != null) {
                        return { ...e, lat: loc.latitude, lng: loc.longitude };
                    }
                }
                return null;
            })
            .filter((e): e is NonNullable<typeof e> => e !== null);
    }, [events, locations]);

    return (
        <Box sx={{ height: 500, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
            <Paper
                elevation={3}
                sx={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    zIndex: 1100,
                    borderRadius: '50%',
                    overflow: 'hidden',
                }}
            >
                <IconButton
                    size="small"
                    onClick={() => setFollowMe(f => !f)}
                    color={followMe ? 'primary' : 'default'}
                    title={followMe ? t('map.stopFollowing') : t('map.followLocation')}
                    aria-label="follow my location"
                    sx={{
                        backgroundColor: followMe ? 'rgba(25,118,210,0.1)' : 'white',
                        '&:hover': { backgroundColor: followMe ? 'rgba(25,118,210,0.2)' : '#f5f5f5' },
                    }}
                >
                    <MyLocationIcon fontSize="small" />
                </IconButton>
            </Paper>
            <MapContainer
                center={ICELAND_CENTER}
                zoom={ICELAND_ZOOM}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FollowController
                    followMe={followMe}
                    userLocation={userLocation}
                    onDrag={() => setFollowMe(false)}
                />
                {eventsWithCoords.map(event => (
                    <Marker key={event.id} position={[event.lat, event.lng]}>
                        <Popup>
                            <Box sx={{ minWidth: 180 }}>
                                <Typography variant="subtitle2" fontWeight={700}>
                                    {event.name}
                                </Typography>
                                {event.locationName && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        📍 {event.locationName}
                                    </Typography>
                                )}
                                {event.daysUntil !== null && event.status !== 'Cancelled' && (
                                    <Chip
                                        icon={<CalendarTodayIcon sx={{ fontSize: 12 }} />}
                                        label={
                                            event.daysUntil === 0 ? t('races.today')
                                            : event.daysUntil === 1 ? t('races.tomorrow')
                                            : event.daysUntil === -1 ? t('races.yesterday')
                                            : event.daysUntil < -1 ? t('races.daysAgo', { count: Math.abs(event.daysUntil) })
                                            : t('races.daysUntil', { count: event.daysUntil })
                                        }
                                        size="small"
                                        color={getCountdownColor(event.daysUntil)}
                                        variant="outlined"
                                        sx={{ mt: 0.5 }}
                                    />
                                )}
                                <Button
                                    component={RouterLink}
                                    to={`/events/${event.slug}`}
                                    size="small"
                                    sx={{ mt: 1, display: 'block' }}
                                >
                                    {t('common.viewDetails', 'View Details')}
                                </Button>
                            </Box>
                        </Popup>
                    </Marker>
                ))}
                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon} />
                )}
            </MapContainer>
        </Box>
    );
};

export default EventMapView;
