import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
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
    Menu,
    MenuItem,
    Link,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LanguageIcon from '@mui/icons-material/Language';
import XIcon from '@mui/icons-material/X';
import YouTubeIcon from '@mui/icons-material/YouTube';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { breadcrumbContext } from '../utils/breadcrumbContext';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VideocamIcon from '@mui/icons-material/Videocam';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import TimerIcon from '@mui/icons-material/Timer';
import StraightenIcon from '@mui/icons-material/Straighten';
import TerrainIcon from '@mui/icons-material/Terrain';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import { getActivityIcon } from '../utils/activityIcon';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import ShareButtons from '../components/ShareButtons';
import SendTipButton from '../components/SendTipButton';
import RaceShareCard from '../components/RaceShareCard';
import RaceFinishCard from '../components/RaceFinishCard';
import RaceProgressBar from '../components/RaceProgressBar';
import Layout from '../components/Layout';
import RunningLoader from '../components/RunningLoader';
import LostRunner from '../components/LostRunner';
import WeatherCard from '../components/WeatherCard';
import GalleryLinks from '../components/GalleryLinks';
import { useEvents, useEventBySlug } from '../hooks/useEvents';
import type { EventEditionDto, RaceDto, ScheduleRule } from '../hooks/useEvents';
import { useFavoriteEvents } from '../hooks/useFavoriteEvents';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useLocalize } from '../utils/localize';
import { useTrailWeather } from '../hooks/useTrails';
import { useLocations } from '../hooks/useLocations';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MapFollowController from '../components/MapFollowController';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
// @ts-expect-error - Leaflet internal
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIconRetina, iconUrl: markerIcon, shadowUrl: markerShadow });

const userLocationIcon = L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="#1976d2" fill-opacity="0.9" stroke="white" stroke-width="2"/>
        <circle cx="10" cy="10" r="3" fill="white"/>
    </svg>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
});

import { splitMinutes } from '../utils/cutoffTime';

type CompetitionDetailPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

type PreparedEdition = EventEditionDto & {
    visibleRaces: RaceDto[];
};

import { ACTIVITY_EMOJI } from '../constants/activityEmoji';
import { googleCalendarUrl, outlookCalendarUrl, downloadIcs } from '../utils/calendarLinks';
import EventDateBadge from '../components/EventDateBadge';
import { formatDateRange, formatNextDate, getCountdownColor, getCountdownLabel, formatRaceDateTime, getEventTypeColor, isEffectivelyCancelled, isEffectivelyUnconfirmed, editionKeyFor } from '../utils/eventUtils';
import { getTicketStatusColor } from '../utils/ticketStatus';
import { trackEventQRClick } from '../utils/analytics';

type RaceDayChecklistKey = 'bib' | 'shoes' | 'gels' | 'goodMood';

const RUN_ACTIVITY_TYPES = new Set(['TrailRunning', 'Running', 'FunRun', 'CrossCountryRun', 'ObstacleCourse']);

function toAnchorSlug(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function formatCutoff(minutes: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
    const { hours: h, minutes: m } = splitMinutes(minutes);
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
    endDate?: string | null,
    startDate?: string | null,
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
            date: formatDateRange(startDate ?? rule.date, endDate, t),
        });
    }

    if (rule.type === 'Approximate' && rule.month) {
        if (rule.monthEnd && rule.monthEnd !== rule.month) {
            return t('races.scheduleApproximateRange', {
                monthStart: months[(rule.month - 1)] ?? '',
                monthEnd: months[(rule.monthEnd - 1)] ?? '',
            });
        }
        return t('races.scheduleApproximate', {
            month: months[(rule.month - 1)] ?? '',
        });
    }

    return null;
}

