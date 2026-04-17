import { useMemo } from 'react';
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
    useTheme,
    alpha,
} from '@mui/material';
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
import Layout from '../components/Layout';
import RunningLoader from '../components/RunningLoader';
import { useCompetitionBySlug } from '../hooks/useCompetitions';
import type { RaceDto, ScheduleRule } from '../hooks/useCompetitions';

type CompetitionDetailPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

const ACTIVITY_ICONS: Record<string, string> = {
    TrailRunning: '🏃‍♂️',
    Running: '🏃',
    Hiking: '🥾',
    Cycling: '🚴',
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
    if (daysUntil < 0) return t('races.passed');
    return t('races.daysUntil', { count: daysUntil });
}

function getCountdownColor(daysUntil: number | null): 'success' | 'warning' | 'error' | 'default' {
    if (daysUntil === null) return 'default';
    if (daysUntil <= 7) return 'error';
    if (daysUntil <= 30) return 'warning';
    return 'success';
}

export default function CompetitionDetailPage({ mode, onToggleMode }: CompetitionDetailPageProps) {
    const { slug } = useParams<{ slug: string }>();
    const { t } = useTranslation();
    const { competition, loading, error } = useCompetitionBySlug(slug);
    const navigate = useNavigate();
    const theme = useTheme();

    const visibleRaces = useMemo(() => {
        if (!competition) return [];
        return competition.races
            .filter(r => r.status !== 'Hidden')
            .sort((a, b) => {
                // Cancelled last, then by sortOrder
                const cancelledA = a.status === 'Cancelled' ? 1 : 0;
                const cancelledB = b.status === 'Cancelled' ? 1 : 0;
                if (cancelledA !== cancelledB) return cancelledA - cancelledB;
                return a.sortOrder - b.sortOrder;
            });
    }, [competition]);

    if (loading) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <RunningLoader />
            </Layout>
        );
    }

    if (error || !competition) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Container maxWidth="md" sx={{ py: 4 }}>
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error || t('races.notFound')}
                    </Alert>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
                        {t('races.backToRaces')}
                    </Button>
                </Container>
            </Layout>
        );
    }

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="md" sx={{ py: 3 }}>
                {/* Back link */}
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(-1)}
                    size="small"
                    sx={{ mb: 2 }}
                >
                    {t('races.backToRaces')}
                </Button>

                {/* Hero section */}
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
                    {/* Row 1: Title + countdown */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                        <Typography variant="h4" fontWeight={800} sx={{
                            display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 200,
                            ...(competition.status === 'Cancelled' && { textDecoration: 'line-through', opacity: 0.7 }),
                        }}>
                            <EmojiEventsIcon sx={{ color: theme.palette.warning.main, flexShrink: 0 }} />
                            {competition.name}
                        </Typography>
                        {competition.status === 'Cancelled' ? (
                            <Chip label={t('races.statusCancelled')} color="error" sx={{ fontWeight: 700, fontSize: '1rem', px: 1.5, py: 0.5, height: 'auto', flexShrink: 0 }} />
                        ) : competition.status === 'Upcoming' ? (
                            <Chip label={t('races.statusUpcoming')} color="info" sx={{ fontWeight: 700, fontSize: '1rem', px: 1.5, py: 0.5, height: 'auto', flexShrink: 0 }} />
                        ) : (
                            <Chip
                                label={getCountdownLabel(competition.daysUntil, t)}
                                color={getCountdownColor(competition.daysUntil)}
                                sx={{ fontWeight: 700, fontSize: '1rem', px: 1.5, py: 0.5, height: 'auto', flexShrink: 0 }}
                            />
                        )}
                    </Box>

                    {/* Row 2: Chips */}
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                        {competition.locationName && (
                            <Chip icon={<LocationOnIcon />} label={competition.locationName} size="small" variant="outlined" />
                        )}
                        {competition.organizerName && (
                            <Chip label={competition.organizerName} size="small" variant="outlined" />
                        )}
                        <Chip
                            label={t('races.raceCount', { count: visibleRaces.length })}
                            size="small"
                            color="primary"
                        />
                    </Stack>

                    {/* Competition Alert */}
                    {competition.alertMessage && (
                        <Alert
                            severity={(competition.alertSeverity as 'info' | 'success' | 'warning' | 'error') ?? 'info'}
                            sx={{ mt: 2, borderRadius: 2, alignItems: 'center' }}
                        >
                            {competition.alertMessage}
                        </Alert>
                    )}

                    {/* Row 3: Schedule description (hide for cancelled) */}
                    {competition.status !== 'Cancelled' && (() => {
                        const desc = formatScheduleDescription(
                            competition.scheduleRule,
                            competition.upcomingDates?.length ?? 0,
                            t,
                        );
                        return desc ? (
                            <Typography variant="body2" sx={{ mt: 1.5, fontStyle: 'italic', color: 'text.secondary' }}>
                                📅 {desc}
                            </Typography>
                        ) : null;
                    })()}

                    {/* Row 4: Next date (hide for cancelled) */}
                    {competition.nextDate && competition.status !== 'Cancelled' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 2 }}>
                            <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                                {t('races.nextRace')}
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                                {formatNextDate(competition.nextDate, t)}
                            </Typography>
                        </Box>
                    )}

                    {/* Row 5: Description */}
                    {competition.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                            {competition.description}
                        </Typography>
                    )}

                    {/* Row 6: Action buttons */}
                    {(competition.registrationUrl || competition.organizerWebsite) && (
                        <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
                            {competition.registrationUrl && (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    endIcon={<OpenInNewIcon />}
                                    onClick={() => window.open(competition.registrationUrl!, '_blank', 'noopener')}
                                    sx={{ textTransform: 'none' }}
                                >
                                    {t('races.register')}
                                </Button>
                            )}
                            {competition.organizerWebsite && (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                    onClick={() => window.open(competition.organizerWebsite!, '_blank', 'noopener')}
                                    sx={{ textTransform: 'none' }}
                                >
                                    {t('races.organizerSite')}
                                </Button>
                            )}
                        </Stack>
                    )}
                </Paper>

                {/* Races section */}
                <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
                    {t('races.racesHeading')}
                </Typography>

                {visibleRaces.length === 0 ? (
                    <Alert severity="info">{t('races.noRaces')}</Alert>
                ) : (
                    <Stack spacing={2}>
                        {visibleRaces.map((race: RaceDto) => (
                            <RaceCard key={race.id} race={race} t={t} />
                        ))}
                    </Stack>
                )}

                {/* Schedule section — show when there are multiple upcoming dates (hide for cancelled) */}
                {competition.status !== 'Cancelled' && competition.upcomingDates && competition.upcomingDates.length > 1 && (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                            {t('races.scheduleHeading')}
                        </Typography>
                        <Paper
                            variant="outlined"
                            sx={{ borderRadius: 2, overflow: 'hidden' }}
                        >
                            <List disablePadding>
                                {competition.upcomingDates.map((dateStr, idx) => {
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
            </Container>
        </Layout>
    );
}

function RaceCard({ race, t }: { race: RaceDto; t: (key: string, opts?: Record<string, unknown>) => string }) {
    const theme = useTheme();
    return (
        <Card variant="outlined" sx={{
            borderRadius: 2,
            ...(race.status === 'Cancelled' && { opacity: 0.6 }),
            ...(race.status === 'Upcoming' && { borderStyle: 'dashed', borderColor: theme.palette.info.main }),
        }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
                {/* Row 1: Name + View trail button */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" fontWeight={700} sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5,
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
                    </Typography>
                    {race.trailSlug && (
                        <Button
                            component={RouterLink}
                            to={`/trails/${race.trailSlug}`}
                            size="small"
                            variant="outlined"
                            sx={{ textTransform: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                            {ACTIVITY_ICONS[race.trailSlug ? 'TrailRunning' : ''] ?? '🗺️'} {t('races.viewTrail')}
                        </Button>
                    )}
                </Box>

                {/* Row 2: Chips */}
                <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                    {race.distanceLabel && (
                        <Chip icon={<StraightenIcon />} label={race.distanceLabel} size="small" color="primary" variant="outlined" />
                    )}
                    {race.trailDistanceMeters && (
                        <Chip label={`${(race.trailDistanceMeters / 1000).toFixed(1)} km`} size="small" variant="outlined" />
                    )}
                    {race.trailElevationGain && (
                        <Chip icon={<TerrainIcon />} label={`↑ ${Math.round(race.trailElevationGain)} m`} size="small" variant="outlined" />
                    )}
                    {race.cutoffMinutes && (
                        <Chip icon={<TimerIcon />} label={formatCutoff(race.cutoffMinutes, t)} size="small" variant="outlined" color="warning" />
                    )}
                </Stack>

                {/* Row 3: Description */}
                {race.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {race.description}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}
