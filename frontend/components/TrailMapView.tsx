import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import L from 'leaflet';
import { Box, Typography, Button, IconButton, Paper, Tooltip, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import RouteIcon from '@mui/icons-material/Route';
import { Trail } from '../hooks/useTrails';
import { useTrailGeometries } from '../hooks/useTrailGeometries';
import { Link as RouterLink } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix for Leaflet marker icons in React
// @ts-expect-error - Leaflet internal _getIconUrl not in type definitions
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface TrailMapViewProps {
    trails: Trail[];
    userLocation: { lat: number; lng: number } | null;
}

function ChangeView({ bounds, followMe, userLocation }: { 
    bounds: L.LatLngBoundsExpression | null, 
    followMe: boolean,
    userLocation: { lat: number; lng: number } | null 
}) {
    const map = useMap();

    useMapEvents({
        dragstart: () => {
            // We'll handle disabling followMe via a prop callback if needed, 
            // but since ChangeView is a child, we'll use a simpler approach in the main component
        },
    });

    useEffect(() => {
        if (!followMe && bounds && (bounds as L.LatLngBounds).isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [bounds, map, followMe]);

    useEffect(() => {
        if (followMe && userLocation) {
            map.setView([userLocation.lat, userLocation.lng], map.getZoom());
        }
    }, [followMe, userLocation, map]);

    return null;
}

const ACTIVITY_COLORS: Record<string, string> = {
    TrailRunning: '#e65100', // deep orange
    Running: '#1565c0',     // blue
    Hiking: '#2e7d32',      // green
    Cycling: '#6a1b9a',     // purple
};

// Must be stable components (not inline) to avoid Leaflet re-registration
function MapInvalidateSize() {
    const map = useMap();
    useEffect(() => {
        // Fix tiles not rendering when map is lazy-loaded into a container
        const timer = setTimeout(() => map.invalidateSize(), 200);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
}

function MapDragHandler({ onDrag, onMapClick, ignoreClickRef }: { 
    onDrag: () => void; 
    onMapClick?: () => void;
    ignoreClickRef?: React.MutableRefObject<boolean>;
}) {
    useMapEvents({
        dragstart: onDrag,
        click: () => {
            if (ignoreClickRef?.current) {
                ignoreClickRef.current = false;
                return;
            }
            onMapClick?.();
        },
    });
    return null;
}

export const TrailMapView: React.FC<TrailMapViewProps> = ({ trails, userLocation }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [followMe, setFollowMe] = useState(false);
    const [showTracks, setShowTracks] = useState(true);
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
    const [selectionSource, setSelectionSource] = useState<'pin' | 'track' | null>(null);
    const { geometries } = useTrailGeometries();

    const handleFollowMeClick = () => {
        setFollowMe(prev => !prev);
    };

    const handleDrag = React.useCallback(() => setFollowMe(false), []);
    const handleMapClick = React.useCallback(() => { setSelectedSlug(null); setSelectionSource(null); }, []);
    const ignoreMapClick = React.useRef(false);
    const trailsWithLocation = useMemo(() => 
        trails.filter(t => t.startLatitude !== null && t.startLongitude !== null && (t.startLatitude !== 0 || t.startLongitude !== 0)),
    [trails]);

    const trailBySlug = useMemo(() => {
        const map = new Map<string, Trail>();
        trails.forEach(t => map.set(t.slug, t));
        return map;
    }, [trails]);

    // Filter geometries to only trails in the current view
    const visibleGeometries = useMemo(() => {
        if (!showTracks || geometries.length === 0) return [];
        const slugSet = new Set(trails.map(t => t.slug));
        return geometries.filter(g => slugSet.has(g.slug));
    }, [trails, geometries, showTracks]);

    const bounds = useMemo(() => {
        if (trailsWithLocation.length === 0) return null;
        const latLngs = trailsWithLocation.map(t => [t.startLatitude!, t.startLongitude!] as [number, number]);
        if (userLocation) {
            latLngs.push([userLocation.lat, userLocation.lng]);
        }
        return L.latLngBounds(latLngs);
    }, [trailsWithLocation, userLocation]);

    const userLocationIcon = useMemo(() => new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }), []);

    const trailIcon = useMemo(() => new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
        className: 'trail-marker'
    }), []);

    return (
        <Box sx={{ 
            height: '70vh', 
            width: '100%', 
            borderRadius: 2, 
            overflow: 'hidden', 
            border: '1px solid #ccc', 
            mb: 2,
            '& .trail-marker': {
                filter: 'grayscale(0.4) opacity(0.8)',
                transition: 'filter 0.3s ease, transform 0.3s ease',
            },
            '& .trail-marker:hover': {
                filter: 'grayscale(0) opacity(1)',
                transform: 'scale(1.1)',
                zIndex: 1000,
            }
        }}>
            <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
                <Paper 
                    elevation={3} 
                    sx={{ 
                        position: 'absolute', 
                        top: 10, 
                        right: 10, 
                        zIndex: 1100,
                        borderRadius: 4,
                        overflow: 'hidden',
                        backgroundColor: 'white',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        p: 0.5,
                    }}
                >
                    <Tooltip title={followMe ? t('map.stopFollowing') : t('map.followLocation')} placement="left">
                        <IconButton 
                            onClick={handleFollowMeClick}
                            color={followMe ? "primary" : "default"}
                            size="small"
                            sx={{ 
                                backgroundColor: followMe ? 'rgba(25, 118, 210, 0.1)' : 'white',
                                '&:hover': {
                                    backgroundColor: followMe ? 'rgba(25, 118, 210, 0.2)' : '#f5f5f5',
                                }
                            }}
                            aria-label="follow my location"
                        >
                            <MyLocationIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={showTracks ? t('map.hideTracks') : t('map.showTracks')} placement="left">
                        <IconButton
                            onClick={() => setShowTracks(prev => !prev)}
                            color={showTracks ? "primary" : "default"}
                            size="small"
                            sx={{
                                backgroundColor: showTracks ? 'rgba(25, 118, 210, 0.1)' : 'white',
                                '&:hover': {
                                    backgroundColor: showTracks ? 'rgba(25, 118, 210, 0.2)' : '#f5f5f5',
                                }
                            }}
                            aria-label="toggle tracks"
                        >
                            <RouteIcon />
                        </IconButton>
                    </Tooltip>
                </Paper>

                <MapContainer 
                    center={[64.1265, -21.8174]} 
                    zoom={10} 
                    style={{ height: '100%', width: '100%' }}
                >
                    <MapInvalidateSize />
                    <MapDragHandler onDrag={handleDrag} onMapClick={handleMapClick} ignoreClickRef={ignoreMapClick} />
                <TileLayer
                    key={isDark ? 'dark' : 'light'}
                    attribution={isDark
                        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
                        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
                    url={isDark
                        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
                />
                
                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                        <Popup>
                            <Typography variant="body2">{t('map.youAreHere')}</Typography>
                        </Popup>
                    </Marker>
                )}

                {visibleGeometries.map(geo => {
                    const isSelected = selectedSlug === geo.slug;
                    const isDimmed = selectedSlug !== null && !isSelected;
                    return (
                        <Polyline
                            key={geo.slug}
                            positions={geo.coordinates}
                            pathOptions={{
                                color: isSelected ? '#f44336' : (ACTIVITY_COLORS[geo.activityType] ?? '#1976d2'),
                                weight: isSelected ? 5 : 3,
                                opacity: isDimmed ? 0.15 : isSelected ? 1 : 0.7,
                            }}
                            eventHandlers={{
                                click: (e) => {
                                    L.DomEvent.stopPropagation(e.originalEvent);
                                    ignoreMapClick.current = true;
                                    setSelectedSlug(prev => prev === geo.slug ? null : geo.slug);
                                    setSelectionSource(prev => prev === 'track' && selectedSlug === geo.slug ? null : 'track');
                                }
                            }}
                        />
                    );
                })}

                <MarkerClusterGroup
                    chunkedLoading
                    maxClusterRadius={50}
                    spiderfyOnMaxZoom
                    showCoverageOnHover={false}
                >
                {trailsWithLocation.map(trail => (
                    <Marker 
                        key={trail.id} 
                        position={[trail.startLatitude!, trail.startLongitude!]}
                        icon={trailIcon}
                        eventHandlers={{
                            click: () => { ignoreMapClick.current = true; },
                            popupopen: () => { setSelectedSlug(trail.slug); setSelectionSource('pin'); },
                            popupclose: () => { setSelectedSlug(null); setSelectionSource(null); },
                        }}
                    >
                        <Popup>
                            <Box sx={{ minWidth: 200, p: 0.5 }}>
                                <Typography variant="h6" gutterBottom>{trail.name}</Typography>
                                <Typography variant="body2" color="textSecondary" gutterBottom>
                                    {trail.trailType} • {(trail.length / 1000).toFixed(1)} km
                                </Typography>
                                {trail.description && (
                                    <Typography variant="body2" sx={{ mb: 1, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {trail.description}
                                    </Typography>
                                )}
                                <Button 
                                    component={RouterLink} 
                                    to={`/trails/${trail.slug}`} 
                                    variant="contained" 
                                    size="small" 
                                    fullWidth
                                    sx={{ 
                                        color: '#fff !important',
                                        '&:hover': { color: '#fff !important' }
                                    }}
                                >
                                    {t('map.viewDetails')}
                                </Button>
                            </Box>
                        </Popup>
                    </Marker>
                ))}
                </MarkerClusterGroup>

                {bounds && <ChangeView bounds={bounds} followMe={followMe} userLocation={userLocation} />}
            </MapContainer>

                {/* Minimal info strip for selected track (only on track click, not pin click) */}
                {selectedSlug && selectionSource === 'track' && (() => {
                    const trail = trailBySlug.get(selectedSlug);
                    if (!trail) return null;
                    return (
                        <Box
                            component={RouterLink}
                            to={`/trails/${trail.slug}`}
                            sx={{
                                position: 'absolute',
                                bottom: 8,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 1100,
                                backgroundColor: 'rgba(0,0,0,0.65)',
                                backdropFilter: 'blur(8px)',
                                color: '#fff',
                                px: 2,
                                py: 0.75,
                                borderRadius: 3,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                textDecoration: 'none',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' },
                                maxWidth: '90%',
                            }}
                        >
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {trail.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                                {(trail.length / 1000).toFixed(1)} km · ↑{trail.elevationGain?.toFixed(0) ?? '?'}m
                            </Typography>
                        </Box>
                    );
                })()}
            </Box>
        </Box>
    );
};
