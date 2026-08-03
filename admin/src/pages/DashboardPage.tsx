import { useEffect, useRef, useState } from 'react';
import {
    Box, Typography, Paper, Grid, Button, Chip, Skeleton,
    Stack, Divider, Tooltip, List, ListItem, ListItemText, ListItemButton,
    InputBase,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import SearchIcon from '@mui/icons-material/Search';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EventIcon from '@mui/icons-material/Event';
import RouteIcon from '@mui/icons-material/Route';
import HistoryIcon from '@mui/icons-material/History';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BuildIcon from '@mui/icons-material/Build';
import type { ChangeLogDto } from '../components/ChangeLogList';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { apiFetch } from '../hooks/api';
import type { PageKey } from '../types/PageKey';
import type { EventSummaryDto } from '../hooks/useEvents';
import type { Trail } from '../hooks/useTrails';

interface DashboardPageProps {
    onNewEvent: () => void;
    onUploadTrail: () => void;
    onNavigate: (page: PageKey) => void;
}

interface DailyViews {
    date: string;
    views: number;
    uniqueVisitors: number;
}

interface AnalyticsSummary {
    totalViews: number;
    viewsThisWeek: number;
    viewsLastWeek: number;
}

interface AnalyticsData {
    summary: AnalyticsSummary;
    dailyViews: DailyViews[];
}

interface AdminHealth {
    status: string;
    gitHash: string;
    timestampUtc: string;
}

function getTrailHealthScore(trail: Trail): number {
    const checks = [
        !!trail.description && trail.description.trim().length > 0,
        trail.startLatitude != null && trail.startLongitude != null,
        trail.elevationGain > 0 || trail.elevationLoss > 0,
        trail.locations.length > 0,
        trail.length > 0,
        trail.status === 'Published',
        trail.startLatitude == null ? true : trail.terrainType != null,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getEventHealthScore(event: EventSummaryDto): number {
    const isAd = event.type === 'Advertisement';
    const isSeries = event.type === 'Series';
    const checks = [
        { passed: !!event.description && event.description.trim().length > 10, na: false },
        { passed: !!event.nextEditionDate, na: isAd },
        { passed: event.editionCount > 0, na: isAd || isSeries },
        { passed: !!event.locationId, na: isAd },
        { passed: event.gpxPointLat != null && event.gpxPointLng != null, na: isAd },
        { passed: !!(event.organizerName || event.organizerWebsite), na: isAd },
        { passed: !!event.scheduleRule, na: isAd },
        { passed: event.status === 'Confirmed', na: false },
    ];
    const applicable = checks.filter(c => !c.na);
    if (applicable.length === 0) return 100;
    return Math.round((applicable.filter(c => c.passed).length / applicable.length) * 100);
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(iso);
}

function QuickActionButton({
    icon, label, description, onClick, color = 'primary',
}: {
    icon: React.ReactNode;
    label: string;
    description: string;
    onClick: () => void;
    color?: 'primary' | 'secondary' | 'inherit';
}) {
    return (
        <Paper
            elevation={2}
            component="button"
            onClick={onClick}
            sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: 0.5, p: 2.5, cursor: 'pointer', border: 'none',
                background: 'white', width: '100%', textAlign: 'left',
                transition: 'box-shadow 0.15s, transform 0.1s',
                '&:hover': { boxShadow: 6, transform: 'translateY(-1px)' },
                '&:active': { transform: 'translateY(0)' },
            }}
        >
            <Box sx={{ color: color === 'primary' ? 'primary.main' : color === 'secondary' ? 'secondary.main' : 'text.secondary', mb: 0.5 }}>
                {icon}
            </Box>
            <Typography variant="subtitle1" fontWeight={600}>{label}</Typography>
            <Typography variant="caption" color="text.secondary">{description}</Typography>
        </Paper>
    );
}

function WoWChip({ thisWeek, lastWeek }: { thisWeek: number; lastWeek: number }) {
    if (lastWeek === 0 && thisWeek === 0) return <Chip label="—" size="small" variant="outlined" />;
    if (lastWeek === 0) return <Chip label="New" size="small" color="info" />;
    const pct = ((thisWeek - lastWeek) / lastWeek) * 100;
    const up = pct >= 0;
    return (
        <Chip
            icon={up ? <TrendingUpIcon /> : <TrendingDownIcon />}
            label={`${up ? '+' : ''}${pct.toFixed(0)}% WoW`}
            size="small"
            color={up ? 'success' : 'error'}
            variant="outlined"
        />
    );
}

export default function DashboardPage({ onNewEvent, onUploadTrail, onNavigate }: DashboardPageProps) {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [events, setEvents] = useState<EventSummaryDto[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [trails, setTrails] = useState<Trail[]>([]);
    const [trailsLoading, setTrailsLoading] = useState(true);
    const [changelog, setChangelog] = useState<ChangeLogDto[]>([]);
    const [changelogLoading, setChangelogLoading] = useState(true);
    const [backendHealth, setBackendHealth] = useState<AdminHealth | null>(null);
    const [note, setNote] = useState(() => localStorage.getItem('admin_dashboard_note') ?? '');
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleNoteChange = (value: string) => {
        setNote(value);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => localStorage.setItem('admin_dashboard_note', value), 500);
    };

    const frontendHash = import.meta.env.VITE_GIT_HASH ?? 'unknown';
    const adminVersion = import.meta.env.VITE_ADMIN_VERSION ?? '?';
    const frontendVersion = import.meta.env.VITE_FRONTEND_VERSION ?? '?';

    useEffect(() => {
        apiFetch<AnalyticsData>('/api/v1/admin/analytics')
            .then(setAnalytics)
            .catch(() => {})
            .finally(() => setAnalyticsLoading(false));

        apiFetch<EventSummaryDto[]>('/api/v1/admin/events')
            .then(setEvents)
            .catch(() => {})
            .finally(() => setEventsLoading(false));

        apiFetch<Trail[]>('/api/v1/admin/trails')
            .then(setTrails)
            .catch(() => {})
            .finally(() => setTrailsLoading(false));

        apiFetch<ChangeLogDto[]>('/api/v1/admin/history?limit=5')
            .then(setChangelog)
            .catch(() => {})
            .finally(() => setChangelogLoading(false));

        apiFetch<AdminHealth>('/api/v1/admin/health')
            .then(setBackendHealth)
            .catch(() => {});
    }, []);

    const today = new Date().toISOString().slice(0, 10);
    const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const activeEvents = events.filter(e => e.status !== 'Cancelled' && e.type !== 'Advertisement');
    const needsAttention = activeEvents.filter(e => getEventHealthScore(e) < 80);
    const noUpcomingDate = activeEvents.filter(
        e => !e.nextEditionDate && e.status === 'Confirmed' && (e.type === 'Race' || e.type === 'Series')
    );

    const upcomingEvents = activeEvents
        .filter(e => e.nextEditionDate && e.nextEditionDate >= today && e.nextEditionDate <= in30days)
        .sort((a, b) => (a.nextEditionDate ?? '').localeCompare(b.nextEditionDate ?? ''))
        .slice(0, 3);

    const recentTrails = [...trails]
        .filter(t => t.updatedAt)
        .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
        .slice(0, 3);

    const chartData = analytics?.dailyViews.slice(-30) ?? [];

    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 18) return 'Good afternoon';
        return 'Good evening';
    })();

    const todayLabel = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    return (
        <Box>
            {/* Header */}
            <Box mb={4}>
                <Typography variant="h4" fontWeight="bold">{greeting}</Typography>
                <Typography variant="body2" color="text.secondary">{todayLabel}</Typography>
            </Box>

            {/* Stats strip */}
            <Grid container spacing={2} mb={3}>
                {[
                    { label: 'Total Events', value: eventsLoading ? null : activeEvents.length, onClick: () => onNavigate('events') },
                    { label: 'Total Trails', value: trailsLoading ? null : trails.length, onClick: () => onNavigate('trails') },
                    { label: 'Events Needing Attention', value: eventsLoading ? null : needsAttention.length, onClick: () => onNavigate('event-health'), warn: needsAttention.length > 0 },
                    { label: 'Trail Health Issues', value: trailsLoading ? null : trails.filter(t => getTrailHealthScore(t) < 50).length, onClick: () => onNavigate('health'), warn: trails.filter(t => getTrailHealthScore(t) < 50).length > 0 },
                ].map(stat => (
                    <Grid item xs={6} md={3} key={stat.label}>
                        <Paper
                            elevation={1}
                            component="button"
                            onClick={stat.onClick}
                            sx={{
                                width: '100%', p: 2, border: 'none', cursor: 'pointer',
                                background: 'white', textAlign: 'left',
                                borderLeft: '3px solid',
                                borderColor: stat.warn ? 'warning.main' : 'primary.main',
                                transition: 'box-shadow 0.15s',
                                '&:hover': { boxShadow: 3 },
                            }}
                        >
                            <Typography variant="caption" color="text.secondary" display="block">{stat.label}</Typography>
                            {stat.value === null
                                ? <Skeleton width={40} height={36} />
                                : <Typography variant="h4" fontWeight="bold" color={stat.warn ? 'warning.main' : 'text.primary'}>{stat.value}</Typography>
                            }
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* Quick Actions */}
            <Typography variant="overline" color="text.secondary" fontWeight={600} letterSpacing={1}>
                Quick Actions
            </Typography>
            <Grid container spacing={2} mt={0.5} mb={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <QuickActionButton
                        icon={<AddCircleOutlineIcon sx={{ fontSize: 28 }} />}
                        label="New Event"
                        description="Create a race, festival or series"
                        onClick={onNewEvent}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <QuickActionButton
                        icon={<FileUploadIcon sx={{ fontSize: 28 }} />}
                        label="Upload Trail"
                        description="Import a GPX file as a new trail"
                        onClick={onUploadTrail}
                        color="secondary"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <QuickActionButton
                        icon={<EmojiEventsIcon sx={{ fontSize: 28 }} />}
                        label="Manage Events"
                        description="View, edit and organise events"
                        onClick={() => onNavigate('events')}
                        color="inherit"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <QuickActionButton
                        icon={<SearchIcon sx={{ fontSize: 28 }} />}
                        label="Spotlight Search"
                        description="Jump anywhere  (Ctrl+K)"
                        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        color="inherit"
                    />
                </Grid>
            </Grid>

            {/* Four-column row: Upcoming Events | Recent Trails | Event Health | Recent Activity */}
            <Grid container spacing={3}>
                {/* Upcoming Events */}
                <Grid item xs={12} md={3}>
                    <Paper elevation={2} sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                            <Stack direction="row" alignItems="center" gap={1}>
                                <EventIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                <Typography variant="h6" fontWeight={600}>Upcoming Events</Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary">next 30 days</Typography>
                        </Stack>
                        {eventsLoading ? (
                            <Stack gap={1}>{[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={52} />)}</Stack>
                        ) : upcomingEvents.length === 0 ? (
                            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography variant="body2" color="text.secondary">No events in the next 30 days</Typography>
                            </Box>
                        ) : (
                            <List disablePadding sx={{ flexGrow: 1 }}>
                                {upcomingEvents.map((ev, i) => (
                                    <ListItem key={ev.id} disablePadding divider={i < upcomingEvents.length - 1}>
                                        <ListItemButton
                                            onClick={() => onNavigate('events')}
                                            sx={{ px: 0, py: 1 }}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Typography variant="body2" fontWeight={600} noWrap>{ev.name}</Typography>
                                                }
                                                secondary={
                                                    <Stack direction="row" alignItems="center" gap={0.75} mt={0.25}>
                                                        <Chip
                                                            label={ev.nextEditionDate ? formatDate(ev.nextEditionDate) : '—'}
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                            sx={{ fontSize: '0.7rem', height: 20 }}
                                                        />
                                                        {ev.daysUntil != null && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                {ev.daysUntil === 0 ? 'Today' : `in ${ev.daysUntil}d`}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                }
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                        <Box mt={1.5} textAlign="right">
                            <Button size="small" onClick={() => onNavigate('events')}>All events →</Button>
                        </Box>
                    </Paper>
                </Grid>

                {/* Recently Updated Trails */}
                <Grid item xs={12} md={3}>
                    <Paper elevation={2} sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Stack direction="row" alignItems="center" gap={1} mb={1}>
                            <RouteIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
                            <Typography variant="h6" fontWeight={600}>Recently Updated Trails</Typography>
                        </Stack>
                        {trailsLoading ? (
                            <Stack gap={1}>{[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={52} />)}</Stack>
                        ) : recentTrails.length === 0 ? (
                            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography variant="body2" color="text.secondary">No trails found</Typography>
                            </Box>
                        ) : (
                            <List disablePadding sx={{ flexGrow: 1 }}>
                                {recentTrails.map((trail, i) => (
                                    <ListItem key={trail.id} disablePadding divider={i < recentTrails.length - 1}>
                                        <ListItemButton
                                            onClick={() => onNavigate('trails')}
                                            sx={{ px: 0, py: 1 }}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Typography variant="body2" fontWeight={600} noWrap>{trail.name}</Typography>
                                                }
                                                secondary={
                                                    <Stack direction="row" alignItems="center" gap={0.75} mt={0.25}>
                                                        <Chip
                                                            label={`${(trail.length / 1000).toFixed(1)} km`}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ fontSize: '0.7rem', height: 20 }}
                                                        />
                                                        {trail.updatedAt && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                {formatRelative(trail.updatedAt)}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                }
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                        <Box mt={1.5} textAlign="right">
                            <Button size="small" onClick={() => onNavigate('trails')}>All trails →</Button>
                        </Box>
                    </Paper>
                </Grid>

                {/* Event Health */}
                <Grid item xs={12} md={3}>
                    <Paper elevation={2} sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Stack direction="row" alignItems="center" gap={1} mb={1}>
                            <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                            <Typography variant="h6" fontWeight={600}>Event Health</Typography>
                        </Stack>
                        {eventsLoading ? (
                            <Stack gap={1.5}>{[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={52} />)}</Stack>
                        ) : (
                            <Stack gap={1.5} sx={{ flexGrow: 1 }}>
                                <Box
                                    component={needsAttention.length > 0 ? 'button' : 'div'}
                                    onClick={needsAttention.length > 0 ? () => onNavigate('event-health') : undefined}
                                    sx={{
                                        display: 'flex', alignItems: 'center', gap: 1.5,
                                        p: 1.5, borderRadius: 1, border: '1px solid',
                                        borderColor: needsAttention.length > 0 ? 'warning.light' : 'success.light',
                                        cursor: needsAttention.length > 0 ? 'pointer' : 'default',
                                        background: 'none', width: '100%', textAlign: 'left',
                                        transition: 'box-shadow 0.15s',
                                        '&:hover': needsAttention.length > 0 ? { boxShadow: 2 } : {},
                                    }}
                                >
                                    {needsAttention.length > 0
                                        ? <WarningAmberIcon sx={{ color: 'warning.main', flexShrink: 0 }} />
                                        : <CheckCircleOutlineIcon sx={{ color: 'success.main', flexShrink: 0 }} />}
                                    <Box flexGrow={1}>
                                        <Typography variant="body2" fontWeight={600}>
                                            {needsAttention.length > 0
                                                ? `${needsAttention.length} event${needsAttention.length > 1 ? 's' : ''} need${needsAttention.length === 1 ? 's' : ''} attention`
                                                : 'All events look healthy'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {needsAttention.length > 0 ? 'Health score below 80%' : 'Score ≥ 80% across the board'}
                                        </Typography>
                                    </Box>
                                    {needsAttention.length > 0 && <Typography variant="caption" color="warning.dark" fontWeight={600}>→</Typography>}
                                </Box>

                                {noUpcomingDate.length > 0 && (
                                    <Box
                                        component="button"
                                        onClick={() => onNavigate('event-health')}
                                        sx={{
                                            display: 'flex', alignItems: 'center', gap: 1.5,
                                            p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'error.light',
                                            cursor: 'pointer', background: 'none', width: '100%', textAlign: 'left',
                                            transition: 'box-shadow 0.15s', '&:hover': { boxShadow: 2 },
                                        }}
                                    >
                                        <WarningAmberIcon sx={{ color: 'error.main', flexShrink: 0 }} />
                                        <Box flexGrow={1}>
                                            <Typography variant="body2" fontWeight={600}>
                                                {noUpcomingDate.length} confirmed event{noUpcomingDate.length > 1 ? 's' : ''} with no date
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">Missing next edition date</Typography>
                                        </Box>
                                        <Typography variant="caption" color="error.dark" fontWeight={600}>→</Typography>
                                    </Box>
                                )}

                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, mt: 'auto', pt: 1 }}>
                                    <Typography variant="caption" color="text.secondary">Total active events</Typography>
                                    <Chip label={activeEvents.length} size="small" variant="outlined" />
                                </Box>
                            </Stack>
                        )}
                        <Box mt={1.5} textAlign="right">
                            <Button size="small" onClick={() => onNavigate('event-health')}>Full health report →</Button>
                        </Box>
                    </Paper>
                </Grid>

                {/* Recent Activity */}
                <Grid item xs={12} md={3}>
                    <Paper elevation={2} sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Stack direction="row" alignItems="center" gap={1} mb={1}>
                            <HistoryIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                            <Typography variant="h6" fontWeight={600}>Recent Activity</Typography>
                        </Stack>
                        {changelogLoading ? (
                            <Stack gap={1}>{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} variant="rounded" height={40} />)}</Stack>
                        ) : changelog.length === 0 ? (
                            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography variant="body2" color="text.secondary">No recent activity</Typography>
                            </Box>
                        ) : (
                            <List disablePadding sx={{ flexGrow: 1 }}>
                                {changelog.map((entry, i) => (
                                    <ListItem key={entry.id} disablePadding divider={i < changelog.length - 1} sx={{ py: 0.75 }}>
                                        <ListItemText
                                            primary={
                                                <Stack direction="row" alignItems="center" gap={0.75}>
                                                    <Chip
                                                        label={entry.action}
                                                        size="small"
                                                        color={entry.action === 'Create' ? 'success' : entry.action === 'Delete' ? 'error' : 'primary'}
                                                        variant="outlined"
                                                        sx={{ fontSize: '0.65rem', height: 18, flexShrink: 0 }}
                                                    />
                                                    <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem' }}>{entry.description}</Typography>
                                                </Stack>
                                            }
                                            secondary={
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatRelative(entry.timestampUtc)}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* Analytics — full width, compact */}
            <Paper elevation={2} sx={{ p: 2.5, mt: 3 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Typography variant="h6" fontWeight={600}>Views — Last 30 Days</Typography>
                    {analytics && (
                        <Stack direction="row" alignItems="center" gap={1}>
                            <Typography variant="h6" fontWeight="bold">
                                {analytics.summary.totalViews.toLocaleString()}
                            </Typography>
                            <WoWChip
                                thisWeek={analytics.summary.viewsThisWeek}
                                lastWeek={analytics.summary.viewsLastWeek}
                            />
                            <Button size="small" onClick={() => onNavigate('analytics')}>Full analytics →</Button>
                        </Stack>
                    )}
                </Stack>
                {analyticsLoading ? (
                    <Skeleton variant="rounded" height={100} />
                ) : chartData.length === 0 ? (
                    <Box sx={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography color="text.secondary">No data</Typography>
                    </Box>
                ) : (
                    <ResponsiveContainer width="100%" height={100}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                            <defs>
                                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#2e7d32" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tickFormatter={(l) => formatDate(String(l))} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10 }} />
                            <RechartsTooltip
                                labelFormatter={(label) => formatDate(String(label))}
                                formatter={(v) => [Number(v).toLocaleString(), 'Views']}
                            />
                            <Area type="monotone" dataKey="views" stroke="#2e7d32" strokeWidth={2} fill="url(#viewsGradient)" dot={false} activeDot={{ r: 3 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </Paper>

            {/* Scratch pad */}
            <Paper elevation={1} sx={{ mt: 3, p: 2.5, border: '1px dashed', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} letterSpacing={0.5} display="block" mb={1}>
                    📝 SCRATCH PAD — saved locally in your browser
                </Typography>
                <InputBase
                    multiline
                    minRows={3}
                    fullWidth
                    value={note}
                    onChange={e => handleNoteChange(e.target.value)}
                    placeholder="Jot something down… tasks, reminders, things to check"
                    sx={{ fontSize: '0.875rem', alignItems: 'flex-start', fontFamily: 'inherit' }}
                />
            </Paper>

            {/* Build info */}
            <Divider sx={{ mt: 3, mb: 2 }} />
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <BuildIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.disabled">Build info</Typography>
                <Tooltip title="Admin app version (package.json)">
                    <Chip label={`admin v${adminVersion}`} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                </Tooltip>
                <Tooltip title="Frontend app version (package.json)">
                    <Chip label={`frontend v${frontendVersion}`} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                </Tooltip>
                <Tooltip title="Git hash at build time (git rev-parse --short HEAD)">
                    <Chip label={`fe: ${frontendHash}`} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                </Tooltip>
                {backendHealth ? (
                    <Tooltip title="Backend deployed git hash (GIT_HASH env var on Fly.io)">
                        <Chip
                            label={`be: ${backendHealth.gitHash}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                            color={
                                backendHealth.gitHash !== 'unknown' && frontendHash !== 'unknown' && backendHealth.gitHash !== frontendHash
                                    ? 'warning' : 'default'
                            }
                        />
                    </Tooltip>
                ) : (
                    <Chip label="be: …" size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                )}
                {backendHealth?.gitHash !== 'unknown' && frontendHash !== 'unknown' && backendHealth?.gitHash !== frontendHash && (
                    <Tooltip title="Frontend and backend are on different commits — a deploy may be in progress">
                        <Chip label="hash mismatch" size="small" color="warning" />
                    </Tooltip>
                )}
            </Stack>
        </Box>
    );
}
