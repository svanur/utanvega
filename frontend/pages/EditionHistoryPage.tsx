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
import GalleryLinks from '../components/GalleryLinks';
import type { EventEditionDto, RaceDto } from '../hooks/useEvents';
import { useLocalize } from '../utils/localize';
import { splitMinutes } from '../utils/cutoffTime';
import { formatDateRange, formatRaceDateTime, editionKeyFor } from '../utils/eventUtils';
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
        // Swipe left → forward in time (newer), swipe right → back in time (older)
        if (diff < 0 && prevEdition) goToEdition(prevEdition);
        else if (diff > 0 && nextEdition) goToEdition(nextEdition);
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
            <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.events'), to: '/events' }, { label: loc(event.name, event.nameEn) ?? event.name, to: `/events/${slug}` }]}>
                <Container maxWidth="md" sx={{ py: 3 }}>
                    <Alert severity="warning">
                        {t('races.history.editionNotFound', { defaultValue: 'Edition not found' })}
                    </Alert>
                </Container>
            </Layout>
        );
    }

    const heading = loc(edition.title, edition.titleEn)?.trim() || String(edition.year);

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.events'), to: '/events' }, { label: loc(event.name, event.nameEn) ?? event.name, to: `/events/${slug}` }, { label: editionKey ?? '' }]}>
            <Container
                maxWidth="md"
                sx={{ py: 3 }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={0.5}>
                        <IconButton
                            size="small"
                            disabled={!nextEdition}
                            onClick={() => nextEdition && goToEdition(nextEdition)}
                            aria-label={t('races.history.older')}
                        >
                            <NavigateBeforeIcon />
                        </IconButton>
                        <IconButton
                            size="small"
                            disabled={!prevEdition}
                            onClick={() => prevEdition && goToEdition(prevEdition)}
                            aria-label={t('races.history.newer')}
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
                            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
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
                            <Tooltip title={t('races.history.year', { defaultValue: 'Year' })}>
                                <Chip label={String(edition.year)} size="small" variant="outlined" color="primary" />
                            </Tooltip>
                        )}
                        {edition.date && (
                            <Tooltip title={t('races.history.eventDate', { defaultValue: 'Event date' })}>
                                <Chip
                                    icon={<CalendarTodayIcon />}
                                    label={formatDateRange(edition.date, edition.endDate, t)}
                                    size="small"
                                    variant="outlined"
                                />
                            </Tooltip>
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
                        <GalleryLinks galleries={edition.galleries} />
                    </Stack>
                </Paper>

                {visibleRaces.length === 0 ? (
                    (event.type === 'Race' || event.type === 'Series') && <Alert severity="info">{t('races.noRaces')}</Alert>
                ) : (
                    <>
                        {(event.type === 'Race' || event.type === 'Series') && (
                            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
                                {t('races.racesHeading')}
                            </Typography>
                        )}
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
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: { xs: 0.5, sm: 1 }, justifyContent: 'space-between' }}>
                    <Box>
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
                        {race.trailName && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                {race.trailSlug ? (
                                    <RouterLink to={`/trails/${race.trailSlug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                        {race.trailName}
                                    </RouterLink>
                                ) : race.trailName}
                            </Typography>
                        )}
                    </Box>
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
                        <Tooltip title={t('races.raceDistance', { defaultValue: 'Race distance' })}>
                            <Chip icon={<StraightenIcon />} label={race.distanceLabel} size="small" color="primary" variant="outlined" />
                        </Tooltip>
                    )}
                    {raceDateTime && (
                        <Tooltip title={t('races.raceDateTime', { defaultValue: 'Date & start time' })}>
                            <Chip icon={<CalendarTodayIcon />} label={raceDateTime} size="small" variant="outlined" />
                        </Tooltip>
                    )}
                    {race.trailDistanceMeters && (
                        <Tooltip title={t('races.trailDistance', { defaultValue: 'Trail distance' })}>
                            <Chip label={`${(race.trailDistanceMeters / 1000).toFixed(1)} km`} size="small" variant="outlined" />
                        </Tooltip>
                    )}
                    {race.trailElevationGain && (
                        <Tooltip title={t('races.elevationGain', { defaultValue: 'Elevation gain' })}>
                            <Chip icon={<TerrainIcon />} label={`↑ ${Math.round(race.trailElevationGain)} m`} size="small" variant="outlined" />
                        </Tooltip>
                    )}
                    {race.cutoffMinutes != null && (
                        <Tooltip title={t('races.cutoffTime', { defaultValue: 'Time limit' })}>
                            <Chip icon={<TimerIcon />} label={formatCutoff(race.cutoffMinutes, t)} size="small" variant="outlined" color="warning" />
                        </Tooltip>
                    )}
                    {race.ticketStatus && (
                        <Tooltip title={t('races.ticketStatus', { defaultValue: 'Registration status' })}>
                            <Chip
                                label={t(`races.ticketStatus.${race.ticketStatus}`, { defaultValue: race.ticketStatus })}
                                size="small"
                                color={getTicketStatusColor(race.ticketStatus)}
                            />
                        </Tooltip>
                    )}
                    {race.maxParticipants != null && (
                        <Tooltip title={t('races.maxParticipants', { defaultValue: 'Max participants' })}>
                            <Chip label={`👥 ${race.maxParticipants}`} size="small" variant="outlined" />
                        </Tooltip>
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
