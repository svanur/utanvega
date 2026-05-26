import { useEffect, useMemo, useRef, useState } from 'react';
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
    Paper,
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Checkbox,
    FormControlLabel,
    FormGroup,
    Tooltip,
    IconButton,
    useTheme,
    alpha,
} from '@mui/material';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LanguageIcon from '@mui/icons-material/Language';
import XIcon from '@mui/icons-material/X';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TimerIcon from '@mui/icons-material/Timer';
import StraightenIcon from '@mui/icons-material/Straighten';
import TerrainIcon from '@mui/icons-material/Terrain';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import confetti from 'canvas-confetti';
import ShareButtons from '../components/ShareButtons';
import RaceShareCard from '../components/RaceShareCard';
import RaceFinishCard from '../components/RaceFinishCard';
import RaceProgressBar from '../components/RaceProgressBar';
import Layout from '../components/Layout';
import RunningLoader from '../components/RunningLoader';
import LostRunner from '../components/LostRunner';
import WeatherCard from '../components/WeatherCard';
import { useEvents, useEventBySlug } from '../hooks/useEvents';
import type { EventEditionDto, RaceDto, ScheduleRule } from '../hooks/useEvents';
import { useTrailWeather } from '../hooks/useTrails';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

type CompetitionDetailPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

type PreparedEdition = EventEditionDto & {
    visibleRaces: RaceDto[];
};

import { ACTIVITY_EMOJI } from '../constants/activityEmoji';

type RaceDayChecklistKey = 'bib' | 'shoes' | 'gels' | 'goodMood';

