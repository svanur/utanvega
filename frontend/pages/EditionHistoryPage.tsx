import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Container,
    Typography,
    Box,
    Card,
    CardContent,
    Alert,
    PaletteMode,
    Chip,
    Stack,
    Button,
    IconButton,
    Paper,
    Tooltip,
    useTheme,
    alpha,
} from '@mui/material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import TimerIcon from '@mui/icons-material/Timer';
import StraightenIcon from '@mui/icons-material/Straighten';
import TerrainIcon from '@mui/icons-material/Terrain';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Layout from '../components/Layout';
import RunningLoader from '../components/RunningLoader';
import LostRunner from '../components/LostRunner';
import { useEventBySlug } from '../hooks/useEvents';
import type { EventEditionDto, RaceDto } from '../hooks/useEvents';
import { useLocalize } from '../utils/localize';
import { splitMinutes } from '../utils/cutoffTime';
import { formatNextDate, formatRaceDateTime } from '../utils/eventUtils';
import { getTicketStatusColor } from '../utils/ticketStatus';

type EditionHistoryPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

function formatCutoff(minutes: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
    const { hours: h, minutes: m } = splitMinutes(minutes);
    if (m === 0) return t('races.cutoffHours', { count: h });
    return `${h}h ${m}m`;
}


function getRegistrationStatusColor(status: string | null | undefined): 'success' | 'warning' | 'default' {
    if (status === 'Open') return 'success';
    if (status === 'NotStarted') return 'warning';
    return 'default';
}

