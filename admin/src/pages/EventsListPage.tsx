import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import SearchIcon from '@mui/icons-material/Search';

import {
  useEvents,
  type ActivityType,
  type CreateEditionInput,
  type CreateRaceInput,
  type EventDetailDto,
  type EventEditionDto,
  type EventStatus,
  type EventSummaryDto,
  type EventType,
  type RegistrationStatus,
  type ScheduleRule,
} from '../hooks/useEvents';
import CreateEventDialog from '../components/events/CreateEventDialog';

// ── Constants ────────────────────────────────────────────────────────────────

const PUBLIC_SITE_URL = ((import.meta.env.VITE_PUBLIC_SITE_URL ?? '') as string).replace(/\/$/, '');

const EVENT_TYPES: EventType[] = ['Race', 'Series', 'Advertisement', 'Festival', 'Other'];
const EVENT_TYPE_COLORS: Record<EventType, 'primary' | 'secondary' | 'warning' | 'success' | 'default' | 'info' | 'error'> = {
  Race: 'primary', Series: 'secondary', Advertisement: 'warning', Festival: 'info', Other: 'default',
};
const ACTIVITY_TYPES: ActivityType[] = ['TrailRunning', 'Running', 'Cycling', 'Hiking', 'FunRun', 'ObstacleCourse', 'CrossCountryRun', 'Swim', 'Social', 'Other'];
const ACTIVITY_TYPE_COLORS: Record<ActivityType, 'primary' | 'secondary' | 'warning' | 'success' | 'default' | 'info' | 'error'> = {
  TrailRunning: 'success', Running: 'primary', Cycling: 'info', Hiking: 'warning', FunRun: 'secondary',
  ObstacleCourse: 'error', CrossCountryRun: 'primary', Swim: 'info', Social: 'default', Other: 'default',
};
const ACTIVITY_ICONS: Record<string, string> = {
  TrailRunning: '🏃‍♂️', Running: '🏃', Hiking: '🥾', Cycling: '🚴', FunRun: '🎊',
  ObstacleCourse: '🧗', CrossCountryRun: '🌾', Swim: '🏊', Social: '🎉', Other: '🏅',
};
const EVENT_STATUSES: EventStatus[] = ['Unconfirmed', 'Confirmed', 'Cancelled', 'Hidden', 'Unlisted'];
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEventStatusColor(status: EventStatus): 'default' | 'success' | 'warning' | 'error' {
  if (status === 'Confirmed') return 'success';
  if (status === 'Unconfirmed') return 'warning';
  if (status === 'Cancelled') return 'error';
  return 'default';
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
  return `${d}. ${months[(m ?? 1) - 1]} ${y}`;
}

function formatDaysUntil(daysUntil: number | null): string | null {
  if (daysUntil == null) return null;
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil > 1) return `in ${daysUntil} days`;
  return `${Math.abs(daysUntil)} days ago`;
}

function ordinal(n: number) {
  if (n === 1) return 'st'; if (n === 2) return 'nd'; if (n === 3) return 'rd'; return 'th';
}

function isPastDate(iso: string): boolean {
  return iso < new Date().toISOString().slice(0, 10);
}

function bumpYearInUrl(url: string, fromYear: number | null | undefined, toYear: number): string {
  if (!url || !fromYear) return url;
  return url.replaceAll(String(fromYear), String(toYear));
}

function suggestEditionDateForYear(prevDateStr: string | null | undefined, year: number): string {
  if (!prevDateStr) return '';
  const [, m, d] = prevDateStr.split('-');
  return `${year}-${m}-${d}`;
}

function suggestEditionEndDateForYear(
  prevStartStr: string | null | undefined,
  prevEndStr: string | null | undefined,
  newStartStr: string,
): string {
  if (!prevStartStr || !prevEndStr || !newStartStr) return '';
  const startMs = new Date(prevStartStr).getTime();
  const endMs = new Date(prevEndStr).getTime();
  const diff = endMs - startMs;
  if (isNaN(diff) || diff < 0) return '';
  const newEnd = new Date(new Date(newStartStr).getTime() + diff);
  return newEnd.toISOString().slice(0, 10);
}

