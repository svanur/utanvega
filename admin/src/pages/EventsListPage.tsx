import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
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
import SearchIcon from '@mui/icons-material/Search';

import {
  useEvents,
  type ActivityType,
  type EventStatus,
  type EventSummaryDto,
  type EventType,
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
    events, loading, error,
    createEvent,
    updateEventSilently, patchEventLocally,
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
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setCreateDialogOpen(true); onInitialCreateConsumed?.(); }}>
          New Event
        </Button>
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
                      <Typography variant="body2">{event.nextEditionDate}</Typography>
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
    </Box>
  );
}