export default function EditionHistoryPage({ mode, onToggleMode }: EditionHistoryPageProps) {
    const { slug, editionKey } = useParams<{ slug: string; editionKey: string }>();
    const { t } = useTranslation();
    const loc = useLocalize();
    const { event, loading, error } = useEventBySlug(slug);
    const navigate = useNavigate();
    const theme = useTheme();

    const edition: EventEditionDto | null = useMemo(() => {
        if (!event || !editionKey) return null;
        // Match by date (yyyy-mm-dd), year, or fall back to id
        return event.editions.find(ed => ed.date === editionKey)
            ?? event.editions.find(ed => String(ed.year) === editionKey)
            ?? event.editions.find(ed => ed.id === editionKey)
            ?? null;
    }, [event, editionKey]);

    const visibleRaces = useMemo(() => {
        if (!edition) return [];
        return [...edition.races]
            .filter(race => race.status !== 'Hidden')
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }, [edition]);

    // Sorted editions (newest first) for prev/next navigation
    const sortedEditions = useMemo(() => {
        if (!event) return [];
        return [...event.editions].sort((a, b) => {
            const dateA = a.date ?? '';
            const dateB = b.date ?? '';
            if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
            return (b.year ?? 0) - (a.year ?? 0);
        });
    }, [event]);

    const currentIndex = useMemo(
        () => edition ? sortedEditions.findIndex(ed => ed.id === edition.id) : -1,
        [edition, sortedEditions],
    );

    const editionKeyFor = (ed: EventEditionDto) => ed.date ?? String(ed.year ?? ed.id);
    const prevEdition = currentIndex > 0 ? sortedEditions[currentIndex - 1] : null;
    const nextEdition = currentIndex >= 0 && currentIndex < sortedEditions.length - 1
        ? sortedEditions[currentIndex + 1] : null;

    const goToEdition = useCallback((ed: EventEditionDto) => {
        navigate(`/events/${slug}/history/${editionKeyFor(ed)}`, { replace: true });
    }, [navigate, slug]);

    // Swipe left/right to navigate editions
    const touchStartX = useRef<number | null>(null);
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    }, []);
    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (touchStartX.current === null) return;
        const diff = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(diff) < 60) return;
        // Swipe right → newer (prev), swipe left → older (next)
        if (diff > 0 && prevEdition) goToEdition(prevEdition);
        else if (diff < 0 && nextEdition) goToEdition(nextEdition);
    }, [prevEdition, nextEdition, goToEdition]);

    if (loading) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <RunningLoader />
            </Layout>
        );
    }

    if (error || !event) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <LostRunner
                    message={t('races.notFound')}
                    buttonLabel={t('races.backToRaces')}
                    onBack={() => navigate('/events')}
                />
            </Layout>
        );
    }

    if (!edition) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Container maxWidth="md" sx={{ py: 3 }}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate(`/events/${slug}`)}
                        size="small"
                        sx={{ mb: 2 }}
                    >
                        {t('races.history.backToEvent', { defaultValue: 'Back to event' })}
                    </Button>
                    <Alert severity="warning">
                        {t('races.history.editionNotFound', { defaultValue: 'Edition not found' })}
                    </Alert>
                </Container>
            </Layout>
        );
    }

    const heading = loc(edition.title, edition.titleEn)?.trim() || String(edition.year);

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container
                maxWidth="md"
                sx={{ py: 3 }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate(`/events/${slug}`)}
                        size="small"
                    >
                        {t('races.history.backToEvent', { defaultValue: 'Back to event' })}
                    </Button>
                    <Stack direction="row" spacing={0.5}>
                        <IconButton
                            size="small"
                            disabled={!prevEdition}
                            onClick={() => prevEdition && goToEdition(prevEdition)}
                            aria-label={t('races.history.newer', { defaultValue: 'Newer' })}
                        >
                            <NavigateBeforeIcon />
                        </IconButton>
                        <IconButton
                            size="small"
                            disabled={!nextEdition}
                            onClick={() => nextEdition && goToEdition(nextEdition)}
                            aria-label={t('races.history.older', { defaultValue: 'Older' })}
                        >
                            <NavigateNextIcon />
                        </IconButton>
                    </Stack>
                </Stack>

                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 2.5, sm: 4 },
                        mb: 3,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.grey[500], 0.05)} 100%)`,
                        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                {loc(event.name, event.nameEn) ?? event.name}
                            </Typography>
                            <Typography variant="h4" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <EmojiEventsIcon sx={{ color: theme.palette.grey[500], flexShrink: 0 }} />
                                {heading}
                            </Typography>
                        </Box>
                        <Chip
                            label={t('races.history.pastEdition', { defaultValue: 'Past edition' })}
                            size="small"
                            variant="outlined"
                            color="default"
                        />
                    </Box>

                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                        {edition.year && (
                            <Chip label={String(edition.year)} size="small" variant="outlined" color="primary" />
                        )}
                        {edition.date && (
                            <Chip
                                icon={<CalendarTodayIcon />}
                                label={formatNextDate(edition.date, t)}
                                size="small"
                                variant="outlined"
                            />
                        )}
                        {edition.registrationStatus && (
                            <Chip
                                label={edition.registrationStatus}
                                size="small"
                                color={getRegistrationStatusColor(edition.registrationStatus)}
                            />
                        )}
                    </Stack>

                    {edition.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, whiteSpace: 'pre-line' }}>
                            {edition.notes}
                        </Typography>
                    )}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }} alignItems={{ sm: 'center' }}>
                        {edition.resultsUrl && (
                            <Button
                                variant="contained"
                                color="primary"
                                size="small"
                                endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                onClick={() => window.open(edition.resultsUrl!, '_blank', 'noopener')}
                                sx={{ textTransform: 'none' }}
                            >
                                {t('races.results', { defaultValue: 'Results' })}
                            </Button>
                        )}
                        {edition.registrationUrl && (
                            <Button
                                variant="outlined"
                                size="small"
                                endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                onClick={() => window.open(edition.registrationUrl!, '_blank', 'noopener')}
                                sx={{ textTransform: 'none' }}
                            >
                                {t('races.register')}
                            </Button>
                        )}
                    </Stack>
                </Paper>

                {visibleRaces.length === 0 ? (
                    <Alert severity="info">{t('races.noRaces')}</Alert>
                ) : (
                    <>
                        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
                            {t('races.racesHeading')}
                        </Typography>
                        <Stack spacing={2}>
                            {visibleRaces.map(race => (
                                <HistoryRaceCard key={race.id} race={race} t={t} />
                            ))}
                        </Stack>
                    </>
                )}
            </Container>
        </Layout>
    );
}

function HistoryRaceCard({
    race,
    t,
}: {
    race: RaceDto;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    const theme = useTheme();
    const loc = useLocalize();
    const raceDateTime = formatRaceDateTime(race.dateOfRace, race.startTime, t);

    return (
        <Card variant="outlined" sx={{
            borderRadius: 2,
            ...(race.status === 'Cancelled' && { opacity: 0.6 }),
        }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, justifyContent: 'space-between' }}>
                    <Typography variant="h6" fontWeight={700} sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap',
                        ...(race.status === 'Cancelled' && { textDecoration: 'line-through' }),
                    }}>
                        <DirectionsRunIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                        {loc(race.name, race.nameEn) ?? race.name}
                        {race.status === 'Cancelled' && (
                            <Chip label={t('races.statusCancelled')} size="small" color="error" sx={{ ml: 0.5, fontWeight: 600 }} />
                        )}
                        {(race.status === 'Completed') && (
                            <Chip label={t('races.history.completed', { defaultValue: 'Completed' })} size="small" color="success" sx={{ ml: 0.5 }} />
                        )}
                    </Typography>
                    {race.trailSlug && (
                        <Button
                            component={RouterLink}
                            to={`/trails/${race.trailSlug}`}
                            size="small"
                            variant="outlined"
                            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                        >
                            🗺️ {t('races.viewTrail')}
                        </Button>
                    )}
                </Box>

                <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                    {race.distanceLabel && (
                        <Chip icon={<StraightenIcon />} label={race.distanceLabel} size="small" color="primary" variant="outlined" />
                    )}
                    {raceDateTime && (
                        <Chip icon={<CalendarTodayIcon />} label={raceDateTime} size="small" variant="outlined" />
                    )}
                    {race.trailDistanceMeters && (
                        <Chip label={`${(race.trailDistanceMeters / 1000).toFixed(1)} km`} size="small" variant="outlined" />
                    )}
                    {race.trailElevationGain && (
                        <Chip icon={<TerrainIcon />} label={`↑ ${Math.round(race.trailElevationGain)} m`} size="small" variant="outlined" />
                    )}
                    {race.cutoffMinutes != null && (
                        <Chip icon={<TimerIcon />} label={formatCutoff(race.cutoffMinutes, t)} size="small" variant="outlined" color="warning" />
                    )}
                    {race.ticketStatus && (
                        <Chip label={race.ticketStatus} size="small" color={getTicketStatusColor(race.ticketStatus)} />
                    )}
                    {race.maxParticipants != null && (
                        <Chip label={`👥 ${race.maxParticipants}`} size="small" variant="outlined" />
                    )}
                    {race.itraPoints != null && (
                        <Tooltip title={`ITRA ${race.itraPoints}`}>
                            <img
                                src={`/images/itra-${race.itraPoints}.png`}
                                alt={`ITRA ${race.itraPoints}`}
                                style={{ height: 20, verticalAlign: 'middle' }}
                            />
                        </Tooltip>
                    )}
                </Stack>

                {(race.description || race.descriptionEn) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
                        {loc(race.description, race.descriptionEn)}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}