function computeClonedRaceDate(
  editionDate: string | null | undefined,
  raceDateOfRace: string | null | undefined,
  newEditionDate: string,
): string | null {
  if (!editionDate || !raceDateOfRace || !newEditionDate) return null;
  const offset = new Date(raceDateOfRace).getTime() - new Date(editionDate).getTime();
  if (isNaN(offset)) return null;
  return new Date(new Date(newEditionDate).getTime() + offset).toISOString().slice(0, 10);
}

function sortEditions(a: EventEditionDto, b: EventEditionDto): number {
  return (a.year ?? 0) - (b.year ?? 0) || (a.date ?? '').localeCompare(b.date ?? '');
}

interface BulkMissingItem {
  event: EventSummaryDto;
  detail: EventDetailDto | null;
  sourceEdition: EventEditionDto | null;
  year: number;
  date: string;
  endDate: string;
  registrationUrl: string;
  resultsUrl: string;
  registrationStatus: RegistrationStatus;
  selected: boolean;
}

function formatSchedule(rule: ScheduleRule | null): string {
  if (!rule) return '—';
  if (rule.type === 'Fixed') return rule.date ?? '—';
  if (rule.type === 'Yearly') {
    if (rule.dayOfMonth != null) return `${MONTHS[rule.month ?? 1]} ${rule.dayOfMonth}`;
    if (rule.weekOfMonth != null && rule.dayOfWeek && rule.month != null) {
      const w = rule.weekOfMonth === -1 ? 'Last' : `${rule.weekOfMonth}${ordinal(rule.weekOfMonth)}`;
      return `${w} ${rule.dayOfWeek} in ${MONTHS[rule.month]}`;
    }
  }
  if (rule.type === 'Seasonal' && rule.dayOfWeek && rule.monthStart != null && rule.monthEnd != null) {
    const w = rule.weekOfMonth != null
      ? `${rule.weekOfMonth === -1 ? 'Last' : `${rule.weekOfMonth}${ordinal(rule.weekOfMonth)}`} `
      : 'Every ';
    return `${w}${rule.dayOfWeek}, ${MONTHS[rule.monthStart]}–${MONTHS[rule.monthEnd]}`;
  }
  if (rule.type === 'Approximate' && rule.month != null) {
    return rule.monthEnd != null
      ? `Usually ${MONTHS[rule.month]}–${MONTHS[rule.monthEnd]}`
      : `Usually in ${MONTHS[rule.month]}`;
  }
  return '—';
}

// ── Component ─────────────────────────────────────────────────────────────────

type SortField = 'name' | 'activityType' | 'type' | 'nextEditionDate' | 'status' | 'editionCount' | 'locationName' | 'updatedAt';
type AttentionFilter = 'noEdition' | 'seriesMissingReg' | 'pastActive' | null;

interface EventsListPageProps {
  onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
  initialCreate?: boolean;
  onInitialCreateConsumed?: () => void;
}

