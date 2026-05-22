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
  Clear as ClearIcon,
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
  cutoffMinutes: string;
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
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
  trailId: string;
  registrationUrl: string;
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
  Social: 'default',
  Other: 'default',
};
const ACTIVITY_TYPES: ActivityType[] = ['TrailRunning', 'Running', 'Cycling', 'Hiking', 'FunRun', 'ObstacleCourse', 'Social', 'Other'];
const EVENT_STATUSES: EventStatus[] = ['Unconfirmed', 'Confirmed', 'Cancelled', 'Hidden', 'Unlisted'];
const REGISTRATION_STATUSES: RegistrationStatus[] = ['NotStarted', 'Open', 'Closed'];
const RACE_STATUSES: RaceStatus[] = ['Active', 'Cancelled', 'Hidden'];
const TICKET_STATUSES: TicketStatus[] = ['Available', 'SoldOut'];
const ALERT_SEVERITIES: AlertSeverity[] = ['info', 'success', 'warning', 'error'];

const ACTIVITY_ICONS: Record<string, string> = {
  TrailRunning: '🏃‍♂️',
  Running: '🏃',
  Hiking: '🥾',
  Cycling: '🚴',
  FunRun: '🎊',
  ObstacleCourse: '🧗',
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

  return '—';
}

function formatDateLabel(value: string | null | undefined, fallback = '—'): string {
  return value || fallback;
}

function formatTimeLabel(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '—';
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
  if (status === 'Cancelled') return 'error';
  return 'default';
}

