import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Alert, Typography, Slider,
    Tabs, Tab, Autocomplete, CircularProgress
} from '@mui/material';
import { History as HistoryIcon, AutoFixHigh as WikiIcon } from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationDto, LocationType } from '../hooks/useLocations';
import { apiFetch } from '../hooks/api';
import ChangeLogList from './ChangeLogList';

// Fix for default Leaflet marker icon
// @ts-expect-error - Leaflet internal _getIconUrl not in type definitions
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

interface NominatimResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    type: string;
}

function useGeocode() {
    const [options, setOptions] = useState<NominatimResult[]>([]);
    const [loading, setLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout>>();

    const search = useCallback((query: string) => {
        clearTimeout(timerRef.current);
        if (query.length < 3) { setOptions([]); return; }

        setLoading(true);
        timerRef.current = setTimeout(async () => {
            try {
                const params = new URLSearchParams({
                    q: query,
                    format: 'json',
                    limit: '6',
                    countrycodes: 'is',
                    addressdetails: '0',
                });
                const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
                    headers: { 'Accept-Language': 'is,en' },
                });
                const data: NominatimResult[] = await res.json();
                setOptions(data);
            } catch {
                setOptions([]);
            } finally {
                setLoading(false);
            }
        }, 400);
    }, []);

    return { options, loading, search, setOptions };
}

function parseCoordinates(text: string): { lat: number; lon: number } | null {
    const cleaned = text.trim();
    if (!cleaned) return null;

    // "63.9830° N, 19.0670° W" or "63.9830°N, 19.0670°W"
    const degDir = cleaned.match(
        /(-?\d+\.?\d*)\s*°?\s*([NSns]),?\s*(-?\d+\.?\d*)\s*°?\s*([EWew])/
    );
    if (degDir) {
        let lat = parseFloat(degDir[1]);
        let lon = parseFloat(degDir[3]);
        if (degDir[2].toUpperCase() === 'S') lat = -lat;
        if (degDir[4].toUpperCase() === 'W') lon = -lon;
        if (isValidCoord(lat, lon)) return { lat, lon };
    }

    // "N 63.9830, W 19.0670"
    const dirDeg = cleaned.match(
        /([NSns])\s*(-?\d+\.?\d*)\s*°?,?\s*([EWew])\s*(-?\d+\.?\d*)\s*°?/
    );
    if (dirDeg) {
        let lat = parseFloat(dirDeg[2]);
        let lon = parseFloat(dirDeg[4]);
        if (dirDeg[1].toUpperCase() === 'S') lat = -lat;
        if (dirDeg[3].toUpperCase() === 'W') lon = -lon;
        if (isValidCoord(lat, lon)) return { lat, lon };
    }

    // DMS: 63°58'58.8"N 19°4'1.2"W
    const dms = cleaned.match(
        /(\d+)°\s*(\d+)[''′]\s*(\d+\.?\d*)[""″]?\s*([NSns]),?\s*(\d+)°\s*(\d+)[''′]\s*(\d+\.?\d*)[""″]?\s*([EWew])/
    );
    if (dms) {
        let lat = parseInt(dms[1]) + parseInt(dms[2]) / 60 + parseFloat(dms[3]) / 3600;
        let lon = parseInt(dms[5]) + parseInt(dms[6]) / 60 + parseFloat(dms[7]) / 3600;
        if (dms[4].toUpperCase() === 'S') lat = -lat;
        if (dms[8].toUpperCase() === 'W') lon = -lon;
        if (isValidCoord(lat, lon)) return { lat, lon };
    }

    // Simple decimal: "63.9830, -19.0670"
    const decimal = cleaned.match(/(-?\d+\.?\d*)\s*[,;\s]\s*(-?\d+\.?\d*)/);
    if (decimal) {
        const lat = parseFloat(decimal[1]);
        const lon = parseFloat(decimal[2]);
        if (isValidCoord(lat, lon)) return { lat, lon };
    }

    return null;
}

