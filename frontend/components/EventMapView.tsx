import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Popup, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import L from 'leaflet';
import { Box, Typography, Chip, Button, Paper, IconButton, useTheme } from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import type { EventSummary } from '../hooks/useEvents';
import { useLocations } from '../hooks/useLocations';
import { getCountdownColor, getCountdownLabel, isOngoingPastDayTwo } from '../utils/eventUtils';
import { useLocalize } from '../utils/localize';
import { geoJsonBoundaryToLatLngParts, getBoundaryPathOptions, SIMPLEMAPS_CC_BY_ATTRIBUTION } from './locationBoundary';
import { MapAttributionSync } from './TrailMapView';
import MapFollowController from './MapFollowController';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix Leaflet default marker icons
// @ts-expect-error - Leaflet internal _getIconUrl not in type definitions
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIconRetina,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const userLocationIcon = L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="#1976d2" fill-opacity="0.9" stroke="white" stroke-width="2"/>
        <circle cx="10" cy="10" r="3" fill="white"/>
    </svg>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
});

interface EventMapViewProps {
    events: EventSummary[];
}

const ICELAND_CENTER: [number, number] = [64.96, -18.5];
const ICELAND_ZOOM = 6;

const EventMapView: React.FC<EventMapViewProps> = ({ events }) => {
    const { t } = useTranslation();
    const loc = useLocalize();
    const theme = useTheme();
    const { locations } = useLocations();
    const [followMe, setFollowMe] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    // #1776: one location's boundary shape hovered (or tapped — Leaflet's default tap-to-open
    // behavior on touch) at a time, independent of MarkerClusterGroup's own marker state. Keyed by
    // locationId rather than slug (EventSummary only carries locationId, not the location's slug).
    const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);

    // Start watching position only when the user activates follow mode
    useEffect(() => {
        if (!followMe || !navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.warn('Geolocation error:', err),
            { enableHighAccuracy: true },
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [followMe]);

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

    // #1776: distinct locations behind the current events that have a saved boundary
    // (Location.boundaryGeoJson, #1705) — rendered as Polygon outlines alongside (not instead of)
    // the event pins above, adapting LocationsPage.tsx's boundary-overlay pattern (#1708) from
    // "every location" to "every location among these events".
    const boundaryLocations = useMemo(() => {
        const locationMap = new Map(locations.map(l => [l.id, l]));
        const locationIds = new Set(events.map(e => e.locationId).filter((id): id is string => id != null));
        return Array.from(locationIds)
            .map(id => locationMap.get(id))
            .filter((l): l is NonNullable<typeof l> & { boundaryGeoJson: string } => !!l?.boundaryGeoJson);
    }, [events, locations]);

    // #1764/#1776: a landsvæði Region boundary is simplemaps.com (CC BY 4.0) — surface that credit
    // whenever one is among the shapes currently rendered, same gate LocationsPage.tsx/
    // LocationDetailsPage.tsx use for the same data.
    const hasSimplemapsBoundary = useMemo(() =>
        boundaryLocations.some(l => l.type === 'Region'),
        [boundaryLocations]
    );

    const markerCluster = useMemo(() => (
        <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            spiderfyOnMaxZoom
            showCoverageOnHover={false}
        >
            {eventsWithCoords.map(event => (
                <Marker key={event.id} position={[event.lat, event.lng]}>
                    <Popup>
                        <Box sx={{ minWidth: 180 }}>
                            <Typography variant="subtitle2" fontWeight={700}>
                                {loc(event.name, event.nameEn) ?? event.name}
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
                                        isOngoingPastDayTwo(event.daysUntil, event.displayDate, event.endDisplayDate) ? t('races.ongoing')
                                        : getCountdownLabel(event.daysUntil, t)
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
        </MarkerClusterGroup>
    ), [eventsWithCoords, loc, t]);

    return (
        <Box sx={{ height: 500, width: '100%', maxWidth: '100%', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
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
                <MapAttributionSync text={hasSimplemapsBoundary ? SIMPLEMAPS_CC_BY_ATTRIBUTION : null} />
                <MapFollowController
                    followMe={followMe}
                    userLocation={userLocation}
                    returnCenter={ICELAND_CENTER}
                    returnZoom={ICELAND_ZOOM}
                    onDrag={() => setFollowMe(false)}
                />
                {/* #1776: boundary outlines — rendered outside/before MarkerClusterGroup so shapes
                    never join marker clustering and always sit beneath the pins. Hovering (or
                    tapping, on touch — Leaflet's default behavior) any part highlights the whole
                    shape and shows the location's localized name. */}
                {boundaryLocations.flatMap(location => {
                    const parts = geoJsonBoundaryToLatLngParts(location.boundaryGeoJson);
                    if (!parts) return [];
                    const isHovered = hoveredLocationId === location.id;
                    // #1739: one <Polygon> per part so a MultiPolygon boundary (e.g. an exclave)
                    // renders as several disconnected outlines, all sharing the same hover
                    // handlers so hovering/tapping any part highlights the same location.
                    return parts.map((part, index) => (
                        <Polygon
                            key={`boundary-${location.id}-${index}`}
                            positions={part}
                            pathOptions={getBoundaryPathOptions(theme, isHovered)}
                            eventHandlers={{
                                mouseover: () => setHoveredLocationId(location.id),
                                mouseout: () => setHoveredLocationId(null),
                            }}
                        >
                            <Tooltip direction="center" sticky>
                                <Typography variant="caption" fontWeight="bold">
                                    {loc(location.name, location.nameEn) ?? location.name}
                                </Typography>
                            </Tooltip>
                        </Polygon>
                    ));
                })}
                {markerCluster}
                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon} />
                )}
            </MapContainer>
        </Box>
    );
};

export default EventMapView;
