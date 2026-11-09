import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Box, Alert, Typography, Slider, Tabs, Tab, Autocomplete, CircularProgress,
    IconButton, Tooltip, TextField, Button, Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HistoryIcon from '@mui/icons-material/History';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import WikiIcon from '@mui/icons-material/AutoFixHigh';
import TranslateIcon from '@mui/icons-material/Translate';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Side-effect import: attaches `.pm` to L.Map/L.Layer (module augmentation lives in its .d.ts) and
// registers the draw/edit/removal toolbar Geoman adds to any map it's imported alongside (#1706).
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { booleanIntersects } from '@turf/turf';
import { useLocations, useLocationById, LocationType } from '../hooks/useLocations';
import { findBundledMunicipalityBoundary, MunicipalityBoundaryFeature } from '../utils/municipalityBoundaries';
import type { MunicipalityBoundaryProperties } from '../utils/municipalityBoundaries';
import { apiFetch } from '../hooks/api';
import { useTranslate } from '../hooks/useTranslate';
import { useBackToList } from '../hooks/useBackToList';
import BilingualTextField from '../components/BilingualTextField';
import ChangeLogList from '../components/ChangeLogList';
import { BilingualLangProvider } from '../contexts/BilingualLangContext';

// Fix for default Leaflet marker icon
// @ts-expect-error - Leaflet internal _getIconUrl not in type definitions
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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
                    {/* pmIgnore excludes this layer from Geoman's draw/edit/removal toolbar
                        (#1706) — without it, toggling Geoman's global "Edit Layers" button would
                        also attach vertex-drag handles to this pin, fighting the drag handler
                        above that already drives onUpdate. */}
                    <Marker
                        position={[lat, lon]}
                        draggable={true}
                        pmIgnore
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
                            pmIgnore
                        />
                    )}
                </>
            )}
        </>
    );
}

/**
 * Geoman draw/edit/delete toolbar for a single Location.Boundary polygon (#1706). Deliberately
 * only exposes polygon drawing plus edit/drag/removal — no line/marker/circle/rectangle/text
 * tools, and no union/difference "composer" modes (out of scope, see the issue).
 *
 * `boundaryGeoJson` is the single source of truth for what should be on the map — both the
 * initial fetch-on-open and "Load official boundary" reseed it, and this component reacts by
 * loading it as a fresh editable layer. `loadedRef` distinguishes "a new value arrived from the
 * parent" from "I just emitted this value myself via a pm:edit", so a user's own edits don't
 * bounce the layer through a remove/recreate on every vertex drag.
 */
