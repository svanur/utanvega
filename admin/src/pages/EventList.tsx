import { Fragment, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
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
import {
  Add as AddIcon,
  AutoAwesome as GenerateIcon,
  CalendarMonth as CalendarIcon,
  Clear as ClearIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  EmojiEvents as TrophyIcon,
  Link as LinkIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  useEvents,
  type AlertSeverity,
  type DayOfWeek,
  type EventDetailDto,
  type EventEditionDto,
  type EventStatus,
  type EventSummaryDto,
  type EventType,
  type ActivityType,
  type RaceDto,
  type RaceStatus,
  type RegistrationStatus,
  type ScheduleRule,
  type ScheduleType,
  type SocialLink,
  type TicketStatus,
} from '../hooks/useEvents';
import { useLocations } from '../hooks/useLocations';
import { useTrails } from '../hooks/useTrails';
import { formatMinutesToHHmm, parseHHmmToMinutes } from '../utils/cutoffTime';

interface EventListProps {
  onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
}

interface EventFormState {
  name: string;
  slug: string;
  description: string;
  type: EventType;
  activityType: ActivityType;
  status: EventStatus;
  organizerName: string;
  organizerWebsite: string;
  alertMessage: string;
  alertSeverity: AlertSeverity;
  locationId: string;
  hasSchedule: boolean;
  scheduleType: ScheduleType;
  yearlyMode: 'weekday' | 'date';
  scheduleMonth: number;
  scheduleWeek: number;
  scheduleDay: DayOfWeek;
  scheduleDayOfMonth: number;
  scheduleMonthStart: number;
  scheduleMonthEnd: number;
  scheduleDate: string;
  scheduleSeasonalWeek: number | '';
  socialLinks: SocialLink[];
}

interface EditionFormState {
  eventId: string;
  eventType: EventType;
  eventName: string;
  year: string;
  date: string;
  title: string;
  registrationUrl: string;
  resultsUrl: string;
  notes: string;
  registrationStatus: RegistrationStatus;
  trailId: string;
}

interface RaceFormState {
  eventEditionId: string;
  trailId: string;
  name: string;
  distanceLabel: string;
  cutoffTime: string;
  description: string;
  status: RaceStatus;
  sortOrder: string;
  ticketStatus: TicketStatus;
  maxParticipants: string;
  itraPoints: string;
  certifiedBy: string;
  prizeMoney: string;
  championshipCategory: string;
  dateOfRace: string;
  startTime: string;
}

interface GenerateFormState {
  eventId: string;
  eventName: string;
  eventType: EventType;
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
  trailId: string;
  registrationUrl: string;
  seasonStartMonth: number | null;
  editionName: string;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EVENT_TYPES: EventType[] = ['Race', 'Series', 'Advertisement', 'Festival', 'Other'];
const EVENT_TYPE_COLORS: Record<EventType, 'primary' | 'secondary' | 'warning' | 'success' | 'default' | 'info' | 'error'> = {
  Race: 'primary',
  Series: 'secondary',
  Advertisement: 'warning',
  Festival: 'info',
  Other: 'default',
};
const ACTIVITY_TYPE_COLORS: Record<ActivityType, 'primary' | 'secondary' | 'warning' | 'success' | 'default' | 'info' | 'error'> = {
  TrailRunning: 'success',
  Running: 'primary',
  Cycling: 'info',
  Hiking: 'warning',
  FunRun: 'secondary',
  ObstacleCourse: 'error',
  CrossCountryRun: 'primary',
  Social: 'default',
  Other: 'default',
};
const ACTIVITY_TYPES: ActivityType[] = ['TrailRunning', 'Running', 'Cycling', 'Hiking', 'FunRun', 'ObstacleCourse', 'CrossCountryRun', 'Social', 'Other'];
const EVENT_STATUSES: EventStatus[] = ['Unconfirmed', 'Confirmed', 'Cancelled', 'Hidden', 'Unlisted'];
const REGISTRATION_STATUSES: RegistrationStatus[] = ['NotStarted', 'Open', 'Closed'];
const RACE_STATUSES: RaceStatus[] = ['Active', 'Completed', 'Cancelled', 'Hidden'];
const TICKET_STATUSES: TicketStatus[] = ['Free', 'NotStarted', 'Available', 'AlmostSoldOut', 'SoldOut', 'Closed'];
const ALERT_SEVERITIES: AlertSeverity[] = ['info', 'success', 'warning', 'error'];

const ACTIVITY_ICONS: Record<string, string> = {
  TrailRunning: '🏃‍♂️',
  Running: '🏃',
  Hiking: '🥾',
  Cycling: '🚴',
  FunRun: '🎊',
  ObstacleCourse: '🧗',
  CrossCountryRun: '🌾',
  Social: '🎉',
  Other: '🏅',
};

function ordinal(value: number): string {
  if (value === 1) return 'st';
  if (value === 2) return 'nd';
  if (value === 3) return 'rd';
  return 'th';
}

function formatSchedule(rule: ScheduleRule | null): string {
  if (!rule) return '—';
  if (rule.type === 'Fixed') return rule.date ?? '—';

  if (rule.type === 'Yearly') {
    if (rule.dayOfMonth != null) {
      return `${MONTHS[rule.month ?? 1]} ${rule.dayOfMonth}`;
    }

    if (rule.weekOfMonth != null && rule.dayOfWeek && rule.month != null) {
      const weekLabel = rule.weekOfMonth === -1 ? 'Last' : `${rule.weekOfMonth}${ordinal(rule.weekOfMonth)}`;
      return `${weekLabel} ${rule.dayOfWeek} in ${MONTHS[rule.month]}`;
    }
  }

  if (rule.type === 'Seasonal' && rule.dayOfWeek && rule.monthStart != null && rule.monthEnd != null) {
    const weekPart = rule.weekOfMonth != null
      ? `${rule.weekOfMonth === -1 ? 'Last' : `${rule.weekOfMonth}${ordinal(rule.weekOfMonth)}`} `
      : 'Every ';
    return `${weekPart}${rule.dayOfWeek}, ${MONTHS[rule.monthStart]}–${MONTHS[rule.monthEnd]}`;
  }

  if (rule.type === 'Approximate' && rule.month != null) {
    return rule.monthEnd != null
      ? `Usually ${MONTHS[rule.month]}–${MONTHS[rule.monthEnd]}`
      : `Usually in ${MONTHS[rule.month]}`;
  }

  return '—';
}

function formatDateLabel(value: string | null | undefined, fallback = '—'): string {
  return value || fallback;
}

function formatTimeLabel(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '—';
}

function normalizeCutoffTimeInput(value: string): string {
  const compact = value.replace(/\s/g, '');
  if (compact.includes(':')) {
    const [rawHours, rawMinutes = ''] = compact.split(':', 2);
    const hours = rawHours.replace(/\D/g, '').slice(0, 2);
    const minutes = rawMinutes.replace(/\D/g, '').slice(0, 2);
    if (!hours && !minutes) return '';
    if (!hours) return `0:${minutes}`;
    return `${hours}:${minutes}`;
  }

  const digits = compact.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length === 3) return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeCutoffTimeOnBlur(value: string): string {
  const compact = value.replace(/\s/g, '');
  const colonMatch = /^(\d{1,2}):(\d{1,2})$/.exec(compact);
  if (colonMatch) {
    const hours = Number(colonMatch[1]);
    const minutes = Number(colonMatch[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) {
      return value;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  const digits = compact.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';

  let hours = 0;
  let minutes = 0;

  if (digits.length <= 2) {
    hours = Number(digits);
  } else if (digits.length === 3) {
    hours = Number(digits.slice(0, 1));
    minutes = Number(digits.slice(1));
  } else {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2));
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) {
    return value;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatDaysUntil(daysUntil: number | null): string | null {
  if (daysUntil == null) return null;
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil > 1) return `in ${daysUntil} days`;
  return `${Math.abs(daysUntil)} days ago`;
}

function getEventStatusColor(status: EventStatus): 'default' | 'success' | 'warning' | 'error' {
  if (status === 'Confirmed') return 'success';
  if (status === 'Unconfirmed') return 'warning';
  if (status === 'Cancelled') return 'error';
  return 'default';
}

function getRegistrationStatusColor(status: RegistrationStatus): 'default' | 'success' | 'warning' {
  if (status === 'Open') return 'success';
  if (status === 'Closed') return 'default';
  return 'warning';
}

function getRaceStatusColor(status: RaceStatus): 'default' | 'success' | 'info' | 'error' {
  if (status === 'Active') return 'success';
  if (status === 'Completed') return 'info';
  if (status === 'Cancelled') return 'error';
  return 'default';
}

function getTicketStatusColor(status: TicketStatus): 'success' | 'error' | 'warning' | 'info' | 'default' {
  if (status === 'Available') return 'success';
  if (status === 'Free') return 'success';
  if (status === 'SoldOut') return 'error';
  if (status === 'AlmostSoldOut') return 'warning';
  if (status === 'NotStarted') return 'info';
  return 'default';
}

function bumpYearInUrl(url: string, fromYear: number | null | undefined, toYear: number): string {
  if (!url || !fromYear) return '';
  return url.split(String(fromYear)).join(String(toYear));
}

function isPastDate(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function trimToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function buildEditionLabel(edition: Pick<EventEditionDto, 'title' | 'year' | 'date'>): string {
  if (edition.title?.trim()) return edition.title;
  if (edition.date) return edition.date;
  if (edition.year != null) return `Edition ${edition.year}`;
  return 'Untitled edition';
}

function sortEditions(a: EventEditionDto, b: EventEditionDto): number {
  // Newest first
  if (a.date && b.date) return b.date.localeCompare(a.date);
  if (a.date) return -1;
  if (b.date) return 1;
  if (a.year != null && b.year != null) return b.year - a.year;
  if (a.year != null) return -1;
  if (b.year != null) return 1;
  return buildEditionLabel(b).localeCompare(buildEditionLabel(a));
}

function sortRaces(a: RaceDto, b: RaceDto): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
}

function createEmptyEventForm(): EventFormState {
  return {
    name: '',
    slug: '',
    description: '',
    type: 'Race',
    activityType: 'TrailRunning',
    status: 'Unconfirmed',
    organizerName: '',
    organizerWebsite: '',
    alertMessage: '',
    alertSeverity: 'info',
    locationId: '',
    hasSchedule: false,
    scheduleType: 'Yearly',
    yearlyMode: 'weekday',
    scheduleMonth: 7,
    scheduleWeek: 2,
    scheduleDay: 'Saturday',
    scheduleDayOfMonth: 1,
    scheduleMonthStart: 10,
    scheduleMonthEnd: 3,
    scheduleDate: '',
    scheduleSeasonalWeek: '',
    socialLinks: [],
  };
}

function createEmptyEditionForm(eventId = '', eventType: EventType = 'Race', eventName = ''): EditionFormState {
  return {
    eventId,
    eventType,
    eventName,
    year: new Date().getFullYear().toString(),
    date: '',
    title: '',
    registrationUrl: '',
    resultsUrl: '',
    notes: '',
    registrationStatus: 'NotStarted',
    trailId: '',
  };
}

function createEmptyRaceForm(eventEditionId = '', sortOrder = 0): RaceFormState {
  return {
    eventEditionId,
    trailId: '',
    name: '',
    distanceLabel: '',
    cutoffTime: '',
    description: '',
    status: 'Active',
    sortOrder: String(sortOrder),
    ticketStatus: 'Available',
    maxParticipants: '',
    itraPoints: '',
    certifiedBy: '',
    prizeMoney: '0',
    championshipCategory: '',
    dateOfRace: '',
    startTime: '',
  };
}

function createGenerateForm(event: EventSummaryDto): GenerateFormState {
  const currentYear = new Date().getFullYear();
  const seasonStart = event.type === 'Series' ? (event.scheduleRule?.monthStart ?? null) : null;
  return {
    eventId: event.id,
    eventName: event.name,
    eventType: event.type,
    fromMonth: seasonStart ?? 1,
    fromYear: currentYear,
    toMonth: event.scheduleRule?.monthEnd ?? 12,
    toYear: currentYear + (seasonStart && event.scheduleRule?.monthEnd && event.scheduleRule.monthEnd < seasonStart ? 1 : 0),
    trailId: '',
    registrationUrl: '',
    seasonStartMonth: seasonStart,
    editionName: '',
  };
}

function buildEventForm(event: EventSummaryDto): EventFormState {
  const rule = event.scheduleRule;
  return {
    name: event.name,
    slug: event.slug,
    description: event.description ?? '',
    type: event.type,
    activityType: event.activityType,
    status: event.status,
    organizerName: event.organizerName ?? '',
    organizerWebsite: event.organizerWebsite ?? '',
    alertMessage: event.alertMessage ?? '',
    alertSeverity: event.alertSeverity ?? 'info',
    locationId: event.locationId ?? '',
    hasSchedule: rule != null,
    scheduleType: rule?.type ?? 'Yearly',
    yearlyMode: rule?.dayOfMonth != null ? 'date' : 'weekday',
    scheduleMonth: rule?.month ?? 7,
    scheduleWeek: rule?.weekOfMonth ?? 2,
    scheduleDay: rule?.dayOfWeek ?? 'Saturday',
    scheduleDayOfMonth: rule?.dayOfMonth ?? 1,
    scheduleMonthStart: rule?.monthStart ?? 10,
    scheduleMonthEnd: rule?.monthEnd ?? (rule?.type === 'Approximate' ? 0 : 3),
    scheduleDate: rule?.date ?? '',
    scheduleSeasonalWeek: rule?.type === 'Seasonal' ? (rule.weekOfMonth ?? '') : '',
    socialLinks: event.socialLinks?.map(link => ({ ...link })) ?? [],
  };
}

function buildEditionForm(edition: EventEditionDto, eventType: EventType = 'Race', eventName = ''): EditionFormState {
  return {
    eventId: edition.eventId,
    eventType,
    eventName,
    year: edition.year?.toString() ?? '',
    date: edition.date ?? '',
    title: edition.title ?? '',
    registrationUrl: edition.registrationUrl ?? '',
    resultsUrl: edition.resultsUrl ?? '',
    notes: edition.notes ?? '',
    registrationStatus: edition.registrationStatus,
    trailId: edition.trailId ?? '',
  };
}

function buildRaceForm(race: RaceDto): RaceFormState {
  return {
    eventEditionId: race.eventEditionId,
    trailId: race.trailId ?? '',
    name: race.name,
    distanceLabel: race.distanceLabel ?? '',
    cutoffTime: formatMinutesToHHmm(race.cutoffMinutes) ?? '',
    description: race.description ?? '',
    status: race.status,
    sortOrder: race.sortOrder.toString(),
    ticketStatus: race.ticketStatus,
    maxParticipants: race.maxParticipants?.toString() ?? '',
    itraPoints: race.itraPoints?.toString() ?? '',
    certifiedBy: race.certifiedBy ?? '',
    prizeMoney: race.prizeMoney.toString(),
    championshipCategory: race.championshipCategory ?? '',
    dateOfRace: race.dateOfRace ?? '',
    startTime: race.startTime ? race.startTime.slice(0, 5) : '',
  };
}

function buildScheduleRule(form: EventFormState): ScheduleRule | null {
  if (!form.hasSchedule) return null;

  if (form.scheduleType === 'Yearly') {
    if (form.yearlyMode === 'date') {
      return {
        type: 'Yearly',
        month: form.scheduleMonth,
        dayOfMonth: form.scheduleDayOfMonth,
      };
    }

    return {
      type: 'Yearly',
      month: form.scheduleMonth,
      weekOfMonth: form.scheduleWeek,
      dayOfWeek: form.scheduleDay,
    };
  }

  if (form.scheduleType === 'Seasonal') {
    return {
      type: 'Seasonal',
      monthStart: form.scheduleMonthStart,
      monthEnd: form.scheduleMonthEnd,
      weekOfMonth: form.scheduleSeasonalWeek === '' ? undefined : form.scheduleSeasonalWeek,
      dayOfWeek: form.scheduleDay,
    };
  }

  if (form.scheduleType === 'Fixed') {
    if (!form.scheduleDate) return null;
    return {
      type: 'Fixed',
      date: form.scheduleDate,
    };
  }

  if (form.scheduleType === 'Approximate') {
    return {
      type: 'Approximate',
      month: form.scheduleMonth,
      ...(form.scheduleMonthEnd > 0 && { monthEnd: form.scheduleMonthEnd }),
    };
  }

  return null;
}

export default function EventList({ onNotify }: EventListProps) {
  const {
    events,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    getEvent,
    createEdition,
    updateEdition,
    deleteEdition,
    generateEditionsForSeason,
    createRace,
    updateRace,
    deleteRace,
  } = useEvents();
  const { locations } = useLocations();
  const { trails } = useTrails();

  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showEditionDialog, setShowEditionDialog] = useState(false);
  const [showRaceDialog, setShowRaceDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editEditionId, setEditEditionId] = useState<string | null>(null);
  const [editRaceId, setEditRaceId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<EventDetailDto | null>(null);
  const [expandedEditionIds, setExpandedEditionIds] = useState<string[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'activityType' | 'type' | 'nextEditionDate' | 'status' | 'editionCount' | 'locationName'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [eventForm, setEventForm] = useState<EventFormState>(createEmptyEventForm());
  const [editionForm, setEditionForm] = useState<EditionFormState>(createEmptyEditionForm());
  const [raceForm, setRaceForm] = useState<RaceFormState>(createEmptyRaceForm());
  const [applyToAllEditions, setApplyToAllEditions] = useState(false);
  const [cloneFromEditionId, setCloneFromEditionId] = useState<string>('');
  const [showBulkDatesDialog, setShowBulkDatesDialog] = useState(false);
  const [bulkDates, setBulkDates] = useState<Array<{ race: RaceDto; dateOfRace: string; startTime: string }>>([]);
  const [generateForm, setGenerateForm] = useState<GenerateFormState>({ eventId: '', eventName: '', eventType: 'Race', fromMonth: 1, fromYear: new Date().getFullYear(), toMonth: 12, toYear: new Date().getFullYear(), trailId: '', registrationUrl: '', seasonStartMonth: null, editionName: '' });

  const sortedLocations = useMemo(
    () => [...locations].sort((a, b) => a.name.localeCompare(b.name)),
    [locations],
  );
  const sortedTrails = useMemo(
    () => [...trails].filter(t => t.status === 'Published' || t.status === 'EventOnly').sort((a, b) => a.name.localeCompare(b.name)),
    [trails],
  );

  const eventLocationOptions = useMemo(
    () => [...new Set(events.map(e => e.locationName).filter(Boolean) as string[])].sort(),
    [events],
  );

  const hasActiveFilters = activityFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all' || locationFilter !== 'all';
  const resetFilters = () => { setActivityFilter('all'); setTypeFilter('all'); setStatusFilter('all'); setLocationFilter('all'); };

  const filteredEvents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return [...events]
      .filter(event => {
        if (normalizedQuery && ![
          event.name,
          event.slug,
          event.description ?? '',
          event.locationName ?? '',
          event.organizerName ?? '',
          event.type,
          event.status,
          event.activityType,
        ].some(value => value.toLowerCase().includes(normalizedQuery))) return false;

        if (activityFilter !== 'all' && event.activityType !== activityFilter) return false;
        if (typeFilter !== 'all' && event.type !== typeFilter) return false;
        if (statusFilter !== 'all' && event.status !== statusFilter) return false;
        if (locationFilter !== 'all') {
          if (locationFilter === 'none' && event.locationName) return false;
          if (locationFilter !== 'none' && event.locationName !== locationFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        let cmp = 0;

        if (sortBy === 'nextEditionDate') {
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
  }, [events, searchQuery, sortBy, sortDir, activityFilter, typeFilter, statusFilter, locationFilter]);

  const handleRequestSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const setEventField = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => {
    setEventForm(prev => ({ ...prev, [field]: value }));
  };

  const setEditionField = <K extends keyof EditionFormState>(field: K, value: EditionFormState[K]) => {
    setEditionForm(prev => ({ ...prev, [field]: value }));
  };

  const setRaceField = <K extends keyof RaceFormState>(field: K, value: RaceFormState[K]) => {
    setRaceForm(prev => ({ ...prev, [field]: value }));
  };

  const loadExpandedEvent = async (eventId: string, slug: string) => {
    setLoadingDetail(true);
    try {
      const detail = await getEvent(slug);
      setExpandedEventId(eventId);
      setExpandedDetail(detail);
    } catch {
      onNotify('Failed to load event editions', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshExpandedEvent = async () => {
    if (!expandedEventId) return;
    const slug = expandedDetail?.slug ?? events.find(event => event.id === expandedEventId)?.slug;
    if (!slug) return;
    await loadExpandedEvent(expandedEventId, slug);
  };

  const toggleExpand = async (event: EventSummaryDto) => {
    if (expandedEventId === event.id) {
      setExpandedEventId(null);
      setExpandedDetail(null);
      setExpandedEditionIds([]);
      return;
    }

    setExpandedEditionIds([]);
    await loadExpandedEvent(event.id, event.slug);
  };

  const toggleEditionExpand = (editionId: string) => {
    setExpandedEditionIds(prev => prev.includes(editionId)
      ? prev.filter(id => id !== editionId)
      : [...prev, editionId]);
  };

  const handleAddSocialLink = () => {
    setEventForm(prev => ({
      ...prev,
      socialLinks: [...prev.socialLinks, { type: '', url: '' }],
    }));
  };

  const handleSocialLinkChange = (index: number, field: keyof SocialLink, value: string) => {
    setEventForm(prev => ({
      ...prev,
      socialLinks: prev.socialLinks.map((link, linkIndex) => linkIndex === index ? { ...link, [field]: value } : link),
    }));
  };

  const handleRemoveSocialLink = (index: number) => {
    setEventForm(prev => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((_, linkIndex) => linkIndex !== index),
    }));
  };

  const openCreateEvent = () => {
    setEditEventId(null);
    setEventForm(createEmptyEventForm());
    setShowEventDialog(true);
  };

  const openEditEvent = (event: EventSummaryDto) => {
    setEditEventId(event.id);
    setEventForm(buildEventForm(event));
    setShowEventDialog(true);
  };

  const openCreateEdition = (event: EventSummaryDto) => {
    setEditEditionId(null);
    const editionsWithRaces = [...(expandedDetail?.editions ?? [])].filter(ed => ed.races.length > 0).sort(sortEditions);
    const defaultClone = editionsWithRaces[editionsWithRaces.length - 1];
    const nextYear = defaultClone?.year ? String(defaultClone.year + 1) : String(new Date().getFullYear());
    const clonedRegUrl = bumpYearInUrl(defaultClone?.registrationUrl ?? '', defaultClone?.year, Number(nextYear));
    const isPastYear = Number(nextYear) < new Date().getFullYear();
    setCloneFromEditionId(defaultClone?.id ?? '');
    setEditionForm({
      ...createEmptyEditionForm(event.id, event.type, event.name),
      year: nextYear,
      registrationUrl: clonedRegUrl,
      registrationStatus: isPastYear ? 'Closed' : 'NotStarted',
    });
    setShowEditionDialog(true);
  };

  const openEditEdition = (edition: EventEditionDto) => {
    setEditEditionId(edition.id);
    setCloneFromEditionId('');
    setEditionForm(buildEditionForm(edition, expandedDetail?.type ?? 'Race', expandedDetail?.name ?? ''));
    setShowEditionDialog(true);
  };

  const openCreateRace = (edition: EventEditionDto) => {
    setEditRaceId(null);
    const past = isPastDate(edition.date ?? '');
    setRaceForm({
      ...createEmptyRaceForm(edition.id, edition.races.length),
      status: past ? 'Completed' : 'Active',
      ticketStatus: past ? 'Closed' : 'Available',
    });
    setShowRaceDialog(true);
  };

  const openEditRace = (race: RaceDto) => {
    setEditRaceId(race.id);
    setRaceForm(buildRaceForm(race));
    setShowRaceDialog(true);
  };

  const openGenerateEditionDialog = (event: EventSummaryDto) => {
    setGenerateForm(createGenerateForm(event));
    setShowGenerateDialog(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.name.trim()) return;

    const hasIncompleteSocialLink = eventForm.socialLinks.some(link => {
      const hasType = Boolean(link.type.trim());
      const hasUrl = Boolean(link.url.trim());
      return hasType !== hasUrl;
    });

    if (hasIncompleteSocialLink) {
      onNotify('Each social link needs both a type and a URL.', 'error');
      return;
    }

    setSaving(true);
    try {
      const socialLinks = eventForm.socialLinks
        .map(link => ({ type: link.type.trim(), url: link.url.trim() }))
        .filter(link => link.type && link.url);

      const baseInput = {
        name: eventForm.name.trim(),
        description: trimToUndefined(eventForm.description),
        type: eventForm.type,
        activityType: eventForm.activityType,
        status: eventForm.status,
        organizerName: trimToUndefined(eventForm.organizerName),
        organizerWebsite: trimToUndefined(eventForm.organizerWebsite),
        alertMessage: trimToUndefined(eventForm.alertMessage),
        alertSeverity: eventForm.alertMessage.trim() ? eventForm.alertSeverity : undefined,
        locationId: eventForm.locationId || null,
        scheduleRule: buildScheduleRule(eventForm),
        socialLinks: socialLinks.length > 0 ? socialLinks : null,
      };

      if (editEventId) {
        await updateEvent(editEventId, baseInput);
        onNotify(`"${eventForm.name.trim()}" updated`);
        if (expandedEventId === editEventId) {
          await refreshExpandedEvent();
        }
      } else {
        await createEvent({
          ...baseInput,
          slug: trimToUndefined(eventForm.slug),
        });
        onNotify(`"${eventForm.name.trim()}" created`);
      }

      setShowEventDialog(false);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save event', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (event: EventSummaryDto) => {
    if (!window.confirm(`Delete "${event.name}" and all its editions and races?`)) return;

    try {
      await deleteEvent(event.id);
      onNotify(`"${event.name}" deleted`);
      if (expandedEventId === event.id) {
        setExpandedEventId(null);
        setExpandedDetail(null);
        setExpandedEditionIds([]);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete event', 'error');
    }
  };

  const handleSaveEdition = async () => {
    if (!editionForm.eventId) return;

    const isRaceOrSeries = editionForm.eventType === 'Race' || editionForm.eventType === 'Series';

    setSaving(true);
    try {
      const input = {
        eventId: editionForm.eventId,
        year: editionForm.year.trim() ? Number(editionForm.year) : null,
        date: editionForm.date || null,
        title: trimToUndefined(editionForm.title),
        registrationUrl: trimToUndefined(editionForm.registrationUrl),
        resultsUrl: trimToUndefined(editionForm.resultsUrl),
        notes: trimToUndefined(editionForm.notes),
        registrationStatus: editionForm.registrationStatus,
        trailId: isRaceOrSeries ? null : (editionForm.trailId || null),
      };
      const editionLabel = trimToUndefined(editionForm.title) || editionForm.date || editionForm.year || 'Untitled edition';

      if (editEditionId) {
        await updateEdition(editEditionId, {
          year: input.year,
          date: input.date,
          title: input.title,
          registrationUrl: input.registrationUrl,
          resultsUrl: input.resultsUrl,
          notes: input.notes,
          registrationStatus: input.registrationStatus,
          trailId: input.trailId,
        });
        onNotify(`Edition "${editionLabel}" updated`);
      } else {
        const newEditionId = await createEdition(input);
        const sourceEdition = cloneFromEditionId
          ? expandedDetail?.editions.find(ed => ed.id === cloneFromEditionId)
          : null;

        if (isRaceOrSeries) {
          if (sourceEdition && sourceEdition.races.length > 0) {
            await Promise.all(sourceEdition.races.map(race =>
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
                dateOfRace: null,
                startTime: null,
              }),
            ));
            onNotify(`Edition "${editionLabel}" created with ${sourceEdition.races.length} cloned race${sourceEdition.races.length === 1 ? '' : 's'} — set their dates below`);
          } else {
            await createRace({
              eventEditionId: newEditionId,
              trailId: null,
              name: editionForm.eventName || 'Race',
              status: 'Active',
              sortOrder: 0,
              ticketStatus: 'Available',
              itraPoints: null,
              prizeMoney: 0,
            });
            onNotify(`Edition "${editionLabel}" created with default race`);
          }
        } else {
          onNotify(`Edition "${editionLabel}" created`);
        }

        // Auto-expand the new edition so admin can see and set dates immediately
        setExpandedEditionIds(prev => [...prev, newEditionId]);
      }

      setCloneFromEditionId('');
      setShowEditionDialog(false);
      await refreshExpandedEvent();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save edition', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEdition = async (edition: EventEditionDto) => {
    if (!window.confirm(`Delete edition "${buildEditionLabel(edition)}" and all its races?`)) return;

    try {
      await deleteEdition(edition.id);
      setExpandedEditionIds(prev => prev.filter(id => id !== edition.id));
      onNotify(`Edition "${buildEditionLabel(edition)}" deleted`);
      await refreshExpandedEvent();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete edition', 'error');
    }
  };

  const handleGenerateEditions = async () => {
    if (!generateForm.eventId) return;

    const from = `${generateForm.fromYear}-${String(generateForm.fromMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(generateForm.toYear, generateForm.toMonth, 0).getDate();
    const to = `${generateForm.toYear}-${String(generateForm.toMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    setSaving(true);
    try {
      const isSeries = generateForm.eventType === 'Series';

      const result = await generateEditionsForSeason({
        eventId: generateForm.eventId,
        from,
        to,
        // For Race/Series events, trail is set on the Race (backend handles it); for others, on the Edition
        trailId: generateForm.trailId || null,
        registrationUrl: generateForm.registrationUrl.trim() || null,
        // Series: pass season start month so backend groups dates into seasons
        seasonStartMonth: isSeries ? generateForm.seasonStartMonth : null,
        editionName: isSeries && generateForm.editionName.trim() ? generateForm.editionName.trim() : null,
      });
      const hasDefaults = generateForm.trailId || generateForm.registrationUrl.trim();

      // Auto-create default races for editions without races (Race events only — Series handled by backend)
      let racesCreated = result.racesCreated;
      if (generateForm.eventType === 'Race') {
        const raceTrailId = generateForm.trailId || null;
        const raceName = generateForm.eventName || 'Race';

        // Fetch fresh event detail to find ALL editions without races
        const eventSlug = expandedDetail?.slug ?? events.find(e => e.id === generateForm.eventId)?.slug;
        if (eventSlug) {
          const freshDetail = await getEvent(eventSlug);
          const editionsWithoutRaces = freshDetail.editions.filter(ed => ed.races.length === 0);
          if (editionsWithoutRaces.length > 0) {
            await Promise.all(editionsWithoutRaces.map(ed =>
              createRace({
                eventEditionId: ed.id,
                trailId: raceTrailId,
                name: raceName,
                status: 'Active',
                sortOrder: 0,
                ticketStatus: 'Available',
                itraPoints: null,
                prizeMoney: 0,
              }),
            ));
            racesCreated += editionsWithoutRaces.length;
          }
        }
      }

      const parts: string[] = [];
      if (result.count > 0) parts.push(`Generated ${result.count} ${isSeries ? 'season' : 'edition'}${result.count === 1 ? '' : 's'}`);
      if (racesCreated > 0) parts.push(`created ${racesCreated} race${racesCreated === 1 ? '' : 's'}`);
      if (parts.length === 0 && hasDefaults) parts.push('Defaults applied to existing editions');
      if (parts.length === 0) parts.push('No new editions to generate — all dates already exist.');

      onNotify(
        `${parts.join(' and ')} for "${generateForm.eventName}"`,
        result.count > 0 || hasDefaults || racesCreated > 0 ? 'success' : 'error',
      );
      setShowGenerateDialog(false);
      if (expandedEventId === generateForm.eventId) {
        await refreshExpandedEvent();
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to generate editions', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRace = async () => {
    if (!raceForm.name.trim() || !raceForm.eventEditionId) return;

    const normalizedCutoffTime = normalizeCutoffTimeOnBlur(raceForm.cutoffTime);
    const parsedCutoffMinutes = parseHHmmToMinutes(normalizedCutoffTime);
    if (normalizedCutoffTime.trim() && parsedCutoffMinutes == null) {
      onNotify('Cutoff Time must be in HH:mm format', 'error');
      return;
    }
    if (parsedCutoffMinutes === 0) {
      onNotify('Cutoff Time cannot be 00:00. Clear the field if you want no cutoff.', 'error');
      return;
    }
    if (normalizedCutoffTime !== raceForm.cutoffTime) {
      setRaceField('cutoffTime', normalizedCutoffTime);
    }

    setSaving(true);
    try {
      const input = {
        eventEditionId: raceForm.eventEditionId,
        trailId: raceForm.trailId || null,
        name: raceForm.name.trim(),
        distanceLabel: trimToUndefined(raceForm.distanceLabel),
        cutoffMinutes: parsedCutoffMinutes,
        description: trimToUndefined(raceForm.description),
        status: raceForm.status,
        sortOrder: raceForm.sortOrder.trim() ? Number(raceForm.sortOrder) : 0,
        ticketStatus: raceForm.ticketStatus,
        maxParticipants: raceForm.maxParticipants.trim() ? Number(raceForm.maxParticipants) : null,
        itraPoints: raceForm.itraPoints.trim() !== '' ? Number(raceForm.itraPoints) : null,
        certifiedBy: trimToUndefined(raceForm.certifiedBy),
        prizeMoney: raceForm.prizeMoney.trim() ? Number(raceForm.prizeMoney) : 0,
        championshipCategory: trimToUndefined(raceForm.championshipCategory),
        dateOfRace: raceForm.dateOfRace || null,
        startTime: raceForm.startTime || null,
      };

      if (editRaceId) {
        await updateRace(editRaceId, {
          trailId: input.trailId,
          name: input.name,
          distanceLabel: input.distanceLabel,
          cutoffMinutes: input.cutoffMinutes,
          description: input.description,
          status: input.status,
          sortOrder: input.sortOrder,
          ticketStatus: input.ticketStatus,
          maxParticipants: input.maxParticipants,
          itraPoints: input.itraPoints,
          certifiedBy: input.certifiedBy,
          prizeMoney: input.prizeMoney,
          championshipCategory: input.championshipCategory,
          dateOfRace: input.dateOfRace,
          startTime: input.startTime,
        });
        onNotify(`Race "${raceForm.name.trim()}" updated`);

        // Apply to other races
        if (applyToAllEditions && expandedDetail) {
          const isSeries = expandedDetail.type === 'Series';
          let otherRaces: typeof expandedDetail.editions[0]['races'];

          if (isSeries) {
            // Series: apply to other races within the same edition
            otherRaces = expandedDetail.editions
              .filter(ed => ed.id === raceForm.eventEditionId)
              .flatMap(ed => ed.races)
              .filter(r => r.id !== editRaceId);
          } else {
            // Non-Series: apply to matching races (by sortOrder) in other editions
            otherRaces = expandedDetail.editions
              .filter(ed => ed.id !== raceForm.eventEditionId)
              .flatMap(ed => ed.races)
              .filter(r => r.id !== editRaceId && r.sortOrder === input.sortOrder);
          }

          if (otherRaces.length > 0) {
            await Promise.all(otherRaces.map(r =>
              updateRace(r.id, {
                trailId: input.trailId,
                name: isSeries ? r.name : input.name,
                distanceLabel: input.distanceLabel,
                cutoffMinutes: input.cutoffMinutes,
                description: input.description,
                status: input.status,
                sortOrder: isSeries ? r.sortOrder : input.sortOrder,
                ticketStatus: input.ticketStatus,
                maxParticipants: input.maxParticipants,
                itraPoints: input.itraPoints,
                certifiedBy: input.certifiedBy,
                prizeMoney: input.prizeMoney,
                championshipCategory: input.championshipCategory,
                dateOfRace: r.dateOfRace ?? null,
                startTime: input.startTime,
              }),
            ));
            onNotify(`Also updated ${otherRaces.length} other race${otherRaces.length === 1 ? '' : 's'} in ${isSeries ? 'this edition' : 'other editions'}`);
          }
        }
      } else {
        await createRace(input);
        onNotify(`Race "${raceForm.name.trim()}" created`);
      }

      setShowRaceDialog(false);
      setApplyToAllEditions(false);
      await refreshExpandedEvent();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save race', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRace = async (race: RaceDto) => {
    if (!window.confirm(`Delete race "${race.name}"?`)) return;

    try {
      await deleteRace(race.id);
      onNotify(`Race "${race.name}" deleted`);
      await refreshExpandedEvent();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete race', 'error');
    }
  };

  const handleCopyRacesFromPrevious = async (edition: EventEditionDto) => {
    if (!expandedDetail) return;

    // Sort all editions chronologically and find the target's position
    const allSorted = [...expandedDetail.editions].sort(sortEditions);
    const targetIndex = allSorted.findIndex(ed => ed.id === edition.id);

    // Look backwards for the closest earlier edition with races
    let sourceEdition: EventEditionDto | undefined;
    for (let i = targetIndex - 1; i >= 0; i--) {
      if (allSorted[i].races.length > 0) {
        sourceEdition = allSorted[i];
        break;
      }
    }
    // Fallback: use the most recent edition with races (any position)
    if (!sourceEdition) {
      sourceEdition = [...allSorted].reverse().find(ed => ed.id !== edition.id && ed.races.length > 0);
    }
    if (!sourceEdition) return;

    const raceCount = sourceEdition.races.length;
    const label = buildEditionLabel(sourceEdition);
    if (!window.confirm(`Copy ${raceCount} race${raceCount === 1 ? '' : 's'} from "${label}" into this edition?`)) return;

    setSaving(true);
    try {
      await Promise.all(sourceEdition.races.map(race =>
        createRace({
          eventEditionId: edition.id,
          trailId: race.trailId ?? null,
          name: race.name,
          distanceLabel: race.distanceLabel ?? undefined,
          cutoffMinutes: race.cutoffMinutes ?? null,
          description: race.description ?? undefined,
          status: 'Active',
          sortOrder: race.sortOrder,
          ticketStatus: 'Available',
          maxParticipants: race.maxParticipants ?? null,
          itraPoints: race.itraPoints,
          certifiedBy: race.certifiedBy ?? undefined,
          prizeMoney: race.prizeMoney,
          championshipCategory: race.championshipCategory ?? undefined,
          dateOfRace: null,
          startTime: race.startTime ?? null,
        }),
      ));
      onNotify(`Copied ${raceCount} race${raceCount === 1 ? '' : 's'} from "${label}"`);
      await refreshExpandedEvent();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to copy races', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCycleRegistrationStatus = async (edition: EventEditionDto) => {
    const cycle: RegistrationStatus[] = ['NotStarted', 'Open', 'Closed'];
    const next = cycle[(cycle.indexOf(edition.registrationStatus) + 1) % cycle.length];
    try {
      await updateEdition(edition.id, {
        year: edition.year ?? null,
        date: edition.date ?? null,
        title: edition.title ?? undefined,
        registrationUrl: edition.registrationUrl ?? undefined,
        resultsUrl: edition.resultsUrl ?? undefined,
        notes: edition.notes ?? undefined,
        registrationStatus: next,
        trailId: edition.trailId ?? null,
      });
      await refreshExpandedEvent();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to update status', 'error');
    }
  };

  const openBulkDates = (edition: EventEditionDto) => {
    setBulkDates(
      [...edition.races].sort(sortRaces).map(race => ({
        race,
        dateOfRace: race.dateOfRace ?? '',
        startTime: race.startTime ? race.startTime.slice(0, 5) : '',
      })),
    );
    setShowBulkDatesDialog(true);
  };

  const handleSaveBulkDates = async () => {
    setSaving(true);
    try {
      await Promise.all(bulkDates.map(({ race, dateOfRace, startTime }) =>
        updateRace(race.id, {
          trailId: race.trailId ?? null,
          name: race.name,
          distanceLabel: race.distanceLabel ?? undefined,
          cutoffMinutes: race.cutoffMinutes ?? null,
          description: race.description ?? undefined,
          status: race.status,
          sortOrder: race.sortOrder,
          ticketStatus: race.ticketStatus,
          maxParticipants: race.maxParticipants ?? null,
          itraPoints: race.itraPoints ?? null,
          certifiedBy: race.certifiedBy ?? undefined,
          prizeMoney: race.prizeMoney,
          championshipCategory: race.championshipCategory ?? undefined,
          dateOfRace: dateOfRace || null,
          startTime: startTime || null,
        }),
      ));
      onNotify(`Dates saved for ${bulkDates.length} race${bulkDates.length === 1 ? '' : 's'}`);
      setShowBulkDatesDialog(false);
      await refreshExpandedEvent();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save dates', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getTrailActivityIcon = (trailId: string | null) => {
    if (!trailId) return '🏁';
    return ACTIVITY_ICONS[trails.find(trail => trail.id === trailId)?.activityType ?? ''] ?? '🏁';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <TrophyIcon color="primary" />
          <Typography variant="h5">Events</Typography>
          <Chip label={searchQuery.trim() || hasActiveFilters ? `${filteredEvents.length} / ${events.length}` : events.length} size="small" color="primary" />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateEvent}>
          New Event
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ mb: 3, p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search events…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          sx={{ minWidth: 200, flexGrow: 1, maxWidth: 300 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="Clear search" onClick={() => setSearchQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
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
        {hasActiveFilters && (
          <Tooltip title="Clear all filters">
            <IconButton size="small" aria-label="Clear all filters" onClick={resetFilters}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={40} />
              <TableCell sortDirection={sortBy === 'name' ? sortDir : false}>
                <TableSortLabel active={sortBy === 'name'} direction={sortBy === 'name' ? sortDir : 'asc'} onClick={() => handleRequestSort('name')}>
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sortBy === 'activityType' ? sortDir : false}>
                <TableSortLabel active={sortBy === 'activityType'} direction={sortBy === 'activityType' ? sortDir : 'asc'} onClick={() => handleRequestSort('activityType')}>
                  Activity
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sortBy === 'type' ? sortDir : false}>
                <TableSortLabel active={sortBy === 'type'} direction={sortBy === 'type' ? sortDir : 'asc'} onClick={() => handleRequestSort('type')}>
                  Type
                </TableSortLabel>
              </TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell sortDirection={sortBy === 'nextEditionDate' ? sortDir : false}>
                <TableSortLabel active={sortBy === 'nextEditionDate'} direction={sortBy === 'nextEditionDate' ? sortDir : 'asc'} onClick={() => handleRequestSort('nextEditionDate')}>
                  Next Edition
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sortDirection={sortBy === 'status' ? sortDir : false}>
                <TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortDir : 'asc'} onClick={() => handleRequestSort('status')}>
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sortDirection={sortBy === 'editionCount' ? sortDir : false}>
                <TableSortLabel active={sortBy === 'editionCount'} direction={sortBy === 'editionCount' ? sortDir : 'asc'} onClick={() => handleRequestSort('editionCount')}>
                  Editions
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sortBy === 'locationName' ? sortDir : false}>
                <TableSortLabel active={sortBy === 'locationName'} direction={sortBy === 'locationName' ? sortDir : 'asc'} onClick={() => handleRequestSort('locationName')}>
                  Location
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEvents.map(event => (
              <Fragment key={event.id}>
                <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => toggleExpand(event)}>
                  <TableCell sx={expandedEventId === event.id ? { borderTop: '2px solid', borderLeft: '2px solid', borderColor: 'primary.main' } : {}}>
                    <IconButton size="small">
                      {expandedEventId === event.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{event.name}</Typography>
                    <Typography variant="caption" color="text.secondary" fontFamily="monospace">{event.slug}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={`${ACTIVITY_ICONS[event.activityType] ?? '🏅'} ${event.activityType}`} size="small" color={ACTIVITY_TYPE_COLORS[event.activityType as ActivityType] ?? 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={event.type} size="small" color={EVENT_TYPE_COLORS[event.type as EventType] ?? 'default'} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{formatSchedule(event.scheduleRule)}</Typography>
                  </TableCell>
                  <TableCell>
                    {event.nextEditionDate ? (
                      <Box>
                        <Typography variant="body2">{event.nextEditionDate}</Typography>
                        {formatDaysUntil(event.daysUntil) && (
                          <Chip
                            label={formatDaysUntil(event.daysUntil)}
                            size="small"
                            variant="outlined"
                            color={event.daysUntil != null && event.daysUntil <= 7 ? 'warning' : 'default'}
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={event.status} size="small" color={getEventStatusColor(event.status)} />
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={event.editionCount} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{event.locationName ?? '—'}</Typography>
                  </TableCell>
                  <TableCell align="right" onClick={clickEvent => clickEvent.stopPropagation()} sx={expandedEventId === event.id ? { borderTop: '2px solid', borderRight: '2px solid', borderColor: 'primary.main' } : {}}>
                    <Tooltip title="Edit event">
                      <IconButton size="small" onClick={() => openEditEvent(event)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete event">
                      <IconButton size="small" color="error" onClick={() => handleDeleteEvent(event)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={10} sx={{ py: 0, borderBottom: expandedEventId === event.id ? undefined : 'none', ...(expandedEventId === event.id && { borderLeft: '2px solid', borderRight: '2px solid', borderBottomColor: 'primary.main', borderLeftColor: 'primary.main', borderRightColor: 'primary.main' }) }}>
                    <Collapse in={expandedEventId === event.id} timeout="auto" unmountOnExit>
                      <Box sx={{ px: 2, py: 2, bgcolor: 'action.hover' }}>
                        {loadingDetail ? (
                          <CircularProgress size={24} />
                        ) : expandedDetail ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {/* Sticky event name header */}
                            <Box sx={{
                              position: 'sticky', top: 0, zIndex: 1,
                              bgcolor: 'background.paper',
                              borderBottom: 1, borderColor: 'divider',
                              mx: -2, px: 2, py: 1,
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1,
                            }}>
                              <Typography variant="subtitle1" fontWeight={700}>{expandedDetail.name}</Typography>
                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                {expandedDetail.scheduleRule && (
                                  <Button size="small" variant="outlined" startIcon={<GenerateIcon />} onClick={() => openGenerateEditionDialog(event)}>
                                    Generate Editions
                                  </Button>
                                )}
                                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => openCreateEdition(event)}>
                                  Add Edition
                                </Button>
                              </Stack>
                            </Box>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {expandedDetail.description && (
                                <Typography variant="body2">{expandedDetail.description}</Typography>
                              )}
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                  <Chip label={expandedDetail.type} size="small" color={EVENT_TYPE_COLORS[expandedDetail.type as EventType] ?? 'default'} />
                                  <Chip label={`${expandedDetail.editions.length} edition${expandedDetail.editions.length === 1 ? '' : 's'}`} size="small" />
                                  {expandedDetail.organizerName && <Chip label={`Organizer: ${expandedDetail.organizerName}`} size="small" variant="outlined" />}
                                  {expandedDetail.locationName && <Chip label={expandedDetail.locationName} size="small" variant="outlined" />}
                                </Stack>
                                {expandedDetail.upcomingDates.length > 0 && (
                                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                    {expandedDetail.upcomingDates.slice(0, 6).map(date => (
                                      <Chip key={date} label={date} size="small" variant="outlined" color="info" />
                                    ))}
                                  </Stack>
                                )}
                            </Box>

                            {(expandedDetail.alertMessage || expandedDetail.socialLinks?.length || expandedDetail.organizerWebsite) && (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {expandedDetail.alertMessage && (
                                  <Alert severity={expandedDetail.alertSeverity ?? 'info'}>{expandedDetail.alertMessage}</Alert>
                                )}
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                  {expandedDetail.organizerWebsite && (
                                    <Chip
                                      icon={<LinkIcon />}
                                      label="Organizer website"
                                      component="a"
                                      clickable
                                      href={expandedDetail.organizerWebsite}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      variant="outlined"
                                    />
                                  )}
                                  {expandedDetail.socialLinks?.map((link) => (
                                    <Chip
                                      key={`${link.type}-${link.url}`}
                                      icon={<LinkIcon />}
                                      label={link.type}
                                      component="a"
                                      clickable
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      variant="outlined"
                                    />
                                  ))}
                                </Stack>
                              </Box>
                            )}

                            <Box>
                              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                                Editions ({expandedDetail.editions.length})
                              </Typography>

                              {expandedDetail.editions.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                  No editions yet. Click "Add Edition" to create the first one.
                                </Typography>
                              ) : (
                                [...expandedDetail.editions].sort(sortEditions).map(edition => (
                                  <Paper key={edition.id} variant="outlined" sx={{
                                    mb: 1.5,
                                    borderLeft: '4px solid',
                                    borderLeftColor: edition.registrationStatus === 'Open' ? 'success.main'
                                      : edition.registrationStatus === 'NotStarted' ? 'warning.main'
                                      : 'divider',
                                  }}>
                                    <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexGrow: 1 }}>
                                        <IconButton size="small" onClick={() => toggleEditionExpand(edition.id)}>
                                          {expandedEditionIds.includes(edition.id) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                        </IconButton>
                                        <Box sx={{ flexGrow: 1 }}>
                                          <Typography variant="body2" fontWeight={700}>{buildEditionLabel(edition)}</Typography>
                                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                                            <Chip label={edition.date ?? (edition.year != null ? String(edition.year) : 'Date TBD')} size="small" variant="outlined" />
                                            <Tooltip title="Click to cycle: NotStarted → Open → Closed">
                                              <Chip
                                                label={edition.registrationStatus}
                                                size="small"
                                                color={getRegistrationStatusColor(edition.registrationStatus)}
                                                onClick={() => handleCycleRegistrationStatus(edition)}
                                                sx={{ cursor: 'pointer' }}
                                              />
                                            </Tooltip>
                                            <Chip label={`${edition.races.length} race${edition.races.length === 1 ? '' : 's'}`} size="small" variant="outlined" />
                                            {edition.trailName && <Chip label={`Trail: ${edition.trailName}`} size="small" variant="outlined" />}
                                            {(() => {
                                              const missing = edition.races.filter(r => !r.dateOfRace).length;
                                              return missing > 0 ? (
                                                <Tooltip title="Click to set dates">
                                                  <Chip
                                                    label={`${missing} date${missing === 1 ? '' : 's'} missing`}
                                                    size="small"
                                                    color="warning"
                                                    onClick={() => openBulkDates(edition)}
                                                    sx={{ cursor: 'pointer' }}
                                                  />
                                                </Tooltip>
                                              ) : null;
                                            })()}
                                          </Stack>
                                        </Box>
                                      </Box>
                                      <Box>
                                        <Tooltip title="Edit edition">
                                          <IconButton size="small" onClick={() => openEditEdition(edition)}>
                                            <EditIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete edition">
                                          <IconButton size="small" color="error" onClick={() => handleDeleteEdition(edition)}>
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      </Box>
                                    </Box>

                                    <Collapse in={expandedEditionIds.includes(edition.id)} timeout="auto" unmountOnExit>
                                      <Divider />
                                      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        {(edition.registrationUrl || edition.resultsUrl) && (
                                          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                                            {edition.registrationUrl && (
                                              <Link href={edition.registrationUrl} target="_blank" rel="noopener noreferrer" underline="hover">
                                                Registration link
                                              </Link>
                                            )}
                                            {edition.resultsUrl && (
                                              <Link href={edition.resultsUrl} target="_blank" rel="noopener noreferrer" underline="hover">
                                                Results link
                                              </Link>
                                            )}
                                          </Stack>
                                        )}

                                        {edition.notes && (
                                          <Typography variant="body2" color="text.secondary">{edition.notes}</Typography>
                                        )}

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                          <Typography variant="subtitle2" color="text.secondary">
                                            Races · {buildEditionLabel(edition)} ({edition.races.length})
                                          </Typography>
                                          <Stack direction="row" spacing={1}>
                                            {expandedDetail && edition.races.length === 0 && expandedDetail.editions.some(ed => ed.id !== edition.id && ed.races.length > 0) && (
                                              <Button size="small" startIcon={<CopyIcon />} onClick={() => handleCopyRacesFromPrevious(edition)} disabled={saving}>
                                                Copy races
                                              </Button>
                                            )}
                                            {edition.races.length > 0 && (
                                              <Button size="small" startIcon={<CalendarIcon />} onClick={() => openBulkDates(edition)}>
                                                Set Dates
                                              </Button>
                                            )}
                                            <Button size="small" startIcon={<AddIcon />} onClick={() => openCreateRace(edition)}>
                                              Add Race
                                            </Button>
                                          </Stack>
                                        </Box>

                                        {edition.races.length === 0 ? (
                                          <Typography variant="body2" color="text.secondary">
                                            No races yet. Click "Add Race" to attach distances for this edition.
                                          </Typography>
                                        ) : (
                                          <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            {[...edition.races].sort(sortRaces).map(race => (
                                              <ListItem
                                                key={race.id}
                                                sx={{
                                                  px: 1.5,
                                                  py: 1.25,
                                                  border: '1px solid',
                                                  borderColor: 'divider',
                                                  borderRadius: 1,
                                                  alignItems: 'flex-start',
                                                }}
                                                secondaryAction={(
                                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <IconButton size="small" onClick={() => openEditRace(race)}>
                                                      <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" color="error" onClick={() => handleDeleteRace(race)}>
                                                      <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                  </Box>
                                                )}
                                              >
                                                <ListItemText
                                                  sx={{ pr: 10 }}
                                                  primary={(
                                                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ alignItems: 'center' }}>
                                                      <Typography variant="body2" fontWeight={700}>{race.name}</Typography>
                                                      {race.distanceLabel && <Chip label={race.distanceLabel} size="small" variant="outlined" />}
                                                      <Chip label={race.status} size="small" color={getRaceStatusColor(race.status)} />
                                                      <Chip label={race.ticketStatus} size="small" color={getTicketStatusColor(race.ticketStatus)} variant="outlined" />
                                                      {race.cutoffMinutes != null && (
                                                        <Chip
                                                          label={`Cutoff ${formatMinutesToHHmm(race.cutoffMinutes) ?? `${race.cutoffMinutes} min`}`}
                                                          size="small"
                                                          variant="outlined"
                                                          color="warning"
                                                        />
                                                      )}
                                                    </Stack>
                                                  )}
                                                  secondary={(
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.75 }}>
                                                      {race.description && <Typography variant="body2" color="text.secondary">{race.description}</Typography>}
                                                      <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
                                                        {race.trailName && (
                                                          <Typography variant="caption" color="primary">
                                                            {getTrailActivityIcon(race.trailId)} {race.trailName}
                                                            {race.trailDistanceMeters != null && ` • ${(race.trailDistanceMeters / 1000).toFixed(1)} km`}
                                                            {race.trailElevationGain != null && ` • ↑${Math.round(race.trailElevationGain)} m`}
                                                          </Typography>
                                                        )}
                                                        {race.maxParticipants != null && (
                                                          <Typography variant="caption" color="text.secondary">Max {race.maxParticipants} participants</Typography>
                                                        )}
                                                        {race.itraPoints != null && (
                                                          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                                            <img src={`/images/itra-${race.itraPoints}.png`} alt={`ITRA ${race.itraPoints}`} style={{ height: 20 }} />
                                                            <Typography variant="caption" color="text.secondary">{race.itraPoints} ITRA pts</Typography>
                                                          </Box>
                                                        )}
                                                        {race.certifiedBy && (
                                                          <Typography variant="caption" color="text.secondary">Certified by {race.certifiedBy}</Typography>
                                                        )}
                                                        {race.prizeMoney > 0 && (
                                                          <Typography variant="caption" color="text.secondary">Prize {race.prizeMoney}</Typography>
                                                        )}
                                                        {race.championshipCategory && (
                                                          <Typography variant="caption" color="text.secondary">{race.championshipCategory}</Typography>
                                                        )}
                                                        {(race.dateOfRace || race.startTime) && (
                                                          <Typography variant="caption" color="text.secondary">
                                                            {formatDateLabel(race.dateOfRace, 'Date TBD')}
                                                            {race.startTime ? ` • ${formatTimeLabel(race.startTime)}` : ''}
                                                          </Typography>
                                                        )}
                                                      </Stack>
                                                    </Box>
                                                  )}
                                                  secondaryTypographyProps={{ component: 'div' }}
                                                />
                                              </ListItem>
                                            ))}
                                          </List>
                                        )}
                                      </Box>
                                    </Collapse>
                                  </Paper>
                                ))
                              )}
                            </Box>
                          </Box>
                        ) : null}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            ))}

            {filteredEvents.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    {searchQuery.trim() ? `No events match "${searchQuery}"` : 'No events yet. Click "New Event" to get started.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={showEventDialog} onClose={() => setShowEventDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editEventId ? 'Edit Event' : 'New Event'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={eventForm.name}
              onChange={(event) => setEventField('name', event.target.value)}
              autoFocus
              required
              fullWidth
            />
            <TextField
              label="Slug"
              value={eventForm.slug}
              onChange={(event) => setEventField('slug', event.target.value)}
              fullWidth
              placeholder="Auto-generated from name if empty"
              helperText={editEventId ? 'Slug is managed by the backend after creation.' : 'Lowercase, hyphens only'}
              disabled={Boolean(editEventId)}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
              <FormControl>
                <InputLabel>Event Type</InputLabel>
                <Select value={eventForm.type} label="Event Type" onChange={(event) => setEventField('type', event.target.value as EventType)}>
                  {EVENT_TYPES.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl>
                <InputLabel>Activity</InputLabel>
                <Select value={eventForm.activityType} label="Activity" onChange={(event) => setEventField('activityType', event.target.value as ActivityType)}>
                  {ACTIVITY_TYPES.map(at => <MenuItem key={at} value={at}>{ACTIVITY_ICONS[at] ?? '🏅'} {at}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl>
                <InputLabel>Status</InputLabel>
                <Select value={eventForm.status} label="Status" onChange={(event) => setEventField('status', event.target.value as EventStatus)}>
                  {EVENT_STATUSES.map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <TextField
              label="Description"
              value={eventForm.description}
              onChange={(event) => setEventField('description', event.target.value)}
              multiline
              rows={3}
              fullWidth
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Organizer Name"
                value={eventForm.organizerName}
                onChange={(event) => setEventField('organizerName', event.target.value)}
                fullWidth
              />
              <TextField
                label="Organizer Website"
                value={eventForm.organizerWebsite}
                onChange={(event) => setEventField('organizerWebsite', event.target.value)}
                placeholder="https://..."
                fullWidth
              />
            </Box>
            <Autocomplete
              options={sortedLocations}
              value={sortedLocations.find(location => location.id === eventForm.locationId) ?? null}
              onChange={(_, value) => setEventField('locationId', value?.id ?? '')}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Location" />}
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Alert Banner</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  label="Alert Message"
                  value={eventForm.alertMessage}
                  onChange={(event) => setEventField('alertMessage', event.target.value)}
                  placeholder="e.g. Registration closes May 1st"
                  helperText="Leave empty for no alert"
                  fullWidth
                />
                <FormControl>
                  <InputLabel>Severity</InputLabel>
                  <Select value={eventForm.alertSeverity} label="Severity" onChange={(event) => setEventField('alertSeverity', event.target.value as AlertSeverity)}>
                    {ALERT_SEVERITIES.map(severity => <MenuItem key={severity} value={severity}>{severity}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
              {eventForm.alertMessage.trim() && (
                <Alert severity={eventForm.alertSeverity} sx={{ mt: 1.5 }}>
                  {eventForm.alertMessage}
                </Alert>
              )}
            </Box>

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2">Schedule Rule</Typography>
                <FormControlLabel
                  control={<Switch checked={eventForm.hasSchedule} onChange={(event) => setEventField('hasSchedule', event.target.checked)} />}
                  label="Enabled"
                />
              </Box>

              {eventForm.hasSchedule && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant={eventForm.scheduleType === 'Yearly' ? 'contained' : 'outlined'} onClick={() => setEventField('scheduleType', 'Yearly' as ScheduleType)}>
                      Yearly
                    </Button>
                    <Button size="small" variant={eventForm.scheduleType === 'Seasonal' ? 'contained' : 'outlined'} onClick={() => setEventField('scheduleType', 'Seasonal' as ScheduleType)}>
                      Seasonal
                    </Button>
                    <Button size="small" variant={eventForm.scheduleType === 'Fixed' ? 'contained' : 'outlined'} onClick={() => setEventField('scheduleType', 'Fixed' as ScheduleType)}>
                      Fixed date
                    </Button>
                    <Button size="small" variant={eventForm.scheduleType === 'Approximate' ? 'contained' : 'outlined'} onClick={() => { setEventField('scheduleType', 'Approximate' as ScheduleType); setEventField('scheduleMonthEnd', 0); }}>
                      Approximate
                    </Button>
                  </Box>

                  {eventForm.scheduleType === 'Yearly' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button size="small" variant={eventForm.yearlyMode === 'weekday' ? 'contained' : 'outlined'} onClick={() => setEventField('yearlyMode', 'weekday')}>
                          Weekday
                        </Button>
                        <Button size="small" variant={eventForm.yearlyMode === 'date' ? 'contained' : 'outlined'} onClick={() => setEventField('yearlyMode', 'date')}>
                          Date
                        </Button>
                      </Box>

                      {eventForm.yearlyMode === 'weekday' ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '100px 150px 150px' }, gap: 2 }}>
                          <FormControl>
                            <InputLabel>Week</InputLabel>
                            <Select value={eventForm.scheduleWeek} label="Week" onChange={(event) => setEventField('scheduleWeek', Number(event.target.value))}>
                              <MenuItem value={1}>1st</MenuItem>
                              <MenuItem value={2}>2nd</MenuItem>
                              <MenuItem value={3}>3rd</MenuItem>
                              <MenuItem value={4}>4th</MenuItem>
                              <MenuItem value={-1}>Last</MenuItem>
                            </Select>
                          </FormControl>
                          <FormControl>
                            <InputLabel>Day</InputLabel>
                            <Select value={eventForm.scheduleDay} label="Day" onChange={(event) => setEventField('scheduleDay', event.target.value as DayOfWeek)}>
                              {DAYS.map(day => <MenuItem key={day} value={day}>{day}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <FormControl>
                            <InputLabel>Month</InputLabel>
                            <Select value={eventForm.scheduleMonth} label="Month" onChange={(event) => setEventField('scheduleMonth', Number(event.target.value))}>
                              {MONTHS.slice(1).map((month, index) => <MenuItem key={month} value={index + 1}>{month}</MenuItem>)}
                            </Select>
                          </FormControl>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '150px 100px' }, gap: 2 }}>
                          <FormControl>
                            <InputLabel>Month</InputLabel>
                            <Select value={eventForm.scheduleMonth} label="Month" onChange={(event) => setEventField('scheduleMonth', Number(event.target.value))}>
                              {MONTHS.slice(1).map((month, index) => <MenuItem key={month} value={index + 1}>{month}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <FormControl>
                            <InputLabel>Day</InputLabel>
                            <Select value={eventForm.scheduleDayOfMonth} label="Day" onChange={(event) => setEventField('scheduleDayOfMonth', Number(event.target.value))}>
                              {Array.from({ length: 31 }, (_, index) => index + 1).map(day => <MenuItem key={day} value={day}>{day}</MenuItem>)}
                            </Select>
                          </FormControl>
                        </Box>
                      )}
                    </Box>
                  )}

                  {eventForm.scheduleType === 'Seasonal' && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '110px 140px 110px 110px' }, gap: 2 }}>
                      <FormControl>
                        <InputLabel>Week</InputLabel>
                        <Select
                          value={eventForm.scheduleSeasonalWeek}
                          label="Week"
                          onChange={(event) => setEventField('scheduleSeasonalWeek', event.target.value === '' ? '' : Number(event.target.value))}
                        >
                          <MenuItem value="">Every</MenuItem>
                          <MenuItem value={1}>1st</MenuItem>
                          <MenuItem value={2}>2nd</MenuItem>
                          <MenuItem value={3}>3rd</MenuItem>
                          <MenuItem value={4}>4th</MenuItem>
                          <MenuItem value={-1}>Last</MenuItem>
                        </Select>
                      </FormControl>
                      <FormControl>
                        <InputLabel>Day</InputLabel>
                        <Select value={eventForm.scheduleDay} label="Day" onChange={(event) => setEventField('scheduleDay', event.target.value as DayOfWeek)}>
                          {DAYS.map(day => <MenuItem key={day} value={day}>{day}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <FormControl>
                        <InputLabel>From</InputLabel>
                        <Select value={eventForm.scheduleMonthStart} label="From" onChange={(event) => setEventField('scheduleMonthStart', Number(event.target.value))}>
                          {MONTHS_SHORT.slice(1).map((month, index) => <MenuItem key={month} value={index + 1}>{month}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <FormControl>
                        <InputLabel>To</InputLabel>
                        <Select value={eventForm.scheduleMonthEnd} label="To" onChange={(event) => setEventField('scheduleMonthEnd', Number(event.target.value))}>
                          {MONTHS_SHORT.slice(1).map((month, index) => <MenuItem key={month} value={index + 1}>{month}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Box>
                  )}

                  {eventForm.scheduleType === 'Fixed' && (
                    <TextField
                      label="Date"
                      type="date"
                      value={eventForm.scheduleDate}
                      onChange={(event) => setEventField('scheduleDate', event.target.value)}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ lang: 'is' }}
                    />
                  )}

                  {eventForm.scheduleType === 'Approximate' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        No exact date — shown as "Usually in [month]" on the calendar.
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '150px 150px' }, gap: 2 }}>
                        <FormControl>
                          <InputLabel>Month</InputLabel>
                          <Select value={eventForm.scheduleMonth} label="Month" onChange={(event) => setEventField('scheduleMonth', Number(event.target.value))}>
                            {MONTHS.slice(1).map((month, index) => <MenuItem key={month} value={index + 1}>{month}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <FormControl>
                          <InputLabel>Until month (optional)</InputLabel>
                          <Select value={eventForm.scheduleMonthEnd} label="Until month (optional)" onChange={(event) => setEventField('scheduleMonthEnd', Number(event.target.value))}>
                            <MenuItem value={0}>—</MenuItem>
                            {MONTHS.slice(1).map((month, index) => <MenuItem key={month} value={index + 1}>{month}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2">Social Links</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={handleAddSocialLink}>
                  Add Social Link
                </Button>
              </Box>
              {eventForm.socialLinks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No social links configured.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {eventForm.socialLinks.map((link, index) => (
                    <Box key={`social-${index}`} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr auto' }, gap: 1, alignItems: 'center' }}>
                      <TextField
                        label="Type"
                        value={link.type}
                        onChange={(event) => handleSocialLinkChange(index, 'type', event.target.value)}
                        placeholder="Instagram"
                      />
                      <TextField
                        label="URL"
                        value={link.url}
                        onChange={(event) => handleSocialLinkChange(index, 'url', event.target.value)}
                        placeholder="https://..."
                        fullWidth
                      />
                      <IconButton color="error" onClick={() => handleRemoveSocialLink(index)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEventDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEvent} disabled={!eventForm.name.trim() || saving}>
            {saving ? <CircularProgress size={20} /> : editEventId ? 'Update Event' : 'Create Event'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showEditionDialog} onClose={() => { setShowEditionDialog(false); setCloneFromEditionId(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editEditionId ? 'Edit Edition' : 'Add Edition'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Clone source — only shown when creating and there are editions to clone from */}
            {!editEditionId && expandedDetail && expandedDetail.editions.some(ed => ed.races.length > 0) && (
              <FormControl fullWidth size="small">
                <InputLabel>Clone races from</InputLabel>
                <Select
                  value={cloneFromEditionId}
                  label="Clone races from"
                  onChange={(e) => {
                    const sourceId = e.target.value;
                    setCloneFromEditionId(sourceId);
                    if (sourceId) {
                      const source = expandedDetail.editions.find(ed => ed.id === sourceId);
                      const nextYear = source?.year ? source.year + 1 : Number(editionForm.year);
                      if (source?.year) setEditionField('year', String(nextYear));
                      const newUrl = bumpYearInUrl(source?.registrationUrl ?? '', source?.year, nextYear);
                      if (newUrl) setEditionField('registrationUrl', newUrl);
                    }
                  }}
                >
                  <MenuItem value=""><em>Don't clone — start empty</em></MenuItem>
                  {[...expandedDetail.editions].filter(ed => ed.races.length > 0).sort(sortEditions).map(ed => (
                    <MenuItem key={ed.id} value={ed.id}>
                      {buildEditionLabel(ed)} ({ed.races.length} race{ed.races.length === 1 ? '' : 's'})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Year"
                type="number"
                value={editionForm.year}
                onChange={(event) => setEditionField('year', event.target.value)}
              />
              <TextField
                label="Date"
                type="date"
                value={editionForm.date}
                onChange={(event) => setEditionField('date', event.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ lang: 'is' }}
              />
            </Box>
            <TextField
              label="Title"
              value={editionForm.title}
              onChange={(event) => setEditionField('title', event.target.value)}
              placeholder="e.g. 2026 Summer Edition"
            />
            <FormControl fullWidth>
              <InputLabel>Registration Status</InputLabel>
              <Select
                value={editionForm.registrationStatus}
                label="Registration Status"
                onChange={(event) => setEditionField('registrationStatus', event.target.value as RegistrationStatus)}
              >
                {REGISTRATION_STATUSES.map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
              </Select>
            </FormControl>
            {editionForm.eventType !== 'Race' && editionForm.eventType !== 'Series' && (
              <Autocomplete
                options={sortedTrails}
                value={sortedTrails.find(trail => trail.id === editionForm.trailId) ?? null}
                onChange={(_, value) => setEditionField('trailId', value?.id ?? '')}
                getOptionLabel={(trail) => `${trail.name} (${(trail.length / 1000).toFixed(1)} km)`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="Linked Trail" />}
              />
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Registration URL"
                value={editionForm.registrationUrl}
                onChange={(event) => setEditionField('registrationUrl', event.target.value)}
                placeholder="https://..."
              />
              <TextField
                label="Results URL"
                value={editionForm.resultsUrl}
                onChange={(event) => setEditionField('resultsUrl', event.target.value)}
                placeholder="https://..."
              />
            </Box>
            <TextField
              label="Notes"
              value={editionForm.notes}
              onChange={(event) => setEditionField('notes', event.target.value)}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditionDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdition} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editEditionId ? 'Update Edition' : 'Create Edition'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showRaceDialog} onClose={() => setShowRaceDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editRaceId ? 'Edit Race' : 'Add Race'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Autocomplete
              options={sortedTrails}
              value={sortedTrails.find(trail => trail.id === raceForm.trailId) ?? null}
              onChange={(_, value) => setRaceField('trailId', value?.id ?? '')}
              getOptionLabel={(trail) => `${trail.name} (${(trail.length / 1000).toFixed(1)} km)`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Linked Trail" />}
            />
            <TextField
              label="Race Name"
              value={raceForm.name}
              onChange={(event) => setRaceField('name', event.target.value)}
              required
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 140px' }, gap: 2 }}>
              <TextField
                label="Distance Label"
                value={raceForm.distanceLabel}
                onChange={(event) => setRaceField('distanceLabel', event.target.value)}
                placeholder="e.g. 55 km"
              />
              <TextField
                label="Cutoff Time"
                value={raceForm.cutoffTime}
                onChange={(event) => setRaceField('cutoffTime', normalizeCutoffTimeInput(event.target.value))}
                onBlur={() => {
                  const normalized = normalizeCutoffTimeOnBlur(raceForm.cutoffTime);
                  if (normalized !== raceForm.cutoffTime) {
                    setRaceField('cutoffTime', normalized);
                  }
                }}
                placeholder="Type 0400 or 04:00"
                helperText="Accepted formats: 0400 or 04:00 (stored as minutes)"
                inputProps={{ inputMode: 'numeric' }}
              />
              <TextField
                label="Sort Order"
                type="number"
                value={raceForm.sortOrder}
                onChange={(event) => setRaceField('sortOrder', event.target.value)}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl>
                <InputLabel>Race Status</InputLabel>
                <Select value={raceForm.status} label="Race Status" onChange={(event) => setRaceField('status', event.target.value as RaceStatus)}>
                  {RACE_STATUSES.map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl>
                <InputLabel>Ticket Status</InputLabel>
                <Select value={raceForm.ticketStatus} label="Ticket Status" onChange={(event) => setRaceField('ticketStatus', event.target.value as TicketStatus)}>
                  {TICKET_STATUSES.map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Max Participants"
                type="number"
                value={raceForm.maxParticipants}
                onChange={(event) => setRaceField('maxParticipants', event.target.value)}
              />
              <TextField
                label="ITRA Points"
                type="number"
                value={raceForm.itraPoints}
                onChange={(event) => setRaceField('itraPoints', event.target.value)}
                inputProps={{ min: 0, max: 6 }}
                placeholder="Empty = not ITRA"
                helperText="0-6 if ITRA certified, empty if not"
              />
              <TextField
                label="Prize Money"
                type="number"
                value={raceForm.prizeMoney}
                onChange={(event) => setRaceField('prizeMoney', event.target.value)}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Certified By"
                value={raceForm.certifiedBy}
                onChange={(event) => setRaceField('certifiedBy', event.target.value)}
              />
              <TextField
                label="Championship Category"
                value={raceForm.championshipCategory}
                onChange={(event) => setRaceField('championshipCategory', event.target.value)}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Date of Race"
                type="date"
                value={raceForm.dateOfRace}
                onChange={(event) => {
                  const d = event.target.value;
                  setRaceField('dateOfRace', d);
                  if (!editRaceId && isPastDate(d)) {
                    setRaceField('status', 'Completed');
                    setRaceField('ticketStatus', 'Closed');
                  }
                }}
                InputLabelProps={{ shrink: true }}
                inputProps={{ lang: 'is' }}
              />
              <TextField
                label="Start Time"
                type="time"
                value={raceForm.startTime}
                onChange={(event) => setRaceField('startTime', event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <TextField
              label="Description"
              value={raceForm.description}
              onChange={(event) => setRaceField('description', event.target.value)}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          {editRaceId && expandedDetail && (
            expandedDetail.type === 'Series'
              ? expandedDetail.editions.find(ed => ed.id === raceForm.eventEditionId)?.races && expandedDetail.editions.find(ed => ed.id === raceForm.eventEditionId)!.races.length > 1
              : expandedDetail.editions.length > 1
          ) ? (
            <FormControlLabel
              control={<Switch checked={applyToAllEditions} onChange={(_, checked) => setApplyToAllEditions(checked)} size="small" />}
              label={<Typography variant="body2">{expandedDetail.type === 'Series' ? 'Apply to other races in edition' : 'Apply to other editions'}</Typography>}
            />
          ) : <Box />}
          <Box>
            <Button onClick={() => { setShowRaceDialog(false); setApplyToAllEditions(false); }}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveRace} disabled={!raceForm.name.trim() || saving}>
              {saving ? <CircularProgress size={20} /> : editRaceId ? 'Update Race' : 'Create Race'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog open={showGenerateDialog} onClose={() => setShowGenerateDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Generate {generateForm.eventType === 'Series' ? 'Season' : 'Editions'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1, mb: 2 }}>
            {generateForm.eventType === 'Series'
              ? `Generate seasons for ${generateForm.eventName}. Each season becomes one edition with individual races. Existing race dates are skipped.`
              : `Generate editions for ${generateForm.eventName} using its schedule rule. Existing dates are skipped.`}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {generateForm.eventType === 'Series' && (
              <FormControl size="small">
                <InputLabel>Season starts in</InputLabel>
                <Select
                  value={generateForm.seasonStartMonth ?? ''}
                  label="Season starts in"
                  onChange={(event) => setGenerateForm(prev => ({ ...prev, seasonStartMonth: event.target.value ? Number(event.target.value) : null }))}
                >
                  {MONTHS_SHORT.slice(1).map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            {generateForm.eventType === 'Series' && (
              <TextField
                label="Season name (optional)"
                size="small"
                placeholder="e.g. Powerade vetrarhlaup"
                value={generateForm.editionName}
                onChange={(event) => setGenerateForm(prev => ({ ...prev, editionName: event.target.value }))}
                helperText="If set, editions are named 'Season name 2025–2026'"
              />
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <FormControl size="small">
                <InputLabel>From month</InputLabel>
                <Select value={generateForm.fromMonth} label="From month" onChange={(event) => setGenerateForm(prev => ({ ...prev, fromMonth: Number(event.target.value) }))}>
                  {MONTHS_SHORT.slice(1).map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                label="Year"
                type="number"
                size="small"
                value={generateForm.fromYear}
                onChange={(event) => setGenerateForm(prev => ({ ...prev, fromYear: Number(event.target.value) }))}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <FormControl size="small">
                <InputLabel>To month</InputLabel>
                <Select value={generateForm.toMonth} label="To month" onChange={(event) => setGenerateForm(prev => ({ ...prev, toMonth: Number(event.target.value) }))}>
                  {MONTHS_SHORT.slice(1).map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                label="Year"
                type="number"
                size="small"
                value={generateForm.toYear}
                onChange={(event) => setGenerateForm(prev => ({ ...prev, toYear: Number(event.target.value) }))}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Defaults (optional)</Typography>
            <Autocomplete
              size="small"
              options={sortedTrails}
              value={sortedTrails.find(trail => trail.id === generateForm.trailId) ?? null}
              onChange={(_, value) => setGenerateForm(prev => ({ ...prev, trailId: value?.id ?? '' }))}
              getOptionLabel={(trail) => `${trail.name} (${(trail.length / 1000).toFixed(1)} km)`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Linked Trail" />}
            />
            <TextField
              label="Registration URL"
              size="small"
              value={generateForm.registrationUrl}
              onChange={(event) => setGenerateForm(prev => ({ ...prev, registrationUrl: event.target.value }))}
              placeholder="https://..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleGenerateEditions} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk date entry dialog */}
      <Dialog open={showBulkDatesDialog} onClose={() => setShowBulkDatesDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set Race Dates</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {bulkDates.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No races in this edition.</Typography>
            ) : bulkDates.map((entry, i) => (
              <Box key={entry.race.id}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.75, display: 'block' }}>
                  {entry.race.name}{entry.race.distanceLabel ? ` · ${entry.race.distanceLabel}` : ''}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 1.5 }}>
                  <TextField
                    label="Date"
                    type="date"
                    size="small"
                    value={entry.dateOfRace}
                    onChange={(e) => setBulkDates(prev => prev.map((d, j) => j === i ? { ...d, dateOfRace: e.target.value } : d))}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ lang: 'is' }}
                  />
                  <TextField
                    label="Start time"
                    type="time"
                    size="small"
                    value={entry.startTime}
                    onChange={(e) => setBulkDates(prev => prev.map((d, j) => j === i ? { ...d, startTime: e.target.value } : d))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBulkDatesDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveBulkDates} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Save Dates'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
