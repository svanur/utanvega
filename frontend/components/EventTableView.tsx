import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TableSortLabel, Paper, Typography, Chip, IconButton, Tooltip, Stack,
    Collapse, Box, Skeleton, Button, alpha, useTheme, Link,
} from '@mui/material';
import { getTicketStatusColor, groupDistances, isAllSoldOut } from '../utils/ticketStatus';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import StraightenIcon from '@mui/icons-material/Straighten';
import TimerIcon from '@mui/icons-material/Timer';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VideocamIcon from '@mui/icons-material/Videocam';
import CelebrationIcon from '@mui/icons-material/Celebration';
import type { EventSummary, EventDetail, RaceDto, SeriesRaceDto } from '../hooks/useEvents';
import { API_URL } from '../hooks/useTrails';
import { haversineKm, formatDistanceKm } from '../utils/geo';
import NearMeIcon from '@mui/icons-material/NearMe';
import EventDateBadge from './EventDateBadge';
import { getCountdownColor, getEventTypeColor, formatNextDate, isEffectivelyCancelled } from '../utils/eventUtils';
import { ActivityIcons, getActivityIcon } from '../utils/activityIcon';
import { useLocalize } from '../utils/localize';
import { useIcelandicHolidays } from '../hooks/useIcelandicHolidays';
import { useFeatureFlags } from '../hooks/useFeatureFlags';



interface EventTableViewProps {
    events: EventSummary[];
    userLocation: { lat: number; lng: number } | null;
}

type SortField = 'name' | 'daysUntil' | 'nextEditionDate' | 'locationName' | 'activityType' | 'type' | 'distance';
type SortDir = 'asc' | 'desc';

type TableRow =
    | { kind: 'event'; event: EventSummary }
    | { kind: 'series-race'; event: EventSummary; race: SeriesRaceDto };



function getRegistrationStatusColor(status: string): 'success' | 'error' | 'default' {
    switch (status) {
        case 'Open': return 'success';
        case 'Closed': return 'error';
        default: return 'default';
    }
}

