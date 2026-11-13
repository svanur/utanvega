import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import {
    Container,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    CardActionArea,
    Alert,
    PaletteMode,
    Chip,
    Stack,
    TextField,
    InputAdornment,
    IconButton,
    ToggleButtonGroup,
    ToggleButton,
    Tooltip,
    alpha,
    useTheme
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import SortIcon from '@mui/icons-material/Sort';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ViewListIcon from '@mui/icons-material/ViewList';
import { MapContainer, TileLayer, Marker, Polygon, Tooltip as LeafletTooltip, useMap, LayersControl } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import Layout from '../components/Layout';
import { MapAttributionSync } from '../components/TrailMapView';
import { LeafletTooltipThemeStyles } from '../components/LeafletTooltipStyles';
import { geoJsonBoundaryToLatLngParts, getBoundaryPathOptions, SIMPLEMAPS_CC_BY_ATTRIBUTION } from '../components/locationBoundary';
import { computeFitBoundsPoints } from './locationsFitBounds';
import { useLocations, Location } from '../hooks/useLocations';
import { useLocalize } from '../utils/localize';
import { useTrails, Trail } from '../hooks/useTrails';
import RunningLoader from '../components/RunningLoader';
import { toUserFriendlyFetchError } from '../utils/apiErrors';

const activityEmoji: Record<string, string> = {
    hiking: '🥾',
    trailrunning: '🏃‍♀️',
    running: '🏃‍♂️',
    cycling: '🚴',
};

const difficultyColors: Record<string, string> = {
    Easy: '#4caf50',
    Moderate: '#ff9800',
    Hard: '#f44336',
    Expert: '#9c27b0',
    Extreme: '#212121',
};

interface LocationStats {
    trailCount: number;
    totalKm: number;
    totalElevationGain: number;
    activityCounts: Record<string, number>;
    difficulties: Record<string, number>;
    topDifficulty: string | null;
}

function computeLocationStats(trails: Trail[], locationSlug: string): LocationStats {
    const matching = trails.filter(t =>
        t.locations.some(l => l.slug === locationSlug)
    );
    const activityCounts: Record<string, number> = {};
    const difficulties: Record<string, number> = {};
    let totalKm = 0;
    let totalElevationGain = 0;

    for (const t of matching) {
        totalKm += t.length / 1000;
        totalElevationGain += t.elevationGain;
        const act = t.activityType?.toLowerCase() || 'unknown';
        activityCounts[act] = (activityCounts[act] || 0) + 1;
        if (t.difficulty) {
            difficulties[t.difficulty] = (difficulties[t.difficulty] || 0) + 1;
        }
    }

    const diffOrder = ['Extreme', 'Expert', 'Hard', 'Moderate', 'Easy'];
    const topDifficulty = diffOrder.find(d => difficulties[d]) || null;

    return {
        trailCount: matching.length,
        totalKm: Math.round(totalKm * 10) / 10,
        totalElevationGain: Math.round(totalElevationGain),
        activityCounts,
        difficulties,
        topDifficulty,
    };
}

type SortField = 'trails' | 'distance' | 'name';

// #1740: takes the full (unfiltered-by-coords) location list so a boundary-only location (no
// lat/long yet, e.g. the first one added via #1705 without a center point) still reaches the
// fit-bounds calc — today it's rendered via locationsWithBoundary's own Polygon layer below but
// never counted here, so the map's initial view can sit anywhere relative to it.
// #1786: mirrors TrailMapView's ChangeView — fitBounds must run from a useEffect keyed on the
// computed bounds, not directly in the render body, or every re-render (e.g. hoveredSlug changing
// on Polygon mouseover/mouseout, #1708) resets the user's zoom/pan. `bounds` is memoized off
// `locations` alone, so hover-only state changes elsewhere in LocationsPage don't recompute it.
function FitBounds({ locations }: { locations: Location[] }) {
    const map = useMap();
    const bounds = useMemo(() => {
        const points = computeFitBoundsPoints(locations);
        if (points.length === 0) return null;
        const b = L.latLngBounds(points);
        return b.isValid() ? b : null;
    }, [locations]);

    useEffect(() => {
        if (bounds) {
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }, [bounds, map]);

    return null;
}

type LocationsPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function LocationsPage({ mode, onToggleMode }: LocationsPageProps) {
    const { t } = useTranslation();
    usePageTitle(t('nav.locations'));
    const localize = useLocalize();
    const { locations, loading, error } = useLocations();
    const { trails } = useTrails();
    const navigate = useNavigate();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<SortField>('trails');
    const [showMap, setShowMap] = useState(true);
    // #1708: shared between the map's boundary Polygon layer and the list Cards — hovering (or
    // tapping, via click) either one highlights both, independent of MarkerClusterGroup's own
    // marker state.
    const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const statsMap = useMemo(() => {
        const m: Record<string, LocationStats> = {};
        for (const loc of locations) {
            m[loc.slug] = computeLocationStats(trails, loc.slug);
        }
        return m;
    }, [locations, trails]);

    const filtered = useMemo(() => {
        let result = [...locations];
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(l =>
                l.name.toLowerCase().includes(q) ||
                (l.nameEn?.toLowerCase().includes(q) ?? false) ||
                l.type.toLowerCase().includes(q) ||
                l.description?.toLowerCase().includes(q) ||
                (l.descriptionEn?.toLowerCase().includes(q) ?? false)
            );
        }
        result.sort((a, b) => {
            const sa = statsMap[a.slug];
            const sb = statsMap[b.slug];
            if (sortBy === 'trails') return (sb?.trailCount || 0) - (sa?.trailCount || 0);
            if (sortBy === 'distance') return (sb?.totalKm || 0) - (sa?.totalKm || 0);
            return (localize(a.name, a.nameEn) ?? a.name).localeCompare(localize(b.name, b.nameEn) ?? b.name, 'is');
        });
        return result;
    }, [locations, search, sortBy, statsMap, localize]);

    const locationsWithCoords = useMemo(() =>
        filtered.filter(l => l.latitude && l.longitude),
        [filtered]
    );

    // #1708: locations with a saved boundary (#1705), rendered as Polygon outlines on the index
    // map alongside (not instead of) the dot markers above.
    const locationsWithBoundary = useMemo(() =>
        filtered.filter(l => l.boundaryGeoJson),
        [filtered]
    );

    // #1764: a landsvæði Region boundary is simplemaps.com (CC BY 4.0) — show that credit whenever
    // one is among the shapes currently rendered, same attribution shown on LocationDetailsPage.
    const hasSimplemapsBoundary = useMemo(() =>
        locationsWithBoundary.some(l => l.type === 'Region'),
        [locationsWithBoundary]
    );

    const scrollToCard = useCallback((slug: string) => {
        const el = cardRefs.current[slug];
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Direct DOM highlight — more reliable than React state
        const card = el.querySelector('.MuiCard-root') as HTMLElement;
        if (card) {
            card.style.outline = `3px solid ${theme.palette.primary.main}`;
            card.style.boxShadow = `0 0 16px rgba(25, 118, 210, 0.4)`;
            card.style.transform = 'scale(1.02)';
            setTimeout(() => {
                card.style.outline = '';
                card.style.boxShadow = '';
                card.style.transform = '';
            }, 3000);
        }
    }, [theme.palette.primary.main]);

    const getCircleColor = (loc: Location) => {
        const stats = statsMap[loc.slug];
        if (!stats || stats.trailCount === 0) return theme.palette.grey[400];
        if (stats.trailCount >= 5) return theme.palette.primary.main;
        if (stats.trailCount >= 2) return theme.palette.secondary.main;
        return theme.palette.info.main;
    };

    if (loading) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                    <RunningLoader />
                </Box>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Container sx={{ mt: 4 }}>
                    <Alert severity="error">{toUserFriendlyFetchError(error, t('common.dataLoadUnavailable'))}</Alert>
                </Container>
            </Layout>
        );
    }

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.trails'), to: '/trails' }, { label: t('nav.locations') }]}>
            <Container maxWidth="md" sx={{ py: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOnIcon sx={{ fontSize: 32, color: theme.palette.primary.main }} />
                    {t('locations.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('locations.subtitle', { locationCount: locations.length, trailCount: trails.length })}
                </Typography>

                {/* Map Hero */}
                {/* #1754: gate on boundary-only locations too (#1708), not just coord-bearing ones,
                    so an all-boundary-only dataset still mounts the map (markers, Polygon outlines, FitBounds). */}
                {showMap && (locationsWithCoords.length > 0 || locationsWithBoundary.length > 0) && (
                    <Box sx={{
                        height: { xs: 260, sm: 350 },
                        borderRadius: '16px',
                        overflow: 'hidden',
                        mb: 3,
                        border: `1px solid ${theme.palette.divider}`,
                    }}>
                        <MapContainer
                            center={[64.9, -18.5]}
                            zoom={6}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                        >
                            {/* #1781: dark-mode-aware override for Leaflet's hardcoded-white .leaflet-tooltip */}
                            <LeafletTooltipThemeStyles theme={theme} />
                            <MapAttributionSync text={hasSimplemapsBoundary ? SIMPLEMAPS_CC_BY_ATTRIBUTION : null} />
                            <LayersControl key={isDark ? 'dark' : 'light'} position="topleft">
                                <LayersControl.BaseLayer checked={!isDark} name={t('map.street')}>
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                </LayersControl.BaseLayer>
                                <LayersControl.BaseLayer checked={isDark} name={t('map.dark')}>
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
                                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                    />
                                </LayersControl.BaseLayer>
                                <LayersControl.BaseLayer name={t('map.topo')}>
                                    <TileLayer
                                        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                                        attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                                        maxZoom={17}
                                    />
                                </LayersControl.BaseLayer>
                            </LayersControl>
                            <MarkerClusterGroup
                                chunkedLoading
                                maxClusterRadius={40}
                                spiderfyOnMaxZoom
                                showCoverageOnHover={false}
                            >
                            {locationsWithCoords.map(loc => {
                                const stats = statsMap[loc.slug];
                                const count = stats?.trailCount || 0;
                                const color = getCircleColor(loc);
                                const icon = L.divIcon({
                                    className: '',
                                    html: `<div style="
                                        background: ${color};
                                        width: 28px; height: 28px;
                                        border-radius: 50%;
                                        border: 2px solid white;
                                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                                        display: flex; align-items: center; justify-content: center;
                                        color: white; font-weight: 700; font-size: 11px;
                                    ">${count}</div>`,
                                    iconSize: [28, 28],
                                    iconAnchor: [14, 14],
                                });
                                return (
                                    <Marker
                                        key={loc.id}
                                        position={[loc.latitude!, loc.longitude!]}
                                        icon={icon}
                                        eventHandlers={{
                                            click: () => scrollToCard(loc.slug),
                                        }}
                                    >
                                        <LeafletTooltip direction="top" offset={[0, -14]}>
                                            <Typography variant="caption" fontWeight="bold">{localize(loc.name, loc.nameEn) ?? loc.name}</Typography>
                                            <Typography variant="caption" display="block" color="text.secondary">
                                                {count} {count === 1 ? 'trail' : 'trails'}
                                            </Typography>
                                        </LeafletTooltip>
                                    </Marker>
                                );
                            })}
                            </MarkerClusterGroup>
                            {/* #1708: boundary outlines — a separate layer outside MarkerClusterGroup
                                so shapes never join/affect dot-marker clustering. Interactive (unlike
                                TrailMapView's static context polygon): hover/tap highlights the shape
                                and its list card together. */}
                            {locationsWithBoundary.flatMap(loc => {
                                const parts = geoJsonBoundaryToLatLngParts(loc.boundaryGeoJson!);
                                if (!parts) return [];
                                const isHovered = hoveredSlug === loc.slug;
                                // #1739: one <Polygon> per part so a MultiPolygon boundary (e.g. an
                                // exclave) renders as several disconnected outlines, all sharing the
                                // same hover/click handlers so hovering/clicking any part highlights
                                // the same location card.
                                return parts.map((part, index) => (
                                    <Polygon
                                        key={`boundary-${loc.id}-${index}`}
                                        positions={part}
                                        pathOptions={getBoundaryPathOptions(theme, isHovered)}
                                        eventHandlers={{
                                            mouseover: () => setHoveredSlug(loc.slug),
                                            mouseout: () => setHoveredSlug(null),
                                            click: () => scrollToCard(loc.slug),
                                        }}
                                    >
                                        <LeafletTooltip direction="center" sticky>
                                            <Typography variant="caption" fontWeight="bold">{localize(loc.name, loc.nameEn) ?? loc.name}</Typography>
                                        </LeafletTooltip>
                                    </Polygon>
                                ));
                            })}
                            <FitBounds locations={filtered} />
                        </MapContainer>
                    </Box>
                )}

                {/* Search & Sort Bar */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <TextField
                        size="small"
                        placeholder={t('locations.searchPlaceholder')}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        sx={{ flex: 1 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                            endAdornment: search ? (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        onClick={() => setSearch('')}
                                        aria-label={t('common.clear', 'Clear search')}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : undefined,
                        }}
                    />
                    <ToggleButtonGroup
                        size="small"
                        value={sortBy}
                        exclusive
                        onChange={(_, v) => v && setSortBy(v)}
                    >
                        <ToggleButton value="trails">
                            <Tooltip title={t('locations.sortByTrails')}><SortIcon sx={{ fontSize: 18 }} /></Tooltip>
                        </ToggleButton>
                        <ToggleButton value="name">
                            <Tooltip title={t('locations.sortAlphabetically')}><Typography variant="caption" sx={{ fontWeight: 'bold', lineHeight: 1 }}>AÖ</Typography></Tooltip>
                        </ToggleButton>
                    </ToggleButtonGroup>
                    <ToggleButtonGroup
                        size="small"
                        value={showMap ? 'map' : 'list'}
                        exclusive
                        onChange={(_, v) => v && setShowMap(v === 'map')}
                    >
                        <ToggleButton value="map"><Tooltip title={t('locations.showMap')}><PlaceOutlinedIcon sx={{ fontSize: 18 }} /></Tooltip></ToggleButton>
                        <ToggleButton value="list"><Tooltip title={t('locations.hideMap')}><ViewListIcon sx={{ fontSize: 18 }} /></Tooltip></ToggleButton>
                    </ToggleButtonGroup>
                </Stack>

                {/* Location Cards */}
                <Grid container spacing={2}>
                    {filtered.map(loc => {
                        const stats = statsMap[loc.slug];
                        return (
                            <Grid item xs={12} sm={6} key={loc.id}>
                                <div ref={el => { cardRefs.current[loc.slug] = el; }}>
                                    <Card
                                        elevation={2}
                                        onMouseEnter={() => setHoveredSlug(loc.slug)}
                                        onMouseLeave={() => setHoveredSlug(null)}
                                        sx={{
                                            borderRadius: '16px',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease, outline 0.3s ease',
                                            '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
                                            // #1708: mirrors the map boundary Polygon's hover state back onto
                                            // the card, so hovering either one highlights both together.
                                            ...(hoveredSlug === loc.slug && {
                                                outline: `3px solid ${theme.palette.secondary.main}`,
                                                boxShadow: 6,
                                            }),
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                        }}
                                    >
                                        <CardActionArea
                                            onClick={() => navigate(`/locations/${loc.slug}`)}
                                            sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                                        >
                                            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                {/* Header */}
                                                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                                                    <LocationOnIcon color="primary" />
                                                    <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.3 }}>
                                                        {localize(loc.name, loc.nameEn) ?? loc.name}
                                                    </Typography>
                                                </Stack>

                                                {/* Type & Parent */}
                                                <Stack direction="row" spacing={0.5} mb={1} flexWrap="wrap">
                                                    <Chip label={t(`locations.type${loc.type}`)} size="small" variant="outlined" color="secondary" />
                                                    {loc.parentName && (
                                                        <Chip label={loc.parentName} size="small" variant="outlined" />
                                                    )}
                                                </Stack>

                                                {/* Description */}
                                                {(loc.description || loc.descriptionEn) && (
                                                    <Typography variant="body2" color="text.secondary" sx={{
                                                        mb: 1.5,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                    }}>
                                                        {localize(loc.description, loc.descriptionEn)}
                                                    </Typography>
                                                )}

                                                {/* Stats (pushed to bottom) */}
                                                <Box sx={{ mt: 'auto' }}>
                                                    {/* Activity Breakdown */}
                                                    {stats && Object.keys(stats.activityCounts).length > 0 && (
                                                        <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" useFlexGap>
                                                            {Object.entries(stats.activityCounts).map(([act, count]) => (
                                                                <Chip
                                                                    key={act}
                                                                    label={`${activityEmoji[act] || '🏞️'} ${count}`}
                                                                    size="small"
                                                                    sx={{
                                                                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                                        fontWeight: 500,
                                                                        fontSize: '0.75rem',
                                                                    }}
                                                                />
                                                            ))}
                                                        </Stack>
                                                    )}

                                                    {/* Difficulty dots */}
                                                    {stats && Object.keys(stats.difficulties).length > 0 && (
                                                        <Stack direction="row" spacing={0.5} mb={1} alignItems="center">
                                                            {['Easy', 'Moderate', 'Hard', 'Expert', 'Extreme']
                                                                .filter(d => stats.difficulties[d])
                                                                .map(d => (
                                                                    <Tooltip key={d} title={`${d}: ${stats.difficulties[d]}`}>
                                                                        <Box sx={{
                                                                            width: 8,
                                                                            height: 8,
                                                                            borderRadius: '50%',
                                                                            bgcolor: difficultyColors[d],
                                                                        }} />
                                                                    </Tooltip>
                                                                ))}
                                                        </Stack>
                                                    )}

                                                    {/* Summary line */}
                                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                                            {stats?.trailCount || loc.trailsCount} {t('locations.trails')}
                                                        </Typography>
                                                        {stats && stats.totalKm > 0 && (
                                                            <>
                                                                <Typography variant="caption" color="text.secondary">·</Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {stats.totalKm} km
                                                                </Typography>
                                                            </>
                                                        )}
                                                        {stats && stats.totalElevationGain > 0 && (
                                                            <>
                                                                <Typography variant="caption" color="text.secondary">·</Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    ↑ {stats.totalElevationGain} m
                                                                </Typography>
                                                            </>
                                                        )}
                                                        {loc.childrenCount > 0 && (
                                                            <>
                                                                <Typography variant="caption" color="text.secondary">·</Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {t('locations.subLocations', { count: loc.childrenCount })}
                                                                </Typography>
                                                            </>
                                                        )}
                                                    </Stack>
                                                </Box>
                                            </CardContent>
                                        </CardActionArea>
                                    </Card>
                                </div>
                            </Grid>
                        );
                    })}
                </Grid>

                {filtered.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <LocationOnIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                            {search ? t('locations.noMatch') : t('locations.noLocations')}
                        </Typography>
                    </Box>
                )}
            </Container>
        </Layout>
    );
}
