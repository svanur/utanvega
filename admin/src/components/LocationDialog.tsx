import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, MenuItem, Box, Alert, Typography, Slider,
    Tabs, Tab
} from '@mui/material';
import { History as HistoryIcon } from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationDto, LocationType } from '../hooks/useLocations';
import { apiFetch } from '../hooks/api';
import ChangeLogList from './ChangeLogList';

// Fix for default Leaflet marker icon
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationDialogProps {
    open: boolean;
    onClose: () => void;
    onSaveSuccess: () => void;
    onNotify: (message: string, severity: 'success' | 'error') => void;
    location?: LocationDto;
    allLocations: LocationDto[];
}

const LOCATION_TYPES: LocationType[] = ['Country', 'Area', 'Region', 'Municipality', 'Place', 'Other'];

function MapPicker({ lat, lon, radius, onUpdate, onRadiusUpdate }: { 
    lat: number | null, 
    lon: number | null, 
    radius: number | null, 
    onUpdate: (lat: number, lon: number) => void,
    onRadiusUpdate: (radius: number) => void
}) {
    const map = useMap();
    
    useMapEvents({
        click(e) {
            onUpdate(e.latlng.lat, e.latlng.lng);
        },
    });

    useEffect(() => {
        if (lat && lon && map) {
            try {
                const bounds = map.getBounds();
                if (bounds.isValid() && !bounds.contains([lat, lon])) {
                    map.setView([lat, lon], map.getZoom());
                }
            } catch (e) {
                // Bounds might not be ready yet
                map.setView([lat, lon], map.getZoom());
            }
        }
    }, [lat, lon, map]);

    return (
        <>
            {lat && lon && (
                <>
                    <Marker 
                        position={[lat, lon]} 
                        draggable={true}
                        eventHandlers={{
                            dragend: (e) => {
                                const marker = e.target;
                                const position = marker.getLatLng();
                                onUpdate(position.lat, position.lng);
                            },
                        }}
                    />
                    {radius && (
                        <Circle 
                            center={[lat, lon]} 
                            radius={radius}
                            pathOptions={{ color: 'blue', fillColor: 'blue' }}
                        />
                    )}
                </>
            )}
        </>
    );
}

