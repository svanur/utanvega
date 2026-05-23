import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TableSortLabel, Paper, Typography, Chip, IconButton, Tooltip, Stack,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LandscapeIcon from '@mui/icons-material/Landscape';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import GrassIcon from '@mui/icons-material/Grass';
import type { EventSummary } from '../hooks/useEvents';

function getActivityIcon(type: string) {
    switch (type) {
        case 'TrailRunning': return <LandscapeIcon fontSize="small" />;
        case 'Running': return <DirectionsRunIcon fontSize="small" />;
        case 'Hiking': return <HikingIcon fontSize="small" />;
        case 'Cycling': return <DirectionsBikeIcon fontSize="small" />;
        case 'FunRun': return <CelebrationIcon fontSize="small" />;
        case 'ObstacleCourse': return <FitnessCenterIcon fontSize="small" />;
        case 'CrossCountryRun': return <GrassIcon fontSize="small" />;
        default: return <DirectionsRunIcon fontSize="small" />;
    }
}

interface EventTableViewProps {
    events: EventSummary[];
}

type SortField = 'name' | 'daysUntil' | 'locationName' | 'editionCount' | 'activityType' | 'organizerName';
type SortDir = 'asc' | 'desc';

function getCountdownColor(daysUntil: number | null): 'success' | 'warning' | 'error' | 'default' {
    if (daysUntil === null) return 'default';
    if (daysUntil < 0) return 'default';
    if (daysUntil <= 7) return 'error';
    if (daysUntil <= 30) return 'warning';
    return 'success';
}

const EventTableView: React.FC<EventTableViewProps> = ({ events }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [sortField, setSortField] = useState<SortField>('daysUntil');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

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
                case 'locationName':
                    return dir * (a.locationName ?? '').localeCompare(b.locationName ?? '', 'is');
                case 'editionCount':
                    return dir * (a.editionCount - b.editionCount);
                case 'activityType':
                    return dir * a.activityType.localeCompare(b.activityType);
                case 'organizerName':
                    return dir * (a.organizerName ?? '').localeCompare(b.organizerName ?? '', 'is');
                default:
                    return 0;
            }
        });
    }, [events, sortField, sortDir]);

    const columns: { field: SortField; label: string; align?: 'left' | 'right' | 'center' }[] = [
        { field: 'name', label: t('races.table.name', 'Name') },
        { field: 'daysUntil', label: t('races.table.nextRace', 'Next Race'), align: 'center' },
        { field: 'locationName', label: t('trail.location', 'Location') },
        { field: 'activityType', label: t('trail.activity', 'Activity'), align: 'center' },
        { field: 'organizerName', label: t('races.table.organizer', 'Organizer') },
        { field: 'editionCount', label: t('races.table.editions', 'Editions'), align: 'right' },
    ];

    return (
        <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2, width: '100%', overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 700 }}>
                <TableHead>
                    <TableRow>
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
                    {sortedEvents.map((event, idx) => (
                        <TableRow
                            key={event.id}
                            hover
                            tabIndex={0}
                            role="link"
                            sx={{
                                cursor: 'pointer',
                                '&:last-child td': { border: 0 },
                                bgcolor: idx % 2 === 1 ? 'action.hover' : 'transparent',
                                ...(event.status === 'Cancelled' && { opacity: 0.6 }),
                            }}
                            onClick={() => navigate(`/races/${event.slug}`)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/races/${event.slug}`); } }}
                        >
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
                            <TableCell>
                                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 140 }}>
                                    {event.organizerName ?? '—'}
                                </Typography>
                            </TableCell>
                            <TableCell align="right">
                                <Typography variant="body2">{event.editionCount}</Typography>
                            </TableCell>
                        </TableRow>
                    ))}
                    {sortedEvents.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                <Typography color="text.secondary">{t('races.noResults', 'No events found')}</Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default EventTableView;