const EventTableView: React.FC<EventTableViewProps> = ({ events, userLocation }) => {
    const { t, i18n } = useTranslation();
    const loc = useLocalize();
    const navigate = useNavigate();
    const theme = useTheme();
    const { getHolidays } = useIcelandicHolidays();
    const [sortField, setSortField] = useState<SortField>('daysUntil');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [detailCache, setDetailCache] = useState<Record<string, EventDetail>>({});
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const fetchedOrInFlightRef = useRef<Set<string>>(new Set());

    const toggleExpand = useCallback((event: EventSummary) => {
        const id = event.id;
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); } else { next.add(id); }
            return next;
        });

        if (fetchedOrInFlightRef.current.has(id)) return;
        fetchedOrInFlightRef.current.add(id);
        setLoadingIds(prev => new Set(prev).add(id));
        fetch(`${API_URL}/api/v1/events/${encodeURIComponent(event.slug)}`)
            .then(res => res.ok ? res.json() as Promise<EventDetail> : null)
            .then(detail => { if (detail) setDetailCache(prev => ({ ...prev, [id]: detail })); })
            .finally(() => {
                setLoadingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            });
    }, []);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const getDistanceKm = (e: EventSummary): number | null =>
        userLocation && e.gpxPointLat != null && e.gpxPointLng != null
            ? haversineKm(userLocation.lat, userLocation.lng, e.gpxPointLat, e.gpxPointLng)
            : null;

    const sortedRows = useMemo((): TableRow[] => {
        const dir = sortDir === 'asc' ? 1 : -1;
        const sorted = [...events].sort((a, b) => {
            switch (sortField) {
                case 'name':
                    return dir * (loc(a.name, a.nameEn) ?? a.name).localeCompare(loc(b.name, b.nameEn) ?? b.name, 'is');
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
                case 'activityType':
                    return dir * a.activityType.localeCompare(b.activityType);
                case 'distance': {
                    const da = getDistanceKm(a);
                    const db = getDistanceKm(b);
                    if (da == null && db == null) return 0;
                    if (da == null) return 1;
                    if (db == null) return -1;
                    return dir * (da - db);
                }
                default:
                    return 0;
            }
        });

        const rows: TableRow[] = [];
        for (const event of sorted) {
            if (event.type === 'Series' && event.seriesRaces && event.seriesRaces.length > 0) {
                for (const race of event.seriesRaces) {
                    rows.push({ kind: 'series-race', event, race });
                }
            } else {
                rows.push({ kind: 'event', event });
            }
        }
        // Re-sort by individual race date when sorting by date fields
        if (sortField === 'daysUntil' || sortField === 'nextEditionDate') {
            rows.sort((a, b) => {
                const aDate = a.kind === 'series-race' ? a.race.dateOfRace : (a.event.displayDate ?? a.event.nextEditionDate);
                const bDate = b.kind === 'series-race' ? b.race.dateOfRace : (b.event.displayDate ?? b.event.nextEditionDate);
                if (!aDate && !bDate) return 0;
                if (!aDate) return dir;
                if (!bDate) return -dir;
                return dir * aDate.localeCompare(bDate);
            });
        }
        return rows;
    }, [events, sortField, sortDir, userLocation, loc]);

    const columns: { field: SortField; label: string; align?: 'left' | 'right' | 'center' }[] = [
        { field: 'daysUntil', label: t('races.table.date', 'Date'), align: 'center' },
        { field: 'name', label: t('races.table.name', 'Name') },
    ];

    // +1 expand, +4 manual headers (Distances, km away, Location, Links)
    const totalColumns = columns.length + 5;

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
                        <TableCell>{t('races.table.distances', 'Distances')}</TableCell>
                        <TableCell>
                            <TableSortLabel active={sortField === 'distance'} direction={sortField === 'distance' ? sortDir : 'asc'} onClick={() => handleSort('distance')}>
                                {t('trail.kmAway', 'km away')}
                            </TableSortLabel>
                        </TableCell>
                        <TableCell>
                            <TableSortLabel active={sortField === 'locationName'} direction={sortField === 'locationName' ? sortDir : 'asc'} onClick={() => handleSort('locationName')}>
                                {t('trail.location', 'Location')}
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="center">{t('races.table.links', 'Links')}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {(() => {
                        let lastHolidayDate: string | null = null;
                        return sortedRows.map((row, idx) => {
                        const rowDate = row.kind === 'series-race'
                            ? row.race.dateOfRace
                            : (row.event.displayDate ?? row.event.nextEditionDate);
                        const holidays = rowDate ? getHolidays(rowDate) : [];
                        const holidaySeparator = holidays.length > 0 && rowDate !== lastHolidayDate ? (() => {
                            lastHolidayDate = rowDate!;
                            const d = new Date(rowDate! + 'T00:00:00');
                            const months = t('races.months', { returnObjects: true }) as string[];
                            const dateLabel = `${d.getDate()}. ${months[d.getMonth()]}`;
                            return (
                                <TableRow key={`holiday-${rowDate}`} sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12) }}>
                                    <TableCell colSpan={totalColumns} sx={{ py: 0.5, px: 2, borderBottom: 0 }}>
                                        <Stack direction="row" alignItems="center" gap={1}>
                                            <CelebrationIcon sx={{ fontSize: 15, color: 'warning.dark' }} />
                                            <Typography variant="caption" fontWeight={700} sx={{ color: 'warning.dark', letterSpacing: 0.3 }}>
                                                {dateLabel} — {holidays.map(h => loc(h.name, h.nameEn) ?? h.name).join(' · ')}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            );
                        })() : null;
                        if (row.kind === 'series-race') {
                            const { event, race } = row;
                            const raceDaysUntil = race.dateOfRace
                                ? Math.round((new Date(race.dateOfRace + 'T00:00:00').getTime() - Date.now()) / 86400000)
                                : null;
                            return (
                                <React.Fragment key={`${event.id}-${race.raceId}`}>
                                    {holidaySeparator}
                                    <TableRow
                                        hover
                                        tabIndex={0}
                                        role="link"
                                        sx={{ cursor: 'pointer', bgcolor: idx % 2 === 1 ? 'action.hover' : 'transparent' }}
                                        onClick={() => navigate(`/events/${event.slug}`)}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/events/${event.slug}`); } }}
                                >
                                    <TableCell sx={{ p: 0.5 }} />
                                    <TableCell align="center">
                                        {race.dateOfRace ? (
                                            <Stack alignItems="center" spacing={0.5}>
                                                <Typography variant="body2" noWrap>
                                                    {formatNextDate(race.dateOfRace, t)}
                                                </Typography>
                                                <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap" justifyContent="center">
                                                    <EventDateBadge dateStr={race.dateOfRace} />
                                                    {raceDaysUntil !== null && (
                                                        <Chip
                                                            label={
                                                                raceDaysUntil === 0 ? t('races.today')
                                                                : raceDaysUntil === 1 ? t('races.tomorrow')
                                                                : raceDaysUntil < 0 ? t('races.daysAgo', { count: Math.abs(raceDaysUntil) })
                                                                : t('races.daysUntil', { count: raceDaysUntil })
                                                            }
                                                            size="small"
                                                            color={getCountdownColor(raceDaysUntil)}
                                                            variant="outlined"
                                                            sx={{ height: 20, fontSize: '0.68rem' }}
                                                        />
                                                    )}
                                                </Stack>
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">—</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                                            <ActivityIcons activityTypes={event.activityTypes} activityType={event.activityType} />
                                            <Stack spacing={0.25}>
                                                <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 280 }}>
                                                    {loc(event.name, event.nameEn) ?? event.name}
                                                    {' '}
                                                    <svg width="6" height="6" viewBox="0 0 24 24" style={{ display: 'inline', verticalAlign: 'middle', marginBottom: 1, opacity: 0.5 }}><circle cx="12" cy="12" r="8" fill="currentColor" /></svg>
                                                    {' '}
                                                    {loc(race.raceName, race.raceNameEn) ?? race.raceName}
                                                </Typography>
                                                <Chip label={t(`races.eventTypes.Series`, 'Series')} size="small" color={getEventTypeColor('Series')} variant="outlined" sx={{ fontSize: '0.65rem', height: 18, alignSelf: 'flex-start' }} />
                                            </Stack>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        {race.distanceLabel ? (
                                            <Chip label={race.distanceLabel} size="small" variant="outlined" color={getTicketStatusColor(race.ticketStatus)} />
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">—</Typography>
                                        )}
                                    </TableCell>
                                    {(() => {
                                        const km = getDistanceKm(event);
                                        return (
                                            <TableCell>
                                                {km != null ? (
                                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                                        <NearMeIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                                                        <Typography variant="body2" noWrap>{formatDistanceKm(km)}</Typography>
                                                    </Stack>
                                                ) : (
                                                    <Tooltip title={userLocation ? t('races.nearMe.noGps') : t('races.nearMe.enableLocation')}>
                                                        <Typography variant="body2" color="text.secondary" sx={{ cursor: 'help' }}>—</Typography>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        );
                                    })()}
                                    <TableCell>
                                        {event.locationName ? (
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 130 }}>{event.locationName}</Typography>
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">—</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        {race.registrationUrl && raceDaysUntil !== null && raceDaysUntil >= 0 ? (
                                            <Button size="small" variant="outlined" href={race.registrationUrl} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} onClick={(e) => e.stopPropagation()} sx={{ textTransform: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                                {t('races.register', 'Register')}
                                            </Button>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">—</Typography>
                                        )}
                                    </TableCell>
                                </TableRow>
                                </React.Fragment>
                            );
                        }

                        const { event } = row;
                        const isExpanded = expandedIds.has(event.id);
                        const detail = detailCache[event.id];
                        const isLoading = loadingIds.has(event.id);
                        const nextEdition = detail?.editions.find(ed => ed.date === event.nextEditionDate)
                            ?? detail?.editions[0];
                        const races = nextEdition?.races ?? [];

                        return (
                            <React.Fragment key={event.id}>
                                {holidaySeparator}
                                <TableRow
                                    hover
                                    tabIndex={0}
                                    role="link"
                                    sx={{
                                        cursor: 'pointer',
                                        '& td': { borderBottom: isExpanded ? 0 : undefined },
                                        bgcolor: event.type === 'Advertisement'
                                            ? 'rgba(255, 193, 7, 0.08)'
                                            : idx % 2 === 1 ? 'action.hover' : 'transparent',
                                        ...(isEffectivelyCancelled(event) && { opacity: 0.6 }),
                                    }}
                                    onClick={() => navigate(`/events/${event.slug}`)}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/events/${event.slug}`); } }}
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
                                    {/* Date — merged countdown + date + weekday badge */}
                                    <TableCell align="center">
                                        {(event.displayDate ?? event.nextEditionDate) ? (
                                            <Stack alignItems="center" spacing={0.5}>
                                                <Typography variant="body2" noWrap>
                                                    {formatNextDate((event.displayDate ?? event.nextEditionDate)!, t)}
                                                </Typography>
                                                <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap" justifyContent="center">
                                                    <EventDateBadge dateStr={(event.displayDate ?? event.nextEditionDate)!} endDateStr={event.endDisplayDate} />
                                                    {event.daysUntil !== null && !isEffectivelyCancelled(event) && (
                                                        <Chip
                                                            label={
                                                                event.daysUntil === 0 ? t('races.today')
                                                                : event.daysUntil === 1 ? t('races.tomorrow')
                                                                : event.daysUntil === -1 ? t('races.yesterday')
                                                                : event.daysUntil < -1 ? t('races.daysAgo', { count: Math.abs(event.daysUntil) })
                                                                : t('races.daysUntil', { count: event.daysUntil })
                                                            }
                                                            size="small"
                                                            color={getCountdownColor(event.daysUntil)}
                                                            variant="outlined"
                                                            sx={{ height: 20, fontSize: '0.68rem' }}
                                                        />
                                                    )}
                                                </Stack>
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">—</Typography>
                                        )}
                                    </TableCell>

                                    {/* Name — activity icon + type pill below */}
                                    <TableCell>
                                        <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                                            <ActivityIcons activityTypes={event.activityTypes} activityType={event.activityType} />
                                            <Stack spacing={0.25}>
                                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={700}
                                                        noWrap
                                                        sx={{
                                                            maxWidth: 220,
                                                            ...(isEffectivelyCancelled(event) && { textDecoration: 'line-through' }),
                                                        }}
                                                    >
                                                        {loc(event.name, event.nameEn) ?? event.name}
                                                    </Typography>
                                                    {event.type === 'Advertisement' && (
                                                        <Chip label={t('races.eventTypes.Advertisement', 'Sponsored')} size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />
                                                    )}
                                                    {isEffectivelyCancelled(event) && (
                                                        <Chip label={t('races.statusCancelled')} size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
                                                    )}
                                                </Stack>
                                                {event.type !== 'Advertisement' && (
                                                    <Chip label={t(`races.eventTypes.${event.type}`, event.type)} size="small" color={getEventTypeColor(event.type)} variant="outlined" sx={{ fontSize: '0.65rem', height: 18, alignSelf: 'flex-start' }} />
                                                )}
                                            </Stack>
                                        </Stack>
                                    </TableCell>

                                    {/* Distances */}
                                    <TableCell>
                                        {event.distances && event.distances.length > 0 ? (
                                            <Stack direction="row" flexWrap="wrap" gap={0.5}>
                                                {groupDistances(event.distances).map((d, i) => (
                                                    <Tooltip key={i} title={d.ticketStatus && d.ticketStatus !== 'Available' ? t(`races.ticketStatus.${d.ticketStatus}`, d.ticketStatus) : ''}>
                                                        <Chip
                                                            label={d.count > 1 ? `${d.count} × ${d.label}` : d.label}
                                                            size="small"
                                                            variant="outlined"
                                                            clickable
                                                            color={getTicketStatusColor(d.ticketStatus)}
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.slug}`); }}
                                                        />
                                                    </Tooltip>
                                                ))}
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">—</Typography>
                                        )}
                                    </TableCell>


                                    {/* Distance to user */}
                                    {(() => {
                                        const km = getDistanceKm(event);
                                        return (
                                            <TableCell>
                                                {km != null ? (
                                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                                        <NearMeIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                                                        <Typography variant="body2" noWrap>{formatDistanceKm(km)}</Typography>
                                                    </Stack>
                                                ) : (
                                                    <Tooltip title={userLocation ? t('races.nearMe.noGps') : t('races.nearMe.enableLocation')}>
                                                        <Typography variant="body2" color="text.secondary" sx={{ cursor: 'help' }}>—</Typography>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        );
                                    })()}

                                    {/* Location */}
                                    <TableCell>
                                        {event.locationName ? (
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 130 }}>
                                                    {event.locationName}
                                                </Typography>
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">—</Typography>
                                        )}
                                    </TableCell>

                                    {/* Links */}
                                    <TableCell align="center">
                                        <Stack alignItems="center" spacing={0.5}>
                                            {event.registrationUrl && event.daysUntil != null && event.daysUntil >= 0 ? (
                                                isAllSoldOut(event.distances) ? (
                                                    <Chip
                                                        label={t('races.ticketStatus.SoldOut', 'Sold out')}
                                                        size="small"
                                                        color="error"
                                                        variant="outlined"
                                                    />
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            href={event.registrationUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                                            onClick={(e) => e.stopPropagation()}
                                                            sx={{ textTransform: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                                                        >
                                                            {t('races.register', 'Register')}
                                                        </Button>
                                                        {event.registrationStatus && (
                                                            <Chip
                                                                label={t(`races.registrationStatus.${event.registrationStatus}`, event.registrationStatus)}
                                                                size="small"
                                                                color={getRegistrationStatusColor(event.registrationStatus)}
                                                            />
                                                        )}
                                                    </>
                                                )
                                            ) : event.resultsUrl && event.daysUntil != null && event.daysUntil < 0 ? (
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="success"
                                                    href={event.resultsUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                                    onClick={(e) => e.stopPropagation()}
                                                    sx={{ textTransform: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                                                >
                                                    {t('races.results', 'Results')}
                                                </Button>
                                            ) : null}
                                            {event.youtubeUrl && (
                                                <Tooltip title="360° / YouTube">
                                                    <IconButton
                                                        size="small"
                                                        href={event.youtubeUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        color="error"
                                                    >
                                                        <VideocamIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {!event.registrationUrl && !event.resultsUrl && !event.youtubeUrl && (
                                                <Typography variant="body2" color="text.secondary">—</Typography>
                                            )}
                                        </Stack>
                                    </TableCell>
                                </TableRow>

                                {/* Expandable race detail row */}
                                <TableRow sx={{ bgcolor: idx % 2 === 1 ? 'action.hover' : 'transparent' }}>
                                    <TableCell colSpan={totalColumns} sx={{ py: 0, px: 0, borderBottom: isExpanded ? undefined : 0 }}>
                                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                            <Box sx={{ px: 3, py: 1.5 }}>
                                                {isLoading || (!detail && isExpanded) ? (
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
                                                                <RaceChipCard key={race.id} race={race} editionDate={nextEdition?.date ?? null} eventActivityType={event.activityType} />
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
                    });
                    })()}
                    {sortedRows.length === 0 && (
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
function RaceChipCard({ race, editionDate, eventActivityType }: { race: RaceDto; editionDate?: string | null; eventActivityType?: string }) {
    const { t, i18n } = useTranslation();
    const loc = useLocalize();
    const navigate = useNavigate();
    const { isEnabled } = useFeatureFlags();
    const resolvedActivityType = race.activityType ?? eventActivityType ?? null;
    const isResaleActivityType = resolvedActivityType === 'Running' || resolvedActivityType === 'TrailRunning';
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
                    {loc(race.name, race.nameEn) ?? race.name}
                </Typography>
                {formattedDate && (
                    <Typography variant="caption" color="text.secondary">
                        {formattedDate}
                    </Typography>
                )}
                {(race.trailDifficulty || race.trailTerrainType || race.trailActivityType) && (
                    <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
                        {race.trailDifficulty && (
                            <Chip
                                label={t(`difficulty.${race.trailDifficulty.toLowerCase()}`, race.trailDifficulty)}
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                            />
                        )}
                        {race.trailTerrainType && (
                            <Chip
                                label={t(`trail.terrainType.${race.trailTerrainType}`, { defaultValue: race.trailTerrainType })}
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                            />
                        )}
                        {race.trailActivityType && (
                            <Chip
                                icon={getActivityIcon(race.trailActivityType)}
                                label={t(`difficulty.${race.trailActivityType.charAt(0).toLowerCase() + race.trailActivityType.slice(1)}`, race.trailActivityType)}
                                size="small"
                                variant="outlined"
                                color="primary"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                            />
                        )}
                    </Stack>
                )}
                <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
                    {race.distanceLabel && (
                        <Tooltip title={t('races.raceDistance', 'Race distance')}>
                            <Chip
                                icon={<StraightenIcon sx={{ fontSize: 14 }} />}
                                label={race.distanceLabel}
                                size="small"
                                variant="outlined"
                                sx={{ height: 22, fontSize: '0.7rem' }}
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
                    {race.ticketStatus && race.ticketStatus !== 'Available' && (
                        <Tooltip title={t('races.ticketStatusLabel', 'Registration status')}>
                            <Chip
                                label={t(`races.ticketStatus.${race.ticketStatus}`, race.ticketStatus)}
                                size="small"
                                color={getTicketStatusColor(race.ticketStatus)}
                                sx={{ height: 22, fontSize: '0.7rem' }}
                            />
                        </Tooltip>
                    )}
                    {race.ticketStatus === 'SoldOut'
                        && isEnabled('resale_tickets', false)
                        && isResaleActivityType && (
                        <Link
                            href={t('races.table.resaleHref')}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="caption"
                            sx={{ height: 22, lineHeight: '22px', fontSize: '0.7rem' }}
                            onClick={e => e.stopPropagation()}
                        >
                            {t('races.table.resaleLink', 'Ticket resale')}
                        </Link>
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
            </Stack>
        </Paper>
    );
}

export default EventTableView;