export function LocationDialog({ open, onClose, onSaveSuccess, onNotify, location, allLocations }: LocationDialogProps) {
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<LocationType>('Place');
    const [parentId, setParentId] = useState<string>('');
    const [latitude, setLatitude] = useState<string>('');
    const [longitude, setLongitude] = useState<string>('');
    const [radius, setRadius] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        if (location) {
            setName(location.name);
            setSlug(location.slug);
            setDescription(location.description || '');
            setType(location.type);
            setParentId(location.parentId || '');
            setLatitude(location.latitude?.toString() || '');
            setLongitude(location.longitude?.toString() || '');
            setRadius(location.radius?.toString() || '');
        } else {
            setName('');
            setSlug('');
            setDescription('');
            setType('Place');
            setParentId('');
            setLatitude('');
            setLongitude('');
            setRadius('');
        }
        setError(null);
    }, [location, open]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const body = {
                id: location?.id,
                name,
                slug,
                description,
                type,
                parentId: parentId || null,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                radius: radius ? parseFloat(radius) : null,
            };

            if (location) {
                await apiFetch(`/api/v1/admin/locations/${location.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(body),
                });
                onNotify('Location updated successfully', 'success');
            } else {
                await apiFetch(`/api/v1/admin/locations`, {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
                onNotify('Location created successfully', 'success');
            }
            onSaveSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save location');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">{location ? 'Edit Location' : 'New Location'}</Typography>
                    {location && (
                        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                            <Tab label="General" />
                            <Tab icon={<HistoryIcon />} label="History" />
                        </Tabs>
                    )}
                </Box>
            </DialogTitle>
            <DialogContent>
                {activeTab === 0 ? (
                    <>
                        <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                                {error && <Alert severity="error">{error}</Alert>}
                                <TextField
                                    label="Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    fullWidth
                                    required
                                />
                                <TextField
                                    label="Slug"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    fullWidth
                                    placeholder="auto-generated if empty"
                                />
                                <TextField
                                    label="Description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    fullWidth
                                    multiline
                                    rows={2}
                                />
                                <TextField
                                    select
                                    label="Type"
                                    value={type}
                                    onChange={(e) => setType(e.target.value as LocationType)}
                                    fullWidth
                                >
                                    {LOCATION_TYPES.map((t) => (
                                        <MenuItem key={t} value={t}>{t}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select
                                    label="Parent Location"
                                    value={parentId}
                                    onChange={(e) => setParentId(e.target.value)}
                                    fullWidth
                                >
                                    <MenuItem value=""><em>None</em></MenuItem>
                                    {allLocations
                                        .filter(l => l.id !== location?.id) // Prevent self-parenting
                                        .map((l) => (
                                            <MenuItem key={l.id} value={l.id}>{l.name} ({l.type})</MenuItem>
                                        ))}
                                </TextField>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <TextField
                                        label="Latitude"
                                        type="number"
                                        value={latitude}
                                        onChange={(e) => setLatitude(e.target.value)}
                                        fullWidth
                                        inputProps={{ step: "0.000001" }}
                                    />
                                    <TextField
                                        label="Longitude"
                                        type="number"
                                        value={longitude}
                                        onChange={(e) => setLongitude(e.target.value)}
                                        fullWidth
                                        inputProps={{ step: "0.000001" }}
                                    />
                                </Box>
                                <TextField
                                    label="Radius (meters)"
                                    type="number"
                                    value={radius}
                                    onChange={(e) => setRadius(e.target.value)}
                                    fullWidth
                                    inputProps={{ step: "100", min: "0" }}
                                />
                            </Box>
                            <Box sx={{ flex: 1, height: 400, borderRadius: 1, overflow: 'hidden', border: '1px solid #ccc' }}>
                                <Typography variant="caption" sx={{ p: 1, display: 'block', bgcolor: '#f5f5f5' }}>
                                    Click on the map to set location coordinates
                                </Typography>
                                <MapContainer 
                                    center={[64.1265, -21.8174]} 
                                    zoom={7} 
                                    style={{ height: 'calc(100% - 32px)', width: '100%' }}
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    <MapPicker 
                                        lat={latitude ? parseFloat(latitude) : null}
                                        lon={longitude ? parseFloat(longitude) : null}
                                        radius={radius ? parseFloat(radius) : null}
                                        onUpdate={(lat, lon) => {
                                            setLatitude(lat.toFixed(6));
                                            setLongitude(lon.toFixed(6));
                                        }}
                                        onRadiusUpdate={(r) => {
                                            setRadius(Math.round(r).toString());
                                        }}
                                    />
                                </MapContainer>
                            </Box>
                        </Box>
                        <Box sx={{ mt: 3, px: 1 }}>
                            <Typography gutterBottom variant="subtitle2" color="textSecondary">
                                Radius Area Adjustment (meters): {radius || 0}
                            </Typography>
                            <Slider
                                value={radius ? parseInt(radius) : 0}
                                min={0}
                                max={50000}
                                step={100}
                                onChange={(_, newValue) => setRadius(newValue.toString())}
                                valueLabelDisplay="auto"
                                marks={[
                                    { value: 0, label: '0m' },
                                    { value: 10000, label: '10km' },
                                    { value: 25000, label: '25km' },
                                    { value: 50000, label: '50km' },
                                ]}
                            />
                        </Box>
                    </>
                ) : (
                    <ChangeLogList entityName="Location" entityId={location?.id} title="Location History" />
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                {activeTab === 0 && (
                    <Button 
                        onClick={handleSave} 
                        variant="contained" 
                        color="primary"
                        disabled={saving || !name}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