function BoundaryEditor({
    boundaryGeoJson,
    onBoundaryChange,
    onUserDrewNewShape,
    onBoundaryRemoved,
}: {
    boundaryGeoJson: string | null;
    onBoundaryChange: (geoJson: string | null) => void;
    onUserDrewNewShape: () => void;
    onBoundaryRemoved: () => void;
}) {
    const map = useMap();
    const layerRef = useRef<L.Polygon | null>(null);
    const loadedRef = useRef<string | null>(null);

    const captureGeometry = useCallback((layer: L.Polygon) => {
        const feature = layer.toGeoJSON();
        const json = JSON.stringify(feature.geometry);
        loadedRef.current = json;
        onBoundaryChange(json);
    }, [onBoundaryChange]);

    useEffect(() => {
        map.pm.addControls({
            position: 'topleft',
            drawMarker: false,
            drawCircleMarker: false,
            drawPolyline: false,
            drawRectangle: false,
            drawCircle: false,
            drawText: false,
            drawPolygon: true,
            editMode: true,
            dragMode: true,
            cutPolygon: false,
            removalMode: true,
            rotateMode: false,
            splitMode: false,
            scaleMode: false,
            unionMode: false,
            differenceMode: false,
            bringToMode: false,
            sendToBackMode: false,
            pinningOption: false,
            snappingOption: false,
            autoTracingOption: false,
            snapGuidesOption: false,
        });
        // The one hard constraint the issue calls for explicitly: Geoman itself refuses to finish
        // (or edit into) a self-intersecting ring, rather than the app validating it after the fact.
        map.pm.setGlobalOptions({ allowSelfIntersection: false });

        return () => {
            map.pm.removeControls();
        };
    }, [map]);

    useEffect(() => {
        const handleCreate: L.PM.CreateEventHandler = (e) => {
            // Location.Boundary is a single Polygon — drawing a new one while a previous draft is
            // still on the map replaces it rather than accumulating multiple shapes.
            if (layerRef.current && (layerRef.current as unknown as L.Layer) !== e.layer) {
                map.removeLayer(layerRef.current);
            }
            const layer = e.layer as L.Polygon;
            layerRef.current = layer;
            layer.on('pm:edit', () => captureGeometry(layer));
            onUserDrewNewShape();
            captureGeometry(layer);
        };
        const handleRemove: L.PM.RemoveEventHandler = (e) => {
            if ((e.layer as unknown as L.Layer) === (layerRef.current as unknown as L.Layer)) {
                layerRef.current = null;
                loadedRef.current = null;
                onBoundaryChange(null);
                // Distinct from onBoundaryChange(null) above: that also fires on first mount with
                // nothing loaded, which must never be mistaken for "the user explicitly deleted a
                // previously-saved boundary" (the save path turns that into the "" clear sentinel
                // UpdateLocationCommand expects — see the #1706 review fix in handleSave).
                onBoundaryRemoved();
            }
        };
        map.on('pm:create', handleCreate);
        map.on('pm:remove', handleRemove);
        return () => {
            map.off('pm:create', handleCreate);
            map.off('pm:remove', handleRemove);
        };
    }, [map, captureGeometry, onBoundaryChange, onUserDrewNewShape, onBoundaryRemoved]);

    useEffect(() => {
        if (boundaryGeoJson === loadedRef.current) return;
        loadedRef.current = boundaryGeoJson;

        if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
        }
        if (!boundaryGeoJson) return;

        let geometry: GeoJSON.Polygon;
        try {
            geometry = JSON.parse(boundaryGeoJson);
        } catch {
            return;
        }

        const layer = L.geoJSON(geometry).getLayers()[0] as L.Polygon;
        layer.addTo(map);
        layer.pm.enable();
        layer.on('pm:edit', () => captureGeometry(layer));
        layerRef.current = layer;

        try {
            const bounds = layer.getBounds();
            if (bounds.isValid()) map.fitBounds(bounds, { maxZoom: 14 });
        } catch {
            // Bounds might not be ready yet — not worth failing the load over.
        }
    }, [boundaryGeoJson, map, captureGeometry]);

    return null;
}

