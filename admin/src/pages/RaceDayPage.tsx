import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Stack, Button, Chip, Checkbox,
    TextField, CircularProgress, Tooltip, IconButton,
    Table, TableBody, TableCell, TableHead, TableRow, Alert,
    Select, MenuItem, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import dayjs, { type Dayjs } from 'dayjs';
import { apiFetch } from '../hooks/api';
import type { RaceStatus, TicketStatus } from '../hooks/useEvents';

const RACE_STATUSES: RaceStatus[] = ['Active', 'Completed', 'Cancelled', 'Hidden'];
const TICKET_STATUSES: TicketStatus[] = ['Available', 'AlmostSoldOut', 'SoldOut', 'Closed', 'NotStarted', 'Free'];
const EVENT_STATUSES = ['Unconfirmed', 'Confirmed', 'Cancelled', 'Hidden', 'Unlisted'] as const;
const REGISTRATION_STATUSES = ['NotStarted', 'Open', 'Closed'] as const;

type Mode = 'setup' | 'wrapup';

interface RaceDayRace {
    id: string;
    name: string;
    nameEn: string | null;
    distanceLabel: string | null;
    distanceLabelEn: string | null;
    status: RaceStatus;
    ticketStatus: TicketStatus;
    sortOrder: number;
    activityType: string | null;
    startTime: string | null;
    cutoffMinutes: number | null;
}

interface RaceDayEdition {
    id: string;
    eventId: string;
    eventName: string;
    eventSlug: string;
    eventType: string;
    eventStatus: string;
    date: string | null;
    endDate: string | null;
    title: string | null;
    resultsUrl: string | null;
    registrationUrl: string | null;
    registrationStatus: string;
    races: RaceDayRace[];
}

const STATUS_COLOR: Record<string, 'default' | 'success' | 'error' | 'warning' | 'info'> = {
    Active: 'info',
    Completed: 'success',
    Cancelled: 'error',
    Hidden: 'default',
};

function defaultMode(d: Dayjs): Mode {
    return d.isAfter(dayjs(), 'day') ? 'setup' : 'wrapup';
}

interface RaceDayPageProps {
    onNotify: (message: string, severity?: 'success' | 'error') => void;
    onNavigateToEvent?: (eventId: string) => void;
    initialDate?: string;
}