function getTicketStatusColor(status: TicketStatus): 'success' | 'error' {
  return status === 'Available' ? 'success' : 'error';
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
  if (a.date && b.date) return a.date.localeCompare(b.date);
  if (a.date) return -1;
  if (b.date) return 1;
  if (a.year != null && b.year != null) return a.year - b.year;
  if (a.year != null) return -1;
  if (b.year != null) return 1;
  return buildEditionLabel(a).localeCompare(buildEditionLabel(b));
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

function createEmptyEditionForm(eventId = ''): EditionFormState {
  return {
    eventId,
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
    cutoffMinutes: '',
    description: '',
    status: 'Active',
    sortOrder: String(sortOrder),
    ticketStatus: 'Available',
    maxParticipants: '',
    itraPoints: '0',
    certifiedBy: '',
    prizeMoney: '0',
    championshipCategory: '',
    dateOfRace: '',
    startTime: '',
  };
}

function createGenerateForm(event: EventSummaryDto): GenerateFormState {
  const currentYear = new Date().getFullYear();
  return {
    eventId: event.id,
    eventName: event.name,
    fromMonth: 1,
    fromYear: currentYear,
    toMonth: 12,
    toYear: currentYear,
    trailId: '',
    registrationUrl: '',
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
    scheduleMonthEnd: rule?.monthEnd ?? 3,
    scheduleDate: rule?.date ?? '',
    scheduleSeasonalWeek: rule?.type === 'Seasonal' ? (rule.weekOfMonth ?? '') : '',
    socialLinks: event.socialLinks?.map(link => ({ ...link })) ?? [],
  };
}

function buildEditionForm(edition: EventEditionDto): EditionFormState {
  return {
    eventId: edition.eventId,
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
    cutoffMinutes: race.cutoffMinutes?.toString() ?? '',
    description: race.description ?? '',
    status: race.status,
    sortOrder: race.sortOrder.toString(),
    ticketStatus: race.ticketStatus,
    maxParticipants: race.maxParticipants?.toString() ?? '',
    itraPoints: race.itraPoints.toString(),
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

  if (form.scheduleDate) {
    return {
      type: 'Fixed',
      date: form.scheduleDate,
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
  const [generateForm, setGenerateForm] = useState<GenerateFormState>({ eventId: '', eventName: '', fromMonth: 1, fromYear: new Date().getFullYear(), toMonth: 12, toYear: new Date().getFullYear(), trailId: '', registrationUrl: '' });

  const sortedLocations = useMemo(
    () => [...locations].sort((a, b) => a.name.localeCompare(b.name)),
    [locations],
  );
  const sortedTrails = useMemo(
    () => [...trails].sort((a, b) => a.name.localeCompare(b.name)),
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

        if (sortBy === 'nextEditionDate') {
          if (!a.nextEditionDate && !b.nextEditionDate) return 0;
          if (!a.nextEditionDate) return 1;
          if (!b.nextEditionDate) return -1;
          return dir * a.nextEditionDate.localeCompare(b.nextEditionDate);
        }

        if (sortBy === 'editionCount') {
          return dir * ((a.editionCount ?? 0) - (b.editionCount ?? 0));
        }

        if (sortBy === 'activityType' || sortBy === 'type' || sortBy === 'status' || sortBy === 'locationName') {
          const aVal = (a[sortBy] ?? '').toLowerCase();
          const bVal = (b[sortBy] ?? '').toLowerCase();
          return dir * aVal.localeCompare(bVal);
        }

        return dir * a.name.localeCompare(b.name);
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

  const openCreateEdition = (eventId: string) => {
    setEditEditionId(null);
    setEditionForm(createEmptyEditionForm(eventId));
    setShowEditionDialog(true);
  };

  const openEditEdition = (edition: EventEditionDto) => {
    setEditEditionId(edition.id);
    setEditionForm(buildEditionForm(edition));
    setShowEditionDialog(true);
  };

  const openCreateRace = (edition: EventEditionDto) => {
    setEditRaceId(null);
    setRaceForm(createEmptyRaceForm(edition.id, edition.races.length));
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
        trailId: editionForm.trailId || null,
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
        await createEdition(input);
        onNotify(`Edition "${editionLabel}" created`);
      }

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
      const result = await generateEditionsForSeason({
        eventId: generateForm.eventId,
        from,
        to,
        trailId: generateForm.trailId || null,
        registrationUrl: generateForm.registrationUrl.trim() || null,
      });
      const hasDefaults = generateForm.trailId || generateForm.registrationUrl.trim();
      onNotify(result.count > 0
        ? `Generated ${result.count} edition${result.count === 1 ? '' : 's'} for "${generateForm.eventName}"`
        : hasDefaults
          ? `Defaults applied to existing editions for "${generateForm.eventName}"`
          : `No new editions to generate — all dates already exist.`, result.count > 0 || hasDefaults ? 'success' : 'error');
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

    setSaving(true);
    try {
      const input = {
        eventEditionId: raceForm.eventEditionId,
        trailId: raceForm.trailId || null,
        name: raceForm.name.trim(),
        distanceLabel: trimToUndefined(raceForm.distanceLabel),
        cutoffMinutes: raceForm.cutoffMinutes.trim() ? Number(raceForm.cutoffMinutes) : null,
        description: trimToUndefined(raceForm.description),
        status: raceForm.status,
        sortOrder: raceForm.sortOrder.trim() ? Number(raceForm.sortOrder) : 0,
        ticketStatus: raceForm.ticketStatus,
        maxParticipants: raceForm.maxParticipants.trim() ? Number(raceForm.maxParticipants) : null,
        itraPoints: raceForm.itraPoints.trim() ? Number(raceForm.itraPoints) : 0,
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
      } else {
        await createRace(input);
        onNotify(`Race "${raceForm.name.trim()}" created`);
      }

      setShowRaceDialog(false);
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
            {(['Race', 'Series', 'Advertisement', 'Festival', 'Other'] as EventType[]).map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
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
            <IconButton size="small" onClick={resetFilters}>
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
                  <TableCell>
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
                  <TableCell align="right" onClick={clickEvent => clickEvent.stopPropagation()}>
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
                  <TableCell colSpan={9} sx={{ py: 0, borderBottom: expandedEventId === event.id ? undefined : 'none' }}>
                    <Collapse in={expandedEventId === event.id} timeout="auto" unmountOnExit>
                      <Box sx={{ px: 2, py: 2, bgcolor: 'action.hover' }}>
                        {loadingDetail ? (
                          <CircularProgress size={24} />
                        ) : expandedDetail ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
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

                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                {expandedDetail.scheduleRule && (
                                  <Button size="small" variant="outlined" startIcon={<GenerateIcon />} onClick={() => openGenerateEditionDialog(event)}>
                                    Generate Editions
                                  </Button>
                                )}
                                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => openCreateEdition(event.id)}>
                                  Add Edition
                                </Button>
                              </Stack>
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
                                  <Paper key={edition.id} variant="outlined" sx={{ mb: 1.5 }}>
                                    <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexGrow: 1 }}>
                                        <IconButton size="small" onClick={() => toggleEditionExpand(edition.id)}>
                                          {expandedEditionIds.includes(edition.id) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                        </IconButton>
                                        <Box sx={{ flexGrow: 1 }}>
                                          <Typography variant="body2" fontWeight={700}>{buildEditionLabel(edition)}</Typography>
                                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                                            <Chip label={edition.date ?? (edition.year != null ? String(edition.year) : 'Date TBD')} size="small" variant="outlined" />
                                            <Chip label={edition.registrationStatus} size="small" color={getRegistrationStatusColor(edition.registrationStatus)} />
                                            <Chip label={`${edition.races.length} race${edition.races.length === 1 ? '' : 's'}`} size="small" variant="outlined" />
                                            {edition.trailName && <Chip label={`Trail: ${edition.trailName}`} size="small" variant="outlined" />}
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
                                            Races ({edition.races.length})
                                          </Typography>
                                          <Button size="small" startIcon={<AddIcon />} onClick={() => openCreateRace(edition)}>
                                            Add Race
                                          </Button>
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
                                                      {race.cutoffMinutes != null && <Chip label={`${race.cutoffMinutes} min cutoff`} size="small" variant="outlined" color="warning" />}
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
                                                        {race.itraPoints > 0 && (
                                                          <Typography variant="caption" color="text.secondary">{race.itraPoints} ITRA pts</Typography>
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
                <TableCell colSpan={9} align="center">
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
                </Box>
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

      <Dialog open={showEditionDialog} onClose={() => setShowEditionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editEditionId ? 'Edit Edition' : 'Add Edition'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
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
            <Autocomplete
              options={sortedTrails}
              value={sortedTrails.find(trail => trail.id === editionForm.trailId) ?? null}
              onChange={(_, value) => setEditionField('trailId', value?.id ?? '')}
              getOptionLabel={(trail) => `${trail.name} (${(trail.length / 1000).toFixed(1)} km)`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Linked Trail" />}
            />
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
                label="Cutoff Minutes"
                type="number"
                value={raceForm.cutoffMinutes}
                onChange={(event) => setRaceField('cutoffMinutes', event.target.value)}
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
                onChange={(event) => setRaceField('dateOfRace', event.target.value)}
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
        <DialogActions>
          <Button onClick={() => setShowRaceDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveRace} disabled={!raceForm.name.trim() || saving}>
            {saving ? <CircularProgress size={20} /> : editRaceId ? 'Update Race' : 'Create Race'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showGenerateDialog} onClose={() => setShowGenerateDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Generate Editions</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1, mb: 2 }}>
            Generate editions for {generateForm.eventName} using its schedule rule. Existing dates are skipped.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
    </Box>
  );
}
