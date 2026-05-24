import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Box, Typography, Chip, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import type { EventSummary } from '../hooks/useEvents';
import { useLocations } from '../hooks/useLocations';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons
// @ts-expect-error - Leaflet internal _getIconUrl not in type definitions
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface EventMapViewProps {
    events: EventSummary[];
}

function getCountdownColor(daysUntil: number | null): 'success' | 'warning' | 'error' | 'default' {
    if (daysUntil === null) return 'default';
    if (daysUntil < 0) return 'default';
    if (daysUntil <= 7) return 'error';
    if (daysUntil <= 30) return 'warning';
    return 'success';
}

const ICELAND_CENTER: [number, number] = [64.96, -18.5];
const ICELAND_ZOOM = 6;

const EventMapView: React.FC<EventMapViewProps> = ({ events }) => {
    const { t } = useTranslation();
    const { locations } = useLocations();

    const eventsWithCoords = useMemo(() => {
        const locationMap = new Map(locations.map(l => [l.id, l]));
        return events
            .filter(e => e.locationId)
            .map(e => {
                const loc = locationMap.get(e.locationId!);
                if (!loc?.latitude || !loc?.longitude) return null;
                return { ...e, lat: loc.latitude, lng: loc.longitude };
            })
            .filter((e): e is NonNullable<typeof e> => e !== null);
    }, [events, locations]);

    return (
        <Box sx={{ height: 500, borderRadius: 2, overflow: 'hidden' }}>
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
                {eventsWithCoords.map(event => (
                    <Marker
                        key={event.id}
                        position={[event.lat, event.lng]}
                    >
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
                                            : event.daysUntil < 0 ? t('races.passed')
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
                                    to={`/races/${event.slug}`}
                                    size="small"
                                    sx={{ mt: 1, display: 'block' }}
                                >
                                    {t('common.viewDetails', 'View Details')}
                                </Button>
                            </Box>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </Box>
    );
};

export default EventMapView;
