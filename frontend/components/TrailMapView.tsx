import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Box, Typography, Button, Link } from '@mui/material';
import { Trail } from '../hooks/useTrails';
import { Link as RouterLink } from 'react-router-dom';

// Fix for Leaflet marker icons in React
// @ts-ignore
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

function ChangeView({ bounds }: { bounds: L.LatLngBoundsExpression }) {
    const map = useMap();
    useEffect(() => {
        if (bounds && (bounds as L.LatLngBounds).isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [bounds, map]);
    return null;
}

export const TrailMapView: React.FC<TrailMapViewProps> = ({ trails, userLocation }) => {
    const trailsWithLocation = useMemo(() => 
        trails.filter(t => t.startLatitude !== null && t.startLongitude !== null && (t.startLatitude !== 0 || t.startLongitude !== 0)),
    [trails]);

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
            <MapContainer 
                center={[64.1265, -21.8174]} 
                zoom={10} 
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                        <Popup>
                            <Typography variant="body2">You are here</Typography>
                        </Popup>
                    </Marker>
                )}

                {trailsWithLocation.map(trail => (
                    <Marker 
                        key={trail.id} 
                        position={[trail.startLatitude!, trail.startLongitude!]}
                        icon={trailIcon}
                    >
                        <Popup>
                            <Box sx={{ minWidth: 200, p: 0.5 }}>
                                <Typography variant="h6" gutterBottom>{trail.name}</Typography>
                                <Typography variant="body2" color="textSecondary" gutterBottom>
                                    {trail.trailType} • {trail.length} km
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
                                    View Details
                                </Button>
                            </Box>
                        </Popup>
                    </Marker>
                ))}

                {bounds && <ChangeView bounds={bounds} />}
            </MapContainer>
        </Box>
    );
};
