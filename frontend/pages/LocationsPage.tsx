import { useMemo, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    ToggleButtonGroup,
    ToggleButton,
    Tooltip,
    alpha,
    useTheme
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MapIcon from '@mui/icons-material/Map';
import ViewListIcon from '@mui/icons-material/ViewList';
import { MapContainer, TileLayer, Marker, Tooltip as LeafletTooltip, useMap, LayersControl } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import Layout from '../components/Layout';
import { useLocations, Location } from '../hooks/useLocations';
import { useTrails, Trail } from '../hooks/useTrails';
import RunningLoader from '../components/RunningLoader';

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

function FitBounds({ locations }: { locations: Location[] }) {
    const map = useMap();
    const withCoords = locations.filter(l => l.latitude && l.longitude);
    if (withCoords.length > 0) {
        const bounds = L.latLngBounds(withCoords.map(l => [l.latitude!, l.longitude!] as [number, number]));
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }
    return null;
}

type LocationsPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function LocationsPage({ mode, onToggleMode }: LocationsPageProps) {
    const { t } = useTranslation();
    const { locations, loading, error } = useLocations();
    const { trails } = useTrails();
    const navigate = useNavigate();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<SortField>('trails');
    const [showMap, setShowMap] = useState(true);
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
                l.type.toLowerCase().includes(q) ||
                l.description?.toLowerCase().includes(q)
            );
        }
        result.sort((a, b) => {
            const sa = statsMap[a.slug];
            const sb = statsMap[b.slug];
            if (sortBy === 'trails') return (sb?.trailCount || 0) - (sa?.trailCount || 0);
            if (sortBy === 'distance') return (sb?.totalKm || 0) - (sa?.totalKm || 0);
            return a.name.localeCompare(b.name, 'is');
        });
        return result;
    }, [locations, search, sortBy, statsMap]);

    const locationsWithCoords = useMemo(() =>
        filtered.filter(l => l.latitude && l.longitude),
        [filtered]
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
                    <Alert severity="error">{error}</Alert>
                </Container>
            </Layout>
        );
    }

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="md" sx={{ py: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
                    {t('locations.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('locations.subtitle', { locationCount: locations.length, trailCount: trails.length })}
                </Typography>

                {/* Map Hero */}
                {showMap && locationsWithCoords.length > 0 && (
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
                                            <Typography variant="caption" fontWeight="bold">{loc.name}</Typography>
                                            <Typography variant="caption" display="block" color="text.secondary">
                                                {count} {count === 1 ? 'trail' : 'trails'}
                                            </Typography>
                                        </LeafletTooltip>
                                    </Marker>
                                );
                            })}
                            </MarkerClusterGroup>
                            <FitBounds locations={locationsWithCoords} />
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
                        <ToggleButton value="map"><Tooltip title={t('locations.showMap')}><MapIcon sx={{ fontSize: 18 }} /></Tooltip></ToggleButton>
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
                                        sx={{
                                            borderRadius: '16px',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease, outline 0.3s ease',
                                            '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
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
                                                        {loc.name}
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
                                                {loc.description && (
                                                    <Typography variant="body2" color="text.secondary" sx={{
                                                        mb: 1.5,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                    }}>
                                                        {loc.description}
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
                    <Box textAlign="center" py={8}>
                        <Typography color="text.secondary">
                            {search ? t('locations.noMatch') : t('locations.noLocations')}
                        </Typography>
                    </Box>
                )}
            </Container>
        </Layout>
    );
}