function getRegistrationStatusColor(status: string | null | undefined): 'success' | 'warning' | 'default' {
    if (status === 'Open') return 'success';
    if (status === 'NotStarted') return 'warning';
    return 'default';
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
    const loc = useLocalize();
    const heading = loc(edition.title?.trim() || null, edition.titleEn) ?? String(edition.year);

    return (
        <Box>
            {showHeader && (
                <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                    {heading}
                </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {!showHeader && edition.title && (
                    <Chip label={loc(edition.title, edition.titleEn) ?? edition.title} size="small" variant="outlined" />
                )}
                {!hideMeta && (
                    <Chip label={String(edition.year)} size="small" variant="outlined" color="primary" />
                )}
                {!hideMeta && edition.date && (
                    <Chip
                        icon={<CalendarTodayIcon />}
                        label={formatDateRange(edition.date, edition.endDate, t)}
                        size="small"
                        variant="outlined"
                    />
                )}
            </Stack>
            {edition.notes && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, whiteSpace: 'pre-line' }}>
                    {loc(edition.notes, edition.notesEn)}
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
                    {edition.registrationStatus && (
                        <Chip
                            label={t(`races.registrationStatus.${edition.registrationStatus}`, { defaultValue: edition.registrationStatus })}
                            size="small"
                            color={getRegistrationStatusColor(edition.registrationStatus)}
                        />
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
                    <GalleryLinks galleries={edition.galleries} />
                </Stack>
            )}
        </Box>
    );
}

export default function CompetitionDetailPage({ mode, onToggleMode }: CompetitionDetailPageProps) {
    const { slug } = useParams<{ slug: string }>();
    const { t } = useTranslation();
    const loc = useLocalize();
    const { event, loading, error } = useEventBySlug(slug);
    usePageTitle(event ? (loc(event.name, event.nameEn) ?? event.name) : undefined);
    const { events, loading: eventsLoading } = useEvents();
    const navigate = useNavigate();
    const theme = useTheme();
    const { isEnabled } = useFeatureFlags();
    const locationsEnabled = isEnabled('locations_page');
    const { locations } = useLocations();
    const { toggleFavoriteEvent, isFavoriteEvent } = useFavoriteEvents();

    const [followMe, setFollowMe] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [eventQROpen, setEventQROpen] = useState(false);
    const [eventQRCopied, setEventQRCopied] = useState(false);

    useEffect(() => {
        if (!followMe || !navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.warn('Geolocation error:', err),
            { enableHighAccuracy: true },
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [followMe]);

    const mapPin = useMemo(() => {
        if (!event) return null;
        if (event.gpxPointLat != null && event.gpxPointLng != null) {
            return { lat: event.gpxPointLat, lng: event.gpxPointLng };
        }
        if (event.locationId) {
            const loc = locations.find(l => l.id === event.locationId);
            if (loc?.latitude != null && loc?.longitude != null) {
                return { lat: loc.latitude, lng: loc.longitude };
            }
        }
        return null;
    }, [event, locations]);
    const confettiFiredForEvent = useRef<string | null>(null);

    // Uses the flattened event.editionEffectiveCancelled (not primaryEdition) since primaryEdition
    // is computed later and itself depends on isPostRace below — going through primaryEdition here
    // would be circular.
    const eventOrEditionCancelled = !!event && isEffectivelyCancelled({ status: event.status, effectiveCancelled: event.editionEffectiveCancelled });
    const isRaceDay = !eventOrEditionCancelled && event?.daysUntil === 0;
    const isRaceWeek = !eventOrEditionCancelled && event?.daysUntil != null && event.daysUntil >= 0 && event.daysUntil <= 7;
    const isPostRace = !eventOrEditionCancelled && event?.daysUntil != null && event.daysUntil < 0 && event.daysUntil >= -3;

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
        const displayDate = event.displayDate;
        const current: PreparedEdition[] = [];
        const past: PreparedEdition[] = [];
        for (const edition of preparedEditions) {
            const edDate = edition.date;
            const isNextEdition = nextDate && edDate === nextDate;
            const effectiveEnd = edition.endDate ?? edDate;
            const isFuture = effectiveEnd && effectiveEnd >= today;
            const hasNoDate = !edDate;
            const isDisplayDate = isPostRace && displayDate && edDate === displayDate;
            if (isNextEdition || isFuture || hasNoDate || isDisplayDate) {
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
    }, [event, preparedEditions, isPostRace]);

    const visibleRaces = useMemo(() => currentEditions.flatMap(edition => edition.visibleRaces), [currentEditions]);

    const firstRaceStarted = useMemo(() => {
        if (!isRaceDay || !visibleRaces.length) return false;
        return visibleRaces.some(r => {
            if (r.status === 'Cancelled') return false;
            if (!r.dateOfRace || !r.startTime) return false;
            const parts = r.startTime.split(':').map(Number);
            const [h, m, s = 0] = parts;
            const start = new Date(r.dateOfRace + 'T00:00:00');
            start.setHours(h, m, s, 0);
            return currentTime >= start;
        });
    }, [isRaceDay, visibleRaces, currentTime]);
    const isRunningEvent = RUN_ACTIVITY_TYPES.has(event?.activityType ?? '') ||
        visibleRaces.some(r => RUN_ACTIVITY_TYPES.has(r.activityType ?? '') || RUN_ACTIVITY_TYPES.has(r.trailActivityType ?? ''));
    const showChecklist = isRaceWeek && !firstRaceStarted && isRunningEvent;

    const showEditionSections = currentEditions.length > 1;
    const primaryEdition = useMemo(
        () => (isPostRace && event?.displayDate
                ? currentEditions.find(edition => edition.date === event.displayDate)
                : undefined)
            ?? currentEditions.find(edition => edition.date === event?.nextEditionDate)
            ?? currentEditions.find(edition => edition.visibleRaces.length > 0)
            ?? currentEditions[0]
            ?? null,
        [currentEditions, event?.nextEditionDate, event?.displayDate, isPostRace],
    );

    // Prefer the richer primaryEdition object (already in scope) over the flattened EventSummary
    // fields — it reflects exactly the edition this page is displaying.
    const heroCancelled = !!event && isEffectivelyCancelled({ status: event.status, effectiveCancelled: primaryEdition?.effectiveCancelled });
    const heroUnconfirmed = !!event && isEffectivelyUnconfirmed({ status: event.status, editionStatus: primaryEdition?.status });

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
        <Layout mode={mode} onToggleMode={onToggleMode} breadcrumb={[{ label: t('nav.events'), to: '/events' }, { label: loc(event.name, event.nameEn) ?? event.name }]}>
            <Container maxWidth="md" sx={{ py: 3 }}>

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
                            <Box component="span" sx={{ display: 'flex', color: 'text.secondary', flexShrink: 0, '& svg': { fontSize: '2rem' } }}>
                                {getActivityIcon(event.activityType)}
                            </Box>
                            {loc(event.name, event.nameEn)}
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
                            ) : heroCancelled ? (
                                <Chip label={t('races.statusCancelled')} color="error" sx={{ fontWeight: 700, fontSize: '1rem', px: 1.5, py: 0.5, height: 'auto', flexShrink: 0 }} />
                            ) : (event.status === 'Upcoming' || heroUnconfirmed) ? (
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
                            {isEnabled('share_trail') && <ShareButtons title={loc(event.name, event.nameEn) ?? event.name} />}
                            <Tooltip title={isFavoriteEvent(slug ?? '') ? t('races.removeFavorite') : t('races.addFavorite')}>
                                <IconButton size="small" onClick={() => toggleFavoriteEvent(slug ?? '')} color={isFavoriteEvent(slug ?? '') ? 'warning' : 'default'}>
                                    {isFavoriteEvent(slug ?? '') ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={t('qr.showQR')}>
                                <IconButton size="small" onClick={() => { trackEventQRClick(slug ?? ''); setEventQROpen(true); }}>
                                    <QrCode2Icon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Box>

                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip
                            label={t(`races.eventTypes.${event.type}`, event.type)}
                            size="small"
                            color={getEventTypeColor(event.type)}
                            variant="outlined"
                        />
                        {event.locationName && locationsEnabled && (
                            <Chip icon={<LocationOnIcon />} label={event.locationName} size="small" variant="outlined" />
                        )}
                        {event.organizerName && (
                            event.organizerSlug
                                ? <Chip
                                    label={loc(event.organizerName, event.organizerNameEn) ?? event.organizerName}
                                    size="small"
                                    variant="outlined"
                                    component="a"
                                    href={`/organizers/${event.organizerSlug}`}
                                    clickable
                                  />
                                : <Chip label={loc(event.organizerName, event.organizerNameEn) ?? event.organizerName} size="small" variant="outlined" />
                        )}
                        {(event.type === 'Race' || event.type === 'Series') && (
                            <Chip
                                label={t('races.raceCount', { count: visibleRaces.length })}
                                size="small"
                                color="primary"
                            />
                        )}
                    </Stack>

                    {event.alertMessage && (
                        <Alert
                            severity={(event.alertSeverity as 'info' | 'success' | 'warning' | 'error') ?? 'info'}
                            sx={{ mt: 2, borderRadius: 2, alignItems: 'center' }}
                        >
                            {loc(event.alertMessage, event.alertMessageEn)}
                        </Alert>
                    )}

                    {!heroCancelled && (() => {
                        const editionEndDate = primaryEdition?.endDate ?? event.endDisplayDate;
                        const desc = formatScheduleDescription(
                            event.scheduleRule,
                            event.upcomingDates?.length ?? 0,
                            t,
                            editionEndDate,
                            primaryEdition?.date ?? event.displayDate,
                        );
                        return desc ? (
                            <Typography variant="body2" sx={{ mt: 1.5, fontStyle: 'italic', color: 'text.secondary' }}>
                                📅 {desc}
                            </Typography>
                        ) : null;
                    })()}

                    {(event.displayDate ?? event.nextEditionDate) && !heroCancelled && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 2, flexWrap: 'wrap' }}>
                            <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                                {t(event.daysUntil != null && event.daysUntil < 0 ? 'races.lastRace' : 'races.nextRace')}
                            </Typography>
                            <EventDateBadge dateStr={(event.displayDate ?? event.nextEditionDate)!} endDateStr={primaryEdition?.endDate ?? event.endDisplayDate} />
                            <Typography variant="body1">
                                {formatDateRange((event.displayDate ?? event.nextEditionDate)!, primaryEdition?.endDate ?? event.endDisplayDate, t)}
                            </Typography>
                        </Box>
                    )}

                    {event.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, whiteSpace: 'pre-line' }}>
                            {loc(event.description, event.descriptionEn)}
                        </Typography>
                    )}

                    {mapPin && (
                        <Box
                            sx={{
                                mt: 2,
                                borderRadius: 2,
                                overflow: 'hidden',
                                height: 220,
                                width: '100%',
                                maxWidth: '100%',
                                border: '1px solid',
                                borderColor: 'divider',
                                position: 'relative',
                            }}
                        >
                            <Paper
                                elevation={3}
                                sx={{
                                    position: 'absolute',
                                    top: 10,
                                    right: 10,
                                    zIndex: 1100,
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                }}
                            >
                                <IconButton
                                    size="small"
                                    onClick={() => setFollowMe(f => !f)}
                                    color={followMe ? 'primary' : 'default'}
                                    title={followMe ? t('map.stopFollowing') : t('map.followLocation')}
                                    aria-label="follow my location"
                                    sx={{
                                        backgroundColor: followMe ? 'rgba(25,118,210,0.1)' : 'white',
                                        '&:hover': { backgroundColor: followMe ? 'rgba(25,118,210,0.2)' : '#f5f5f5' },
                                    }}
                                >
                                    <MyLocationIcon fontSize="small" />
                                </IconButton>
                            </Paper>
                            <MapContainer
                                center={[mapPin.lat, mapPin.lng]}
                                zoom={12}
                                style={{ height: '100%', width: '100%' }}
                                scrollWheelZoom={false}
                                attributionControl={false}
                            >
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <Marker position={[mapPin.lat, mapPin.lng]} />
                                {userLocation && (
                                    <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                                        <Popup>{t('map.yourLocation', 'Your location')}</Popup>
                                    </Marker>
                                )}
                                <MapFollowController
                                    followMe={followMe}
                                    userLocation={userLocation}
                                    returnCenter={[mapPin.lat, mapPin.lng]}
                                    returnZoom={12}
                                    onDrag={() => setFollowMe(false)}
                                />
                            </MapContainer>
                        </Box>
                    )}

                    <Box sx={{ mt: 2.5 }}>
                        {/* Row 1: action buttons */}
                        <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
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
                            <GalleryLinks galleries={primaryEdition?.galleries ?? []} />
                            {event.youtubeUrl && (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<VideocamIcon sx={{ fontSize: 16 }} color="error" />}
                                    endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                    onClick={() => window.open(event.youtubeUrl!, '_blank', 'noopener')}
                                    sx={{ textTransform: 'none' }}
                                >
                                    360°
                                </Button>
                            )}
                            {isEnabled('calendar_integration', false) && (event.displayDate ?? event.nextEditionDate) && !heroCancelled && event.daysUntil != null && event.daysUntil >= 0 && (
                                <AddToCalendarButton event={event} endDate={primaryEdition?.endDate ?? event.endDisplayDate} t={t} />
                            )}
                        </Stack>

                        {/* Row 2: icon links */}
                        {(isEnabled('directions_to_trailhead') && mapPin) || (event.socialLinks && event.socialLinks.length > 0) ? (
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} alignItems="center">
                                {isEnabled('directions_to_trailhead') && mapPin && (
                                    <Tooltip title={t('races.directionsToEvent', 'Directions to event')} arrow>
                                        <IconButton
                                            size="small"
                                            component="a"
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${mapPin.lat},${mapPin.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <DirectionsCarIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {event.socialLinks && event.socialLinks
                                    .filter((link) => /^https?:\/\//i.test(link.url))
                                    .map((link) => {
                                        const type = link.type.toLowerCase();
                                        let icon = <LanguageIcon />;
                                        if (type === 'facebook') icon = <FacebookIcon />;
                                        else if (type === 'instagram') icon = <InstagramIcon />;
                                        else if (type === 'x' || type === 'twitter') icon = <XIcon />;
                                        else if (type === 'youtube') icon = <YouTubeIcon />;
                                        else if (type === 'tiktok') icon = <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>;
                                        else if (type === 'strava') icon = <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>;
                                        else if (type === 'vimeo') icon = <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881l-1.924-7.059c-.702-2.587-1.459-3.88-2.26-3.88-.177 0-.795.372-1.854 1.113L0 7.697c1.059-.924 2.101-1.848 3.124-2.772C4.587 3.55 5.697 2.766 6.48 2.766c1.757 0 2.834 1.648 3.236 4.948.435 3.568.74 5.786.905 6.65.504 2.291 1.06 3.435 1.668 3.435.471 0 1.178-.747 2.116-2.241.937-1.494 1.438-2.631 1.498-3.406.131-1.29-.373-1.934-1.498-1.934-.532 0-1.081.122-1.649.365 1.095-3.591 3.187-5.337 6.285-5.239 2.292.066 3.371 1.553 3.236 4.072z"/></svg>;
                                        return (
                                            <Tooltip key={`${type}-${link.url}`} title={link.type}>
                                                <IconButton
                                                    size="small"
                                                    aria-label={link.type}
                                                    onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                                                    sx={{ color: 'text.secondary' }}
                                                >
                                                    {icon}
                                                </IconButton>
                                            </Tooltip>
                                        );
                                    })}
                            </Stack>
                        ) : null}
                    </Box>

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

                {(event.type === 'Race' || event.type === 'Series') && (
                    <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
                        {t('races.racesHeading')}
                    </Typography>
                )}

                {currentEditions.length === 0 && pastEditions.length === 0 ? (
                    (event.type === 'Race' || event.type === 'Series') && <Alert severity="info">{t('races.noRaces')}</Alert>
                ) : showEditionSections ? (
                    <Stack spacing={3}>
                        {currentEditions.map(edition => (
                            <Paper key={edition.id} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2.5 }}>
                                <EditionMeta edition={edition} t={t} showHeader />
                                {edition.visibleRaces.length === 0 ? (
                                    (event.type === 'Race' || event.type === 'Series') && <Alert severity="info" sx={{ mt: 2 }}>{t('races.noRaces')}</Alert>
                                ) : (
                                    <Stack spacing={2} sx={{ mt: 2 }}>
                                        {edition.visibleRaces.map(race => (
                                            <RaceCard
                                                key={race.id}
                                                race={race}
                                                anchor={raceAnchorMap.get(race.id) ?? `race-${race.id}`}
                                                competitionName={loc(event.name, event.nameEn) ?? event.name}
                                                t={t}
                                                showPredict={isEnabled('tool_trail_predictor')}
                                                showShareCard={isRaceWeek && isEnabled('share_trail')}
                                                showFinishCard={isPostRace && isEnabled('share_trail') && edition.date === event.displayDate}
                                                daysUntil={event.daysUntil}
                                                activityType={event.activityType}
                                                editionDate={edition.date}
                                                eventSlug={event.slug ?? slug}
                                                now={currentTime}
                                            />
                                        ))}
                                    </Stack>
                                )}
                            </Paper>
                        ))}
                    </Stack>
                ) : visibleRaces.length === 0 && currentEditions.length === 0 ? (
                    (event.type === 'Race' || event.type === 'Series') && <Alert severity="info">{t('races.noRaces')}</Alert>
                ) : (
                    <Stack spacing={2}>
                        {racesWithAnchors.map(({ race, anchor }) => (
                            <RaceCard
                                key={race.id}
                                race={race}
                                anchor={anchor}
                                competitionName={loc(event.name, event.nameEn) ?? event.name}
                                t={t}
                                showPredict={isEnabled('tool_trail_predictor')}
                                showShareCard={isRaceWeek && isEnabled('share_trail')}
                                showFinishCard={isPostRace && isEnabled('share_trail') && currentEditions[0]?.date === event.displayDate}
                                daysUntil={event.daysUntil}
                                activityType={event.activityType}
                                editionDate={event.displayDate ?? event.nextEditionDate}
                                eventSlug={event.slug ?? slug}
                                now={currentTime}
                            />
                            ))}
                    </Stack>
                )}

                {!heroCancelled && event.upcomingDates && event.upcomingDates.length > 1 && (
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
                                const editionKey = editionKeyFor(edition);
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
                                            <GalleryLinks galleries={edition.galleries} variant="chip" stopPropagation />
                                        </Stack>
                                    </Paper>
                                );
                            })}
                        </Box>
                    </Box>
                )}

                <Box sx={{ mt: 4, mb: 2 }}>
                    <SendTipButton type="event" />
                </Box>
            </Container>

            {/* Event QR dialog */}
            {(() => {
                const eventUrl = `${window.location.origin}/events/${slug}`;
                return (
                    <Dialog open={eventQROpen} onClose={() => setEventQROpen(false)} maxWidth="xs" fullWidth>
                        <DialogTitle sx={{ textAlign: 'center', pb: 0 }}>
                            {loc(event.name, event.nameEn) ?? event.name}
                        </DialogTitle>
                        <DialogContent>
                            <Box display="flex" flexDirection="column" alignItems="center" py={2} gap={2}>
                                <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2 }}>
                                    <QRCodeSVG value={eventUrl} size={200} level="H" includeMargin />
                                </Box>
                                <Typography variant="body2" color="text.secondary" align="center">
                                    {t('qr.scanEvent')}
                                </Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={eventQRCopied ? <CheckIcon /> : <ContentCopyIcon />}
                                    color={eventQRCopied ? 'success' : 'primary'}
                                    onClick={() => {
                                        navigator.clipboard.writeText(eventUrl);
                                        setEventQRCopied(true);
                                        setTimeout(() => setEventQRCopied(false), 2000);
                                    }}
                                    sx={{ textTransform: 'none' }}
                                >
                                    {eventQRCopied ? t('qr.linkCopied') : t('qr.copyLink')}
                                </Button>
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setEventQROpen(false)}>{t('qr.close')}</Button>
                        </DialogActions>
                    </Dialog>
                );
            })()}
        </Layout>
    );
}