export default function RaceDayPage({ onNotify, onNavigateToEvent, initialDate }: RaceDayPageProps) {
    const [date, setDate] = useState<Dayjs>(() => initialDate ? dayjs(initialDate) : dayjs());
    const [mode, setMode] = useState<Mode>(() => defaultMode(initialDate ? dayjs(initialDate) : dayjs()));
    const [editions, setEditions] = useState<RaceDayEdition[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRaceIds, setSelectedRaceIds] = useState<Set<string>>(new Set());
    const [resultsUrls, setResultsUrls] = useState<Record<string, string>>({});
    const [registrationUrls, setRegistrationUrls] = useState<Record<string, string>>({});
    const [savingRaces, setSavingRaces] = useState<Set<string>>(new Set());
    const [savingEditions, setSavingEditions] = useState<Set<string>>(new Set());
    const [updatingRace, setUpdatingRace] = useState<Set<string>>(new Set());
    const [bulkEditions, setBulkEditions] = useState(false);
    const [nextRaceDate, setNextRaceDate] = useState<string | null>(null);
    const [prevRaceDate, setPrevRaceDate] = useState<string | null>(null);
    const [updatingEditions, setUpdatingEditions] = useState<Set<string>>(new Set());
    const [raceNames, setRaceNames] = useState<Record<string, { name: string; nameEn: string }>>({});
    const [raceDistanceLabels, setRaceDistanceLabels] = useState<Record<string, { distanceLabel: string; distanceLabelEn: string }>>({});
    const [raceNameLang, setRaceNameLang] = useState<'is' | 'en'>('is');
    const [sortByStart, setSortByStart] = useState(false);
    const [bulkEvents, setBulkEvents] = useState(false);

    const dateStr = date.format('YYYY-MM-DD');

    // Auto-switch mode when date changes
    useEffect(() => {
        setMode(defaultMode(date));
    }, [dateStr]); // eslint-disable-line react-hooks/exhaustive-deps

    // Page-local shortcuts: s = Setup, w = Wrap-up
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            const tag = (document.activeElement as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.key === 's') setMode('setup');
            else if (e.key === 'w') setMode('wrapup');
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const load = useCallback(() => {
        setLoading(true);
        setSelectedRaceIds(new Set());
        setNextRaceDate(null);
        setPrevRaceDate(null);
        Promise.all([
            apiFetch<RaceDayEdition[]>(`/api/v1/admin/race-day?date=${dateStr}`),
            apiFetch<string | null>(`/api/v1/admin/next-race-day?after=${dateStr}`),
            apiFetch<string | null>(`/api/v1/admin/prev-race-day?before=${dateStr}`),
        ])
            .then(([data, next, prev]) => {
                setEditions(data);
                setNextRaceDate(next);
                setPrevRaceDate(prev);
                const urls: Record<string, string> = {};
                const names: Record<string, { name: string; nameEn: string }> = {};
                const regUrls: Record<string, string> = {};
                data.forEach(ed => {
                    urls[ed.id] = ed.resultsUrl ?? '';
                    regUrls[ed.id] = ed.registrationUrl ?? '';
                    ed.races.forEach(r => { names[r.id] = { name: r.name, nameEn: r.nameEn ?? '' }; });
                });
                setResultsUrls(urls);
                setRegistrationUrls(regUrls);
                setRaceNames(names);
            })
            .catch(() => onNotify('Failed to load race day data', 'error'))
            .finally(() => setLoading(false));
    }, [dateStr, onNotify]);

    useEffect(() => { load(); }, [load]);

    const allRaceIds = editions.flatMap(ed => ed.races.map(r => r.id));
    const selectableRaceIds = editions.flatMap(ed =>
        ed.races.filter(r => r.status !== 'Cancelled' && r.status !== 'Hidden').map(r => r.id)
    );

    const toggleRace = (id: string) => {
        setSelectedRaceIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedRaceIds.size === selectableRaceIds.length && selectableRaceIds.length > 0) {
            setSelectedRaceIds(new Set());
        } else {
            setSelectedRaceIds(new Set(selectableRaceIds));
        }
    };

    // ── Shared bulk race helper ───────────────────────────────────────────────
    const bulkUpdateRaces = async (
        ids: string[],
        patch: (race: RaceDayRace) => Partial<{ status: string; ticketStatus: string }>,
        successMsg: (n: number) => string
    ) => {
        if (ids.length === 0) return;
        setSavingRaces(new Set(ids));
        let ok = 0; let fail = 0;
        await Promise.all(ids.map(async raceId => {
            const race = editions.flatMap(ed => ed.races).find(r => r.id === raceId);
            if (!race) return;
            const edition = editions.find(ed => ed.races.some(r => r.id === raceId))!;
            const p = patch(race);
            try {
                await apiFetch(`/api/v1/admin/races/${raceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        id: raceId,
                        name: race.name, nameEn: race.nameEn, distanceLabel: race.distanceLabel, distanceLabelEn: race.distanceLabelEn,
                        cutoffMinutes: race.cutoffMinutes, description: null,
                        status: p.status ?? race.status,
                        sortOrder: race.sortOrder,
                        ticketStatus: p.ticketStatus ?? race.ticketStatus,
                        maxParticipants: null, itraPoints: null, certifiedBy: null,
                        prizeMoney: 0, championshipCategory: null, dateOfRace: null,
                        startTime: race.startTime, activityType: race.activityType, trailId: null,
                        eventEditionId: edition.id,
                    }),
                });
                ok++;
            } catch { fail++; }
        }));
        setSavingRaces(new Set());
        if (fail === 0) onNotify(successMsg(ok));
        else onNotify(`${ok} succeeded, ${fail} failed`, 'error');
        load();
    };

    // ── Shared bulk edition helper ────────────────────────────────────────────
    const bulkUpdateEditions = async (
        eds: RaceDayEdition[],
        patch: (ed: RaceDayEdition) => object,
        successMsg: (n: number) => string
    ) => {
        if (eds.length === 0) return;
        setBulkEditions(true);
        let ok = 0; let fail = 0;
        await Promise.all(eds.map(async ed => {
            try {
                await apiFetch(`/api/v1/admin/editions/${ed.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        id: ed.id, year: null, date: ed.date, endDate: ed.endDate,
                        title: ed.title, titleEn: null, registrationUrl: ed.registrationUrl,
                        resultsUrl: resultsUrls[ed.id] || null, notes: null, notesEn: null,
                        trailId: null, ...patch(ed),
                    }),
                });
                ok++;
            } catch { fail++; }
        }));
        setBulkEditions(false);
        if (fail === 0) onNotify(successMsg(ok));
        else onNotify(`${ok} succeeded, ${fail} failed`, 'error');
        load();
    };

    // ── Wrap-up bulk actions ──────────────────────────────────────────────────
    const markCompleted = () =>
        bulkUpdateRaces(Array.from(selectedRaceIds), () => ({ status: 'Completed' }),
            n => `${n} race${n > 1 ? 's' : ''} marked as Completed`);

    const markTicketsClosed = () =>
        bulkUpdateRaces(Array.from(selectedRaceIds), () => ({ ticketStatus: 'Closed' }),
            n => `${n} race${n > 1 ? 's' : ''} tickets marked as Closed`);

    const closeAllRegistrations = () =>
        bulkUpdateEditions(
            editions.filter(ed => ed.registrationStatus !== 'Closed'),
            () => ({ registrationStatus: 'Closed' }),
            n => `Registration closed for ${n} edition${n > 1 ? 's' : ''}`
        );

    // ── Setup bulk actions ────────────────────────────────────────────────────
    const markActive = () =>
        bulkUpdateRaces(Array.from(selectedRaceIds), () => ({ status: 'Active' }),
            n => `${n} race${n > 1 ? 's' : ''} marked as Active`);

    const markTicketsAvailable = () =>
        bulkUpdateRaces(Array.from(selectedRaceIds), () => ({ ticketStatus: 'Available' }),
            n => `${n} race${n > 1 ? 's' : ''} tickets set to Available`);

    const openAllRegistrations = () =>
        bulkUpdateEditions(
            editions.filter(ed => ed.registrationStatus !== 'Open'),
            () => ({ registrationStatus: 'Open' }),
            n => `Registration opened for ${n} edition${n > 1 ? 's' : ''}`
        );

    const confirmAllEvents = async () => {
        const unconfirmed = editions.filter(ed => ed.eventStatus !== 'Confirmed');
        if (unconfirmed.length === 0) { onNotify('All events already confirmed'); return; }
        setBulkEvents(true);
        let ok = 0; let fail = 0;
        await Promise.all(unconfirmed.map(async ed => {
            try {
                await apiFetch(`/api/v1/admin/events/${ed.eventId}/status`, {
                    method: 'PATCH',
                    body: JSON.stringify({ id: ed.eventId, status: 'Confirmed' }),
                });
                ok++;
            } catch { fail++; }
        }));
        setBulkEvents(false);
        if (fail === 0) onNotify(`${ok} event${ok > 1 ? 's' : ''} confirmed`);
        else onNotify(`${ok} succeeded, ${fail} failed`, 'error');
        load();
    };

    // ── Individual field updates ──────────────────────────────────────────────
    const saveResultsUrl = async (editionId: string) => {
        const edition = editions.find(ed => ed.id === editionId);
        if (!edition) return;
        const url = resultsUrls[editionId] ?? '';
        setSavingEditions(prev => new Set(prev).add(editionId));
        try {
            await apiFetch(`/api/v1/admin/editions/${editionId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    id: editionId, year: null, date: edition.date, endDate: edition.endDate,
                    title: edition.title, titleEn: null, registrationUrl: edition.registrationUrl,
                    resultsUrl: url || null, notes: null, notesEn: null,
                    registrationStatus: edition.registrationStatus, trailId: null,
                }),
            });
            onNotify('Results URL saved');
            load();
        } catch {
            onNotify('Failed to save results URL', 'error');
        } finally {
            setSavingEditions(prev => { const n = new Set(prev); n.delete(editionId); return n; });
        }
    };

    const saveRegistrationUrl = async (editionId: string) => {
        const edition = editions.find(ed => ed.id === editionId);
        if (!edition) return;
        const url = registrationUrls[editionId] ?? '';
        setSavingEditions(prev => new Set(prev).add(editionId));
        try {
            await apiFetch(`/api/v1/admin/editions/${editionId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    id: editionId, year: null, date: edition.date, endDate: edition.endDate,
                    title: edition.title, titleEn: null, registrationUrl: url || null,
                    resultsUrl: edition.resultsUrl, notes: null, notesEn: null,
                    registrationStatus: edition.registrationStatus, trailId: null,
                }),
            });
            onNotify('Registration URL saved');
            load();
        } catch {
            onNotify('Failed to save registration URL', 'error');
        } finally {
            setSavingEditions(prev => { const n = new Set(prev); n.delete(editionId); return n; });
        }
    };

    const updateRaceField = async (
        race: RaceDayRace,
        editionId: string,
        patch: { status?: RaceStatus; ticketStatus?: TicketStatus; name?: string; nameEn?: string; distanceLabel?: string; distanceLabelEn?: string }
    ) => {
        setUpdatingRace(prev => new Set(prev).add(race.id));
        try {
            await apiFetch(`/api/v1/admin/races/${race.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    id: race.id,
                    name: patch.name ?? race.name,
                    nameEn: patch.nameEn !== undefined ? (patch.nameEn || null) : race.nameEn,
                    distanceLabel: patch.distanceLabel !== undefined ? (patch.distanceLabel || null) : race.distanceLabel,
                    distanceLabelEn: patch.distanceLabelEn !== undefined ? (patch.distanceLabelEn || null) : race.distanceLabelEn,
                    cutoffMinutes: race.cutoffMinutes, description: null,
                    status: patch.status ?? race.status,
                    sortOrder: race.sortOrder,
                    ticketStatus: patch.ticketStatus ?? race.ticketStatus,
                    maxParticipants: null, itraPoints: null, certifiedBy: null,
                    prizeMoney: 0, championshipCategory: null, dateOfRace: null,
                    startTime: race.startTime, activityType: race.activityType, trailId: null,
                    eventEditionId: editionId,
                }),
            });
            onNotify(`${race.name} updated`);
            load();
        } catch {
            onNotify(`Failed to update ${race.name}`, 'error');
        } finally {
            setUpdatingRace(prev => { const n = new Set(prev); n.delete(race.id); return n; });
        }
    };

    const updateEditionField = async (ed: RaceDayEdition, patch: { registrationStatus?: string }) => {
        setUpdatingEditions(prev => new Set(prev).add(ed.id));
        try {
            await apiFetch(`/api/v1/admin/editions/${ed.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    id: ed.id, year: null, date: ed.date, endDate: ed.endDate,
                    title: ed.title, titleEn: null, registrationUrl: ed.registrationUrl,
                    resultsUrl: resultsUrls[ed.id] || null, notes: null, notesEn: null,
                    registrationStatus: patch.registrationStatus ?? ed.registrationStatus,
                    trailId: null,
                }),
            });
            onNotify('Edition updated');
            load();
        } catch {
            onNotify('Failed to update edition', 'error');
        } finally {
            setUpdatingEditions(prev => { const n = new Set(prev); n.delete(ed.id); return n; });
        }
    };

    const updateEventStatus = async (ed: RaceDayEdition, status: string) => {
        setUpdatingEditions(prev => new Set(prev).add(ed.id));
        try {
            await apiFetch(`/api/v1/admin/events/${ed.eventId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ id: ed.eventId, status }),
            });
            onNotify('Event status updated');
            load();
        } catch {
            onNotify('Failed to update event status', 'error');
        } finally {
            setUpdatingEditions(prev => { const n = new Set(prev); n.delete(ed.id); return n; });
        }
    };

    // ── Derived state ─────────────────────────────────────────────────────────
    const totalRaces = allRaceIds.length;
    const allRaces = editions.flatMap(ed => ed.races);
    const completedRaces = allRaces.filter(r => r.status === 'Completed').length;
    const cancelledRaces = allRaces.filter(r => r.status === 'Cancelled').length;
    const activeRaces = allRaces.filter(r => r.status === 'Active').length;

    const isWrapupDone = editions.length > 0 &&
        allRaces.every(r => r.status === 'Completed' || r.status === 'Cancelled') &&
        allRaces.filter(r => r.status !== 'Cancelled').every(r => r.ticketStatus === 'Closed') &&
        editions.every(ed => ed.registrationStatus === 'Closed') &&
        editions.every(ed => (ed.resultsUrl ?? '') !== '');

    const isSetupReady = editions.length > 0 &&
        allRaces.filter(r => r.status !== 'Cancelled' && r.status !== 'Hidden').every(r => r.status === 'Active') &&
        editions.every(ed => ed.registrationStatus === 'Open') &&
        editions.every(ed => ed.eventStatus === 'Confirmed') &&
        editions.every(ed => (registrationUrls[ed.id] ?? ed.registrationUrl ?? '') !== '');

    const isBusy = savingRaces.size > 0 || bulkEditions || bulkEvents;

    // Per-edition progress
    const editionProgress = (ed: RaceDayEdition) => {
        const races = ed.races.filter(r => r.status !== 'Cancelled' && r.status !== 'Hidden');
        if (mode === 'setup') {
            return [
                { label: 'Confirmed', done: ed.eventStatus === 'Confirmed' },
                { label: 'Reg URL', done: (registrationUrls[ed.id] ?? ed.registrationUrl ?? '') !== '' },
                { label: 'Races active', done: races.length > 0 && races.every(r => r.status === 'Active') },
                { label: 'Reg open', done: ed.registrationStatus === 'Open' },
            ];
        }
        const nonCancelled = ed.races.filter(r => r.status !== 'Cancelled');
        return [
            { label: `${ed.races.filter(r => r.status === 'Completed').length}/${ed.races.length} done`, done: ed.races.every(r => r.status === 'Completed' || r.status === 'Cancelled') },
            { label: 'Tickets', done: nonCancelled.every(r => r.ticketStatus === 'Closed') },
            { label: 'Reg closed', done: ed.registrationStatus === 'Closed' },
            { label: 'Results URL', done: (resultsUrls[ed.id] ?? ed.resultsUrl ?? '') !== '' },
        ];
    };

    return (
        <Box>
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
                <Box>
                    <Typography variant="h5" fontWeight="bold">Race Manager</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {mode === 'setup'
                            ? 'Pre-race setup — activate races, open registrations'
                            : 'Post-race wrap-up — mark completed, add results URLs'}
                    </Typography>
                </Box>
                <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
                    <ToggleButtonGroup
                        value={mode}
                        exclusive
                        onChange={(_, v) => v && setMode(v)}
                        size="small"
                    >
                        <ToggleButton value="setup" sx={{ px: 1.5, textTransform: 'none', fontSize: '0.8rem' }}>
                            <RocketLaunchIcon sx={{ fontSize: '0.9rem', mr: 0.5 }} /><u>S</u>etup
                        </ToggleButton>
                        <ToggleButton value="wrapup" sx={{ px: 1.5, textTransform: 'none', fontSize: '0.8rem' }}>
                            <CheckCircleIcon sx={{ fontSize: '0.9rem', mr: 0.5 }} /><u>W</u>rap-up
                        </ToggleButton>
                    </ToggleButtonGroup>
                    <Tooltip title={prevRaceDate ? `Previous: ${dayjs(prevRaceDate).format('D MMM YYYY')}` : 'No earlier race day'}>
                        <span>
                            <IconButton onClick={() => prevRaceDate && setDate(dayjs(prevRaceDate))} size="small" disabled={!prevRaceDate || loading}>
                                <ChevronLeftIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <DatePicker
                        label="Date"
                        value={date}
                        onChange={d => d && setDate(d)}
                        slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
                    />
                    <Tooltip title={nextRaceDate ? `Next: ${dayjs(nextRaceDate).format('D MMM YYYY')}` : 'No upcoming race day'}>
                        <span>
                            <IconButton onClick={() => nextRaceDate && setDate(dayjs(nextRaceDate))} size="small" disabled={!nextRaceDate || loading}>
                                <ChevronRightIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Today">
                        <IconButton onClick={() => setDate(dayjs())} size="small">
                            <CalendarTodayIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Refresh">
                        <IconButton onClick={load} size="small" disabled={loading}>
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>

            {/* Status banner */}
            {!loading && mode === 'wrapup' && isWrapupDone && (
                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                    All done! Every race is completed, tickets closed, registrations closed, and results URLs saved.
                </Alert>
            )}
            {!loading && mode === 'setup' && isSetupReady && (
                <Alert severity="success" icon={<RocketLaunchIcon />} sx={{ mb: 2 }}>
                    Ready to go! All races are active, registrations open, and events confirmed.
                </Alert>
            )}

            {/* Summary strip */}
            {!loading && editions.length > 0 && (
                <Stack direction="row" alignItems="center" gap={1.5} mb={3} flexWrap="wrap">
                    <Chip label={`${editions.length} edition${editions.length > 1 ? 's' : ''}`} variant="outlined" />
                    <Chip label={`${totalRaces} race${totalRaces !== 1 ? 's' : ''} total`} variant="outlined" />
                    {activeRaces > 0 && <Chip label={`${activeRaces} active`} color="info" variant="outlined" />}
                    {completedRaces > 0 && <Chip label={`${completedRaces} completed`} color="success" variant="outlined" />}
                    {cancelledRaces > 0 && <Chip label={`${cancelledRaces} cancelled`} color="error" variant="outlined" />}
                    <Tooltip title={raceNameLang === 'is' ? 'Switch race names to English' : 'Switch race names to Icelandic'}>
                        <IconButton onClick={() => setRaceNameLang(l => l === 'is' ? 'en' : 'is')} size="small" sx={{ fontSize: '1.2rem' }}>
                            {raceNameLang === 'is' ? '🇬🇧' : '🇮🇸'}
                        </IconButton>
                    </Tooltip>
                </Stack>
            )}

            {/* Bulk action bar */}
            {selectableRaceIds.length > 0 && (
                <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                    <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
                        <Checkbox
                            checked={selectedRaceIds.size === selectableRaceIds.length && selectableRaceIds.length > 0}
                            indeterminate={selectedRaceIds.size > 0 && selectedRaceIds.size < selectableRaceIds.length}
                            onChange={toggleAll}
                            size="small"
                        />
                        <Typography variant="body2" color="text.secondary">
                            {selectedRaceIds.size > 0
                                ? `${selectedRaceIds.size} race${selectedRaceIds.size > 1 ? 's' : ''} selected`
                                : 'Select races to update'}
                        </Typography>

                        {mode === 'setup' ? (<>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={isBusy ? <CircularProgress size={14} color="inherit" /> : <RocketLaunchIcon />}
                                disabled={selectedRaceIds.size === 0 || isBusy}
                                onClick={markActive}
                                color="info"
                            >
                                Mark Active
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                disabled={selectedRaceIds.size === 0 || isBusy}
                                onClick={markTicketsAvailable}
                            >
                                Tickets → Available
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                color="success"
                                disabled={isBusy || editions.every(ed => ed.registrationStatus === 'Open')}
                                startIcon={bulkEditions ? <CircularProgress size={14} color="inherit" /> : undefined}
                                onClick={openAllRegistrations}
                            >
                                Open Registrations
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                color="info"
                                disabled={isBusy || editions.every(ed => ed.eventStatus === 'Confirmed')}
                                startIcon={bulkEvents ? <CircularProgress size={14} color="inherit" /> : undefined}
                                onClick={confirmAllEvents}
                            >
                                Confirm All Events
                            </Button>
                        </>) : (<>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={isBusy ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                                disabled={selectedRaceIds.size === 0 || isBusy}
                                onClick={markCompleted}
                                color="success"
                            >
                                Mark Completed
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                disabled={selectedRaceIds.size === 0 || isBusy}
                                onClick={markTicketsClosed}
                            >
                                Tickets Closed
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                color="warning"
                                disabled={isBusy || editions.every(ed => ed.registrationStatus === 'Closed')}
                                startIcon={bulkEditions ? <CircularProgress size={14} color="inherit" /> : undefined}
                                onClick={closeAllRegistrations}
                            >
                                Close All Registrations
                            </Button>
                        </>)}
                    </Stack>
                </Paper>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                    <CircularProgress />
                </Box>
            ) : editions.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">No editions found for {date.format('D MMMM YYYY')}</Typography>
                    <Stack direction="row" justifyContent="center" gap={3} mt={1.5}>
                        {prevRaceDate && (
                            <Typography variant="body2" color="text.secondary">
                                ← <Typography component="span" variant="body2" color="primary" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setDate(dayjs(prevRaceDate))}>
                                    {dayjs(prevRaceDate).format('D MMMM YYYY')}
                                </Typography>
                            </Typography>
                        )}
                        {nextRaceDate && (
                            <Typography variant="body2" color="text.secondary">
                                <Typography component="span" variant="body2" color="primary" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setDate(dayjs(nextRaceDate))}>
                                    {dayjs(nextRaceDate).format('D MMMM YYYY')}
                                </Typography> →
                            </Typography>
                        )}
                    </Stack>
                </Paper>
            ) : (
                <Stack gap={3}>
                    {editions.map(ed => (
                        <Paper key={ed.id} elevation={2}>
                            {/* Event header */}
                            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} flexWrap="wrap">
                                    <Box>
                                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                                            <Tooltip title={onNavigateToEvent ? 'Edit event' : ''} placement="top">
                                                <Typography
                                                    variant="h6"
                                                    fontWeight={600}
                                                    onClick={onNavigateToEvent ? () => onNavigateToEvent(ed.eventId) : undefined}
                                                    sx={onNavigateToEvent ? { cursor: 'pointer', '&:hover': { textDecoration: 'underline' } } : undefined}
                                                >
                                                    {ed.eventName}
                                                </Typography>
                                            </Tooltip>
                                            {ed.title && (
                                                <Chip label={ed.title} size="small" variant="outlined" />
                                            )}
                                            {updatingEditions.has(ed.id) ? (
                                                <CircularProgress size={16} />
                                            ) : (
                                                <>
                                                    <Select
                                                        size="small"
                                                        value={ed.eventStatus}
                                                        onChange={e => updateEventStatus(ed, e.target.value)}
                                                        sx={{ fontSize: '0.75rem', height: 24, '.MuiSelect-select': { py: '2px', px: 1 } }}
                                                    >
                                                        {EVENT_STATUSES.map(s => (
                                                            <MenuItem key={s} value={s} sx={{ fontSize: '0.8rem' }}>
                                                                <Chip
                                                                    label={s}
                                                                    size="small"
                                                                    color={s === 'Confirmed' ? 'success' : s === 'Cancelled' ? 'error' : 'default'}
                                                                    variant="outlined"
                                                                    sx={{ pointerEvents: 'none' }}
                                                                />
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                    <Select
                                                        size="small"
                                                        value={ed.registrationStatus}
                                                        onChange={e => updateEditionField(ed, { registrationStatus: e.target.value })}
                                                        sx={{ fontSize: '0.75rem', height: 24, '.MuiSelect-select': { py: '2px', px: 1 } }}
                                                    >
                                                        {REGISTRATION_STATUSES.map(s => (
                                                            <MenuItem key={s} value={s} sx={{ fontSize: '0.8rem' }}>
                                                                <Chip
                                                                    label={`Reg: ${s}`}
                                                                    size="small"
                                                                    color={s === 'Open' ? 'info' : s === 'Closed' ? 'default' : 'warning'}
                                                                    variant="outlined"
                                                                    sx={{ pointerEvents: 'none' }}
                                                                />
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </>
                                            )}
                                        </Stack>
                                        <Stack direction="row" gap={0.75} mt={0.75} flexWrap="wrap">
                                            {editionProgress(ed).map(item => (
                                                <Chip
                                                    key={item.label}
                                                    label={item.label}
                                                    size="small"
                                                    color={item.done ? 'success' : 'default'}
                                                    variant={item.done ? 'filled' : 'outlined'}
                                                    sx={{ fontSize: '0.7rem', height: 20, opacity: item.done ? 1 : 0.55 }}
                                                />
                                            ))}
                                        </Stack>
                                        {ed.endDate && ed.endDate !== ed.date && (() => {
                                            const dayNum = dayjs(dateStr).diff(dayjs(ed.date), 'day') + 1;
                                            const totalDays = dayjs(ed.endDate).diff(dayjs(ed.date), 'day') + 1;
                                            return (
                                                <Stack direction="row" alignItems="center" gap={1} mt={0.5}>
                                                    <Chip label={`Day ${dayNum} of ${totalDays}`} size="small" color="info" variant="outlined" />
                                                    <Typography variant="caption" color="text.secondary">
                                                        {ed.date} → {ed.endDate}
                                                    </Typography>
                                                </Stack>
                                            );
                                        })()}
                                    </Box>
                                    <Stack direction="row" gap={1} alignItems="center">
                                        <Tooltip title="Open on frontend">
                                            <IconButton
                                                size="small"
                                                component="a"
                                                href={`${import.meta.env.VITE_FRONTEND_URL ?? 'https://hlaupadagskra.is'}/events/${ed.eventSlug}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <OpenInNewIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        {mode === 'wrapup' && ed.races.some(r => r.status === 'Completed') && !(ed.resultsUrl ?? resultsUrls[ed.id]) && (
                                            <Tooltip title="Results URL missing">
                                                <WarningAmberIcon fontSize="small" color="warning" />
                                            </Tooltip>
                                        )}
                                        {mode === 'setup' && ed.eventStatus !== 'Confirmed' && (
                                            <Tooltip title="Event not yet confirmed">
                                                <WarningAmberIcon fontSize="small" color="warning" />
                                            </Tooltip>
                                        )}
                                        {mode === 'setup' && ed.registrationStatus === 'Open' && !(registrationUrls[ed.id] ?? ed.registrationUrl) && (
                                            <Tooltip title="Registration is open but no registration URL set">
                                                <WarningAmberIcon fontSize="small" color="error" />
                                            </Tooltip>
                                        )}
                                        {onNavigateToEvent && (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => onNavigateToEvent(ed.eventId)}
                                            >
                                                Edit event
                                            </Button>
                                        )}
                                    </Stack>
                                </Stack>
                            </Box>

                            {/* URL row — registration in setup, results in wrap-up */}
                            {mode === 'setup' ? (
                                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                                    <Stack direction="row" alignItems="center" gap={1.5}>
                                        <LinkIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
                                        <TextField
                                            size="small"
                                            placeholder="Registration URL (e.g. https://motus.is/…)"
                                            value={registrationUrls[ed.id] ?? ''}
                                            onChange={e => setRegistrationUrls(prev => ({ ...prev, [ed.id]: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter') saveRegistrationUrl(ed.id); }}
                                            fullWidth
                                            sx={{ '& .MuiInputBase-root': { bgcolor: 'background.paper' } }}
                                            InputProps={{
                                                endAdornment: registrationUrls[ed.id] ? (
                                                    <Tooltip title="Open URL">
                                                        <IconButton
                                                            size="small"
                                                            component="a"
                                                            href={registrationUrls[ed.id]}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <OpenInNewIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                ) : null,
                                            }}
                                        />
                                        <Button
                                            size="small"
                                            variant="contained"
                                            disabled={
                                                savingEditions.has(ed.id) ||
                                                (registrationUrls[ed.id] ?? '') === (ed.registrationUrl ?? '')
                                            }
                                            onClick={() => saveRegistrationUrl(ed.id)}
                                            sx={{ flexShrink: 0 }}
                                        >
                                            {savingEditions.has(ed.id) ? <CircularProgress size={16} color="inherit" /> : 'Save'}
                                        </Button>
                                    </Stack>
                                </Box>
                            ) : (
                                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                                    <Stack direction="row" alignItems="center" gap={1.5}>
                                        <LinkIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
                                        <TextField
                                            size="small"
                                            placeholder="Results URL (e.g. https://timataka.is/…)"
                                            value={resultsUrls[ed.id] ?? ''}
                                            onChange={e => setResultsUrls(prev => ({ ...prev, [ed.id]: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter') saveResultsUrl(ed.id); }}
                                            fullWidth
                                            sx={{ '& .MuiInputBase-root': { bgcolor: 'background.paper' } }}
                                            InputProps={{
                                                endAdornment: resultsUrls[ed.id] ? (
                                                    <Tooltip title="Open URL">
                                                        <IconButton
                                                            size="small"
                                                            component="a"
                                                            href={resultsUrls[ed.id]}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <OpenInNewIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                ) : null,
                                            }}
                                        />
                                        <Button
                                            size="small"
                                            variant="contained"
                                            disabled={
                                                savingEditions.has(ed.id) ||
                                                (resultsUrls[ed.id] ?? '') === (ed.resultsUrl ?? '')
                                            }
                                            onClick={() => saveResultsUrl(ed.id)}
                                            sx={{ flexShrink: 0 }}
                                        >
                                            {savingEditions.has(ed.id) ? <CircularProgress size={16} color="inherit" /> : 'Save'}
                                        </Button>
                                    </Stack>
                                </Box>
                            )}

                            {/* Races table */}
                            {ed.races.length === 0 ? (
                                <Box sx={{ p: 2 }}>
                                    <Alert severity="info" variant="outlined">
                                        No races on this edition{mode === 'wrapup' ? ' — results URL above applies to the edition directly' : ''}.
                                    </Alert>
                                </Box>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                                            <TableCell padding="checkbox" />
                                            <TableCell>Race</TableCell>
                                            <TableCell>Distance</TableCell>
                                            <TableCell>
                                                <Tooltip title={sortByStart ? 'Sorted by start time — click to reset' : 'Sort by start time'}>
                                                    <Box
                                                        component="span"
                                                        onClick={() => setSortByStart(s => !s)}
                                                        sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.25,
                                                            color: sortByStart ? 'primary.main' : 'inherit',
                                                            userSelect: 'none',
                                                        }}
                                                    >
                                                        Start {sortByStart ? '↑' : ''}
                                                    </Box>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>Cutoff</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Tickets</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(sortByStart
                                            ? [...ed.races].sort((a, b) => {
                                                if (!a.startTime && !b.startTime) return 0;
                                                if (!a.startTime) return 1;
                                                if (!b.startTime) return -1;
                                                return a.startTime.localeCompare(b.startTime);
                                            })
                                            : ed.races
                                        ).map(race => {
                                            const isSelectable = race.status !== 'Cancelled' && race.status !== 'Hidden';
                                            const isSelected = selectedRaceIds.has(race.id);
                                            const isSaving = savingRaces.has(race.id);
                                            return (
                                                <TableRow
                                                    key={race.id}
                                                    selected={isSelected}
                                                    hover={isSelectable}
                                                    sx={{ opacity: race.status === 'Cancelled' ? 0.5 : 1 }}
                                                >
                                                    <TableCell padding="checkbox">
                                                        {isSelectable && (
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onChange={() => toggleRace(race.id)}
                                                                size="small"
                                                                disabled={isSaving}
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 180 }}>
                                                        {(() => {
                                                            const isIS = raceNameLang === 'is';
                                                            const field = isIS ? 'name' : 'nameEn';
                                                            const original = isIS ? race.name : (race.nameEn ?? '');
                                                            const value = raceNames[race.id]?.[field] ?? original;
                                                            return (
                                                                <TextField
                                                                    size="small"
                                                                    placeholder={isIS ? 'Icelandic name' : 'English name'}
                                                                    value={value}
                                                                    onChange={e => setRaceNames(prev => {
                                                                        const existing = prev[race.id] ?? { name: race.name, nameEn: race.nameEn ?? '' };
                                                                        return { ...prev, [race.id]: { ...existing, [field]: e.target.value } };
                                                                    })}
                                                                    onBlur={() => {
                                                                        const cur = raceNames[race.id];
                                                                        if (cur && cur[field] !== original)
                                                                            updateRaceField(race, ed.id, { name: cur.name, nameEn: cur.nameEn });
                                                                    }}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                    }}
                                                                    disabled={isSaving}
                                                                    inputProps={{ style: { fontWeight: isIS ? 500 : 400, fontSize: '0.875rem' } }}
                                                                    variant="standard"
                                                                    fullWidth
                                                                />
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 100 }}>
                                                        {(() => {
                                                            const isIS = raceNameLang === 'is';
                                                            const field = isIS ? 'distanceLabel' : 'distanceLabelEn';
                                                            const original = isIS ? (race.distanceLabel ?? '') : (race.distanceLabelEn ?? '');
                                                            const value = raceDistanceLabels[race.id]?.[field] ?? original;
                                                            return (
                                                                <TextField
                                                                    size="small"
                                                                    placeholder={isIS ? 'e.g. 50K' : 'EN label'}
                                                                    value={value}
                                                                    onChange={e => setRaceDistanceLabels(prev => {
                                                                        const existing = prev[race.id] ?? { distanceLabel: race.distanceLabel ?? '', distanceLabelEn: race.distanceLabelEn ?? '' };
                                                                        return { ...prev, [race.id]: { ...existing, [field]: e.target.value } };
                                                                    })}
                                                                    onBlur={() => {
                                                                        const cur = raceDistanceLabels[race.id];
                                                                        if (cur && cur[field] !== original)
                                                                            updateRaceField(race, ed.id, { distanceLabel: cur.distanceLabel, distanceLabelEn: cur.distanceLabelEn });
                                                                    }}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                    }}
                                                                    disabled={isSaving}
                                                                    inputProps={{ style: { fontSize: '0.875rem' } }}
                                                                    variant="standard"
                                                                    fullWidth
                                                                />
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                                            {race.startTime ? race.startTime.slice(0, 5) : '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }} color={
                                                            race.startTime && race.cutoffMinutes ? 'text.primary' : 'text.disabled'
                                                        }>
                                                            {race.startTime && race.cutoffMinutes
                                                                ? dayjs(`${dateStr}T${race.startTime}`).add(race.cutoffMinutes, 'minute').format('HH:mm')
                                                                : '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        {isSaving || updatingRace.has(race.id) ? (
                                                            <CircularProgress size={16} />
                                                        ) : (
                                                            <Select
                                                                size="small"
                                                                value={race.status}
                                                                onChange={e => updateRaceField(race, ed.id, { status: e.target.value as RaceStatus })}
                                                                sx={{ fontSize: '0.8rem', minWidth: 110 }}
                                                            >
                                                                {RACE_STATUSES.map(s => (
                                                                    <MenuItem key={s} value={s} sx={{ fontSize: '0.8rem' }}>
                                                                        <Chip
                                                                            label={s}
                                                                            size="small"
                                                                            color={STATUS_COLOR[s] ?? 'default'}
                                                                            variant={s === 'Active' ? 'filled' : 'outlined'}
                                                                            sx={{ pointerEvents: 'none' }}
                                                                        />
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {updatingRace.has(race.id) ? (
                                                            <CircularProgress size={16} />
                                                        ) : (
                                                            <Select
                                                                size="small"
                                                                value={race.ticketStatus}
                                                                onChange={e => updateRaceField(race, ed.id, { ticketStatus: e.target.value as TicketStatus })}
                                                                sx={{ fontSize: '0.8rem', minWidth: 120 }}
                                                            >
                                                                {TICKET_STATUSES.map(s => (
                                                                    <MenuItem key={s} value={s} sx={{ fontSize: '0.8rem' }}>{s}</MenuItem>
                                                                ))}
                                                            </Select>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </Paper>
                    ))}
                </Stack>
            )}
        </Box>
    );
}
