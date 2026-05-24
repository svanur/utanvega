import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TableSortLabel, Paper, Typography, Chip, IconButton, Tooltip, Stack,
    Collapse, Box, CircularProgress, Skeleton,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import StraightenIcon from '@mui/icons-material/Straighten';
import TimerIcon from '@mui/icons-material/Timer';
import LandscapeIcon from '@mui/icons-material/Landscape';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import GrassIcon from '@mui/icons-material/Grass';
import CampaignIcon from '@mui/icons-material/Campaign';
import type { EventSummary, EventDetail, RaceDto } from '../hooks/useEvents';
import { API_URL } from '../hooks/useTrails';

function getActivityIcon(type: string) {
    switch (type) {
        case 'TrailRunning': return <LandscapeIcon fontSize="small" />;
        case 'Running': return <DirectionsRunIcon fontSize="small" />;
        case 'Hiking': return <HikingIcon fontSize="small" />;
        case 'Cycling': return <DirectionsBikeIcon fontSize="small" />;
        case 'FunRun': return <CelebrationIcon fontSize="small" />;
        case 'ObstacleCourse': return <FitnessCenterIcon fontSize="small" />;
        case 'CrossCountryRun': return <GrassIcon fontSize="small" />;
        case 'Advertisement': return <CampaignIcon fontSize="small" />;
        default: return <DirectionsRunIcon fontSize="small" />;
    }
}

function getEventTypeColor(type: string): 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' | 'default' {
    switch (type) {
        case 'Race': return 'primary';
        case 'Series': return 'secondary';
        case 'FunRun': return 'success';
        case 'Training': return 'info';
        case 'Advertisement': return 'warning';
        default: return 'default';
    }
}

interface EventTableViewProps {
    events: EventSummary[];
}

type SortField = 'name' | 'daysUntil' | 'nextEditionDate' | 'locationName' | 'editionCount' | 'activityType' | 'type';
type SortDir = 'asc' | 'desc';

function getCountdownColor(daysUntil: number | null): 'success' | 'warning' | 'error' | 'default' {
    if (daysUntil === null) return 'default';
    if (daysUntil < 0) return 'default';
    if (daysUntil <= 7) return 'error';
    if (daysUntil <= 30) return 'warning';
    return 'success';
}

function getTicketStatusColor(status: string | null): 'success' | 'error' | 'warning' | 'default' {
    switch (status) {
        case 'Available': return 'success';
        case 'SoldOut': return 'error';
        case 'AlmostSoldOut': return 'warning';
        case 'WaitingList': return 'warning';
        case 'Closed': return 'default';
        default: return 'default';
    }
}