function isValidCoord(lat: number, lon: number): boolean {
    return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function MapPicker({ lat, lon, radius, onUpdate, onRadiusUpdate: _onRadiusUpdate }: { 
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
            } catch (_e) {
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
    const geo = useGeocode();
    const [wikiLoading, setWikiLoading] = useState(false);

    const lookupWikipedia = async () => {
        if (!name.trim()) return;
        setWikiLoading(true);
        try {
            // Try Icelandic Wikipedia first, then English
            for (const lang of ['is', 'en']) {
                const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.trim())}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data.extract) {
                        setDescription(data.extract);
                        onNotify(`Description loaded from ${lang}.wikipedia.org`, 'success');
                        return;
                    }
                }
            }
            onNotify('No Wikipedia article found for this name', 'error');
        } catch {
            onNotify('Failed to fetch from Wikipedia', 'error');
        } finally {
            setWikiLoading(false);
        }
    };

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
                slug: slug || null,
                description: description || null,
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
                                <Autocomplete
                                    freeSolo
                                    options={geo.options}
                                    getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.display_name}
                                    loading={geo.loading}
                                    inputValue={name}
                                    onInputChange={(_e, val, reason) => {
                                        setName(val);
                                        if (reason === 'input') geo.search(val);
                                    }}
                                    onChange={(_e, val) => {
                                        if (val && typeof val !== 'string') {
                                            const shortName = val.display_name.split(',')[0].trim();
                                            setName(shortName);
                                            setLatitude(parseFloat(val.lat).toFixed(6));
                                            setLongitude(parseFloat(val.lon).toFixed(6));
                                            geo.setOptions([]);
                                        }
                                    }}
                                    filterOptions={(x) => x}
                                    fullWidth
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Name"
                                            required
                                            InputProps={{
                                                ...params.InputProps,
                                                endAdornment: (
                                                    <>
                                                        {geo.loading && <CircularProgress size={18} />}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                ),
                                            }}
                                            helperText="Type to search places — select to auto-fill coordinates"
                                        />
                                    )}
                                />
                                <TextField
                                    label="Slug"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    fullWidth
                                    placeholder="auto-generated if empty"
                                />
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                    <TextField
                                        label="Description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        fullWidth
                                        multiline
                                        rows={2}
                                    />
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={lookupWikipedia}
                                        disabled={!name.trim() || wikiLoading}
                                        startIcon={wikiLoading ? <CircularProgress size={16} /> : <WikiIcon />}
                                        sx={{ mt: 0.5, whiteSpace: 'nowrap', minWidth: 'auto' }}
                                        title="Lookup description from Wikipedia"
                                    >
                                        Wiki
                                    </Button>
                                </Box>
                                <Autocomplete
                                    options={LOCATION_TYPES}
                                    value={type}
                                    onChange={(_e, val) => setType((val ?? 'Place') as LocationType)}
                                    disableClearable
                                    renderInput={(params) => (
                                        <TextField {...params} label="Type" fullWidth />
                                    )}
                                />
                                <Autocomplete
                                    options={allLocations.filter(l => l.id !== location?.id)}
                                    getOptionLabel={(opt) => typeof opt === 'string' ? opt : `${opt.name} (${opt.type})`}
                                    value={allLocations.find(l => l.id === parentId) ?? null}
                                    onChange={(_e, val) => setParentId(val?.id ?? '')}
                                    isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Parent Location" fullWidth />
                                    )}
                                />
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <TextField
                                        label="Paste coordinates"
                                        placeholder='e.g. 63.98° N, 19.06° W'
                                        fullWidth
                                        onPaste={(e) => {
                                            const text = e.clipboardData.getData('text');
                                            const parsed = parseCoordinates(text);
                                            if (parsed) {
                                                setLatitude(parsed.lat.toFixed(6));
                                                setLongitude(parsed.lon.toFixed(6));
                                                e.preventDefault();
                                            }
                                        }}
                                        onChange={(e) => {
                                            const parsed = parseCoordinates(e.target.value);
                                            if (parsed) {
                                                setLatitude(parsed.lat.toFixed(6));
                                                setLongitude(parsed.lon.toFixed(6));
                                            }
                                        }}
                                        size="small"
                                    />
                                </Box>
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