function LocationDetailPageInner({ onNotify }: { onNotify: (message: string, severity: 'success' | 'error') => void }) {
    const { id = 'new' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const handleBackToList = useBackToList('/locations');
    const isNew = id === 'new';
    // Full/filtered list — still needed for the parent-location picker below, which must offer
    // every other Location as a candidate parent (#1729 out of scope: that data source).
    const { locations: allLocations, refresh } = useLocations();
    // #1729: the edited record itself is resolved with a direct single-record fetch instead of
    // pulling the entire unfiltered admin locations list just to find one row by id.
    const { location, loading: locationLoading, refresh: refreshLocation } = useLocationById(isNew ? undefined : id);

    const [name, setName] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [slug, setSlug] = useState('');
    // Seeded from the mode rather than defaulting to locked: the effect below
    // resets this whenever the loaded location changes, but it runs after the
    // first paint, so defaulting to false showed a locked field for a frame
    // when creating.
    const [slugUnlocked, setSlugUnlocked] = useState(isNew);
    // Creating and editing share this page, and the slug means different
    // things in each: on a new location it is optional and the backend derives
    // one from the name, on an existing one it is a live URL.
    const isEditing = location !== undefined;
    const [description, setDescription] = useState('');
    const [descriptionEn, setDescriptionEn] = useState('');
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
    const { translate, translating } = useTranslate();

    // #1706: Location.Boundary polygon editing. boundaryGeoJson is the single source of truth fed
    // into <BoundaryEditor> — set from the GET .../boundary fetch below once the location loads, or
    // reseeded by "Load official boundary"; BoundaryEditor itself reports user draws/edits back into it.
    const [boundaryGeoJson, setBoundaryGeoJson] = useState<string | null>(null);
    const [boundaryLoading, setBoundaryLoading] = useState(false);
    const [municipalityBoundaries, setMunicipalityBoundaries] = useState<MunicipalityBoundaryFeature[]>([]);
    // True only while the displayed polygon is the bundled official shape or a direct edit of it
    // — drives the CC BY attribution credit, and is reset the moment the user draws a fresh shape
    // from scratch or removes the layer entirely (see the effects below).
    const [officialBoundaryDisplayed, setOfficialBoundaryDisplayed] = useState(false);
    const [boundaryIntersectWarning, setBoundaryIntersectWarning] = useState(false);
    // True only when the user explicitly deleted a previously-saved boundary via Geoman's removal
    // tool this session — distinct from boundaryGeoJson simply being null (which is also true for
    // a Location that never had one, or before the fetch below resolves). handleSave uses this to
    // choose between omitting BoundaryGeoJson (leave an untouched Boundary alone) and sending the
    // "" clear sentinel UpdateLocationCommand needs to actually delete it (#1706 review fix —
    // previously this page always sent null after a removal, which UpdateLocationCommandHandler
    // reads as "field omitted" and silently kept the stale Boundary in the DB).
    const [boundaryRemoved, setBoundaryRemoved] = useState(false);

    // Loaded once per page instance — a small static asset (~17KB), not worth refetching per
    // Location opened.
    useEffect(() => {
        let cancelled = false;
        fetch('/data/municipality-boundaries.geojson')
            .then(res => (res.ok ? res.json() : null))
            .then((data: GeoJSON.FeatureCollection<GeoJSON.Polygon, MunicipalityBoundaryProperties> | null) => {
                if (!cancelled && data) setMunicipalityBoundaries(data.features);
            })
            .catch(() => {
                // Bundled reference boundaries are an optional convenience (soft intersects warning
                // + "Load official boundary") — their absence must never block drawing/saving a
                // hand-drawn boundary.
            });
        return () => { cancelled = true; };
    }, []);

    const matchedMunicipalityBoundary = findBundledMunicipalityBoundary(type, slug, name, municipalityBoundaries);

    useEffect(() => {
        if (boundaryGeoJson === null) setOfficialBoundaryDisplayed(false);
    }, [boundaryGeoJson]);

    useEffect(() => {
        if (!boundaryGeoJson || !matchedMunicipalityBoundary) {
            setBoundaryIntersectWarning(false);
            return;
        }
        try {
            const drawnGeometry = JSON.parse(boundaryGeoJson) as GeoJSON.Polygon;
            const drawnFeature: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {}, geometry: drawnGeometry };
            setBoundaryIntersectWarning(!booleanIntersects(drawnFeature, matchedMunicipalityBoundary));
        } catch {
            setBoundaryIntersectWarning(false);
        }
    }, [boundaryGeoJson, matchedMunicipalityBoundary]);

    const handleLoadOfficialBoundary = useCallback(() => {
        if (!matchedMunicipalityBoundary) return;
        setBoundaryGeoJson(JSON.stringify(matchedMunicipalityBoundary.geometry));
        setOfficialBoundaryDisplayed(true);
        setBoundaryRemoved(false);
    }, [matchedMunicipalityBoundary]);

    const handleUserDrewNewShape = useCallback(() => {
        setOfficialBoundaryDisplayed(false);
        setBoundaryRemoved(false);
    }, []);

    const handleBoundaryRemoved = useCallback(() => setBoundaryRemoved(true), []);

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
        // The lock protects a slug that is already a live URL, so it only
        // applies when editing. A new location has nothing to break yet, and
        // locking the field there would hide the one moment the slug is worth
        // seeing — before it is created. Reset whenever the loaded location
        // changes so an unlock never carries over to the next location edited.
        setSlugUnlocked(!location);
        setOfficialBoundaryDisplayed(false);
        setBoundaryRemoved(false);
        if (location) {
            setName(location.name);
            setNameEn(location.nameEn || '');
            setSlug(location.slug);
            setDescription(location.description || '');
            setDescriptionEn(location.descriptionEn || '');
            setType(location.type);
            setParentId(location.parentId || '');
            setLatitude(location.latitude?.toString() || '');
            setLongitude(location.longitude?.toString() || '');
            setRadius(location.radius?.toString() || '');

            // Lazy admin-only fetch (#1706) — the shared LocationDto/GetLocationsQuery the list
            // view uses deliberately carries no boundary field, so this is only ever requested
            // when a specific Location's edit page actually loads.
            setBoundaryGeoJson(null);
            setBoundaryLoading(true);
            let cancelled = false;
            apiFetch<{ boundaryGeoJson: string | null }>(`/api/v1/admin/locations/${location.id}/boundary`)
                .then((result) => {
                    if (!cancelled) setBoundaryGeoJson(result.boundaryGeoJson);
                })
                .catch(() => {
                    // Leave boundaryGeoJson at null — the pin-drag + circle-radius flow still
                    // works unaffected, this only disables the boundary editor pre-population.
                })
                .finally(() => {
                    if (!cancelled) setBoundaryLoading(false);
                });
            setError(null);
            return () => { cancelled = true; };
        } else if (isNew) {
            setName('');
            setNameEn('');
            setSlug('');
            setDescription('');
            setDescriptionEn('');
            setType('Place');
            setParentId('');
            setLatitude('');
            setLongitude('');
            setRadius('');
            setBoundaryGeoJson(null);
            setBoundaryLoading(false);
        }
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location?.id, isNew]);

    const handleSave = async () => {
        // An empty slug means "generate one from the name", which the backend
        // only does on create. Clearing it on an existing location sends null
        // to an endpoint that requires a value, and the validator answers with
        // a bare "Slug must not be empty" — say what to do about it instead.
        if (isEditing && !slug.trim()) {
            setError('A slug is required. Locations keep their slug unless you set a new one — it is the page address.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const body = {
                id: location?.id,
                name,
                nameEn: nameEn || null,
                slug: slug || null,
                description: description || null,
                descriptionEn: descriptionEn || null,
                type,
                parentId: parentId || null,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                radius: radius ? parseFloat(radius) : null,
                // null = "untouched, leave an existing saved Boundary alone"; "" = the explicit
                // clear sentinel UpdateLocationCommand needs after a Geoman removal (#1706 review
                // fix) — boundaryGeoJson itself is also null in that case, so boundaryRemoved is
                // what tells the two apart.
                boundaryGeoJson: boundaryRemoved ? '' : boundaryGeoJson,
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
            refresh();
            refreshLocation();
            navigate('/locations');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save location');
        } finally {
            setSaving(false);
        }
    };

    if (!isNew && locationLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!isNew && !location) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                Location not found
                <Button size="small" sx={{ ml: 2 }} onClick={() => navigate('/locations')}>Back to locations</Button>
            </Alert>
        );
    }

    return (
        <Box>
            {/* Breadcrumb */}
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
                <IconButton size="small" onClick={handleBackToList}>
                    <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    component={RouterLink}
                    to="/locations"
                    onClick={e => {
                        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                        e.preventDefault();
                        handleBackToList();
                    }}
                    sx={{ cursor: 'pointer', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                    Locations
                </Typography>
                <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Typography variant="body2" fontWeight={500}>{location ? location.name : 'New Location'}</Typography>
            </Stack>

            <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="h5" fontWeight={600}>{location ? 'Edit Location' : 'New Location'}</Typography>
                    {location && (
                        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                            <Tab label="General" />
                            <Tab icon={<HistoryIcon />} label="History" />
                        </Tabs>
                    )}
                </Box>

                {activeTab === 0 ? (
                    <>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                                            autoFocus
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
                                {/* The lock guards a slug that is already a public URL, so
                                    it only engages when editing: a location's slug is in
                                    the sitemap and in any shared or indexed link, and since
                                    #404 a stale one returns a hard 404. Creating leaves the
                                    field open — there is nothing to protect yet, and the
                                    slug is worth seeing at the one moment it is being set.
                                    Nothing here derives the slug from the name; on a new
                                    location the backend does that when the field is left
                                    empty, and on an existing one the slug stays put. */}
                                <TextField
                                    label="Slug"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    fullWidth
                                    disabled={!slugUnlocked}
                                    placeholder={isEditing ? undefined : 'auto-generated from the name if left empty'}
                                    helperText={
                                        isEditing
                                            ? (slugUnlocked
                                                ? 'Changing the slug breaks existing bookmarks and shared links.'
                                                : undefined)
                                            : 'Leave empty to generate one from the name.'
                                    }
                                    InputProps={{
                                        endAdornment: isEditing ? (
                                            <Tooltip
                                                title={
                                                    slugUnlocked
                                                        ? 'Lock slug'
                                                        : 'Changing the slug will break any existing bookmarks or shared links to this location. Click to unlock.'
                                                }
                                            >
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setSlugUnlocked(v => !v)}
                                                    color={slugUnlocked ? 'warning' : 'default'}
                                                >
                                                    {slugUnlocked ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                                                </IconButton>
                                            </Tooltip>
                                        ) : undefined,
                                    }}
                                />
                                <TextField
                                    label="Name (EN)"
                                    value={nameEn}
                                    onChange={(e) => setNameEn(e.target.value)}
                                    fullWidth
                                    placeholder="English name"
                                />
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                    <BilingualTextField
                                        label="Description"
                                        valueIs={description}
                                        valueEn={descriptionEn}
                                        onChangeIs={(v) => setDescription(v)}
                                        onChangeEn={(v) => setDescriptionEn(v)}
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
                            {/* Grown past the old dialog's fixed 400px box (#557) — a page has the width
                                and height to spare, and the boundary polygon editor benefits from both. */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Box sx={{ height: { xs: 360, sm: 460, md: 640 }, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'action.hover', pl: 1 }}>
                                        <Typography variant="caption">
                                            Click on the map to set location coordinates
                                            {boundaryLoading && ' — loading boundary…'}
                                        </Typography>
                                        {matchedMunicipalityBoundary && (
                                            <Button size="small" onClick={handleLoadOfficialBoundary}>
                                                Load official boundary
                                            </Button>
                                        )}
                                    </Box>
                                    <MapContainer
                                        center={[64.1265, -21.8174]}
                                        zoom={7}
                                        style={{ flex: 1, width: '100%' }}
                                    >
                                        <TileLayer
                                            attribution={
                                                officialBoundaryDisplayed
                                                    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors. Contains data from Náttúrufræðistofnun / Landmælingar Íslands (IS 50V), CC BY 4.0.'
                                                    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                            }
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
                                        <BoundaryEditor
                                            boundaryGeoJson={boundaryGeoJson}
                                            onBoundaryChange={setBoundaryGeoJson}
                                            onUserDrewNewShape={handleUserDrewNewShape}
                                            onBoundaryRemoved={handleBoundaryRemoved}
                                        />
                                    </MapContainer>
                                </Box>
                                {boundaryIntersectWarning && matchedMunicipalityBoundary && (
                                    <Alert severity="warning">
                                        This boundary doesn't overlap {matchedMunicipalityBoundary.properties.name}'s official boundary — check before saving.
                                    </Alert>
                                )}
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
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: 1, borderColor: 'divider', pt: 2 }}>
                {activeTab === 0 ? (
                    <Button
                        startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
                        disabled={translating || (!name.trim() && !description.trim())}
                        onClick={async () => {
                            const [nameEnResult, descEnResult] = await translate([name, description]);
                            if (nameEnResult) setNameEn(nameEnResult);
                            if (descEnResult) setDescriptionEn(descEnResult);
                        }}
                    >
                        Translate to EN
                    </Button>
                ) : <Box />}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button onClick={handleBackToList}>Cancel</Button>
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
                </Box>
            </Box>
        </Box>
    );
}

export default function LocationDetailPage(props: { onNotify: (message: string, severity: 'success' | 'error') => void }) {
    return (
        <BilingualLangProvider>
            <LocationDetailPageInner {...props} />
        </BilingualLangProvider>
    );
}
