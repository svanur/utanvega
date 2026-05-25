import { lazy, Suspense, useMemo, useState } from 'react';
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
import Layout from '../components/Layout';
import RandomQuote from '../components/RandomQuote';
import RunningLoader from '../components/RunningLoader';
import { useEvents } from '../hooks/useEvents';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { toUserFriendlyFetchError } from '../utils/apiErrors';

const EventTableView = lazy(() => import('../components/EventTableView'));
const EventMapView = lazy(() => import('../components/EventMapView'));

type ViewMode = 'list' | 'map' | 'table';


type RacesPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
    showQuote?: boolean;
};

function formatNextDate(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const weekdays = t('races.weekdays', { returnObjects: true }) as unknown as string[];
    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const weekday = weekdays[date.getDay()];
    const month = months[date.getMonth()];
    const formatted = `${weekday}, ${date.getDate()}. ${month} ${date.getFullYear()}`;
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getCountdownColor(daysUntil: number | null): 'success' | 'warning' | 'error' | 'default' {
    if (daysUntil === null) return 'default';
    if (daysUntil < 0) return 'success';
    if (daysUntil <= 7) return 'error';
    if (daysUntil <= 30) return 'warning';
    return 'success';
}

function getCountdownLabel(daysUntil: number | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
    if (daysUntil === null) return t('races.noDate');
    if (daysUntil === 0) return t('races.today');
    if (daysUntil === 1) return t('races.tomorrow');
    if (daysUntil === -1) return t('races.yesterday');
    if (daysUntil < -1) return t('races.daysAgo', { count: Math.abs(daysUntil) });
    return t('races.daysUntil', { count: daysUntil });
}

export default function RacesPage({ mode, onToggleMode, showQuote = false }: RacesPageProps) {
    const { t } = useTranslation();
    const { events, loading, error } = useEvents();
    const { isEnabled } = useFeatureFlags();
    const locationsEnabled = isEnabled('locations_page');
    const navigate = useNavigate();
    const theme = useTheme();
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        try {
            const saved = localStorage.getItem('utanvega-events-view-mode');
            if (saved === 'list' || saved === 'map' || saved === 'table') return saved;
        } catch { /* */ }
        return 'list';
    });

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
    }, [events, search]);

    const { justRaced, upcoming } = useMemo(() => {
        const isRecentlyCompleted = (c: typeof filtered[0]) =>
            c.daysUntil != null && c.daysUntil < 0 && c.daysUntil >= -3 && c.status !== 'Cancelled';
        const jr = filtered.filter(isRecentlyCompleted);
        const up = filtered.filter(c => !isRecentlyCompleted(c));
        return { justRaced: jr, upcoming: up };
    }, [filtered]);

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
        <Layout mode={mode} onToggleMode={onToggleMode} maxWidth={viewMode === 'table' ? 'lg' : 'md'}>
            {showQuote && isEnabled('random_quote') && <RandomQuote />}
            <Container maxWidth={viewMode === 'table' ? 'lg' : 'md'} sx={{ py: 3 }}>
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

                {/* Search */}
                <TextField
                    placeholder={t('races.searchPlaceholder')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    fullWidth
                    size="small"
                    sx={{ mb: 3 }}
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

                {/* View toggle */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(_, value) => { if (value) { const v = value as ViewMode; setViewMode(v); try { localStorage.setItem('utanvega-events-view-mode', v); } catch {/* */} } }}
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
                                {search ? t('races.noResults') : t('races.empty')}
                            </Typography>
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
                                            <Card
                                                key={comp.id}
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
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                        <Stack spacing={2}>
                            {upcoming.map(comp => (
                                <Card
                                    key={comp.id}
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
                                                        {locationsEnabled && comp.locationName && (
                                                            <Chip
                                                                icon={<LocationOnIcon />}
                                                                label={comp.locationName}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                        )}
                                                        {comp.organizerName && (
                                                            <Chip
                                                                label={comp.organizerName}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                        )}
                                                        <Chip
                                                            label={t('races.editionCount', { count: comp.editionCount })}
                                                            size="small"
                                                            variant="outlined"
                                                            color="primary"
                                                        />
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
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
                                                            <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                                            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                                                                {t('races.nextRace')}
                                                            </Typography>
                                                            <Typography variant="body2" fontWeight={600}>
                                                                {formatNextDate((comp.displayDate ?? comp.nextEditionDate)!, t)}
                                                            </Typography>
                                                        </Box>
                                                    )}

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
                                                {comp.status !== 'Cancelled' && comp.status !== 'Unconfirmed' && (
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
                            ))}
                        </Stack>
                        </>
                    )
                ) : viewMode === 'table' ? (
                    <Suspense fallback={<Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>}>
                        <EventTableView events={filtered} />
                    </Suspense>
                ) : (
                    <Suspense fallback={<Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>}>
                        <EventMapView events={filtered} />
                    </Suspense>
                )}
            </Container>
        </Layout>
    );
}
