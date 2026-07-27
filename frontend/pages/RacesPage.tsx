import { lazy, Suspense, useMemo, useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Container,
    Typography,
    Box,
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
    alpha,
    useTheme,
    ToggleButtonGroup,
    ToggleButton,
    Tooltip,
    CircularProgress,
    Button,
    Collapse,
    Badge,
    FormControlLabel,
    Checkbox,
    Divider,
    Autocomplete,
    Fade,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ListIcon from '@mui/icons-material/List';
import MapIcon from '@mui/icons-material/Map';
import TableChartIcon from '@mui/icons-material/TableChart';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FilterListIcon from '@mui/icons-material/FilterList';
import ShareIcon from '@mui/icons-material/Share';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import RefreshIcon from '@mui/icons-material/Refresh';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import GrassIcon from '@mui/icons-material/Grass';
import LandscapeIcon from '@mui/icons-material/Landscape';
import NearMeIcon from '@mui/icons-material/NearMe';
import Layout from '../components/Layout';
import PartnerLinks from '../components/PartnerLinks';
import RandomQuote from '../components/RandomQuote';
import RunningLoader from '../components/RunningLoader';
import EventDateBadge from '../components/EventDateBadge';
import SwipeableCard from '../components/SwipeableCard';
import RaceShareCard from '../components/RaceShareCard';
import RaceFinishCard from '../components/RaceFinishCard';
import VideocamIcon from '@mui/icons-material/Videocam';
import { useEvents, type EventSummary, type SeriesRaceDto } from '../hooks/useEvents';
import { downloadIcs } from '../utils/calendarLinks';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { toUserFriendlyFetchError } from '../utils/apiErrors';
import { getTicketStatusColor, groupDistances } from '../utils/ticketStatus';
import { formatNextDate, getCountdownColor, getCountdownLabel, getEventTypeColor } from '../utils/eventUtils';
import { haversineKm, formatDistanceKm } from '../utils/geo';

const EventTableView = lazy(() => import('../components/EventTableView'));
const EventMapView = lazy(() => import('../components/EventMapView'));

type ViewMode = 'list' | 'map' | 'table';


type RacesPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
    showQuote?: boolean;
};


interface EventFilters {
    activityTypes: string[];
    eventTypes: string[];
    months: number[];
    locations: string[];
    itraAny: boolean;
    itraPoints: number[];
    certifications: string[];
    championships: string[];
    weekendOnly: boolean;
}

const DEFAULT_FILTERS: EventFilters = {
    activityTypes: [],
    eventTypes: [],
    months: [],
    locations: [],
    itraAny: false,
    itraPoints: [],
    certifications: [],
    championships: [],
    weekendOnly: false,
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
    TrailRunning: <LandscapeIcon fontSize="small" />,
    Running: <DirectionsRunIcon fontSize="small" />,
    Hiking: <HikingIcon fontSize="small" />,
    Cycling: <DirectionsBikeIcon fontSize="small" />,
    FunRun: <CelebrationIcon fontSize="small" />,
    ObstacleCourse: <FitnessCenterIcon fontSize="small" />,
    CrossCountryRun: <GrassIcon fontSize="small" />,
};