function toAnchorSlug(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function formatNextDate(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const weekdays = t('races.weekdays', { returnObjects: true }) as unknown as string[];
    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const weekday = weekdays[date.getDay()];
    const month = months[date.getMonth()];
    const formatted = `${weekday}, ${date.getDate()}. ${month} ${date.getFullYear()}`;
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatCutoff(minutes: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return t('races.cutoffHours', { count: h });
    return `${h}h ${m}m`;
}

const DAY_OF_WEEK_INDEX: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

function formatScheduleDescription(
    rule: ScheduleRule | null,
    upcomingCount: number,
    t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
    if (!rule) return null;

    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const weekdays = t('races.weekdays', { returnObjects: true }) as unknown as string[];
    const ordinals = t('races.ordinals', { returnObjects: true }) as unknown as string[];
    const ordinalLast = t('races.ordinalLast') as string;

    const getOrdinal = (w: number) => w === -1 ? ordinalLast : (ordinals[w] ?? `${w}.`);
    const getDayName = (dow?: string) => dow ? weekdays[DAY_OF_WEEK_INDEX[dow] ?? 0] : '';

    if (rule.type === 'Seasonal' && rule.monthStart && rule.monthEnd && rule.dayOfWeek) {
        return t('races.scheduleSeasonal', {
            count: upcomingCount,
            ordinal: rule.weekOfMonth ? getOrdinal(rule.weekOfMonth) : '',
            day: getDayName(rule.dayOfWeek),
            monthStart: months[(rule.monthStart - 1)] ?? '',
            monthEnd: months[(rule.monthEnd - 1)] ?? '',
        });
    }

    if (rule.type === 'Yearly' && rule.month && rule.dayOfWeek && rule.weekOfMonth) {
        return t('races.scheduleYearly', {
            ordinal: getOrdinal(rule.weekOfMonth),
            day: getDayName(rule.dayOfWeek),
            month: months[(rule.month - 1)] ?? '',
        });
    }

    if (rule.type === 'Fixed' && rule.date) {
        return t('races.scheduleFixed', {
            date: formatNextDate(rule.date, t),
        });
    }

    return null;
}

function getCountdownLabel(daysUntil: number | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
    if (daysUntil === null) return t('races.noDate');
    if (daysUntil === 0) return t('races.today');
    if (daysUntil === 1) return t('races.tomorrow');
    if (daysUntil === -1) return t('races.yesterday');
    if (daysUntil < -1) return t('races.daysAgo', { count: Math.abs(daysUntil) });
    return t('races.daysUntil', { count: daysUntil });
}

function getCountdownColor(daysUntil: number | null): 'success' | 'warning' | 'error' | 'default' {
    if (daysUntil === null) return 'default';
    if (daysUntil <= 7) return 'error';
    if (daysUntil <= 30) return 'warning';
    return 'success';
}

function getRegistrationStatusColor(status: string | null | undefined): 'success' | 'warning' | 'default' {
    if (status === 'Open') return 'success';
    if (status === 'NotStarted') return 'warning';
    return 'default';
}

function getTicketStatusColor(status: string | null | undefined): 'success' | 'error' | 'default' {
    if (status === 'Available') return 'success';
    if (status === 'SoldOut') return 'error';
    return 'default';
}

function formatRaceDateTime(
    dateOfRace: string | null,
    startTime: string | null,
    t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
    if (!dateOfRace && !startTime) return null;
    const dateLabel = dateOfRace ? formatNextDate(dateOfRace, t) : null;
    const timeLabel = startTime ? startTime.slice(0, 5) : null;
    return [dateLabel, timeLabel].filter(Boolean).join(' · ');
}

function EditionMeta({
    edition,
    t,
    showHeader,
    hideMeta,
}: {
    edition: EventEditionDto;
    t: (key: string, opts?: Record<string, unknown>) => string;
    showHeader?: boolean;
    hideMeta?: boolean;
}) {
    const heading = edition.title?.trim() || String(edition.year);

    return (
        <Box>
            {showHeader && (
                <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                    {heading}
                </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {!showHeader && edition.title && (
                    <Chip label={edition.title} size="small" variant="outlined" />
                )}
                {!hideMeta && (
                    <Chip label={String(edition.year)} size="small" variant="outlined" color="primary" />
                )}
                {!hideMeta && edition.date && (
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
            {!hideMeta && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1.5 }} alignItems={{ sm: 'center' }}>
                    {edition.registrationUrl && (
                        <Button
                            variant="contained"
                            color="primary"
                            endIcon={<OpenInNewIcon />}
                            onClick={() => window.open(edition.registrationUrl!, '_blank', 'noopener')}
                            sx={{ textTransform: 'none' }}
                        >
                            {t('races.register')}
                        </Button>
                    )}
                    {edition.resultsUrl && (
                        <Button
                            variant="outlined"
                            size="small"
                            endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                            onClick={() => window.open(edition.resultsUrl!, '_blank', 'noopener')}
                            sx={{ textTransform: 'none' }}
                        >
                            {t('races.results', { defaultValue: 'Results' })}
                        </Button>
                    )}
                </Stack>
            )}
        </Box>
    );
}

export default function CompetitionDetailPage({ mode, onToggleMode }: CompetitionDetailPageProps) {
    const { slug } = useParams<{ slug: string }>();
    const { t } = useTranslation();
    const { event, loading, error } = useEventBySlug(slug);
    const { events, loading: eventsLoading } = useEvents();
    const navigate = useNavigate();
    const theme = useTheme();
    const { isEnabled } = useFeatureFlags();
    const locationsEnabled = isEnabled('locations_page');
    const confettiFiredForEvent = useRef<string | null>(null);

    const isRaceDay = event?.status !== 'Cancelled' && event?.daysUntil === 0;
    const isRaceWeek = event?.status !== 'Cancelled' && event?.daysUntil != null && event.daysUntil >= 0 && event.daysUntil <= 7;
    const isPostRace = event?.status !== 'Cancelled' && event?.daysUntil != null && event.daysUntil < 0 && event.daysUntil >= -3;

    // Ticking clock for race-day phase transitions and progress bar
    const [currentTime, setCurrentTime] = useState(() => new Date());
    useEffect(() => {
        if (!isRaceDay) return;
        const interval = setInterval(() => setCurrentTime(new Date()), 10_000);
        return () => clearInterval(interval);
    }, [isRaceDay]);

    useEffect(() => {
        if (!event || !isRaceDay) return;
        if (confettiFiredForEvent.current === event.id) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        confettiFiredForEvent.current = event.id;
        const colors = ['#1976d2', '#ff9800', '#66bb6a'];

        confetti({
            particleCount: 16,
            spread: 50,
            startVelocity: 28,
            origin: { x: 0.15, y: 0.35 },
            colors,
        });
        confetti({
            particleCount: 16,
            spread: 50,
            startVelocity: 28,
            origin: { x: 0.85, y: 0.35 },
            colors,
        });
    }, [event, isRaceDay]);

    const preparedEditions = useMemo<PreparedEdition[]>(() => {
        if (!event) return [];
        return [...event.editions]
            .sort((a, b) => {
                const dateA = a.date ?? '';
                const dateB = b.date ?? '';
                if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
                return (b.year ?? 0) - (a.year ?? 0);
            })
            .map(edition => ({
                ...edition,
                visibleRaces: [...edition.races]
                    .filter(race => race.status !== 'Hidden')
                    .sort((a, b) => {
                        const cancelledA = a.status === 'Cancelled' ? 1 : 0;
                        const cancelledB = b.status === 'Cancelled' ? 1 : 0;
                        if (cancelledA !== cancelledB) return cancelledA - cancelledB;
                        return a.sortOrder - b.sortOrder;
                    }),
            }));
    }, [event]);

    const { currentEditions, pastEditions } = useMemo(() => {
        if (!event) return { currentEditions: [] as PreparedEdition[], pastEditions: [] as PreparedEdition[] };
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const nextDate = event.nextEditionDate;
        const current: PreparedEdition[] = [];
        const past: PreparedEdition[] = [];
        for (const edition of preparedEditions) {
            const edDate = edition.date;
            const isNextEdition = nextDate && edDate === nextDate;
            const isFuture = edDate && edDate >= today;
            const hasNoDate = !edDate;
            if (isNextEdition || isFuture || hasNoDate) {
                current.push(edition);
            } else {
                past.push(edition);
            }
        }
        // If no current editions found, promote the first (most recent) one
        if (current.length === 0 && past.length > 0) {
            current.push(past.shift()!);
        }
        return { currentEditions: current, pastEditions: past };
    }, [event, preparedEditions]);

    const visibleRaces = useMemo(() => currentEditions.flatMap(edition => edition.visibleRaces), [currentEditions]);

    const firstRaceStarted = useMemo(() => {
        if (!isRaceDay || !visibleRaces.length) return false;
        return visibleRaces.some(r => {
            if (!r.dateOfRace || !r.startTime) return false;
            const parts = r.startTime.split(':').map(Number);
            const [h, m, s = 0] = parts;
            const start = new Date(r.dateOfRace + 'T00:00:00');
            start.setHours(h, m, s, 0);
            return currentTime >= start;
        });
    }, [isRaceDay, visibleRaces, currentTime]);
    const showChecklist = isRaceWeek && !firstRaceStarted;

    const showEditionSections = currentEditions.length > 1;
    const primaryEdition = useMemo(
        () => currentEditions.find(edition => edition.date === event?.nextEditionDate)
            ?? currentEditions.find(edition => edition.visibleRaces.length > 0)
            ?? currentEditions[0]
            ?? null,
        [currentEditions, event?.nextEditionDate],
    );

    const racesWithAnchors = useMemo(() => {
        const seen = new Map<string, number>();
        return visibleRaces.map((race) => {
            const baseRaw = race.distanceLabel?.trim() || race.name || 'race';
            const baseSlug = toAnchorSlug(baseRaw) || 'race';
            const count = (seen.get(baseSlug) ?? 0) + 1;
            seen.set(baseSlug, count);
            return {
                race,
                anchor: count === 1 ? `race-${baseSlug}` : `race-${baseSlug}-${count}`,
            };
        });
    }, [visibleRaces]);
    const raceAnchorMap = useMemo(
        () => new Map(racesWithAnchors.map(item => [item.race.id, item.anchor])),
        [racesWithAnchors],
    );

    const nextRaceDate = primaryEdition?.date ?? event?.nextEditionDate ?? null;

    const weatherTrailSlug = useMemo(() => {
        if (!event || event.daysUntil === null || event.daysUntil > 7 || event.daysUntil < 0) return undefined;
        return primaryEdition?.trailSlug
            ?? primaryEdition?.visibleRaces.find(race => race.trailSlug)?.trailSlug
            ?? visibleRaces.find(race => race.trailSlug)?.trailSlug
            ?? undefined;
    }, [event, primaryEdition, visibleRaces]);

    const { weather, loading: weatherLoading, error: weatherError } = useTrailWeather(weatherTrailSlug);
    const [raceDayChecklist, setRaceDayChecklist] = useState<Record<RaceDayChecklistKey, boolean>>({
        bib: false,
        shoes: false,
        gels: false,
        goodMood: false,
    });
    const checklistStorageKey = useMemo(
        () => event ? `utanvega-race-day-checklist-${event.id}-${nextRaceDate ?? 'none'}` : null,
        [event, nextRaceDate],
    );
    const checklistItems = useMemo(() => ([
        { key: 'bib', label: t('races.checklistBib') },
        { key: 'shoes', label: t('races.checklistShoes') },
        { key: 'gels', label: t('races.checklistFuel') },
        { key: 'goodMood', label: t('races.checklistGoodMoodReady') },
    ] as const), [t]);

    useEffect(() => {
        if (!isRaceWeek || !checklistStorageKey) return;
        try {
            const raw = localStorage.getItem(checklistStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Partial<Record<RaceDayChecklistKey, boolean>>;
            setRaceDayChecklist(prev => ({ ...prev, ...parsed }));
        } catch {
            // Ignore invalid local data
        }
    }, [isRaceWeek, checklistStorageKey]);

    useEffect(() => {
        if (!isRaceWeek || !checklistStorageKey) return;
        try {
            localStorage.setItem(checklistStorageKey, JSON.stringify(raceDayChecklist));
        } catch {
            // Ignore storage failures
        }
    }, [isRaceWeek, checklistStorageKey, raceDayChecklist]);

    if (loading) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <RunningLoader />
            </Layout>
        );
    }

    if (error || !event) {
        const normalize = (s: string) =>
            s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const slugWords = (slug ?? '').split('-').filter(w => w.length > 2);
        const suggestions = eventsLoading ? [] : events
            .filter(candidate => !['Hidden', 'Unlisted'].includes(candidate.status) && slugWords.some(word => normalize(candidate.name).includes(word)))
            .slice(0, 6);

        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <LostRunner
                    message={t('races.notFound')}
                    buttonLabel={t('races.backToRaces')}
                    onBack={() => navigate('/events')}
                />
                {suggestions.length > 0 && (
                    <Container maxWidth="md" sx={{ mt: 2, mb: 4 }}>
                        <Typography variant="h6" gutterBottom sx={{ textAlign: 'center' }}>
                            {t('races.wereYouLookingFor')}
                        </Typography>
                        <Stack spacing={1}>
                            {suggestions.map(candidate => (
                                <Paper
                                    key={candidate.id}
                                    elevation={1}
                                    sx={{
                                        p: 2,
                                        cursor: 'pointer',
                                        '&:hover': { bgcolor: 'action.hover' },
                                        borderRadius: 2,
                                    }}
                                    onClick={() => navigate(`/events/${candidate.slug}`)}
                                >
                                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                                        <Box>
                                            <Typography variant="subtitle1" fontWeight="bold">{candidate.name}</Typography>
                                            <Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap">
                                                {candidate.locationName && (
                                                    <Chip label={candidate.locationName} size="small" variant="outlined" />
                                                )}
                                                <Chip label={t('races.raceCount', { count: candidate.editionCount })} size="small" color="primary" variant="outlined" />
                                            </Stack>
                                        </Box>
                                        <Typography variant="body2" color="primary">→</Typography>
                                    </Stack>
                                </Paper>
                            ))}
                        </Stack>
                    </Container>
                )}
            </Layout>
        );
    }

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="md" sx={{ py: 3 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(-1)}
                    size="small"
                    sx={{ mb: 2 }}
                >
                    {t('races.backToRaces')}
                </Button>

                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 2.5, sm: 4 },
                        mb: 3,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.warning.main, 0.08)} 100%)`,
                        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                        <Typography variant="h4" fontWeight={800} sx={{
                            display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 200,
                            ...(event.status === 'Cancelled' && { textDecoration: 'line-through', opacity: 0.7 }),
                        }}>
                            <EmojiEventsIcon sx={{ color: theme.palette.warning.main, flexShrink: 0 }} />
                            {event.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                            {isPostRace ? (
                                <Chip
                                    label={t('races.justRaced', { defaultValue: '🏁 Just raced!' })}
                                    color="success"
                                    variant="filled"
                                    sx={{ fontWeight: 700, fontSize: '1rem', px: 1.5, py: 0.5, height: 'auto', flexShrink: 0 }}
                                />
                            ) : isRaceDay ? (
                                <Chip
                                    label={t('races.raceDayBadge')}
                                    color="error"
                                    variant="filled"
                                    sx={{
                                        fontWeight: 800,
                                        fontSize: '1rem',
                                        px: 1.5,
                                        py: 0.5,
                                        height: 'auto',
                                        flexShrink: 0,
                                        animation: 'pulse 1.5s ease-in-out infinite',
                                        '@keyframes pulse': {
                                            '0%, 100%': { transform: 'scale(1)', boxShadow: 'none' },
                                            '50%': { transform: 'scale(1.06)', boxShadow: `0 0 8px ${alpha(theme.palette.error.main, 0.6)}` },
                                        },
                                    }}
                                />
                            ) : event.status === 'Cancelled' ? (
                                <Chip label={t('races.statusCancelled')} color="error" sx={{ fontWeight: 700, fontSize: '1rem', px: 1.5, py: 0.5, height: 'auto', flexShrink: 0 }} />
                            ) : (event.status === 'Upcoming' || event.status === 'Unconfirmed') ? (
                                <Chip label={t('races.statusUpcoming')} color="info" sx={{ fontWeight: 700, fontSize: '1rem', px: 1.5, py: 0.5, height: 'auto', flexShrink: 0 }} />
                            ) : (
                                <Chip
                                    label={getCountdownLabel(event.daysUntil, t)}
                                    color={getCountdownColor(event.daysUntil)}
                                    variant="filled"
                                    sx={{
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        px: 1.5,
                                        py: 0.5,
                                        height: 'auto',
                                        flexShrink: 0,
                                        ...(event.daysUntil === 0 && {
                                            animation: 'pulse 1.5s ease-in-out infinite',
                                            '@keyframes pulse': {
                                                '0%, 100%': { transform: 'scale(1)', boxShadow: 'none' },
                                                '50%': { transform: 'scale(1.06)', boxShadow: `0 0 8px ${alpha(theme.palette.error.main, 0.6)}` },
                                            },
                                        }),
                                    }}
                                />
                            )}
                            {isEnabled('share_trail') && <ShareButtons title={event.name} />}
                        </Stack>
                    </Box>

                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                        {event.locationName && locationsEnabled && (
                            <Chip icon={<LocationOnIcon />} label={event.locationName} size="small" variant="outlined" />
                        )}
                        {event.organizerName && (
                            <Chip label={event.organizerName} size="small" variant="outlined" />
                        )}
                        <Chip
                            label={t('races.raceCount', { count: visibleRaces.length })}
                            size="small"
                            color="primary"
                        />
                    </Stack>

                    {event.alertMessage && (
                        <Alert
                            severity={(event.alertSeverity as 'info' | 'success' | 'warning' | 'error') ?? 'info'}
                            sx={{ mt: 2, borderRadius: 2, alignItems: 'center' }}
                        >
                            {event.alertMessage}
                        </Alert>
                    )}

                    {event.status !== 'Cancelled' && (() => {
                        const desc = formatScheduleDescription(
                            event.scheduleRule,
                            event.upcomingDates?.length ?? 0,
                            t,
                        );
                        return desc ? (
                            <Typography variant="body2" sx={{ mt: 1.5, fontStyle: 'italic', color: 'text.secondary' }}>
                                📅 {desc}
                            </Typography>
                        ) : null;
                    })()}

                    {(event.displayDate ?? event.nextEditionDate) && event.status !== 'Cancelled' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 2 }}>
                            <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                                {t('races.nextRace')}
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                                {formatNextDate((event.displayDate ?? event.nextEditionDate)!, t)}
                            </Typography>
                        </Box>
                    )}

                    {event.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, whiteSpace: 'pre-line' }}>
                            {event.description}
                        </Typography>
                    )}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }} alignItems={{ sm: 'center' }}>
                        {!showEditionSections && primaryEdition?.registrationUrl && (
                            <Button
                                variant="contained"
                                color="primary"
                                endIcon={<OpenInNewIcon />}
                                onClick={() => window.open(primaryEdition.registrationUrl!, '_blank', 'noopener')}
                                sx={{ textTransform: 'none' }}
                            >
                                {t('races.register')}
                            </Button>
                        )}
                        {!showEditionSections && primaryEdition?.resultsUrl && (
                            <Button
                                variant={isPostRace ? 'contained' : 'outlined'}
                                color={isPostRace ? 'success' : 'primary'}
                                size={isPostRace ? 'medium' : 'small'}
                                endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                onClick={() => window.open(primaryEdition.resultsUrl!, '_blank', 'noopener')}
                                sx={{ textTransform: 'none', ...(isPostRace && { fontWeight: 700 }) }}
                            >
                                {isPostRace ? `🏁 ${t('races.results', { defaultValue: 'Results' })}` : t('races.results', { defaultValue: 'Results' })}
                            </Button>
                        )}
                        {event.organizerWebsite && (
                            <Button
                                variant="outlined"
                                size="small"
                                endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                onClick={() => window.open(event.organizerWebsite!, '_blank', 'noopener')}
                                sx={{ textTransform: 'none' }}
                            >
                                {t('races.organizerSite')}
                            </Button>
                        )}
                        {event.socialLinks && event.socialLinks.length > 0 && (
                            <Stack direction="row" spacing={0.5}>
                                {event.socialLinks
                                    .filter((link) => /^https?:\/\//i.test(link.url))
                                    .map((link) => {
                                    const type = link.type.toLowerCase();
                                    let icon = <LanguageIcon />;
                                    if (type === 'facebook') icon = <FacebookIcon />;
                                    else if (type === 'instagram') icon = <InstagramIcon />;
                                    else if (type === 'x' || type === 'twitter') icon = <XIcon />;
                                    return (
                                        <Tooltip key={`${type}-${link.url}`} title={link.type}>
                                            <IconButton
                                                size="small"
                                                aria-label={link.type}
                                                onClick={() => window.open(link.url, '_blank', 'noopener')}
                                                sx={{ color: 'text.secondary' }}
                                            >
                                                {icon}
                                            </IconButton>
                                        </Tooltip>
                                    );
                                })}
                            </Stack>
                        )}
                    </Stack>

                    {!showEditionSections && primaryEdition && (
                        <Box sx={{ mt: 2.5 }}>
                            <EditionMeta edition={primaryEdition} t={t} hideMeta />
                        </Box>
                    )}
                </Paper>

                {showChecklist && (
                    <Card
                        variant="outlined"
                        sx={{
                            mb: 3,
                            borderRadius: 3,
                            borderColor: alpha(theme.palette.error.main, 0.3),
                            background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.06)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
                        }}
                    >
                        <CardContent>
                            <Typography variant="h6" fontWeight={800}>
                                {t('races.checklistTitle')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                                {weather && !weatherLoading
                                    ? t('races.checklistWeatherReady', {
                                        temperature: Math.round(weather.current.temperature),
                                        wind: Math.round(weather.current.windSpeed),
                                    })
                                    : t('races.checklistWeatherFallback')}
                            </Typography>

                            <FormGroup>
                                {checklistItems.map(item => (
                                    <FormControlLabel
                                        key={item.key}
                                        control={(
                                            <Checkbox
                                                checked={raceDayChecklist[item.key]}
                                                onChange={(eventValue) => {
                                                    setRaceDayChecklist(prev => ({
                                                        ...prev,
                                                        [item.key]: eventValue.target.checked,
                                                    }));
                                                }}
                                            />
                                        )}
                                        label={item.label}
                                    />
                                ))}
                            </FormGroup>
                            <Typography variant="caption" color="text.secondary">
                                {t('races.checklistSavedLocally')}
                            </Typography>
                        </CardContent>
                    </Card>
                )}

                <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
                    {t('races.racesHeading')}
                </Typography>

                {currentEditions.length === 0 && pastEditions.length === 0 ? (
                    <Alert severity="info">{t('races.noRaces')}</Alert>
                ) : showEditionSections ? (
                    <Stack spacing={3}>
                        {currentEditions.map(edition => (
                            <Paper key={edition.id} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2.5 }}>
                                <EditionMeta edition={edition} t={t} showHeader />
                                {edition.visibleRaces.length === 0 ? (
                                    <Alert severity="info" sx={{ mt: 2 }}>{t('races.noRaces')}</Alert>
                                ) : (
                                    <Stack spacing={2} sx={{ mt: 2 }}>
                                        {edition.visibleRaces.map(race => (
                                            <RaceCard
                                                key={race.id}
                                                race={race}
                                                anchor={raceAnchorMap.get(race.id) ?? `race-${race.id}`}
                                                competitionName={event.name}
                                                t={t}
                                                showPredict={isEnabled('tool_trail_predictor')}
                                                showShareCard={isRaceWeek && isEnabled('share_trail')}
                                                showFinishCard={isPostRace && isEnabled('share_trail')}
                                                daysUntil={event.daysUntil}
                                                activityType={event.activityType}
                                                editionDate={edition.date}
                                                now={currentTime}
                                            />
                                        ))}
                                    </Stack>
                                )}
                            </Paper>
                        ))}
                    </Stack>
                ) : visibleRaces.length === 0 && currentEditions.length === 0 ? (
                    <Alert severity="info">{t('races.noRaces')}</Alert>
                ) : (
                    <Stack spacing={2}>
                        {racesWithAnchors.map(({ race, anchor }) => (
                            <RaceCard
                                key={race.id}
                                race={race}
                                anchor={anchor}
                                competitionName={event.name}
                                t={t}
                                showPredict={isEnabled('tool_trail_predictor')}
                                showShareCard={isRaceWeek && isEnabled('share_trail')}
                                showFinishCard={isPostRace && isEnabled('share_trail')}
                                daysUntil={event.daysUntil}
                                activityType={event.activityType}
                                editionDate={event.nextEditionDate}
                                now={currentTime}
                            />
                            ))}
                    </Stack>
                )}

                {event.status !== 'Cancelled' && event.upcomingDates && event.upcomingDates.length > 1 && (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                            {t('races.scheduleHeading')}
                        </Typography>
                        <Paper
                            variant="outlined"
                            sx={{ borderRadius: 2, overflow: 'hidden' }}
                        >
                            <List disablePadding>
                                {event.upcomingDates.map((dateStr, idx) => {
                                    const d = new Date(dateStr + 'T00:00:00');
                                    const now = new Date();
                                    now.setHours(0, 0, 0, 0);
                                    const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
                                    const isNext = idx === 0;
                                    return (
                                        <Box key={dateStr}>
                                            {idx > 0 && <Divider />}
                                            <ListItem
                                                sx={{
                                                    py: 1,
                                                    bgcolor: isNext ? alpha(theme.palette.primary.main, 0.06) : undefined,
                                                }}
                                            >
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <CalendarTodayIcon sx={{ fontSize: 18, color: isNext ? theme.palette.primary.main : 'text.secondary' }} />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={formatNextDate(dateStr, t)}
                                                    primaryTypographyProps={{
                                                        fontWeight: isNext ? 700 : 400,
                                                        color: isNext ? 'primary' : 'text.primary',
                                                    }}
                                                />
                                                {isNext && (
                                                    <Chip
                                                        label={getCountdownLabel(diffDays, t)}
                                                        color={getCountdownColor(diffDays)}
                                                        size="small"
                                                        sx={{ fontWeight: 600 }}
                                                    />
                                                )}
                                                {!isNext && diffDays > 0 && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        {t('races.daysUntil', { count: diffDays })}
                                                    </Typography>
                                                )}
                                            </ListItem>
                                        </Box>
                                    );
                                })}
                            </List>
                        </Paper>
                    </Box>
                )}

                {isEnabled('weather_forecast') && weatherTrailSlug && (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
                            {t('races.raceDayWeather')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            {t('races.raceDayWeatherDesc')}
                        </Typography>
                        <WeatherCard weather={weather} loading={weatherLoading} error={weatherError} raceDate={nextRaceDate} />
                    </Box>
                )}

                {pastEditions.length > 0 && (
                    <Box sx={{ mt: 4 }}>
                        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
                            {t('races.history.title', { defaultValue: 'Event History' })}
                        </Typography>
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                            gap: 1.5,
                        }}>
                            {pastEditions.map(edition => {
                                const heading = edition.title?.trim() || String(edition.year);
                                const raceCount = edition.visibleRaces.length;
                                const editionKey = edition.date ?? String(edition.year ?? edition.id);
                                return (
                                    <Paper
                                        key={edition.id}
                                        variant="outlined"
                                        tabIndex={0}
                                        role="link"
                                        sx={{
                                            p: { xs: 1.5, sm: 2 },
                                            borderRadius: 2,
                                            cursor: 'pointer',
                                            transition: 'background-color 0.15s',
                                            '&:hover, &:focus-visible': { bgcolor: 'action.hover', outline: 'none' },
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                        }}
                                        onClick={() => navigate(`/events/${slug}/history/${editionKey}`)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/events/${slug}/history/${editionKey}`); } }}
                                    >
                                        <Typography variant="subtitle1" fontWeight={600} noWrap>
                                            {heading}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                                            {edition.date && (
                                                <Chip
                                                    icon={<CalendarTodayIcon />}
                                                    label={formatNextDate(edition.date, t)}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                            {raceCount > 0 && (
                                                <Chip
                                                    icon={<DirectionsRunIcon />}
                                                    label={t('races.raceCount', { count: raceCount })}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                            {edition.resultsUrl && (
                                                <Chip
                                                    label={t('races.results', { defaultValue: 'Results' })}
                                                    size="small"
                                                    color="primary"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(edition.resultsUrl!, '_blank', 'noopener');
                                                    }}
                                                />
                                            )}
                                        </Stack>
                                    </Paper>
                                );
                            })}
                        </Box>
                    </Box>
                )}
            </Container>
        </Layout>
    );
}