export default function EventsListPage({ onNotify, initialCreate, onInitialCreateConsumed }: EventsListPageProps) {
  const navigate = useNavigate();
  const {
    events, loading, error, refresh,
    createEvent,
    updateEventSilently, patchEventLocally,
    getEvent, createEdition, createRace,
  } = useEvents();

  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>(null);
  const [showAttentionPanel, setShowAttentionPanel] = useState(true);
  const [cyclingStatusIds, setCyclingStatusIds] = useState<Set<string>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(initialCreate ?? false);
  const [showBulkMissingDialog, setShowBulkMissingDialog] = useState(false);
  const [bulkMissingLoading, setBulkMissingLoading] = useState(false);
  const [bulkMissingProgress, setBulkMissingProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkMissingItems, setBulkMissingItems] = useState<BulkMissingItem[]>([]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const in30daysStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const eventLocationOptions = useMemo(
    () => [...new Set(events.map(e => e.locationName).filter(Boolean) as string[])].sort(),
    [events],
  );
  const yearOptions = useMemo(() => {
    const years = events.map(e => e.nextEditionDate?.slice(0, 4)).filter((y): y is string => !!y);
    return [...new Set(years)].sort((a, b) => b.localeCompare(a));
  }, [events]);

  const hasActiveFilters = attentionFilter !== null || activityFilter !== 'all' || typeFilter !== 'all'
    || statusFilter !== 'all' || locationFilter !== 'all' || yearFilter !== 'all' || monthFilter !== 'all';

  const resetFilters = () => {
    setActivityFilter('all'); setTypeFilter('all'); setStatusFilter('all'); setLocationFilter('all');
    setYearFilter('all'); setMonthFilter('all'); setAttentionFilter(null);
  };

  const handleRequestSort = (field: SortField) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  // ── Needs attention items ─────────────────────────────────────────────────
  const attentionItems: { key: AttentionFilter & string; label: string }[] = [];
  {
    const n = events.filter(e => !e.hasFutureEdition && (e.type === 'Race' || e.type === 'Series') && e.status !== 'Cancelled').length;
    if (n > 0) attentionItems.push({ key: 'noEdition', label: `${n} active event${n !== 1 ? 's' : ''} missing a future edition` });
  }
  {
    const n = events.filter(e => e.type === 'Series' && e.nextEditionDate && e.nextEditionDate <= in30daysStr && e.seriesRaces?.some(r => !r.registrationUrl)).length;
    if (n > 0) attentionItems.push({ key: 'seriesMissingReg', label: `${n} series event${n !== 1 ? 's' : ''} with races in ≤30 days missing registration URL` });
  }
  {
    const n = events.filter(e => e.status === 'Confirmed' && e.nextEditionDate && e.nextEditionDate < todayStr).length;
    if (n > 0) attentionItems.push({ key: 'pastActive', label: `${n} event${n !== 1 ? 's' : ''} whose latest edition has passed — check results URL and registration status` });
  }

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...events]
      .filter(e => {
        if (q && ![e.name, e.slug, e.description ?? '', e.locationName ?? '', e.organizerName ?? '', e.type, e.status, e.activityType]
          .some(v => v.toLowerCase().includes(q))) return false;
        if (activityFilter !== 'all' && e.activityType !== activityFilter) return false;
        if (typeFilter !== 'all' && e.type !== typeFilter) return false;
        if (statusFilter !== 'all' && e.status !== statusFilter) return false;
        if (locationFilter !== 'all') {
          if (locationFilter === 'none' && e.locationName) return false;
          if (locationFilter !== 'none' && e.locationName !== locationFilter) return false;
        }
        if (yearFilter !== 'all') {
          if (!e.hasFutureEdition) return true;
          if (!e.nextEditionDate || e.nextEditionDate.slice(0, 4) !== yearFilter) return false;
        }
        if (monthFilter !== 'all') {
          if (!e.hasFutureEdition) return true;
          if (!e.nextEditionDate || e.nextEditionDate.slice(5, 7) !== monthFilter) return false;
        }
        if (attentionFilter === 'noEdition' && !(!e.hasFutureEdition && (e.type === 'Race' || e.type === 'Series') && e.status !== 'Cancelled')) return false;
        if (attentionFilter === 'seriesMissingReg' && !(e.type === 'Series' && e.nextEditionDate && e.nextEditionDate <= in30daysStr && e.seriesRaces?.some(r => !r.registrationUrl))) return false;
        if (attentionFilter === 'pastActive' && !(e.status === 'Confirmed' && e.nextEditionDate && e.nextEditionDate < todayStr)) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        let cmp = 0;
        if (sortBy === 'updatedAt') {
          cmp = (a.updatedAt ? new Date(a.updatedAt).getTime() : 0) - (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
        } else if (sortBy === 'nextEditionDate') {
          if (!a.nextEditionDate && !b.nextEditionDate) cmp = 0;
          else if (!a.nextEditionDate) cmp = 1;
          else if (!b.nextEditionDate) cmp = -1;
          else cmp = a.nextEditionDate.localeCompare(b.nextEditionDate);
        } else if (sortBy === 'editionCount') {
          cmp = (a.editionCount ?? 0) - (b.editionCount ?? 0);
        } else if (sortBy === 'activityType' || sortBy === 'type' || sortBy === 'status' || sortBy === 'locationName') {
          cmp = (a[sortBy] ?? '').toLowerCase().localeCompare((b[sortBy] ?? '').toLowerCase());
        } else {
          cmp = a.name.localeCompare(b.name);
        }
        return cmp !== 0 ? dir * cmp : a.name.localeCompare(b.name);
      });
  }, [events, searchQuery, activityFilter, typeFilter, statusFilter, locationFilter, yearFilter, monthFilter, sortBy, sortDir, attentionFilter, todayStr, in30daysStr]);

  // ── Status cycling ────────────────────────────────────────────────────────
  const handleCycleStatus = async (event: EventSummaryDto) => {
    if (cyclingStatusIds.has(event.id)) return;
    if (event.status !== 'Unconfirmed' && event.status !== 'Confirmed') return;
    const next: EventStatus = event.status === 'Unconfirmed' ? 'Confirmed' : 'Unconfirmed';
    patchEventLocally(event.id, { status: next });
    setCyclingStatusIds(prev => new Set(prev).add(event.id));
    try {
      await updateEventSilently(event.id, {
        name: event.name, nameEn: event.nameEn ?? undefined,
        description: event.description ?? undefined, descriptionEn: event.descriptionEn ?? undefined,
        type: event.type, activityType: event.activityType, status: next,
        organizerName: event.organizerName ?? undefined, organizerNameEn: event.organizerNameEn ?? undefined,
        organizerWebsite: event.organizerWebsite ?? undefined, organizerId: event.organizerId ?? null,
        alertMessage: event.alertMessage ?? undefined, alertMessageEn: event.alertMessageEn ?? undefined,
        alertSeverity: event.alertSeverity ?? undefined,
        locationId: event.locationId ?? null, scheduleRule: event.scheduleRule ?? null,
        socialLinks: event.socialLinks ?? null,
        gpxPointLat: event.gpxPointLat ?? null, gpxPointLng: event.gpxPointLng ?? null,
        translationHashes: event.translationHashes,
      });
    } catch {
      patchEventLocally(event.id, { status: event.status });
      onNotify('Failed to update event status', 'error');
    } finally {
      setCyclingStatusIds(prev => { const s = new Set(prev); s.delete(event.id); return s; });
    }
  };

  const openBulkMissingEditions = async () => {
    const missing = events.filter(e => (e.type === 'Race' || e.type === 'Series') && e.status !== 'Cancelled' && !e.hasFutureEdition);
    if (missing.length === 0) return;
    setBulkMissingLoading(true);
    setShowBulkMissingDialog(true);
    setBulkMissingItems([]);
    try {
      const details = await Promise.all(missing.map(e => getEvent(e.slug)));
      const items: BulkMissingItem[] = details.map((detail, i) => {
        const event = missing[i];
        const editionsWithRaces = [...(detail?.editions ?? [])].filter(ed => ed.races.length > 0).sort(sortEditions);
        const source = editionsWithRaces[editionsWithRaces.length - 1] ?? detail?.editions.sort(sortEditions)[detail.editions.length - 1] ?? null;
        const nextYear = source?.year ? source.year + 1 : new Date().getFullYear();
        const suggestedDate = suggestEditionDateForYear(source?.date, nextYear);
        const suggestedEndDate = suggestEditionEndDateForYear(source?.date, source?.endDate, suggestedDate);
        const isPast = suggestedDate ? isPastDate(suggestedDate) : nextYear < new Date().getFullYear();
        return {
          event, detail: detail ?? null, sourceEdition: source ?? null,
          year: nextYear, date: suggestedDate, endDate: suggestedEndDate,
          registrationUrl: bumpYearInUrl(source?.registrationUrl ?? '', source?.year, nextYear) || (source?.registrationUrl ?? ''),
          resultsUrl: bumpYearInUrl(source?.resultsUrl ?? '', source?.year, nextYear) || (source?.resultsUrl ?? ''),
          registrationStatus: isPast ? 'Closed' : 'NotStarted',
          selected: true,
        };
      });
      setBulkMissingItems(items);
    } catch {
      onNotify('Failed to load event details', 'error');
      setShowBulkMissingDialog(false);
    } finally {
      setBulkMissingLoading(false);
    }
  };

  const handleBulkCreateMissingEditions = async () => {
    const selected = bulkMissingItems.filter(i => i.selected);
    if (selected.length === 0) return;
    setBulkMissingProgress({ done: 0, total: selected.length });
    let succeeded = 0;
    let failed = 0;
    for (const item of selected) {
      try {
        const isRaceOrSeries = item.event.type === 'Race' || item.event.type === 'Series';
        const newEditionId = await createEdition({
          eventId: item.event.id,
          year: item.year,
          title: String(item.year),
          date: item.date || null,
          endDate: item.endDate || null,
          registrationUrl: item.registrationUrl || undefined,
          resultsUrl: item.resultsUrl || undefined,
          registrationStatus: item.registrationStatus,
          trailId: isRaceOrSeries ? null : (item.sourceEdition?.trailId ?? null),
        });
        if (isRaceOrSeries && item.sourceEdition && item.sourceEdition.races.length > 0) {
          await Promise.allSettled(item.sourceEdition.races.map(race =>
            createRace({
              eventEditionId: newEditionId,
              trailId: race.trailId ?? null,
              name: race.name,
              distanceLabel: race.distanceLabel ?? undefined,
              cutoffMinutes: race.cutoffMinutes ?? null,
              description: race.description ?? undefined,
              status: 'Active',
              sortOrder: race.sortOrder,
              ticketStatus: 'Available',
              maxParticipants: race.maxParticipants ?? null,
              itraPoints: race.itraPoints ?? null,
              certifiedBy: race.certifiedBy ?? undefined,
              prizeMoney: race.prizeMoney,
              championshipCategory: race.championshipCategory ?? undefined,
              dateOfRace: computeClonedRaceDate(item.sourceEdition!.date, race.dateOfRace, item.date),
              startTime: race.startTime ? race.startTime.slice(0, 5) : null,
            }),
          ));
        }
        succeeded++;
      } catch {
        failed++;
      }
      setBulkMissingProgress(p => p ? { ...p, done: p.done + 1 } : null);
    }
    setBulkMissingProgress(null);
    setShowBulkMissingDialog(false);
    setBulkMissingItems([]);
    await refresh();
    if (failed > 0) {
      onNotify(`Created ${succeeded} edition${succeeded !== 1 ? 's' : ''}, ${failed} failed`, 'error');
    } else {
      onNotify(`Created ${succeeded} edition${succeeded !== 1 ? 's' : ''} with cloned races`, 'success');
    }
  };

  const selectedBulkCount = bulkMissingItems.filter(i => i.selected).length;

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      {/* Needs attention */}
      {attentionItems.length > 0 && showAttentionPanel && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setShowAttentionPanel(false)}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Needs attention</Typography>
          <Stack component="ul" sx={{ m: 0, pl: 2, gap: 0.25 }}>
            {attentionItems.map(item => (
              <li key={item.key}>
                <Typography
                  variant="body2"
                  component="button"
                  onClick={() => setAttentionFilter(attentionFilter === item.key ? null : item.key)}
                  sx={{ background: 'none', border: 'none', p: 0, cursor: 'pointer', textAlign: 'left', textDecoration: attentionFilter === item.key ? 'underline' : 'underline dotted', textUnderlineOffset: 3, color: 'inherit' }}
                >
                  {item.label} {attentionFilter === item.key ? '(showing — click to clear)' : '→ click to filter'}
                </Typography>
              </li>
            ))}
          </Stack>
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <EmojiEventsIcon color="primary" />
          <Typography variant="h5">Events</Typography>
          <Chip
            label={searchQuery.trim() || hasActiveFilters ? `${filteredEvents.length} / ${events.length}` : events.length}
            size="small" color="primary"
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          {events.some(e => (e.type === 'Race' || e.type === 'Series') && e.status !== 'Cancelled' && !e.hasFutureEdition) && (
            <Button variant="outlined" startIcon={<PlaylistAddIcon />} onClick={() => void openBulkMissingEditions()}>
              Create Missing Editions
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setCreateDialogOpen(true); onInitialCreateConsumed?.(); }}>
            New Event
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters */}
      <Paper sx={{ mb: 3, p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search events…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          sx={{ minWidth: 200, flexGrow: 1, maxWidth: 300 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}><ClearIcon fontSize="small" /></IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Activity</InputLabel>
          <Select value={activityFilter} label="Activity" onChange={e => setActivityFilter(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            {ACTIVITY_TYPES.map(at => <MenuItem key={at} value={at}>{ACTIVITY_ICONS[at] ?? '🏅'} {at}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Type</InputLabel>
          <Select value={typeFilter} label="Type" onChange={e => setTypeFilter(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            {EVENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            {EVENT_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Location</InputLabel>
          <Select value={locationFilter} label="Location" onChange={e => setLocationFilter(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="none"><em>No location</em></MenuItem>
            {eventLocationOptions.map(loc => <MenuItem key={loc} value={loc}>{loc}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Year</InputLabel>
          <Select value={yearFilter} label="Year" onChange={e => { setYearFilter(e.target.value); setMonthFilter('all'); }}>
            <MenuItem value="all">All</MenuItem>
            {yearOptions.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }} disabled={yearFilter === 'all'}>
          <InputLabel>Month</InputLabel>
          <Select value={monthFilter} label="Month" onChange={e => setMonthFilter(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            {MONTHS.slice(1).map((m, i) => <MenuItem key={i} value={String(i + 1).padStart(2, '0')}>{m}</MenuItem>)}
          </Select>
        </FormControl>
        {hasActiveFilters && (
          <Tooltip title="Clear all filters">
            <IconButton size="small" onClick={resetFilters}><ClearIcon fontSize="small" /></IconButton>
          </Tooltip>
        )}
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={sortBy === 'name'} direction={sortBy === 'name' ? sortDir : 'asc'} onClick={() => handleRequestSort('name')}>
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortBy === 'activityType'} direction={sortBy === 'activityType' ? sortDir : 'asc'} onClick={() => handleRequestSort('activityType')}>
                  Activity
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortBy === 'type'} direction={sortBy === 'type' ? sortDir : 'asc'} onClick={() => handleRequestSort('type')}>
                  Type
                </TableSortLabel>
              </TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>
                <TableSortLabel active={sortBy === 'nextEditionDate'} direction={sortBy === 'nextEditionDate' ? sortDir : 'asc'} onClick={() => handleRequestSort('nextEditionDate')}>
                  Next Edition
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortDir : 'asc'} onClick={() => handleRequestSort('status')}>
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel active={sortBy === 'editionCount'} direction={sortBy === 'editionCount' ? sortDir : 'asc'} onClick={() => handleRequestSort('editionCount')}>
                  Editions
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortBy === 'locationName'} direction={sortBy === 'locationName' ? sortDir : 'asc'} onClick={() => handleRequestSort('locationName')}>
                  Location
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortBy === 'updatedAt'} direction={sortBy === 'updatedAt' ? sortDir : 'desc'} onClick={() => handleRequestSort('updatedAt')}>
                  Updated
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEvents.map(event => (
              <TableRow
                key={event.id}
                hover
                sx={{
                  cursor: 'pointer',
                  ...(event.type === 'Advertisement' && { bgcolor: 'rgba(255, 193, 7, 0.08)' }),
                }}
                onClick={() => navigate(`/events/${event.slug}`)}
              >
                {/* Name */}
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>{event.name}</Typography>
                  <Tooltip title="Click to copy slug">
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontFamily="monospace"
                      sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                      onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(event.slug); onNotify(`Copied: ${event.slug}`); }}
                    >
                      {event.slug}
                    </Typography>
                  </Tooltip>
                </TableCell>

                {/* Activity */}
                <TableCell>
                  <Chip
                    label={`${ACTIVITY_ICONS[event.activityType] ?? '🏅'} ${event.activityType}`}
                    size="small"
                    color={ACTIVITY_TYPE_COLORS[event.activityType as ActivityType] ?? 'default'}
                    variant="outlined"
                  />
                </TableCell>

                {/* Type */}
                <TableCell>
                  <Chip label={event.type} size="small" color={EVENT_TYPE_COLORS[event.type as EventType] ?? 'default'} />
                </TableCell>

                {/* Schedule */}
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{formatSchedule(event.scheduleRule)}</Typography>
                </TableCell>

                {/* Next edition */}
                <TableCell>
                  {event.nextEditionDate ? (
                    <Box>
                      <Typography variant="body2">{fmtDate(event.nextEditionDate)}</Typography>
                      {formatDaysUntil(event.daysUntil) && (event.daysUntil == null || event.daysUntil >= 0) && (
                        <Chip label={formatDaysUntil(event.daysUntil)} size="small" variant="outlined"
                          color={event.daysUntil != null && event.daysUntil <= 7 ? 'warning' : 'default'} sx={{ mt: 0.5 }} />
                      )}
                      {event.status !== 'Cancelled' && !event.hasFutureEdition && (
                        <Chip label="Edition missing" size="small" color="warning" variant="outlined" sx={{ mt: 0.5 }} />
                      )}
                    </Box>
                  ) : event.status !== 'Cancelled' && !event.hasFutureEdition ? (
                    <Chip label={event.editionCount === 0 ? 'No editions' : 'Edition missing'} size="small" color="warning" variant="outlined" />
                  ) : (
                    <Typography variant="body2" color="text.secondary">—</Typography>
                  )}
                </TableCell>

                {/* Status — cycles on click */}
                <TableCell align="center" onClick={e => e.stopPropagation()}>
                  <Tooltip title={
                    cyclingStatusIds.has(event.id) ? 'Updating…'
                    : event.status === 'Unconfirmed' ? 'Click to confirm'
                    : event.status === 'Confirmed' ? 'Click to unconfirm'
                    : event.status
                  }>
                    <Chip
                      label={event.status}
                      size="small"
                      color={getEventStatusColor(event.status)}
                      onClick={(event.status === 'Unconfirmed' || event.status === 'Confirmed') && !cyclingStatusIds.has(event.id)
                        ? () => void handleCycleStatus(event) : undefined}
                      disabled={cyclingStatusIds.has(event.id)}
                      sx={(event.status === 'Unconfirmed' || event.status === 'Confirmed') ? { cursor: 'pointer' } : undefined}
                    />
                  </Tooltip>
                </TableCell>

                {/* Edition count */}
                <TableCell align="center">
                  <Chip label={event.editionCount} size="small" variant="outlined" />
                </TableCell>

                {/* Location */}
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{event.locationName ?? '—'}</Typography>
                </TableCell>

                {/* Updated */}
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {event.updatedAt
                      ? new Date(event.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </Typography>
                </TableCell>

                {/* Actions */}
                <TableCell align="right" onClick={e => e.stopPropagation()}>
                  {PUBLIC_SITE_URL && (
                    <Tooltip title="View on public site">
                      <IconButton size="small" component="a" href={`${PUBLIC_SITE_URL}/events/${event.slug}`} target="_blank" rel="noopener noreferrer">
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {filteredEvents.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {hasActiveFilters || searchQuery ? 'No events match the current filters.' : 'No events yet.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateEventDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={(slug) => { setCreateDialogOpen(false); navigate(`/events/${slug}`); }}
        onNotify={onNotify}
        createEvent={createEvent}
      />

      {/* Bulk create missing editions dialog */}
      <Dialog open={showBulkMissingDialog} onClose={() => !bulkMissingLoading && !bulkMissingProgress && setShowBulkMissingDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Missing Editions</DialogTitle>
        <DialogContent>
          {bulkMissingLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
              <CircularProgress size={24} />
              <Typography>Loading event details…</Typography>
            </Box>
          ) : bulkMissingProgress ? (
            <Box sx={{ py: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Creating editions… {bulkMissingProgress.done} / {bulkMissingProgress.total}
              </Typography>
              <LinearProgress variant="determinate" value={(bulkMissingProgress.done / bulkMissingProgress.total) * 100} />
            </Box>
          ) : (
            <Box sx={{ pt: 1 }}>
              <DialogContentText sx={{ mb: 2 }}>
                The following events have no upcoming edition. Review the proposals below and select which ones to create.
              </DialogContentText>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                <Box component="thead">
                  <Box component="tr">
                    <Box component="th" sx={{ width: 40, textAlign: 'left', pb: 1, pr: 1 }}>
                      <Checkbox
                        size="small"
                        checked={bulkMissingItems.length > 0 && bulkMissingItems.every(i => i.selected)}
                        indeterminate={bulkMissingItems.some(i => i.selected) && !bulkMissingItems.every(i => i.selected)}
                        onChange={(_, checked) => setBulkMissingItems(prev => prev.map(i => ({ ...i, selected: checked })))}
                      />
                    </Box>
                    <Box component="th" sx={{ textAlign: 'left', pb: 1, pr: 1 }}><Typography variant="caption" fontWeight={600}>Event</Typography></Box>
                    <Box component="th" sx={{ textAlign: 'left', pb: 1, pr: 1 }}><Typography variant="caption" fontWeight={600}>Year</Typography></Box>
                    <Box component="th" sx={{ textAlign: 'left', pb: 1, pr: 1 }}><Typography variant="caption" fontWeight={600}>Start date</Typography></Box>
                    {bulkMissingItems.some(i => i.endDate) && (
                      <Box component="th" sx={{ textAlign: 'left', pb: 1, pr: 1 }}><Typography variant="caption" fontWeight={600}>End date</Typography></Box>
                    )}
                    <Box component="th" sx={{ textAlign: 'left', pb: 1 }}><Typography variant="caption" fontWeight={600}>Races to clone</Typography></Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {bulkMissingItems.map((item, i) => (
                    <Box component="tr" key={item.event.id} sx={{ borderTop: '1px solid', borderColor: 'divider', opacity: item.selected ? 1 : 0.45 }}>
                      <Box component="td" sx={{ py: 1, pr: 1 }}>
                        <Checkbox size="small" checked={item.selected} onChange={(_, checked) => setBulkMissingItems(prev => prev.map((x, j) => j === i ? { ...x, selected: checked } : x))} />
                      </Box>
                      <Box component="td" sx={{ py: 1, pr: 1 }}>
                        <Typography variant="body2">{item.event.name}</Typography>
                      </Box>
                      <Box component="td" sx={{ py: 1, pr: 1 }}>
                        <Typography variant="body2">{item.year}</Typography>
                      </Box>
                      <Box component="td" sx={{ py: 1, pr: 1 }}>
                        <Typography variant="body2">{fmtDate(item.date) || <em style={{ color: 'gray' }}>TBD</em>}</Typography>
                      </Box>
                      {bulkMissingItems.some(i => i.endDate) && (
                        <Box component="td" sx={{ py: 1, pr: 1 }}>
                          <Typography variant="body2">{fmtDate(item.endDate) || <em style={{ color: 'gray' }}>—</em>}</Typography>
                        </Box>
                      )}
                      <Box component="td" sx={{ py: 1 }}>
                        <Typography variant="body2">
                          {item.sourceEdition ? `${item.sourceEdition.races.length} race${item.sourceEdition.races.length !== 1 ? 's' : ''}` : '—'}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBulkMissingDialog(false)} disabled={!!bulkMissingProgress || bulkMissingLoading}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<PlaylistAddIcon />}
            onClick={() => void handleBulkCreateMissingEditions()}
            disabled={bulkMissingLoading || !!bulkMissingProgress || selectedBulkCount === 0}
          >
            Create {selectedBulkCount || ''} Edition{selectedBulkCount !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