export default function RacesPage({ mode, onToggleMode, showQuote = false }: RacesPageProps) {
    const { t } = useTranslation();
    const { events, loading, error, refresh } = useEvents();
    const { isEnabled } = useFeatureFlags();
    const navigate = useNavigate();
    const theme = useTheme();
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS);
    const [shareEventId, setShareEventId] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationDenied, setLocationDenied] = useState(false);
    const [distanceSortActive, setDistanceSortActive] = useState(false);
    const [pullOffset, setPullOffset] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [showSwipeHint, setShowSwipeHint] = useState(false);
    const touchStartY = useRef<number | null>(null);
    const PULL_THRESHOLD = 80;

    const handlePullStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY;
    };
    const handlePullMove = (e: React.TouchEvent) => {
        if (touchStartY.current === null || refreshing) return;
        const delta = e.touches[0].clientY - touchStartY.current;
        if (delta > 0) setPullOffset(Math.min(delta * 0.4, PULL_THRESHOLD + 20));
    };
    const handlePullEnd = async () => {
        if (pullOffset >= PULL_THRESHOLD) {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
        }
        setPullOffset(0);
        touchStartY.current = null;
    };

    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            err => { if (err.code === err.PERMISSION_DENIED) setLocationDenied(true); },
        );
    }, []);

    const handleDistanceSort = () => {
        if (distanceSortActive) {
            setDistanceSortActive(false);
            return;
        }
        if (userLocation) {
            setDistanceSortActive(true);
            return;
        }
        if (!navigator.geolocation) return;
        setLocationLoading(true);
        navigator.geolocation.getCurrentPosition(
            pos => {
                setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocationDenied(false);
                setDistanceSortActive(true);
                setLocationLoading(false);
            },
            err => {
                if (err.code === err.PERMISSION_DENIED) setLocationDenied(true);
                setLocationLoading(false);
            },
        );
    };

    // One-time swipe hint: show a brief peek animation on the first upcoming card
    useEffect(() => {
        try {
            if (localStorage.getItem('utanvega-swipe-hint-seen')) return;
        } catch { return; }
        const timer = setTimeout(() => {
            setShowSwipeHint(true);
            setTimeout(() => {
                setShowSwipeHint(false);
                try { localStorage.setItem('utanvega-swipe-hint-seen', '1'); } catch { /* */ }
            }, 800);
        }, 1200);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [searchParams, setSearchParams] = useSearchParams();
    const viewModeFromUrl = searchParams.get('view');
    const viewMode: ViewMode = (viewModeFromUrl === 'list' || viewModeFromUrl === 'map' || viewModeFromUrl === 'table')
        ? viewModeFromUrl
        : (() => { try { const s = localStorage.getItem('utanvega-events-view-mode'); return (s === 'list' || s === 'map' || s === 'table') ? s : 'list'; } catch { return 'list'; } })();
    const setViewMode = (v: ViewMode) => {
        setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('view', v); return next; }, { replace: true });
        try { localStorage.setItem('utanvega-events-view-mode', v); } catch { /* */ }
    };

    const activeFilterCount = useMemo(() =>
        filters.activityTypes.length +
        filters.eventTypes.length +
        (filters.months.length > 0 ? 1 : 0) +
        filters.locations.length +
        (filters.itraAny ? 1 : filters.itraPoints.length) +
        filters.certifications.length +
        filters.championships.length +
        (filters.weekendOnly ? 1 : 0),
    [filters]);

    const filterOptions = useMemo(() => {
        const visible = events.filter(e => e.status !== 'Hidden' && e.status !== 'Unlisted');
        const activityTypes = [...new Set(visible.map(e => e.activityType))].sort();
        const eventTypes = [...new Set(visible.map(e => e.type))].sort();
        const locations = [...new Set(visible.map(e => e.locationName).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'is'));
        const certifications = [...new Set(visible.flatMap(e => e.certifications ?? []))].sort();
        const championships = [...new Set(visible.flatMap(e => e.championshipCategories ?? []))].sort();
        return { activityTypes, eventTypes, locations, certifications, championships };
    }, [events]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        let result = events.filter(c => c.status !== 'Hidden' && c.status !== 'Unlisted');

        if (q) {
            result = result.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.locationName?.toLowerCase().includes(q)) ||
                (c.organizerName?.toLowerCase().includes(q))
            );
        }

        if (filters.locations.length > 0) {
            result = result.filter(c => c.locationName && filters.locations.includes(c.locationName));
        }

        if (filters.months.length > 0) {
            result = result.filter(c => {
                const d = c.displayDate ?? c.nextEditionDate;
                if (!d) return false;
                return filters.months.includes(new Date(d + 'T00:00:00').getMonth());
            });
        }

        if (filters.activityTypes.length > 0) {
            result = result.filter(c => filters.activityTypes.includes(c.activityType));
        }
        if (filters.eventTypes.length > 0) {
            result = result.filter(c => filters.eventTypes.includes(c.type));
        }
        if (filters.itraAny) {
            result = result.filter(c => c.itraPoints && c.itraPoints.length > 0);
        } else if (filters.itraPoints.length > 0) {
            result = result.filter(c => c.itraPoints?.some(p => filters.itraPoints.includes(p)));
        }
        if (filters.certifications.length > 0) {
            result = result.filter(c => c.certifications?.some(cert => filters.certifications.includes(cert)));
        }
        if (filters.championships.length > 0) {
            result = result.filter(c => c.championshipCategories?.some(ch => filters.championships.includes(ch)));
        }
        if (filters.weekendOnly) {
            result = result.filter(c => {
                const d = c.displayDate ?? c.nextEditionDate;
                if (!d) return false;
                const day = new Date(d + 'T00:00:00').getDay();
                return day === 0 || day === 6;
            });
        }

        // Sort: Active/Upcoming first, Cancelled last; then by upcoming date, then name
        result.sort((a, b) => {
            const cancelledA = a.status === 'Cancelled' ? 1 : 0;
            const cancelledB = b.status === 'Cancelled' ? 1 : 0;
            if (cancelledA !== cancelledB) return cancelledA - cancelledB;

            if (a.daysUntil !== null && b.daysUntil !== null) {
                if (a.daysUntil >= 0 && b.daysUntil >= 0) return a.daysUntil - b.daysUntil;
                if (a.daysUntil >= 0) return -1;
                if (b.daysUntil >= 0) return 1;
                return b.daysUntil - a.daysUntil;
            }
            if (a.daysUntil !== null) return -1;
            if (b.daysUntil !== null) return 1;
            return a.name.localeCompare(b.name, 'is');
        });

        return result;
    }, [events, search, filters]);

    const sortedFiltered = useMemo(() => {
        if (!distanceSortActive || !userLocation) return filtered;
        const getKm = (e: EventSummary) =>
            e.gpxPointLat != null && e.gpxPointLng != null
                ? haversineKm(userLocation.lat, userLocation.lng, e.gpxPointLat, e.gpxPointLng)
                : null;
        return [...filtered].sort((a, b) => {
            const da = getKm(a);
            const db = getKm(b);
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return da - db;
        });
    }, [filtered, distanceSortActive, userLocation]);

    const { justRaced, upcoming } = useMemo(() => {
        const isRecentlyCompleted = (c: EventSummary) =>
            c.daysUntil != null && c.daysUntil < 0 && c.daysUntil >= -3 && c.status !== 'Cancelled';
        const jr = sortedFiltered.filter(isRecentlyCompleted);
        const up = sortedFiltered.filter(c => !isRecentlyCompleted(c));
        return { justRaced: jr, upcoming: up };
    }, [sortedFiltered]);
    type UpcomingRow =
        | { kind: 'event'; comp: EventSummary }
        | { kind: 'series-race'; comp: EventSummary; race: SeriesRaceDto };

    const flattenedUpcoming = useMemo((): UpcomingRow[] => {
        const rows: UpcomingRow[] = [];
        for (const comp of upcoming) {
            if (comp.type === 'Series' && comp.seriesRaces && comp.seriesRaces.length > 0) {
                for (const race of comp.seriesRaces) {
                    rows.push({ kind: 'series-race', comp, race });
                }
            } else {
                rows.push({ kind: 'event', comp });
            }
        }
        if (!distanceSortActive) {
            rows.sort((a, b) => {
                const dateA = a.kind === 'series-race' ? a.race.dateOfRace : (a.comp.displayDate ?? a.comp.nextEditionDate);
                const dateB = b.kind === 'series-race' ? b.race.dateOfRace : (b.comp.displayDate ?? b.comp.nextEditionDate);
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
            });
        }
        return rows;
    }, [upcoming, distanceSortActive]);

    if (loading) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <RunningLoader />
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Container maxWidth="md" sx={{ py: 4 }}>
                    <Alert severity="error">{toUserFriendlyFetchError(error, t('common.dataLoadUnavailable'))}</Alert>
                </Container>
            </Layout>
        );
    }

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} maxWidth={viewMode === 'table' ? 'lg' : 'md'} bottomContent={<PartnerLinks />}>
            {showQuote && isEnabled('random_quote') && <RandomQuote />}
            <Container
                maxWidth={viewMode === 'table' ? 'lg' : 'md'}
                sx={{ py: 3 }}
                onTouchStart={handlePullStart}
                onTouchMove={handlePullMove}
                onTouchEnd={handlePullEnd}
            >
                {/* Pull-to-refresh indicator */}
                <Fade in={pullOffset > 10}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1, height: 32, alignItems: 'center' }}>
                        {refreshing ? (
                            <CircularProgress size={24} />
                        ) : (
                            <RefreshIcon
                                sx={{
                                    fontSize: 28,
                                    color: pullOffset >= PULL_THRESHOLD ? 'primary.main' : 'text.disabled',
                                    transform: `rotate(${(pullOffset / PULL_THRESHOLD) * 360}deg)`,
                                    transition: 'color 0.2s',
                                }}
                            />
                        )}
                    </Box>
                </Fade>
                {/* Header */}
                <Box sx={{ mb: 3 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                        <Typography variant="h4" fontWeight={800} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <EmojiEventsIcon sx={{ fontSize: 32, color: theme.palette.warning.main }} />
                            {t('races.title')}
                        </Typography>
                        <Chip
                            icon={<CalendarTodayIcon />}
                            label={t('calendar.title')}
                            variant="outlined"
                            size="small"
                            onClick={() => navigate('/events/calendar')}
                        />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                        {t('races.subtitle')}
                    </Typography>
                </Box>

                {/* Search + filter icon */}
                <TextField
                    placeholder={t('races.searchPlaceholder')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    fullWidth
                    size="small"
                    sx={{ mb: 1 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <InputAdornment position="end">
                                {search && (
                                    <IconButton size="small" onClick={() => setSearch('')} sx={{ mr: 0.5 }}>
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                )}
                                <Button
                                    size="small"
                                    variant={showFilters || activeFilterCount > 0 ? 'contained' : 'outlined'}
                                    color={activeFilterCount > 0 ? 'primary' : 'inherit'}
                                    onClick={() => setShowFilters(v => !v)}
                                    startIcon={<FilterListIcon fontSize="small" />}
                                    sx={{ textTransform: 'none', borderRadius: 4, px: 1.5, py: 0.5, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                >
                                    {activeFilterCount > 0
                                        ? t('races.filters.activeCount', { count: activeFilterCount })
                                        : t('races.filters.title')}
                                </Button>
                            </InputAdornment>
                        ),
                    }}
                />

                {/* Filter panel */}
                <Collapse in={showFilters}>
                    <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>

                        {/* Location */}
                        {filterOptions.locations.length > 0 && (
                            <Box sx={{ mb: 1.5 }}>
                                <Autocomplete
                                    multiple
                                    size="small"
                                    options={filterOptions.locations}
                                    value={filters.locations}
                                    onChange={(_, value) => setFilters(f => ({ ...f, locations: value }))}
                                    renderInput={params => (
                                        <TextField {...params} label={t('trail.location')} placeholder={filters.locations.length === 0 ? t('races.filters.allLocations', 'All locations') : undefined} />
                                    )}
                                    renderTags={(value, getTagProps) =>
                                        value.map((loc, index) => (
                                            <Chip {...getTagProps({ index })} key={loc} label={loc} size="small" />
                                        ))
                                    }
                                />
                            </Box>
                        )}

                        {/* Activity type */}
                        {filterOptions.activityTypes.length > 0 && (
                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>{t('races.filters.activityType')}</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                    {filterOptions.activityTypes.map(type => {
                                        const selected = filters.activityTypes.includes(type);
                                        return (
                                            <Chip
                                                key={type}
                                                icon={ACTIVITY_ICONS[type] as React.ReactElement | undefined}
                                                label={t(`races.activityTypes.${type}`, type)}
                                                size="small"
                                                variant={selected ? 'filled' : 'outlined'}
                                                color={selected ? 'primary' : 'default'}
                                                onClick={() => setFilters(f => ({
                                                    ...f,
                                                    activityTypes: selected ? f.activityTypes.filter(x => x !== type) : [...f.activityTypes, type],
                                                }))}
                                                sx={{ cursor: 'pointer' }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Box>
                        )}

                        {/* Event type */}
                        {filterOptions.eventTypes.length > 0 && (
                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>{t('races.filters.eventType')}</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                    {filterOptions.eventTypes.map(type => {
                                        const selected = filters.eventTypes.includes(type);
                                        return (
                                            <Chip
                                                key={type}
                                                label={t(`races.eventTypes.${type}`, type)}
                                                size="small"
                                                variant={selected ? 'filled' : 'outlined'}
                                                color={selected ? 'secondary' : 'default'}
                                                onClick={() => setFilters(f => ({
                                                    ...f,
                                                    eventTypes: selected ? f.eventTypes.filter(x => x !== type) : [...f.eventTypes, type],
                                                }))}
                                                sx={{ cursor: 'pointer' }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Box>
                        )}

                        {/* Month */}
                        <Box sx={{ mb: 1.5 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>{t('races.filters.month', 'Month')}</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                <Chip
                                    label={t('races.filters.allMonths', 'All')}
                                    size="small"
                                    variant={filters.months.length === 0 ? 'filled' : 'outlined'}
                                    color={filters.months.length === 0 ? 'primary' : 'default'}
                                    onClick={() => setFilters(f => ({ ...f, months: [] }))}
                                    sx={{ cursor: 'pointer', fontWeight: 600 }}
                                />
                                {(t('races.months', { returnObjects: true }) as string[]).map((name, idx) => {
                                    const selected = filters.months.includes(idx);
                                    return (
                                        <Chip
                                            key={idx}
                                            label={name.slice(0, 3)}
                                            size="small"
                                            variant={selected ? 'filled' : 'outlined'}
                                            color={selected ? 'primary' : 'default'}
                                            onClick={() => setFilters(f => ({
                                                ...f,
                                                months: selected ? f.months.filter(m => m !== idx) : [...f.months, idx],
                                            }))}
                                            sx={{ cursor: 'pointer' }}
                                        />
                                    );
                                })}
                            </Box>
                        </Box>

                        {/* ITRA points */}
                        <Box sx={{ mb: 1.5 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>{t('races.filters.itraPoints')}</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                <Chip
                                    label="ITRA"
                                    size="small"
                                    variant={filters.itraAny ? 'filled' : 'outlined'}
                                    color={filters.itraAny ? 'warning' : 'default'}
                                    onClick={() => setFilters(f => ({
                                        ...f,
                                        itraAny: !f.itraAny,
                                        itraPoints: [],
                                    }))}
                                    sx={{ cursor: 'pointer', fontWeight: 600 }}
                                />
                                {[0, 1, 2, 3, 4, 5].map(pts => {
                                    const selected = !filters.itraAny && filters.itraPoints.includes(pts);
                                    return (
                                        <Chip
                                            key={pts}
                                            label={`ITRA ${pts}`}
                                            size="small"
                                            variant={selected ? 'filled' : 'outlined'}
                                            color={selected ? 'warning' : 'default'}
                                            onClick={() => setFilters(f => ({
                                                ...f,
                                                itraAny: false,
                                                itraPoints: f.itraPoints.includes(pts)
                                                    ? f.itraPoints.filter(x => x !== pts)
                                                    : [...f.itraPoints, pts],
                                            }))}
                                            sx={{ cursor: 'pointer' }}
                                        />
                                    );
                                })}
                            </Box>
                        </Box>

                        {/* Certifications */}
                        {filterOptions.certifications.length > 0 && (
                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>{t('races.filters.certifications')}</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                    {filterOptions.certifications.map(cert => {
                                        const selected = filters.certifications.includes(cert);
                                        return (
                                            <Chip
                                                key={cert}
                                                label={cert}
                                                size="small"
                                                variant={selected ? 'filled' : 'outlined'}
                                                color={selected ? 'secondary' : 'default'}
                                                onClick={() => setFilters(f => ({
                                                    ...f,
                                                    certifications: selected ? f.certifications.filter(x => x !== cert) : [...f.certifications, cert],
                                                }))}
                                                sx={{ cursor: 'pointer' }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Box>
                        )}

                        {/* Championship categories */}
                        {filterOptions.championships.length > 0 && (
                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>{t('races.filters.championships')}</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                    {filterOptions.championships.map(ch => {
                                        const selected = filters.championships.includes(ch);
                                        return (
                                            <Chip
                                                key={ch}
                                                label={ch}
                                                size="small"
                                                variant={selected ? 'filled' : 'outlined'}
                                                color={selected ? 'primary' : 'default'}
                                                onClick={() => setFilters(f => ({
                                                    ...f,
                                                    championships: selected ? f.championships.filter(x => x !== ch) : [...f.championships, ch],
                                                }))}
                                                sx={{ cursor: 'pointer' }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Box>
                        )}

                        <Divider sx={{ my: 1 }} />

                        {/* Weekend only + reset + close row */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={filters.weekendOnly}
                                        onChange={e => setFilters(f => ({ ...f, weekendOnly: e.target.checked }))}
                                    />
                                }
                                label={<Typography variant="body2">{t('races.filters.weekendOnly')}</Typography>}
                            />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                {activeFilterCount > 0 && (
                                    <Button size="small" onClick={() => setFilters(DEFAULT_FILTERS)}>
                                        {t('races.filters.reset')}
                                    </Button>
                                )}
                                <Button size="small" variant="outlined" onClick={() => setShowFilters(false)}>
                                    {t('filters.closeFilters')}
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                </Collapse>

                {/* View toggle + result count */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                            {t('races.editionCount', { count: filtered.length })}
                        </Typography>
                        {navigator.geolocation && (
                            <Tooltip title={
                                locationDenied
                                    ? t('races.nearMe.denied')
                                    : distanceSortActive
                                        ? t('races.nearMe.disable')
                                        : t('races.nearMe.enable')
                            }>
                                <span>
                                    <Button
                                        size="small"
                                        variant={distanceSortActive ? 'contained' : 'outlined'}
                                        color={locationDenied ? 'error' : distanceSortActive ? 'primary' : 'inherit'}
                                        onClick={handleDistanceSort}
                                        startIcon={locationLoading ? <CircularProgress size={14} color="inherit" /> : <NearMeIcon fontSize="small" />}
                                        disabled={locationLoading || locationDenied}
                                        sx={{
                                            textTransform: 'none', borderRadius: 4, px: 1.5, py: 0.5, fontSize: '0.8rem', minWidth: 0,
                                            display: (viewMode === 'map' || viewMode === 'table') ? 'none' : 'inline-flex',
                                        }}
                                    >
                                        {t('races.nearMe.label')}
                                    </Button>
                                </span>
                            </Tooltip>
                        )}
                    </Stack>
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(_, value) => { if (value) setViewMode(value as ViewMode); }}
                        size="small"
                        aria-label={t('home.viewMode')}
                    >
                        <Tooltip title={t('home.listView')}>
                            <ToggleButton value="list" aria-label={t('home.listView')}>
                                <ListIcon fontSize="small" />
                            </ToggleButton>
                        </Tooltip>
                        <Tooltip title={t('home.mapView')}>
                            <ToggleButton value="map" aria-label={t('home.mapView')}>
                                <MapIcon fontSize="small" />
                            </ToggleButton>
                        </Tooltip>
                        <Tooltip title={t('home.tableView')}>
                            <ToggleButton value="table" aria-label={t('home.tableView')}>
                                <TableChartIcon fontSize="small" />
                            </ToggleButton>
                        </Tooltip>
                    </ToggleButtonGroup>
                </Box>

                {/* Views */}
                {viewMode === 'list' ? (
                    filtered.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 8 }}>
                            <EmojiEventsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                {activeFilterCount > 0 ? t('races.filters.noResults') : search ? t('races.noResults') : t('races.empty')}
                            </Typography>
                            {activeFilterCount > 0 && (
                                <Button size="small" sx={{ mt: 1 }} onClick={() => setFilters(DEFAULT_FILTERS)}>
                                    {t('races.filters.reset')}
                                </Button>
                            )}
                        </Box>
                    ) : (
                        <>
                            {justRaced.length > 0 && (
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        🏁 {t('races.justRacedSection', { defaultValue: 'Recently completed' })}
                                    </Typography>
                                    <Stack spacing={1.5}>
                                        {justRaced.map(comp => (
                                            <SwipeableCard
                                                key={comp.id}
                                                onSwipeRight={() => setShareEventId(comp.id)}
                                                revealWidth={0}
                                            >
                                            <Card
                                                sx={{
                                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                                    '&:hover': { transform: 'translateY(-2px)', boxShadow: theme.shadows[4] },
                                                    borderLeft: `4px solid ${theme.palette.success.main}`,
                                                }}
                                            >
                                                <CardActionArea onClick={() => navigate(`/events/${comp.slug}`)}>
                                                    <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                                            <Box>
                                                                <Typography variant="subtitle1" fontWeight={700}>
                                                                    {comp.name}
                                                                </Typography>
                                                                {(comp.displayDate ?? comp.nextEditionDate) && (
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        {formatNextDate((comp.displayDate ?? comp.nextEditionDate)!, t)}
                                                                    </Typography>
                                                                )}
                                                                {userLocation && comp.gpxPointLat != null && comp.gpxPointLng != null && (
                                                                    <Tooltip title={t('races.nearMe.distanceToStart')}>
                                                                        <Chip icon={<NearMeIcon />} label={formatDistanceKm(haversineKm(userLocation.lat, userLocation.lng, comp.gpxPointLat, comp.gpxPointLng))} size="small" variant="outlined" color="primary" sx={{ mt: 0.5 }} />
                                                                    </Tooltip>
                                                                )}
                                                                {comp.distances && comp.distances.length > 0 && (
                                                                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                                                                        {groupDistances(comp.distances).map((d, i) => (
                                                                            <Chip key={i} label={d.count > 1 ? `${d.count} × ${d.label}` : d.label} size="small" variant="outlined" color={getTicketStatusColor(d.ticketStatus)} />
                                                                        ))}
                                                                    </Stack>
                                                                )}
                                                                {comp.resultsUrl && (
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        color="success"
                                                                        href={comp.resultsUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        sx={{ mt: 0.5, textTransform: 'none', fontSize: '0.75rem' }}
                                                                    >
                                                                        {t('races.results', 'Results')}
                                                                    </Button>
                                                                )}
                                                            </Box>
                                                                <Chip
                                                                label={getCountdownLabel(comp.daysUntil, t)}
                                                                color="success"
                                                                size="small"
                                                                sx={{ fontWeight: 700 }}
                                                            />
                                                        </Box>
                                                    </CardContent>
                                                </CardActionArea>
                                            </Card>
                                            </SwipeableCard>
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                            
                        <Stack spacing={2}>
                            {flattenedUpcoming.map((row, idx) => {
                                if (row.kind === 'series-race') {
                                    const { comp, race } = row;
                                    const raceDaysUntil = race.dateOfRace
                                        ? Math.round((new Date(race.dateOfRace + 'T00:00:00').getTime() - Date.now()) / 86400000)
                                        : null;
                                    return (
                                        <SwipeableCard
                                            key={`${comp.id}-${race.raceId}`}
                                            onSwipeRight={race.registrationUrl && raceDaysUntil != null && raceDaysUntil >= 0
                                                ? () => setShareEventId(comp.id)
                                                : undefined
                                            }
                                            leftActions={
                                                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                                    {race.registrationUrl && raceDaysUntil != null && raceDaysUntil >= 0 && (
                                                        <Box
                                                            component="a"
                                                            href={race.registrationUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                            sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'success.main', color: 'white', textDecoration: 'none', gap: 0.5, px: 1, fontSize: '0.7rem', fontWeight: 600 }}
                                                        >
                                                            <OpenInNewIcon sx={{ fontSize: 18 }} />
                                                            {t('races.register', 'Register')}
                                                        </Box>
                                                    )}
                                                    {race.dateOfRace && (
                                                        <Box
                                                            onClick={(e: React.MouseEvent) => {
                                                                e.stopPropagation();
                                                                downloadIcs({
                                                                    title: race.raceName,
                                                                    date: race.dateOfRace!,
                                                                    location: comp.locationName ?? undefined,
                                                                    url: `https://hlaupadagskra.is/events/${comp.slug}`,
                                                                });
                                                            }}
                                                            sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'primary.main', color: 'white', cursor: 'pointer', gap: 0.5, px: 1, fontSize: '0.7rem', fontWeight: 600 }}
                                                        >
                                                            <EventAvailableIcon sx={{ fontSize: 18 }} />
                                                            {t('races.addToCalendar', 'Calendar')}
                                                        </Box>
                                                    )}
                                                </Box>
                                            }
                                            revealWidth={120}
                                        >
                                            <Card sx={{ transition: 'transform 0.15s, box-shadow 0.15s', '&:hover': { transform: 'translateY(-2px)', boxShadow: theme.shadows[4] } }}>
                                                <CardActionArea onClick={() => navigate(`/events/${comp.slug}`)}>
                                                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
                                                            <Box sx={{ flex: 1, minWidth: 200 }}>
                                                                <Typography variant="h6" fontWeight={700}>{race.raceName}</Typography>
                                                                <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                                                                    <Chip label={t(`races.eventTypes.Series`, 'Series')} size="small" color={getEventTypeColor('Series')} variant="outlined" />
                                                                    <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>{comp.name}</Typography>
                                                                    {comp.locationName && (
                                                                        <Chip icon={<LocationOnIcon />} label={comp.locationName} size="small" variant="outlined" />
                                                                    )}
                                                                    <Chip label={t('races.editionCount', { count: comp.editionCount })} size="small" variant="outlined" color="primary" />
                                                                    {userLocation && comp.gpxPointLat != null && comp.gpxPointLng != null && (
                                                                        <Tooltip title={t('races.nearMe.distanceToStart')}>
                                                                            <Chip icon={<NearMeIcon />} label={formatDistanceKm(haversineKm(userLocation.lat, userLocation.lng, comp.gpxPointLat, comp.gpxPointLng))} size="small" variant="outlined" color="primary" />
                                                                        </Tooltip>
                                                                    )}
                                                                </Stack>
                                                                {race.dateOfRace && (
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, flexWrap: 'wrap' }}>
                                                                        <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                                                        <Typography variant="body2" fontWeight={600}>
                                                                            {formatNextDate(race.dateOfRace, t)}
                                                                        </Typography>
                                                                        <EventDateBadge dateStr={race.dateOfRace} />
                                                                    </Box>
                                                                )}
                                                                {race.distanceLabel && (
                                                                    <Stack direction="row" gap={0.5} sx={{ mt: 1 }}>
                                                                        <Chip
                                                                            label={race.distanceLabel}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            color={getTicketStatusColor(race.ticketStatus)}
                                                                        />
                                                                    </Stack>
                                                                )}
                                                                {race.registrationUrl && raceDaysUntil != null && raceDaysUntil >= 0 && (
                                                                    <Stack direction="row" gap={0.5} sx={{ mt: 1 }}>
                                                                        <Button size="small" variant="outlined" href={race.registrationUrl} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} onClick={(e) => e.stopPropagation()} sx={{ textTransform: 'none', fontSize: '0.8rem' }}>
                                                                            {t('races.register', 'Register')}
                                                                        </Button>
                                                                    </Stack>
                                                                )}
                                                            </Box>
                                                            {raceDaysUntil != null && (
                                                                <Chip
                                                                    label={getCountdownLabel(raceDaysUntil, t)}
                                                                    color={getCountdownColor(raceDaysUntil)}
                                                                    variant="filled"
                                                                    size="medium"
                                                                    sx={{ fontWeight: 700, fontSize: '0.9rem', px: 1 }}
                                                                />
                                                            )}
                                                        </Box>
                                                    </CardContent>
                                                </CardActionArea>
                                            </Card>
                                        </SwipeableCard>
                                    );
                                }
                                const comp = row.comp;
                                return (
                                <SwipeableCard
                                    key={comp.id}
                                    peek={idx === 0 && showSwipeHint}
                                    onSwipeRight={comp.status !== 'Cancelled' && comp.daysUntil != null && comp.daysUntil >= 0
                                        ? () => setShareEventId(comp.id)
                                        : undefined
                                    }
                                    leftActions={
                                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                            {comp.registrationUrl && comp.daysUntil != null && comp.daysUntil >= 0 && (
                                                <Box
                                                    component="a"
                                                    href={comp.registrationUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                    sx={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        bgcolor: 'success.main',
                                                        color: 'white',
                                                        textDecoration: 'none',
                                                        gap: 0.5,
                                                        px: 1,
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    <OpenInNewIcon sx={{ fontSize: 18 }} />
                                                    {t('races.register', 'Register')}
                                                </Box>
                                            )}
                                            {(comp.displayDate ?? comp.nextEditionDate) && (
                                                <Box
                                                    onClick={(e: React.MouseEvent) => {
                                                        e.stopPropagation();
                                                        downloadIcs({
                                                            title: comp.name,
                                                            date: (comp.displayDate ?? comp.nextEditionDate)!,
                                                            location: comp.locationName ?? undefined,
                                                            url: `https://hlaupadagskra.is/events/${comp.slug}`,
                                                        });
                                                    }}
                                                    sx={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        bgcolor: 'primary.main',
                                                        color: 'white',
                                                        cursor: 'pointer',
                                                        gap: 0.5,
                                                        px: 1,
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    <EventAvailableIcon sx={{ fontSize: 18 }} />
                                                    {t('races.addToCalendar', 'Calendar')}
                                                </Box>
                                            )}
                                        </Box>
                                    }
                                    revealWidth={120}
                                >
                                <Card
                                    sx={{
                                        transition: 'transform 0.15s, box-shadow 0.15s',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: theme.shadows[4],
                                        },
                                        ...(comp.status === 'Cancelled' && { opacity: 0.65 }),
                                    }}
                                >
                                    <CardActionArea onClick={() => navigate(`/events/${comp.slug}`)}>
                                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
                                                <Box sx={{ flex: 1, minWidth: 200 }}>
                                                    <Typography variant="h6" fontWeight={700} sx={comp.status === 'Cancelled' ? { textDecoration: 'line-through' } : undefined}>
                                                        {comp.name}
                                                    </Typography>
                                                    {comp.status === 'Cancelled' && (
                                                        <Chip label={t('races.statusCancelled')} size="small" color="error" sx={{ ml: 1, fontWeight: 600 }} />
                                                    )}
                                                    {comp.status === 'Unconfirmed' && (
                                                        <Chip label={t('races.statusUpcoming')} size="small" color="info" sx={{ ml: 1, fontWeight: 600 }} />
                                                    )}

                                                    {/* Location + organizer */}
                                                    <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                                                        <Chip
                                                            label={t(`races.eventTypes.${comp.type}`, comp.type)}
                                                            size="small"
                                                            color={getEventTypeColor(comp.type)}
                                                            variant="outlined"
                                                        />
                                                        {comp.locationName && (
                                                            <Chip
                                                                icon={<LocationOnIcon />}
                                                                label={comp.locationName}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                        )}
                                                        {userLocation && comp.gpxPointLat != null && comp.gpxPointLng != null && (
                                                            <Tooltip title={t('races.nearMe.distanceToStart')}>
                                                                <Chip
                                                                    icon={<NearMeIcon />}
                                                                    label={formatDistanceKm(haversineKm(userLocation.lat, userLocation.lng, comp.gpxPointLat, comp.gpxPointLng))}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    color="primary"
                                                                />
                                                            </Tooltip>
                                                        )}
                                                        {comp.organizerName && (
                                                            <Chip
                                                                label={comp.organizerName}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                        )}
                                                        {comp.type !== 'Advertisement' && (
                                                            <Chip
                                                                label={t('races.editionCount', { count: comp.editionCount })}
                                                                size="small"
                                                                variant="outlined"
                                                                color="primary"
                                                            />
                                                        )}
                                                    </Stack>

                                                    {/* Alert banner */}
                                                    {comp.alertMessage && (
                                                        <Alert
                                                            severity={(comp.alertSeverity as 'info' | 'success' | 'warning' | 'error') ?? 'info'}
                                                            sx={{ mt: 1, borderRadius: 1.5, py: 0, alignItems: 'center', '& .MuiAlert-message': { py: 0.5 } }}
                                                        >
                                                            <Typography variant="body2">{comp.alertMessage}</Typography>
                                                        </Alert>
                                                    )}

                                                    {/* Next date */}
                                                    {(comp.displayDate ?? comp.nextEditionDate) && comp.status !== 'Cancelled' && (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, flexWrap: 'wrap' }}>
                                                            <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                                            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                                                                {t('races.nextRace')}
                                                            </Typography>
                                                            <Typography variant="body2" fontWeight={600}>
                                                                {formatNextDate((comp.displayDate ?? comp.nextEditionDate)!, t)}
                                                            </Typography>
                                                            <EventDateBadge dateStr={(comp.displayDate ?? comp.nextEditionDate)!} />
                                                            {comp.daysUntil !== null && (
                                                                <Chip
                                                                    label={getCountdownLabel(comp.daysUntil, t)}
                                                                    size="small"
                                                                    color={getCountdownColor(comp.daysUntil)}
                                                                    variant="outlined"
                                                                    sx={{ height: 20, fontSize: '0.68rem' }}
                                                                />
                                                            )}
                                                        </Box>
                                                    )}

                                                    {/* Distances */}
                                                    {comp.distances && comp.distances.length > 0 && (
                                                        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                                                            {groupDistances(comp.distances).map((d, i) => (
                                                                <Tooltip key={i} title={d.ticketStatus && d.ticketStatus !== 'Available' ? t(`races.ticketStatus.${d.ticketStatus}`, d.ticketStatus) : ''}>
                                                                    <Chip
                                                                        label={d.count > 1 ? `${d.count} × ${d.label}` : d.label}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        clickable
                                                                        color={getTicketStatusColor(d.ticketStatus)}
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/events/${comp.slug}`); }}
                                                                    />
                                                                </Tooltip>
                                                            ))}
                                                        </Stack>
                                                    )}

                                                    {/* Credentials */}
                                                    {(comp.itraPoints?.length || comp.certifications?.length || comp.championshipCategories?.length) && (
                                                        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }} alignItems="center">
                                                            {comp.itraPoints?.map((pts, i) => (
                                                                <Tooltip key={i} title={`ITRA ${pts} points`}>
                                                                    <img src={`/images/itra-${pts}.png`} alt={`ITRA ${pts}`} style={{ height: 18, verticalAlign: 'middle' }} />
                                                                </Tooltip>
                                                            ))}
                                                            {comp.certifications?.map((c, i) => (
                                                                <Chip key={i} label={c} size="small" variant="outlined" color="secondary" />
                                                            ))}
                                                            {comp.championshipCategories?.map((c, i) => (
                                                                <Chip key={i} label={c} size="small" variant="outlined" color="primary" />
                                                            ))}
                                                        </Stack>
                                                    )}

                                                    {/* Register / Results / 360° */}
                                                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                                                        {comp.registrationUrl && comp.daysUntil != null && comp.daysUntil >= 0 && (
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                href={comp.registrationUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                                                onClick={(e) => e.stopPropagation()}
                                                                sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                                                            >
                                                                {t('races.register', 'Register')}
                                                            </Button>
                                                        )}
                                                        {comp.youtubeUrl && (
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                color="error"
                                                                href={comp.youtubeUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                startIcon={<VideocamIcon sx={{ fontSize: 14 }} />}
                                                                onClick={(e) => e.stopPropagation()}
                                                                sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                                                            >
                                                                360°
                                                            </Button>
                                                        )}
                                                    </Stack>

                                                    {comp.description && (
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                            sx={{
                                                                mt: 1,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 2,
                                                                WebkitBoxOrient: 'vertical',
                                                            }}
                                                        >
                                                            {comp.description}
                                                        </Typography>
                                                    )}
                                                </Box>

                                                {/* Countdown chip */}
                                                {comp.status !== 'Cancelled' && (
                                                    <Chip
                                                        label={getCountdownLabel(comp.daysUntil, t)}
                                                        color={getCountdownColor(comp.daysUntil)}
                                                        variant="filled"
                                                        size="medium"
                                                        sx={{
                                                            fontWeight: 700,
                                                            fontSize: '0.9rem',
                                                            px: 1,
                                                            ...(comp.daysUntil === 0 && {
                                                                animation: 'pulse 1.5s ease-in-out infinite',
                                                                '@keyframes pulse': {
                                                                    '0%, 100%': { transform: 'scale(1)', boxShadow: 'none' },
                                                                    '50%': { transform: 'scale(1.06)', boxShadow: `0 0 8px ${alpha(theme.palette.error.main, 0.6)}` },
                                                                },
                                                            }),
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                                </SwipeableCard>
                                );
                            })}
                        </Stack>
                        </>
                    )
                ) : viewMode === 'table' ? (
                    <Suspense fallback={<Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>}>
                        <EventTableView events={sortedFiltered} userLocation={userLocation} />
                    </Suspense>
                ) : (
                    <Suspense fallback={<Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>}>
                        <EventMapView events={filtered} />
                    </Suspense>
                )}

                {/* Swipe-right share dialogs */}
                {(() => {
                    const ev = shareEventId ? [...justRaced, ...upcoming].find(e => e.id === shareEventId) : null;
                    if (!ev) return null;
                    const isFinished = justRaced.some(e => e.id === shareEventId);
                    const firstDistance = ev.distances?.[0]?.label ?? null;
                    if (isFinished) {
                        return (
                            <RaceFinishCard
                                open
                                onClose={() => setShareEventId(null)}
                                eventName={ev.name}
                                raceName={ev.name}
                                distanceLabel={firstDistance}
                                date={ev.displayDate ?? ev.nextEditionDate}
                                activityType={ev.activityType}
                            />
                        );
                    }
                    return (
                        <RaceShareCard
                            open
                            onClose={() => setShareEventId(null)}
                            eventName={ev.name}
                            raceName={ev.name}
                            distanceLabel={firstDistance}
                            date={ev.displayDate ?? ev.nextEditionDate}
                            daysUntil={ev.daysUntil}
                            activityType={ev.activityType}
                        />
                    );
                })()}
            </Container>
        </Layout>
    );
}