const EventTableView: React.FC<EventTableViewProps> = ({ events }) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [sortField, setSortField] = useState<SortField>('daysUntil');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [detailCache, setDetailCache] = useState<Record<string, EventDetail>>({});
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

    const toggleExpand = useCallback(async (event: EventSummary) => {
        const id = event.id;
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); } else { next.add(id); }
            return next;
        });

        if (!detailCache[id] && !loadingIds.has(id)) {
            setLoadingIds(prev => new Set(prev).add(id));
            try {
                const res = await fetch(`${API_URL}/api/v1/events/${encodeURIComponent(event.slug)}`);
                if (res.ok) {
                    const detail = await res.json() as EventDetail;
                    setDetailCache(prev => ({ ...prev, [id]: detail }));
                }
            } finally {
                setLoadingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            }
        }
    }, [detailCache, loadingIds]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const sortedEvents = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1;
        return [...events].sort((a, b) => {
            switch (sortField) {
                case 'name':
                    return dir * a.name.localeCompare(b.name, 'is');
                case 'daysUntil': {
                    const da = a.daysUntil ?? (dir > 0 ? Infinity : -Infinity);
                    const db = b.daysUntil ?? (dir > 0 ? Infinity : -Infinity);
                    return dir * ((da as number) - (db as number));
                }
                case 'nextEditionDate': {
                    const dateA = a.nextEditionDate ?? '';
                    const dateB = b.nextEditionDate ?? '';
                    if (!dateA && !dateB) return 0;
                    if (!dateA) return dir;
                    if (!dateB) return -dir;
                    return dir * dateA.localeCompare(dateB);
                }
                case 'type':
                    return dir * a.type.localeCompare(b.type);
                case 'locationName':
                    return dir * (a.locationName ?? '').localeCompare(b.locationName ?? '', 'is');
                case 'editionCount':
                    return dir * (a.editionCount - b.editionCount);
                case 'activityType':
                    return dir * a.activityType.localeCompare(b.activityType);
                default:
                    return 0;
            }
        });
    }, [events, sortField, sortDir]);

    const columns: { field: SortField; label: string; align?: 'left' | 'right' | 'center' }[] = [
        { field: 'daysUntil', label: t('races.table.nextRace', 'Next Race'), align: 'center' },
        { field: 'nextEditionDate', label: t('races.table.date', 'Date'), align: 'center' },
        { field: 'name', label: t('races.table.name', 'Name') },
        { field: 'type', label: t('races.table.type', 'Type'), align: 'center' },
        { field: 'locationName', label: t('trail.location', 'Location') },
        { field: 'activityType', label: t('trail.activity', 'Activity'), align: 'center' },
        { field: 'editionCount', label: t('races.table.editions', 'Editions'), align: 'right' },
    ];

    const totalColumns = columns.length + 1; // +1 for expand column

    return (
        <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2, width: '100%', overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 750 }}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ width: 40, p: 0.5 }} />
                        {columns.map(col => (
                            <TableCell key={col.field} align={col.align ?? 'left'}>
                                <TableSortLabel
                                    active={sortField === col.field}
                                    direction={sortField === col.field ? sortDir : 'asc'}
                                    onClick={() => handleSort(col.field)}
                                >
                                    {col.label}
                                </TableSortLabel>
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sortedEvents.map((event, idx) => {
                        const isExpanded = expandedIds.has(event.id);
                        const detail = detailCache[event.id];
                        const isLoading = loadingIds.has(event.id);
                        const nextEdition = detail?.editions.find(ed => ed.date === event.nextEditionDate)
                            ?? detail?.editions[0];
                        const races = nextEdition?.races ?? [];

                        return (
                            <React.Fragment key={event.id}>
                                <TableRow
                                    hover
                                    tabIndex={0}
                                    role="link"
                                    sx={{
                                        cursor: 'pointer',
                                        '& td': { borderBottom: isExpanded ? 0 : undefined },
                                        bgcolor: idx % 2 === 1 ? 'action.hover' : 'transparent',
                                        ...(event.status === 'Cancelled' && { opacity: 0.6 }),
                                    }}
                                    onClick={() => navigate(`/races/${event.slug}`)}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/races/${event.slug}`); } }}
                                >
                                    <TableCell sx={{ p: 0.5 }}>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); toggleExpand(event); }}
                                            aria-label={isExpanded ? t('common.collapse', 'Collapse') : t('common.expand', 'Expand')}
                                        >
                                            {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                                        </IconButton>
                                    </TableCell>
                                    <TableCell align="center">
                                        {event.daysUntil !== null && event.status !== 'Cancelled' ? (
                                            <Chip
                                                icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
                                                label={
                                                    event.daysUntil === 0 ? t('races.today')
                                                    : event.daysUntil === 1 ? t('races.tomorrow')
                                                    : event.daysUntil < 0 ? t('races.passed')
                                                    : t('races.daysUntil', { count: event.daysUntil })
                                                }
                                                size="small"
                                                color={getCountdownColor(event.daysUntil)}
                                                variant="outlined"
                                            />
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">—</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        {event.nextEditionDate ? (
                                            <Typography variant="body2" color="text.secondary" noWrap>
                                                {new Date(event.nextEditionDate + 'T00:00:00').toLocaleDateString(
                                                    i18n.language === 'is' ? 'is-IS' : 'en-US',
                                                    { day: 'numeric', month: 'short', year: 'numeric' }
                                                )}
                                            </Typography>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">—</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                            <Typography
                                                variant="body2"
                                                fontWeight={500}
                                                noWrap
                                                sx={{
                                                    maxWidth: 240,
                                                    ...(event.status === 'Cancelled' && { textDecoration: 'line-through' }),
                                                }}
                                            >
                                                {event.name}
                                            </Typography>
                                            {event.status === 'Cancelled' && (
                                                <Chip label={t('races.statusCancelled')} size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip label={event.type} size="small" color={getEventTypeColor(event.type)} variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                                    </TableCell>
                                    <TableCell>
                                        {event.locationName ? (
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 140 }}>
                                                    {event.locationName}
                                                </Typography>
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">—</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title={event.activityType}>
                                            <Stack alignItems="center">
                                                {getActivityIcon(event.activityType)}
                                            </Stack>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2">{event.editionCount}</Typography>
                                    </TableCell>
                                </TableRow>

                                {/* Expandable race detail row */}
                                <TableRow sx={{ bgcolor: idx % 2 === 1 ? 'action.hover' : 'transparent' }}>
                                    <TableCell colSpan={totalColumns} sx={{ py: 0, px: 0, borderBottom: isExpanded ? undefined : 0 }}>
                                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                            <Box sx={{ px: 3, py: 1.5 }}>
                                                {isLoading ? (
                                                    <Stack spacing={1}>
                                                        <Skeleton variant="rectangular" width="60%" height={32} />
                                                        <Skeleton variant="rectangular" width="40%" height={32} />
                                                    </Stack>
                                                ) : races.length > 0 ? (
                                                    <Stack spacing={1}>
                                                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                            {t('races.table.races', 'Races')} — {nextEdition?.title || nextEdition?.date || nextEdition?.year}
                                                        </Typography>
                                                        <Stack direction="row" flexWrap="wrap" gap={1}>
                                                            {races.map(race => (
                                                                <RaceChipCard key={race.id} race={race} editionDate={nextEdition?.date ?? null} />
                                                            ))}
                                                        </Stack>
                                                    </Stack>
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
                                                        {t('races.table.noRaces', 'No races for this edition')}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Collapse>
                                    </TableCell>
                                </TableRow>
                            </React.Fragment>
                        );
                    })}
                    {sortedEvents.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={totalColumns} align="center" sx={{ py: 4 }}>
                                <Typography color="text.secondary">{t('races.noResults', 'No events found')}</Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

// Compact race card shown inside the expanded row
function RaceChipCard({ race, editionDate }: { race: RaceDto; editionDate?: string | null }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const cutoffHours = race.cutoffMinutes ? Math.floor(race.cutoffMinutes / 60) : null;
    const cutoffMins = race.cutoffMinutes ? race.cutoffMinutes % 60 : null;
    const hasTrail = !!race.trailSlug;

    const dateStr = race.dateOfRace ?? editionDate ?? null;
    const formattedDate = dateStr
        ? new Date(dateStr + 'T00:00:00').toLocaleDateString(i18n.language === 'is' ? 'is-IS' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : null;

    return (
        <Paper
            variant="outlined"
            onClick={hasTrail ? () => navigate(`/trails/${race.trailSlug}`) : undefined}
            sx={{
                px: 1.5, py: 1, borderRadius: 1.5, minWidth: 140, maxWidth: 260,
                cursor: hasTrail ? 'pointer' : 'default',
                '&:hover': hasTrail ? { borderColor: 'primary.main', bgcolor: 'action.hover' } : {},
            }}
        >
            <Stack spacing={0.5}>
                <Typography variant="body2" fontWeight={600} noWrap>
                    {race.name}
                </Typography>
                {formattedDate && (
                    <Typography variant="caption" color="text.secondary">
                        {formattedDate}
                    </Typography>
                )}
                <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
                    {race.distanceLabel && (
                        <Chip
                            icon={<StraightenIcon sx={{ fontSize: 14 }} />}
                            label={race.distanceLabel}
                            size="small"
                            variant="outlined"
                            sx={{ height: 22, fontSize: '0.7rem' }}
                        />
                    )}
                    {race.ticketStatus && race.ticketStatus !== 'Available' && (
                        <Chip
                            label={race.ticketStatus === 'SoldOut' ? t('races.table.soldOut', 'Sold Out')
                                : race.ticketStatus === 'AlmostSoldOut' ? t('races.table.almostSoldOut', 'Almost Full')
                                : race.ticketStatus}
                            size="small"
                            color={getTicketStatusColor(race.ticketStatus)}
                            sx={{ height: 22, fontSize: '0.7rem' }}
                        />
                    )}
                    {race.itraPoints != null && race.itraPoints > 0 && (
                        <Tooltip title={`ITRA ${race.itraPoints}`}>
                            <img
                                src={`/images/itra-${race.itraPoints}.png`}
                                alt={`ITRA ${race.itraPoints}`}
                                style={{ height: 20, verticalAlign: 'middle' }}
                            />
                        </Tooltip>
                    )}
                    {cutoffHours != null && (
                        <Tooltip title={t('races.table.cutoff', 'Cutoff time')}>
                            <Chip
                                icon={<TimerIcon sx={{ fontSize: 14 }} />}
                                label={cutoffMins ? `${cutoffHours}h${cutoffMins}m` : `${cutoffHours}h`}
                                size="small"
                                variant="outlined"
                                sx={{ height: 22, fontSize: '0.7rem' }}
                            />
                        </Tooltip>
                    )}
                </Stack>
            </Stack>
        </Paper>
    );
}

export default EventTableView;