function RaceCard({
    race,
    anchor,
    competitionName,
    t,
    showPredict,
    showShareCard,
    showFinishCard,
    daysUntil,
    activityType,
    editionDate,
    now,
}: {
    race: RaceDto;
    anchor: string;
    competitionName: string;
    t: (key: string, opts?: Record<string, unknown>) => string;
    showPredict?: boolean;
    showShareCard?: boolean;
    showFinishCard?: boolean;
    daysUntil?: number | null;
    activityType?: string;
    editionDate?: string | null;
    now: Date;
}) {
    const theme = useTheme();
    const raceDateTime = formatRaceDateTime(race.dateOfRace, race.startTime, t);

    // Race phase: determine if race is in progress (started but not finished)
    const racePhase = useMemo(() => {
        if (daysUntil !== 0 || !race.dateOfRace || !race.startTime) return 'pre';
        const parts = race.startTime.split(':').map(Number);
        const [h, m, s = 0] = parts;
        const start = new Date(race.dateOfRace + 'T00:00:00');
        start.setHours(h, m, s, 0);
        if (now < start) return 'pre';
        if (race.cutoffMinutes == null) return 'in-progress';
        const cutoffMs = race.cutoffMinutes * 60 * 1000;
        if (now.getTime() - start.getTime() < cutoffMs) return 'in-progress';
        return 'finished';
    }, [daysUntil, race.dateOfRace, race.startTime, race.cutoffMinutes, now]);

    return (
        <Card id={anchor} variant="outlined" sx={{
            borderRadius: 2,
            ...(race.status === 'Cancelled' && { opacity: 0.6 }),
            ...(race.status === 'Upcoming' && { borderStyle: 'dashed', borderColor: theme.palette.info.main }),
            ...(racePhase === 'in-progress' && { borderColor: theme.palette.success.main, borderWidth: 2 }),
        }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, justifyContent: 'space-between' }}>
                    <Typography variant="h6" fontWeight={700} sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap',
                        ...(race.status === 'Cancelled' && { textDecoration: 'line-through' }),
                    }}>
                        <DirectionsRunIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                        {race.name}
                        {race.status === 'Cancelled' && (
                            <Chip label={t('races.statusCancelled')} size="small" color="error" sx={{ ml: 0.5, fontWeight: 600 }} />
                        )}
                        {race.status === 'Upcoming' && (
                            <Chip label={t('races.statusUpcoming')} size="small" color="info" sx={{ ml: 0.5, fontWeight: 600 }} />
                        )}
                        {racePhase === 'in-progress' && (
                            <Chip label={t('races.inProgress', { defaultValue: '🏃 In progress' })} size="small" color="success" sx={{ ml: 0.5, fontWeight: 600 }} />
                        )}
                        {racePhase === 'finished' && daysUntil === 0 && (
                            <Chip label={t('races.raceFinished', { defaultValue: '🏁 Finished' })} size="small" color="default" sx={{ ml: 0.5, fontWeight: 600 }} />
                        )}
                    </Typography>
                    {(race.trailSlug || showShareCard || showFinishCard) && (
                        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, flexWrap: 'wrap' }}>
                            {showPredict && race.trailSlug && (
                                <Button
                                    component={RouterLink}
                                    to={`/tools/trail-predictor?trail=${encodeURIComponent(race.trailSlug)}`}
                                    size="small"
                                    variant="text"
                                    sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: 'auto' }}
                                >
                                    🔮 {t('races.predict')}
                                </Button>
                            )}
                            {race.trailSlug && (
                                <Button
                                    component={RouterLink}
                                    to={`/trails/${race.trailSlug}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                                >
                                    {ACTIVITY_EMOJI[race.trailSlug ? 'TrailRunning' : ''] ?? '🗺️'} {t('races.viewTrail')}
                                </Button>
                            )}
                            {showShareCard && racePhase !== 'finished' && (
                                <RaceShareCard
                                    eventName={competitionName}
                                    raceName={race.name}
                                    distanceLabel={race.distanceLabel}
                                    date={race.dateOfRace ?? editionDate ?? null}
                                    daysUntil={daysUntil ?? null}
                                    activityType={activityType}
                                />
                            )}
                            {(showFinishCard || (showShareCard && racePhase === 'finished')) && (
                                <RaceFinishCard
                                    eventName={competitionName}
                                    raceName={race.name}
                                    distanceLabel={race.distanceLabel}
                                    date={race.dateOfRace ?? editionDate ?? null}
                                    activityType={activityType}
                                />
                            )}
                        </Stack>
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

                {/* Race progress bar on race day */}
                {daysUntil === 0 && race.dateOfRace && race.startTime && race.cutoffMinutes != null && (
                    <RaceProgressBar
                        startTime={race.startTime}
                        dateOfRace={race.dateOfRace}
                        cutoffMinutes={race.cutoffMinutes}
                        now={now}
                    />
                )}

                {race.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
                        {race.description}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}