function AddToCalendarButton({ event, endDate, t }: { event: { name: string; displayDate?: string | null; nextEditionDate?: string | null; locationName?: string | null; slug: string; description?: string | null }; endDate?: string | null; t: (key: string, opts?: Record<string, unknown>) => string }) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const date = (event.displayDate ?? event.nextEditionDate)!;
    const calEvent = {
        title: event.name,
        date,
        endDate: endDate ?? undefined,
        location: event.locationName ?? undefined,
        description: event.description ?? undefined,
        url: `${window.location.origin}/events/${event.slug}`,
    };

    return (
        <>
           <Button
               variant="outlined"
               size="small"
               startIcon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
               onClick={(e) => setAnchorEl(e.currentTarget)}
               sx={{ textTransform: 'none' }}
           >
               {t('races.addToCalendar', { defaultValue: 'Add to Calendar' })}
           </Button>
           <Menu
               anchorEl={anchorEl}
               open={Boolean(anchorEl)}
               onClose={() => setAnchorEl(null)}
           >
               <MenuItem onClick={() => { window.open(googleCalendarUrl(calEvent), '_blank', 'noopener'); setAnchorEl(null); }}>
                   Google Calendar
               </MenuItem>
               <MenuItem onClick={() => { window.open(outlookCalendarUrl(calEvent), '_blank', 'noopener'); setAnchorEl(null); }}>
                   Outlook
               </MenuItem>
               <MenuItem onClick={() => { downloadIcs(calEvent); setAnchorEl(null); }}>
                   {t('races.downloadIcs', { defaultValue: 'Download .ics (Apple/Other)' })}
               </MenuItem>
           </Menu>
        </>
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
    eventSlug,
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
    eventSlug?: string | null;
    now: Date;
}) {
    const theme = useTheme();
    const loc = useLocalize();
    const { isEnabled } = useFeatureFlags();
    const raceDateTime = formatRaceDateTime(race.dateOfRace, race.startTime, t);

    // Carries the event as breadcrumb context so the trail page can render
    // Events > {Event} > {Trail} instead of its default Trails > {Trail}.
    // Memoized so the per-second `now` tick doesn't hand the links a new
    // state reference on every render.
    const trailLinkState = useMemo(
        () => (eventSlug
            ? breadcrumbContext([
                { label: t('nav.events'), to: '/events' },
                { label: competitionName, to: `/events/${eventSlug}` },
            ])
            : undefined),
        [eventSlug, competitionName, t],
    );

    // Race phase: determine if race is in progress (started but not finished)
    const racePhase = useMemo(() => {
        if (race.status === 'Cancelled') return 'pre';
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
    }, [daysUntil, race.status, race.dateOfRace, race.startTime, race.cutoffMinutes, now]);

    // Independent of cutoffMinutes: true as soon as the race starts (or all day if no startTime).
    // Used only to control RaceFinishCard / RaceShareCard visibility.
    const pastStart = useMemo(() => {
        if (daysUntil !== 0 || !race.dateOfRace) return false;
        const [h, m, s = 0] = race.startTime ? race.startTime.split(':').map(Number) : [12, 0, 0];
        const start = new Date(race.dateOfRace + 'T00:00:00');
        start.setHours(h, m, s, 0);
        return now >= start;
    }, [daysUntil, race.dateOfRace, race.startTime, now]);

    return (
        <Card id={anchor} variant="outlined" sx={{
            borderRadius: 2,
            ...(race.status === 'Cancelled' && { opacity: 0.6 }),
            ...(race.status === 'Upcoming' && { borderStyle: 'dashed', borderColor: theme.palette.info.main }),
            ...(racePhase === 'in-progress' && { borderColor: theme.palette.success.main, borderWidth: 2 }),
        }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: { xs: 0.5, sm: 1 }, justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h6" fontWeight={700} sx={{
                            display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap',
                            ...(race.status === 'Cancelled' && { textDecoration: 'line-through' }),
                        }}>
                            <Box component="span" sx={{ fontSize: 20, color: 'primary.main', display: 'flex' }}>
                                {getActivityIcon(race.activityType ?? race.trailActivityType ?? activityType ?? 'TrailRunning')}
                            </Box>
                            {loc(race.name, race.nameEn)}
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
                        {race.trailName && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                {race.trailSlug ? (
                                    <RouterLink to={`/trails/${race.trailSlug}`} state={trailLinkState} style={{ color: 'inherit', textDecoration: 'none' }}>
                                        {race.trailName}
                                    </RouterLink>
                                ) : race.trailName}
                            </Typography>
                        )}
                    </Box>
                    {(race.trailSlug || showShareCard || showFinishCard) && (
                        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, flexWrap: 'wrap' }}>
                            {showPredict && race.trailSlug && (
                                <Tooltip title={t('races.predict')} arrow>
                                    <IconButton
                                        component={RouterLink}
                                        to={`/tools/trail-predictor?trail=${encodeURIComponent(race.trailSlug)}`}
                                        size="small"
                                    >
                                        <QueryStatsIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                            {race.trailSlug && (
                                <Button
                                    component={RouterLink}
                                    to={`/trails/${race.trailSlug}`}
                                    state={trailLinkState}
                                    size="small"
                                    variant="outlined"
                                    sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                                >
                                    {ACTIVITY_EMOJI[race.trailSlug ? 'TrailRunning' : ''] ?? '🗺️'} {t('races.viewTrail')}
                                </Button>
                            )}
                            {showShareCard && !pastStart && racePhase !== 'finished' && race.status !== 'Cancelled' && (
                                <RaceShareCard
                                    eventName={competitionName}
                                    raceName={loc(race.name, race.nameEn) ?? race.name}
                                    distanceLabel={race.distanceLabel}
                                    date={race.dateOfRace ?? editionDate ?? null}
                                    daysUntil={daysUntil ?? null}
                                    activityType={race.activityType ?? race.trailActivityType ?? activityType}
                                />
                            )}
                            {(showFinishCard || (showShareCard && (pastStart || racePhase === 'finished'))) && race.status !== 'Cancelled' && (
                                <RaceFinishCard
                                    eventName={competitionName}
                                    raceName={loc(race.name, race.nameEn) ?? race.name}
                                    distanceLabel={race.distanceLabel}
                                    date={race.dateOfRace ?? editionDate ?? null}
                                    activityType={race.activityType ?? race.trailActivityType ?? activityType}
                                />
                            )}
                        </Stack>
                    )}
                </Box>

                <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                    {race.distanceLabel && (
                        <Tooltip title={t('races.raceDistance', { defaultValue: 'Race distance' })}>
                            <Chip icon={<StraightenIcon />} label={race.distanceLabel} size="small" color="primary" variant="outlined" />
                        </Tooltip>
                    )}
                    {race.activityType && (
                        <Chip
                            icon={<Box component="span" sx={{ display: 'flex', pl: 0.5 }}>{getActivityIcon(race.activityType)}</Box>}
                            label={t(`races.activityTypes.${race.activityType}`, { defaultValue: race.activityType })}
                            size="small"
                            variant="outlined"
                        />
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
                    {race.trailTerrainType === 'Mountainous' && (
                        <Tooltip title={t('races.terrainType', { defaultValue: 'Terrain type' })}>
                            <Chip label={t('races.mountainRace', { defaultValue: 'Mountain race' })} size="small" color="warning" variant="filled" />
                        </Tooltip>
                    )}
                    {race.cutoffMinutes != null && (
                        <Tooltip title={t('races.cutoffTime', { defaultValue: 'Time limit' })}>
                            <Chip icon={<TimerIcon />} label={formatCutoff(race.cutoffMinutes, t)} size="small" variant="outlined" color="warning" />
                        </Tooltip>
                    )}
                    {race.ticketStatus && (
                        <Tooltip title={t('races.ticketStatusLabel', { defaultValue: 'Registration status' })}>
                            <Chip label={t(`races.ticketStatus.${race.ticketStatus}`, { defaultValue: race.ticketStatus })} size="small" color={getTicketStatusColor(race.ticketStatus)} />
                        </Tooltip>
                    )}
                    {race.ticketStatus === 'SoldOut'
                        && isEnabled('resale_tickets', false)
                        && (() => { const at = race.activityType ?? activityType ?? null; return at === 'Running' || at === 'TrailRunning'; })() && (
                        <Link
                            href={t('races.table.resaleHref', { defaultValue: 'https://www.facebook.com/groups/1146319782540776' })}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="body2"
                            onClick={e => e.stopPropagation()}
                        >
                            {t('races.table.resaleLink', { defaultValue: 'Ticket resale' })}
                        </Link>
                    )}
                    {race.maxParticipants != null && (
                        <Tooltip title={t('races.maxParticipants', { defaultValue: 'Max participants' })}>
                            <Chip label={`👥 ${race.maxParticipants}`} size="small" variant="outlined" />
                        </Tooltip>
                    )}
                </Stack>
                {(race.itraPoints != null || race.certifiedBy || race.championshipCategory) && (
                    <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                        {race.itraPoints != null && (
                            <Tooltip title={`ITRA ${race.itraPoints}`}>
                                <img
                                    src={`/images/itra-${race.itraPoints}.png`}
                                    alt={`ITRA ${race.itraPoints}`}
                                    style={{ height: 20, verticalAlign: 'middle' }}
                                />
                            </Tooltip>
                        )}
                        {race.certifiedBy && (
                            <Tooltip title={t('races.certifiedBy', { defaultValue: 'Certified by' })}>
                                <Chip label={race.certifiedBy} size="small" variant="outlined" color="secondary" />
                            </Tooltip>
                        )}
                        {race.championshipCategory && (
                            <Tooltip title={t('races.championshipCategory', { defaultValue: 'Championship category' })}>
                                <Chip label={race.championshipCategory} size="small" variant="outlined" color="primary" />
                            </Tooltip>
                        )}
                    </Stack>
                )}

                {/* Race progress bar on race day */}
                {daysUntil === 0 && race.status !== 'Cancelled' && race.dateOfRace && race.startTime && race.cutoffMinutes != null && (
                    <RaceProgressBar
                        startTime={race.startTime}
                        dateOfRace={race.dateOfRace}
                        cutoffMinutes={race.cutoffMinutes}
                        now={now}
                    />
                )}

                {race.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
                        {loc(race.description, race.descriptionEn)}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}
