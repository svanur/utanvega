import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  Link,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Popover,
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
import AddIcon from '@mui/icons-material/Add';
import GenerateIcon from '@mui/icons-material/AutoAwesome';
import BulkAddIcon from '@mui/icons-material/PlaylistAdd';
import CalendarIcon from '@mui/icons-material/CalendarMonth';
import ClearIcon from '@mui/icons-material/Clear';
import DragHandleIcon from '@mui/icons-material/DragIndicator';
import CopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrophyIcon from '@mui/icons-material/EmojiEvents';
import LinkIcon from '@mui/icons-material/Link';
import MapIcon from '@mui/icons-material/Map';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import NotesIcon from '@mui/icons-material/Notes';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import TranslateIcon from '@mui/icons-material/Translate';
import FlagIcon from '@mui/icons-material/Flag';
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
  type ResultType,
  type RegistrationStatus,
  type ScheduleRule,
  type ScheduleType,
  type SocialLink,
  type TicketStatus,
} from '../hooks/useEvents';
import { useLocations } from '../hooks/useLocations';
import { useOrganizers } from '../hooks/useOrganizers';
import { useTrails, type Trail } from '../hooks/useTrails';
import { formatMinutesToHHmm, parseHHmmToMinutes, normalizeCutoffTimeInput, normalizeCutoffTimeOnBlur } from '../utils/cutoffTime';
import { trimToUndefined, parseCoordPaste } from '../utils/strings';
import { hashText } from '../utils/translationHash';
import BilingualTextField from '../components/BilingualTextField';
import { useTranslate } from '../hooks/useTranslate';
import GpxMapPicker from '../components/GpxMapPicker';

interface EventListProps {
  onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
  initialEventId?: string | null;
  onEventIdConsumed?: () => void;
  initialCreate?: boolean;
  onInitialCreateConsumed?: () => void;
  onNavigateToRaceManager?: (date: string) => void;
  onViewEventDetail?: (slug: string) => void;
}

interface EventFormState {
  name: string;
  nameEn: string;
  slug: string;
  description: string;
  descriptionEn: string;
  type: EventType;
  activityType: ActivityType;
  status: EventStatus;
  organizerName: string;
  organizerNameEn: string;
  organizerWebsite: string;
  organizerId: string;
  alertMessage: string;
  alertMessageEn: string;
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
  gpxPointLat: string;
  gpxPointLng: string;
  translationHashes?: Record<string, string>;
  _initialNameEn?: string;
  _initialDescriptionEn?: string;
  _initialOrganizerNameEn?: string;
  _initialAlertMessageEn?: string;
}

interface EditionFormState {
  eventId: string;
  eventType: EventType;
  eventName: string;
  year: string;
  date: string;
  endDate: string;
  title: string;
  titleEn: string;
  registrationUrl: string;
  resultsUrl: string;
  notes: string;
  notesEn: string;
  registrationStatus: RegistrationStatus;
  trailId: string;
  translationHashes?: Record<string, string>;
  _initialTitleEn?: string;
  _initialNotesEn?: string;
  _originalDate?: string;
}

interface RaceFormState {
  eventEditionId: string;
  trailId: string;
  activityType: ActivityType | '';
  name: string;
  nameEn: string;
  distanceLabel: string;
  distanceLabelEn: string;
  cutoffTime: string;
  description: string;
  descriptionEn: string;
  status: RaceStatus;
  sortOrder: string;
  ticketStatus: TicketStatus;
  resultType: ResultType;
  maxParticipants: string;
  itraPoints: string;
  certifiedBy: string;
  certifiedByEn: string;
  prizeMoney: string;
  championshipCategory: string;
  championshipCategoryEn: string;
  dateOfRace: string;
  startTime: string;
  translationHashes?: Record<string, string>;
  _initialNameEn?: string;
  _initialDescriptionEn?: string;
  _initialCertifiedByEn?: string;
  _initialChampionshipCategoryEn?: string;
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
const EVENT_TYPES: EventType[] = ['Race', 'Series', 'Social', 'Advertisement', 'Festival', 'Other'];
const EVENT_TYPE_COLORS: Record<EventType, 'primary' | 'secondary' | 'warning' | 'success' | 'default' | 'info' | 'error'> = {
  Race: 'primary',
  Series: 'secondary',
  Social: 'success',
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
  Swim: 'info',
  Canicross: 'secondary',
  IronMan: 'primary',
  Other: 'default',
};
const ACTIVITY_TYPES: ActivityType[] = ['TrailRunning', 'Running', 'Cycling', 'Hiking', 'FunRun', 'ObstacleCourse', 'CrossCountryRun', 'Swim', 'Canicross', 'IronMan', 'Other'];
const EVENT_STATUSES: EventStatus[] = ['Unconfirmed', 'Confirmed', 'Cancelled', 'Hidden', 'Unlisted'];
const REGISTRATION_STATUSES: RegistrationStatus[] = ['NotStarted', 'Open', 'Closed'];
const RACE_STATUSES: RaceStatus[] = ['Active', 'Completed', 'Cancelled', 'Hidden'];
const TICKET_STATUSES: TicketStatus[] = ['Free', 'NotStarted', 'Available', 'AlmostSoldOut', 'SoldOut', 'Closed'];
const ALERT_SEVERITIES: AlertSeverity[] = ['info', 'success', 'warning', 'error'];

const EDITION_BORDER_COLORS = [
  '#1976d2', // blue
  '#9c27b0', // purple
  '#e65100', // deep orange
  '#00796b', // teal
  '#c62828', // red
  '#558b2f', // green
  '#f57f17', // amber
  '#0277bd', // light blue
  '#6a1b9a', // deep purple
  '#2e7d32', // dark green
];

const ACTIVITY_ICONS: Record<string, string> = {
  TrailRunning: '🏃‍♂️',
  Running: '🏃',
  Hiking: '🥾',
  Cycling: '🚴',
  FunRun: '🎊',
  ObstacleCourse: '🧗',
  CrossCountryRun: '🌾',
  Swim: '🏊',
  Canicross: '🐕',
  IronMan: '🥇',
  Other: '🏅',
};

function ordinal(value: number): string {
  if (value === 1) return 'st';
  if (value === 2) return 'nd';
  if (value === 3) return 'rd';
  return 'th';
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
  return `${d}. ${months[(m ?? 1) - 1]} ${y}`;
}

function formatSchedule(rule: ScheduleRule | null): string {
  if (!rule) return '—';
  if (rule.type === 'Fixed') return fmtDate(rule.date) || '—';

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

const DAY_OF_WEEK_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

function nthWeekdayOfMonth(year: number, month: number, weekOfMonth: number, dayOfWeek: string): string {
  const dayIdx = DAY_OF_WEEK_INDEX[dayOfWeek] ?? 0;
  const firstOfMonth = dayjs(new Date(year, month - 1, 1));
  // dayjs.day(n) where n >= 7 advances to the same weekday in the following week,
  // so +7 is used when the first of the month is already past the target weekday.
  const firstOccurrence = firstOfMonth.day() <= dayIdx
    ? firstOfMonth.day(dayIdx)
    : firstOfMonth.day(dayIdx + 7);
  return firstOccurrence.add((weekOfMonth - 1) * 7, 'day').format('YYYY-MM-DD');
}

function suggestSeriesLegDates(rule: ScheduleRule, year: number, legCount: number): string[] {
  if (!rule.weekOfMonth || !rule.dayOfWeek || !rule.monthStart) return [];
  const dates: string[] = [];
  for (let i = 0; i < legCount; i++) {
    const month = rule.monthStart + i;
    const actualYear = month > 12 ? year + 1 : year;
    const actualMonth = month > 12 ? month - 12 : month;
    dates.push(nthWeekdayOfMonth(actualYear, actualMonth, rule.weekOfMonth, rule.dayOfWeek));
  }
  return dates;
}

function bumpYearInUrl(url: string, fromYear: number | null | undefined, toYear: number): string {
  if (!url || !fromYear) return '';
  return url.split(String(fromYear)).join(String(toYear));
}

function isPastDate(dateStr: string): boolean {
  if (!dateStr) return false;
  return dateStr < new Date().toISOString().slice(0, 10);
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

function buildEditionLabel(edition: Pick<EventEditionDto, 'title' | 'year' | 'date' | 'endDate'>): string {
  if (edition.title?.trim()) return edition.title;
  if (edition.date) return edition.endDate ? `${edition.date} – ${edition.endDate}` : edition.date;
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

function suggestEditionDateForYear(prevDateStr: string | null | undefined, toYear: number): string {
  if (!prevDateStr) return '';
  const prev = new Date(prevDateStr + 'T00:00:00');
  const candidate = new Date(prev);
  candidate.setFullYear(toYear);
  // Snap to the same day of the week as the source edition
  const diff = prev.getDay() - candidate.getDay();
  candidate.setDate(candidate.getDate() + (Math.abs(diff) <= 3 ? diff : diff > 0 ? diff - 7 : diff + 7));
  return candidate.toISOString().slice(0, 10);
}

function suggestEditionEndDateForYear(
  prevStartStr: string | null | undefined,
  prevEndStr: string | null | undefined,
  newStartStr: string,
): string {
  if (!prevStartStr || !prevEndStr || !newStartStr) return '';
  const srcStart = new Date(prevStartStr + 'T00:00:00');
  const srcEnd = new Date(prevEndStr + 'T00:00:00');
  const durationDays = Math.round((srcEnd.getTime() - srcStart.getTime()) / (1000 * 60 * 60 * 24));
  if (durationDays <= 0) return '';
  const newStart = new Date(newStartStr + 'T00:00:00');
  newStart.setDate(newStart.getDate() + durationDays);
  return newStart.toISOString().slice(0, 10);
}

function computeClonedRaceDate(
  sourceEditionDate: string | null | undefined,
  raceDateOfRace: string | null | undefined,
  newEditionDate: string | null | undefined,
): string | null {
  if (!sourceEditionDate || !raceDateOfRace || !newEditionDate) return null;
  const srcEd = new Date(sourceEditionDate + 'T00:00:00');
  const srcRace = new Date(raceDateOfRace + 'T00:00:00');
  const offsetDays = Math.round((srcRace.getTime() - srcEd.getTime()) / (1000 * 60 * 60 * 24));
  const newDate = new Date(newEditionDate + 'T00:00:00');
  newDate.setDate(newDate.getDate() + offsetDays);
  return newDate.toISOString().slice(0, 10);
}

function sortRaces(a: RaceDto, b: RaceDto): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
}

function isTxStale(isText: string | null | undefined, enText: string | null | undefined, hash: string | undefined): boolean {
  if (!isText?.trim() || !enText?.trim() || !hash) return false;
  return hashText(isText.trim()) !== hash;
}

function eventHasStaleTx(event: EventSummaryDto): boolean {
  const h = event.translationHashes ?? {};
  return isTxStale(event.name, event.nameEn, h['Name'])
    || isTxStale(event.description, event.descriptionEn, h['Description'])
    || isTxStale(event.organizerName, event.organizerNameEn, h['Organizer'])
    || isTxStale(event.alertMessage, event.alertMessageEn, h['Alert']);
}

function editionHasStaleTx(edition: EventEditionDto): boolean {
  const h = edition.translationHashes ?? {};
  return isTxStale(edition.title, edition.titleEn, h['Title'])
    || isTxStale(edition.notes, edition.notesEn, h['Notes']);
}

function raceHasStaleTx(race: RaceDto): boolean {
  const h = race.translationHashes ?? {};
  return isTxStale(race.name, race.nameEn, h['Name'])
    || isTxStale(race.description, race.descriptionEn, h['Description'])
    || isTxStale(race.certifiedBy, race.certifiedByEn, h['CertifiedBy'])
    || isTxStale(race.championshipCategory, race.championshipCategoryEn, h['Championship']);
}

const STALE_TX_CHIP_SX = { height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.75 } } as const;

function createEmptyEventForm(): EventFormState {
  return {
    name: '',
    nameEn: '',
    slug: '',
    description: '',
    descriptionEn: '',
    type: 'Race',
    activityType: 'TrailRunning',
    status: 'Unconfirmed',
    organizerName: '',
    organizerNameEn: '',
    organizerWebsite: '',
    organizerId: '',
    alertMessage: '',
    alertMessageEn: '',
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
    gpxPointLat: '',
    gpxPointLng: '',
  };
}

function createEmptyEditionForm(eventId = '', eventType: EventType = 'Race', eventName = ''): EditionFormState {
  return {
    eventId,
    eventType,
    eventName,
    year: new Date().getFullYear().toString(),
    date: '',
    endDate: '',
    title: '',
    titleEn: '',
    registrationUrl: '',
    resultsUrl: '',
    notes: '',
    notesEn: '',
    registrationStatus: 'NotStarted',
    trailId: '',
  };
}

function createEmptyRaceForm(eventEditionId = '', sortOrder = 0): RaceFormState {
  return {
    eventEditionId,
    trailId: '',
    activityType: '',
    name: '',
    nameEn: '',
    distanceLabel: '',
    distanceLabelEn: '',
    cutoffTime: '',
    description: '',
    descriptionEn: '',
    status: 'Active',
    sortOrder: String(sortOrder),
    ticketStatus: 'Available',
    resultType: 'Time',
    maxParticipants: '',
    itraPoints: '',
    certifiedBy: '',
    certifiedByEn: '',
    prizeMoney: '0',
    championshipCategory: '',
    championshipCategoryEn: '',
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
    nameEn: event.nameEn ?? '',
    slug: event.slug,
    description: event.description ?? '',
    descriptionEn: event.descriptionEn ?? '',
    type: event.type,
    activityType: event.activityType,
    status: event.status,
    organizerName: event.organizerName ?? '',
    organizerNameEn: event.organizerNameEn ?? '',
    organizerWebsite: event.organizerWebsite ?? '',
    organizerId: event.organizerId ?? '',
    alertMessage: event.alertMessage ?? '',
    alertMessageEn: event.alertMessageEn ?? '',
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
    gpxPointLat: event.gpxPointLat != null ? String(event.gpxPointLat) : '',
    gpxPointLng: event.gpxPointLng != null ? String(event.gpxPointLng) : '',
    translationHashes: event.translationHashes,
    _initialNameEn: event.nameEn ?? '',
    _initialDescriptionEn: event.descriptionEn ?? '',
    _initialOrganizerNameEn: event.organizerNameEn ?? '',
    _initialAlertMessageEn: event.alertMessageEn ?? '',
  };
}

function buildEditionForm(edition: EventEditionDto, eventType: EventType = 'Race', eventName = ''): EditionFormState {
  return {
    eventId: edition.eventId,
    eventType,
    eventName,
    year: edition.year?.toString() ?? '',
    date: edition.date ?? '',
    endDate: edition.endDate ?? '',
    title: edition.title ?? '',
    titleEn: edition.titleEn ?? '',
    registrationUrl: edition.registrationUrl ?? '',
    resultsUrl: edition.resultsUrl ?? '',
    notes: edition.notes ?? '',
    notesEn: edition.notesEn ?? '',
    registrationStatus: edition.registrationStatus,
    trailId: edition.trailId ?? '',
    translationHashes: edition.translationHashes,
    _initialTitleEn: edition.titleEn ?? '',
    _initialNotesEn: edition.notesEn ?? '',
    _originalDate: edition.date ?? '',
  };
}

function buildRaceForm(race: RaceDto): RaceFormState {
  return {
    eventEditionId: race.eventEditionId,
    trailId: race.trailId ?? '',
    activityType: (race.activityType as ActivityType) ?? '',
    name: race.name,
    nameEn: race.nameEn ?? '',
    distanceLabel: race.distanceLabel ?? '',
    distanceLabelEn: race.distanceLabelEn ?? '',
    cutoffTime: formatMinutesToHHmm(race.cutoffMinutes) ?? '',
    description: race.description ?? '',
    descriptionEn: race.descriptionEn ?? '',
    status: race.status,
    sortOrder: race.sortOrder.toString(),
    ticketStatus: race.ticketStatus,
    resultType: race.resultType,
    maxParticipants: race.maxParticipants?.toString() ?? '',
    itraPoints: race.itraPoints?.toString() ?? '',
    certifiedBy: race.certifiedBy ?? '',
    certifiedByEn: race.certifiedByEn ?? '',
    prizeMoney: race.prizeMoney.toString(),
    championshipCategory: race.championshipCategory ?? '',
    championshipCategoryEn: race.championshipCategoryEn ?? '',
    dateOfRace: race.dateOfRace ?? '',
    startTime: race.startTime ? race.startTime.slice(0, 5) : '',
    translationHashes: race.translationHashes,
    _initialNameEn: race.nameEn ?? '',
    _initialDescriptionEn: race.descriptionEn ?? '',
    _initialCertifiedByEn: race.certifiedByEn ?? '',
    _initialChampionshipCategoryEn: race.championshipCategoryEn ?? '',
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

interface SortableRaceItemProps {
  race: import('../hooks/useEvents').RaceDto;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCycleTicketStatus: () => void;
  onCycleRaceStatus: () => void;
  onCopyDate: (date: string) => void;
  editionDate: string | null;
  siblingDates: string[];
  ticketLoading: boolean;
  raceStatusLoading: boolean;
  staleTx: boolean;
  getIcon: (trailId: string | null) => string;
  formatDateLabel: (d: string | null | undefined, fallback: string) => string;
  formatTimeLabel: (t: string | null | undefined) => string;
}

function SortableRaceItem({ race, onEdit, onDuplicate, onDelete, onCycleTicketStatus, onCycleRaceStatus, onCopyDate, editionDate, siblingDates, ticketLoading, raceStatusLoading, staleTx, getIcon, formatDateLabel, formatTimeLabel }: SortableRaceItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: race.id });
  const [copyDateAnchor, setCopyDateAnchor] = useState<HTMLElement | null>(null);

  return (
    <ListItem
      ref={setNodeRef}
      sx={{
        px: 1.5, py: 1.25,
        border: '1px solid', borderColor: 'divider', borderRadius: 1,
        alignItems: 'flex-start',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        bgcolor: isDragging ? 'action.hover' : 'background.paper',
      }}
      secondaryAction={(
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title="Duplicate race">
            <IconButton size="small" onClick={onDuplicate}><CopyIcon fontSize="small" /></IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>
        </Box>
      )}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, cursor: 'grab', color: 'text.disabled', touchAction: 'none' }} {...attributes} {...listeners}>
        <DragHandleIcon fontSize="small" />
      </Box>
      <ListItemText
        sx={{ pr: 10 }}
        primary={(
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ alignItems: 'center' }}>
            <Typography variant="body2" fontWeight={700}>{race.name}</Typography>
            {staleTx && (
              <Tooltip title="Race translation (name/description) may be outdated">
                <Chip label="EN" size="small" color="warning" variant="filled" sx={STALE_TX_CHIP_SX} />
              </Tooltip>
            )}
            {race.distanceLabel && <Chip label={race.distanceLabel} size="small" variant="outlined" />}
            {race.activityType && <Chip label={`${ACTIVITY_ICONS[race.activityType] ?? '🏅'} ${race.activityType}`} size="small" variant="outlined" color={ACTIVITY_TYPE_COLORS[race.activityType] ?? 'default'} />}
            <Tooltip title={raceStatusLoading ? 'Updating…' : 'Click to cycle race status'}>
              <Chip label={race.status} size="small" color={getRaceStatusColor(race.status)} onClick={raceStatusLoading ? undefined : onCycleRaceStatus} disabled={raceStatusLoading} sx={{ cursor: raceStatusLoading ? 'default' : 'pointer' }} />
            </Tooltip>
            <Tooltip title={ticketLoading ? 'Updating…' : 'Click to cycle ticket status'}>
              <Chip label={race.ticketStatus} size="small" color={getTicketStatusColor(race.ticketStatus)} variant="outlined" onClick={ticketLoading ? undefined : onCycleTicketStatus} disabled={ticketLoading} sx={{ cursor: ticketLoading ? 'default' : 'pointer' }} />
            </Tooltip>
            {race.cutoffMinutes != null && (
              <Chip label={`Time limit: ${formatMinutesToHHmm(race.cutoffMinutes) ?? `${race.cutoffMinutes} min`}`} size="small" variant="outlined" color="warning" />
            )}
            <Chip
              size="small"
              variant={race.dateOfRace ? 'outlined' : 'filled'}
              color={race.dateOfRace ? 'default' : 'warning'}
              label={race.dateOfRace
                ? `${formatDateLabel(race.dateOfRace, '')}${race.startTime ? ` • ${formatTimeLabel(race.startTime)}` : ''}`
                : 'Date missing'}
            />
            {!race.dateOfRace && (() => {
              const sources: { date: string; label: string }[] = [
                ...(editionDate ? [{ date: editionDate, label: `Parent: ${formatDateLabel(editionDate, editionDate)}` }] : []),
                ...siblingDates.filter(d => d !== editionDate).map(d => ({ date: d, label: `Sibling: ${formatDateLabel(d, d)}` })),
              ];
              if (sources.length === 0) return null;
              const onlyParent = sources.length === 1 && sources[0].date === editionDate;
              const onlySibling = sources.length === 1 && sources[0].date !== editionDate;
              const tooltipText = onlyParent
                ? `Copy date from parent (${formatDateLabel(editionDate!, editionDate!)})`
                : onlySibling
                  ? `Copy date from sibling (${formatDateLabel(siblingDates[0], siblingDates[0])})`
                  : 'Copy date from parent / sibling';
              return (
                <>
                  <Tooltip title={tooltipText}>
                    <Chip
                      size="small"
                      variant="outlined"
                      color="info"
                      label={onlyParent ? 'Copy date from parent' : onlySibling ? 'Copy date from sibling' : 'Copy date'}
                      onClick={sources.length === 1
                        ? () => onCopyDate(sources[0].date)
                        : (e) => setCopyDateAnchor(e.currentTarget)}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Tooltip>
                  <Menu anchorEl={copyDateAnchor} open={Boolean(copyDateAnchor)} onClose={() => setCopyDateAnchor(null)}>
                    {sources.map(s => (
                      <MenuItem key={s.date} onClick={() => { onCopyDate(s.date); setCopyDateAnchor(null); }}>
                        {s.label}
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              );
            })()}
            <Chip
              size="small"
              variant={race.trailId ? 'outlined' : 'filled'}
              color={race.trailId ? 'default' : 'warning'}
              label={race.trailName ?? 'No trail linked'}
            />
          </Stack>
        )}
        secondary={(
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.75 }}>
            {race.description && <Typography variant="body2" color="text.secondary">{race.description}</Typography>}
            <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
              {race.trailName && (
                <Typography variant="caption" color="primary">
                  {getIcon(race.trailId)} {race.trailName}
                  {race.trailDistanceMeters != null && ` • ${(race.trailDistanceMeters / 1000).toFixed(1)} km`}
                  {race.trailElevationGain != null && ` • ↑${Math.round(race.trailElevationGain)} m`}
                </Typography>
              )}
              {race.maxParticipants != null && <Typography variant="caption" color="text.secondary">Max {race.maxParticipants} participants</Typography>}
              {race.itraPoints != null && (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <img src={`/images/itra-${race.itraPoints}.png`} alt={`ITRA ${race.itraPoints}`} style={{ height: 20 }} />
                  <Typography variant="caption" color="text.secondary">{race.itraPoints} ITRA pts</Typography>
                </Box>
              )}
              {race.certifiedBy && <Typography variant="caption" color="text.secondary">Certified by {race.certifiedBy}</Typography>}
              {race.prizeMoney > 0 && <Typography variant="caption" color="text.secondary">Prize {race.prizeMoney}</Typography>}
              {race.championshipCategory && <Typography variant="caption" color="text.secondary">{race.championshipCategory}</Typography>}
            </Stack>
          </Box>
        )}
        secondaryTypographyProps={{ component: 'div' }}
      />
    </ListItem>
  );
}

// ── GPX map picker ──────────────────────────────────────────────────────────

// ── Trail start-point picker ─────────────────────────────────────────────────

interface TrailPickerProps {
  trailsWithCoords: Trail[];
  onPick: (lat: number, lng: number) => void;
}

function TrailStartPicker({ trailsWithCoords, onPick }: TrailPickerProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (trailsWithCoords.length === 0) return null;
  return (
    <>
      <Tooltip title="Copy start point from a trail linked to this event">
        <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
          <MyLocationIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {trailsWithCoords.map(trail => (
          <MenuItem
            key={trail.id}
            onClick={() => {
              onPick(trail.startLatitude!, trail.startLongitude!);
              setAnchor(null);
            }}
          >
            {trail.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

const PUBLIC_SITE_URL = ((import.meta.env.VITE_PUBLIC_SITE_URL ?? '') as string).replace(/\/$/, '');

export default function EventList({ onNotify, initialEventId, onEventIdConsumed, initialCreate, onInitialCreateConsumed, onNavigateToRaceManager, onViewEventDetail }: EventListProps) {
  const {
    events,
    loading,
    error,
    refresh: refreshEvents,
    createEvent,
    updateEvent,
    updateEventSilently,
    patchEventLocally,
    deleteEvent,
    getEvent,
    createEdition,
    updateEdition,
    updateEditionSilently,
    deleteEdition,
    generateEditionsForSeason,
    createRace,
    updateRace,
    deleteRace,
  } = useEvents();
  const { locations } = useLocations();
  const { organizers } = useOrganizers();
  const { trails } = useTrails();

  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showEditionDialog, setShowEditionDialog] = useState(false);
  const [showRaceDialog, setShowRaceDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editEditionId, setEditEditionId] = useState<string | null>(null);
  const [editRaceId, setEditRaceId] = useState<string | null>(null);
  const [raceDialogEdition, setRaceDialogEdition] = useState<EventEditionDto | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const deepLinkScrollTarget = useRef<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<EventDetailDto | null>(null);
  const [expandedEditionIds, setExpandedEditionIds] = useState<string[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));
  const [sortBy, setSortBy] = useState<'name' | 'activityType' | 'type' | 'nextEditionDate' | 'status' | 'editionCount' | 'locationName' | 'updatedAt'>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [eventForm, setEventForm] = useState<EventFormState>(createEmptyEventForm());
  const [editionForm, setEditionForm] = useState<EditionFormState>(createEmptyEditionForm());
  const [raceForm, setRaceForm] = useState<RaceFormState>(createEmptyRaceForm());
  const [applyToAllEditions, setApplyToAllEditions] = useState(false);
  const [cloneFromEditionId, setCloneFromEditionId] = useState<string>('');
  const [localRaceOrder, setLocalRaceOrder] = useState<Map<string, string[]>>(new Map());
  const [prefillRaces, setPrefillRaces] = useState<RaceDto[]>([]);
  const [showBulkDatesDialog, setShowBulkDatesDialog] = useState(false);
  const [bulkDatesEditionDate, setBulkDatesEditionDate] = useState<string>('');
  const [bulkDatesIsSeries, setBulkDatesIsSeries] = useState(false);
  const [bulkDatesScheduleRule, setBulkDatesScheduleRule] = useState<ScheduleRule | null>(null);
  const [bulkDatesEditionYear, setBulkDatesEditionYear] = useState<number | null>(null);
  const [pendingDateShift, setPendingDateShift] = useState<{ offsetDays: number; races: RaceDto[] } | null>(null);
  const [showOlderEditions, setShowOlderEditions] = useState(false);
  const visibleEditions = useMemo(() => {
    if (!expandedDetail) return null;
    const currentYear = new Date().getFullYear();
    const sorted = [...expandedDetail.editions].sort(sortEditions);
    const older = sorted.filter(ed => (ed.year ?? 0) < currentYear && (!(ed.endDate ?? ed.date) || isPastDate(ed.endDate ?? ed.date ?? '')));
    const visible = showOlderEditions ? sorted : sorted.filter(ed => !older.includes(ed));
    return { visible, hiddenCount: older.length };
  }, [expandedDetail, showOlderEditions]);
  const [showAttentionPanel, setShowAttentionPanel] = useState(true);
  const [attentionFilter, setAttentionFilter] = useState<'noEdition' | 'seriesMissingReg' | 'pastActive' | null>(null);
  const [urlPopover, setUrlPopover] = useState<{
    anchorEl: HTMLElement;
    edition: EventEditionDto;
    regUrl: string;
    resultsUrl: string;
  } | null>(null);
  const [notesPopover, setNotesPopover] = useState<{
    anchorEl: HTMLElement;
    edition: EventEditionDto;
    notes: string;
    notesEn: string;
  } | null>(null);
  const [cyclingTicketIds, setCyclingTicketIds] = useState<Set<string>>(new Set());
  const [cyclingRaceStatusIds, setCyclingRaceStatusIds] = useState<Set<string>>(new Set());
  const [copyingDateIds, setCopyingDateIds] = useState<Set<string>>(new Set());
  const [cyclingRegIds, setCyclingRegIds] = useState<Set<string>>(new Set());
  const [cyclingStatusIds, setCyclingStatusIds] = useState<Set<string>>(new Set());
  const [copyRacesConfirm, setCopyRacesConfirm] = useState<{ edition: EventEditionDto; source: EventEditionDto } | null>(null);
  const [showBulkMissingDialog, setShowBulkMissingDialog] = useState(false);
  const [bulkMissingLoading, setBulkMissingLoading] = useState(false);
  const [bulkMissingProgress, setBulkMissingProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkMissingItems, setBulkMissingItems] = useState<BulkMissingItem[]>([]);
  const [bulkDates, setBulkDates] = useState<Array<{ race: RaceDto; dateOfRace: string; startTime: string; prevDateOfRace?: string }>>([]);
  const [generateForm, setGenerateForm] = useState<GenerateFormState>({ eventId: '', eventName: '', eventType: 'Race', fromMonth: 1, fromYear: new Date().getFullYear(), toMonth: 12, toYear: new Date().getFullYear(), trailId: '', registrationUrl: '', seasonStartMonth: null, editionName: '' });

  const sortedLocations = useMemo(
    () => [...locations].sort((a, b) => a.name.localeCompare(b.name)),
    [locations],
  );

  // Trails linked to editions of the currently-edited event that have a start point
  const linkedTrailsWithCoords = useMemo((): Trail[] => {
    if (!expandedDetail || expandedDetail.id !== editEventId) return [];
    const trailIds = new Set(
      expandedDetail.editions.flatMap(ed => ed.races.map(r => r.trailId).filter(Boolean))
    );
    return trails.filter(t => trailIds.has(t.id) && t.startLatitude != null && t.startLongitude != null);
  }, [expandedDetail, editEventId, trails]);
  const sortedTrails = useMemo(
    () => [...trails].filter(t => t.status === 'Published' || t.status === 'EventOnly').sort((a, b) => a.name.localeCompare(b.name)),
    [trails],
  );

  const eventLocationOptions = useMemo(
    () => [...new Set(events.map(e => e.locationName).filter(Boolean) as string[])].sort(),
    [events],
  );

  const yearOptions = useMemo(() => {
    const years = events
      .map(e => e.nextEditionDate?.slice(0, 4))
      .filter((y): y is string => !!y);
    return [...new Set(years)].sort((a, b) => b.localeCompare(a));
  }, [events]);

  const hasActiveFilters = attentionFilter !== null || activityFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all' || locationFilter !== 'all' || yearFilter !== 'all' || monthFilter !== 'all';
  const resetFilters = () => {
    setActivityFilter('all'); setTypeFilter('all'); setStatusFilter('all'); setLocationFilter('all');
    setYearFilter('all'); setMonthFilter('all'); setAttentionFilter(null);
  };

  // Deep-link: expand and scroll to the target event once events are loaded
  useEffect(() => {
    if (!initialEventId || loading || events.length === 0) return;
    const target = events.find(e => e.id === initialEventId);
    if (!target) return;
    deepLinkScrollTarget.current = target.id;
    loadExpandedEvent(target.id, target.slug);
    onEventIdConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount after events load
  }, [initialEventId, loading]);

  useEffect(() => {
    if (!initialCreate || loading) return;
    openCreateEvent();
    onInitialCreateConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount after events load
  }, [initialCreate, loading]);

  // Scroll to the deep-linked row after it has actually rendered (expandedEventId is set)
  useEffect(() => {
    if (!expandedEventId || expandedEventId !== deepLinkScrollTarget.current) return;
    deepLinkScrollTarget.current = null;
    requestAnimationFrame(() => {
      document.getElementById(`event-row-${expandedEventId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [expandedEventId]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const in30daysStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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

        if (yearFilter !== 'all') {
          if (!event.hasFutureEdition) return true; // always show events missing a future edition regardless of year filter
          if (!event.nextEditionDate || event.nextEditionDate.slice(0, 4) !== yearFilter) return false;
        }
        if (monthFilter !== 'all') {
          if (!event.hasFutureEdition) return true;
          if (!event.nextEditionDate || event.nextEditionDate.slice(5, 7) !== monthFilter) return false;
        }

        if (attentionFilter === 'noEdition') {
          if (!(!event.hasFutureEdition && (event.type === 'Race' || event.type === 'Series') && event.status !== 'Cancelled')) return false;
        }
        if (attentionFilter === 'seriesMissingReg') {
          if (!(event.type === 'Series' && event.nextEditionDate && event.nextEditionDate <= in30daysStr && event.seriesRaces?.some(r => !r.registrationUrl))) return false;
        }
        if (attentionFilter === 'pastActive') {
          if (!(event.status === 'Confirmed' && event.nextEditionDate && event.nextEditionDate < todayStr)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        let cmp = 0;

        if (sortBy === 'updatedAt') {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          cmp = aTime - bTime;
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
  }, [events, searchQuery, sortBy, sortDir, activityFilter, typeFilter, statusFilter, locationFilter, yearFilter, monthFilter, attentionFilter]);

  
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

  const loadExpandedEvent = async (eventId: string, slug: string, resetOlderEditions = true) => {
    setLoadingDetail(true);
    try {
      const detail = await getEvent(slug);
      setExpandedEventId(eventId);
      setExpandedDetail(detail);
      if (resetOlderEditions) setShowOlderEditions(false);
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
    await loadExpandedEvent(expandedEventId, slug, false);
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
    const clonedRegUrl = bumpYearInUrl(defaultClone?.registrationUrl ?? '', defaultClone?.year, Number(nextYear)) || (defaultClone?.registrationUrl ?? '');
    const clonedResultsUrl = bumpYearInUrl(defaultClone?.resultsUrl ?? '', defaultClone?.year, Number(nextYear)) || (defaultClone?.resultsUrl ?? '');
    const suggestedDate = suggestEditionDateForYear(defaultClone?.date, Number(nextYear));
    const suggestedEndDate = suggestEditionEndDateForYear(defaultClone?.date, defaultClone?.endDate, suggestedDate);
    const isPastYear = suggestedDate ? isPastDate(suggestedDate) : Number(nextYear) < new Date().getFullYear();
    setCloneFromEditionId(defaultClone?.id ?? '');
    setEditionForm({
      ...createEmptyEditionForm(event.id, event.type, event.name),
      year: nextYear,
      date: suggestedDate,
      endDate: suggestedEndDate,
      title: nextYear,
      registrationUrl: clonedRegUrl,
      resultsUrl: clonedResultsUrl,
      registrationStatus: isPastYear ? 'Closed' : 'NotStarted',
      trailId: defaultClone?.trailId ?? '',
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
    setRaceDialogEdition(edition);
    const past = isPastDate(edition.endDate ?? edition.date ?? '');
    setRaceForm({
      ...createEmptyRaceForm(edition.id, edition.races.length),
      status: past ? 'Completed' : 'Active',
      ticketStatus: past ? 'Closed' : 'Available',
    });
    setPrefillRaces([...edition.races].sort(sortRaces));
    setShowRaceDialog(true);
  };

  const openEditRace = (race: RaceDto) => {
    setEditRaceId(race.id);
    setRaceDialogEdition(expandedDetail?.editions.find(ed => ed.races.some(r => r.id === race.id)) ?? null);
    setPrefillRaces([]);
    setRaceForm(buildRaceForm(race));
    setShowRaceDialog(true);
  };

  const openDuplicateRace = (race: RaceDto) => {
    const edition = expandedDetail?.editions.find(ed => ed.races.some(r => r.id === race.id)) ?? null;
    const maxSort = edition ? Math.max(...edition.races.map(r => r.sortOrder), -1) : -1;
    setEditRaceId(null);
    setRaceDialogEdition(edition);
    setPrefillRaces([]);
    setRaceForm({ ...buildRaceForm(race), sortOrder: String(maxSort + 1) });
    setShowRaceDialog(true);
  };

  const patchRaceInDetail = (raceId: string, patch: Partial<RaceDto>) => {
    setExpandedDetail(prev => prev ? {
      ...prev,
      editions: prev.editions.map(ed => ({
        ...ed,
        races: ed.races.map(r => r.id === raceId ? { ...r, ...patch } : r),
      })),
    } : prev);
  };

  const patchEditionInDetail = (editionId: string, patch: Partial<EventEditionDto>) => {
    setExpandedDetail(prev => prev ? {
      ...prev,
      editions: prev.editions.map(ed => ed.id === editionId ? { ...ed, ...patch } : ed),
    } : prev);
  };

  const handleCycleTicketStatus = async (race: RaceDto) => {
    if (cyclingTicketIds.has(race.id)) return;
    const cycle: TicketStatus[] = ['NotStarted', 'Available', 'AlmostSoldOut', 'SoldOut', 'Closed'];
    const next = cycle[(cycle.indexOf(race.ticketStatus as TicketStatus) + 1) % cycle.length] ?? 'Available';
    patchRaceInDetail(race.id, { ticketStatus: next });
    setCyclingTicketIds(prev => new Set(prev).add(race.id));
    try {
      await updateRace(race.id, {
        trailId: race.trailId ?? null,
        name: race.name,
        distanceLabel: race.distanceLabel ?? undefined,
        distanceLabelEn: race.distanceLabelEn ?? undefined,
        cutoffMinutes: race.cutoffMinutes ?? null,
        description: race.description ?? undefined,
        status: race.status,
        sortOrder: race.sortOrder,
        ticketStatus: next,
        resultType: race.resultType,
        maxParticipants: race.maxParticipants ?? null,
        itraPoints: race.itraPoints ?? null,
        certifiedBy: race.certifiedBy ?? undefined,
        prizeMoney: race.prizeMoney,
        championshipCategory: race.championshipCategory ?? undefined,
        dateOfRace: race.dateOfRace ?? null,
        startTime: race.startTime ?? null,
      });
    } catch {
      patchRaceInDetail(race.id, { ticketStatus: race.ticketStatus });
      onNotify('Failed to update ticket status', 'error');
    } finally {
      setCyclingTicketIds(prev => { const s = new Set(prev); s.delete(race.id); return s; });
    }
  };

  const handleCycleRaceStatus = async (race: RaceDto) => {
    if (cyclingRaceStatusIds.has(race.id)) return;
    const cycle: RaceStatus[] = ['Active', 'Completed', 'Hidden', 'Cancelled'];
    const next = cycle[(cycle.indexOf(race.status as RaceStatus) + 1) % cycle.length] ?? 'Active';
    patchRaceInDetail(race.id, { status: next });
    setCyclingRaceStatusIds(prev => new Set(prev).add(race.id));
    try {
      await updateRace(race.id, {
        trailId: race.trailId ?? null,
        name: race.name,
        distanceLabel: race.distanceLabel ?? undefined,
        distanceLabelEn: race.distanceLabelEn ?? undefined,
        cutoffMinutes: race.cutoffMinutes ?? null,
        description: race.description ?? undefined,
        status: next,
        sortOrder: race.sortOrder,
        ticketStatus: race.ticketStatus,
        resultType: race.resultType,
        maxParticipants: race.maxParticipants ?? null,
        itraPoints: race.itraPoints ?? null,
        certifiedBy: race.certifiedBy ?? undefined,
        prizeMoney: race.prizeMoney,
        championshipCategory: race.championshipCategory ?? undefined,
        dateOfRace: race.dateOfRace ?? null,
        startTime: race.startTime ?? null,
      });
    } catch {
      patchRaceInDetail(race.id, { status: race.status });
      onNotify('Failed to update race status', 'error');
    } finally {
      setCyclingRaceStatusIds(prev => { const s = new Set(prev); s.delete(race.id); return s; });
    }
  };

  const handleCopyRaceDate = async (race: RaceDto, date: string) => {
    if (copyingDateIds.has(race.id)) return;
    setCopyingDateIds(prev => new Set(prev).add(race.id));
    patchRaceInDetail(race.id, { dateOfRace: date });
    try {
      await updateRace(race.id, {
        trailId: race.trailId ?? null,
        name: race.name,
        distanceLabel: race.distanceLabel ?? undefined,
        distanceLabelEn: race.distanceLabelEn ?? undefined,
        cutoffMinutes: race.cutoffMinutes ?? null,
        description: race.description ?? undefined,
        status: race.status,
        sortOrder: race.sortOrder,
        ticketStatus: race.ticketStatus,
        resultType: race.resultType,
        maxParticipants: race.maxParticipants ?? null,
        itraPoints: race.itraPoints ?? null,
        certifiedBy: race.certifiedBy ?? undefined,
        prizeMoney: race.prizeMoney,
        championshipCategory: race.championshipCategory ?? undefined,
        dateOfRace: date,
        startTime: race.startTime ?? null,
      });
    } catch {
      patchRaceInDetail(race.id, { dateOfRace: race.dateOfRace });
      onNotify('Failed to copy date', 'error');
    } finally {
      setCopyingDateIds(prev => { const s = new Set(prev); s.delete(race.id); return s; });
    }
  };

  const handleCloseRegistrationOnPastEditions = async () => {
    const stale = expandedDetail?.editions.filter(
      ed => (ed.endDate ?? ed.date) && isPastDate(ed.endDate ?? ed.date ?? '') && (ed.registrationStatus === 'Open' || ed.registrationStatus === 'NotStarted')
    ) ?? [];
    if (stale.length === 0) return;
    try {
      await Promise.all(stale.map(ed => updateEdition(ed.id, { registrationStatus: 'Closed' })));
      await refreshExpandedEvent();
      onNotify(`Closed registration on ${stale.length} past edition${stale.length !== 1 ? 's' : ''}`);
    } catch {
      onNotify('Failed to close registration', 'error');
    }
  };

  const handleSetTrailForAllRaces = async (edition: EventEditionDto, trailId: string) => {
    const races = edition.races.filter(r => !r.trailId);
    if (races.length === 0) return;
    try {
      await Promise.all(races.map(race => updateRace(race.id, {
        trailId,
        name: race.name,
        distanceLabel: race.distanceLabel ?? undefined,
        distanceLabelEn: race.distanceLabelEn ?? undefined,
        cutoffMinutes: race.cutoffMinutes ?? null,
        description: race.description ?? undefined,
        status: race.status,
        sortOrder: race.sortOrder,
        ticketStatus: race.ticketStatus,
        resultType: race.resultType,
        maxParticipants: race.maxParticipants ?? null,
        itraPoints: race.itraPoints ?? null,
        certifiedBy: race.certifiedBy ?? undefined,
        prizeMoney: race.prizeMoney,
        championshipCategory: race.championshipCategory ?? undefined,
        dateOfRace: race.dateOfRace ?? null,
        startTime: race.startTime ?? null,
      })));
      await refreshExpandedEvent();
      onNotify(`Trail set on ${races.length} race${races.length !== 1 ? 's' : ''}`);
    } catch {
      onNotify('Failed to set trail', 'error');
    }
  };

  const handleMarkPastRacesCompleted = async () => {
    const pastActive = expandedDetail?.editions
      .flatMap(ed => ed.races)
      .filter(r => r.status === 'Active' && r.dateOfRace && isPastDate(r.dateOfRace)) ?? [];
    if (pastActive.length === 0) return;
    try {
      await Promise.all(pastActive.map(race =>
        updateRace(race.id, {
          trailId: race.trailId ?? null,
          name: race.name,
          distanceLabel: race.distanceLabel ?? undefined,
          distanceLabelEn: race.distanceLabelEn ?? undefined,
          cutoffMinutes: race.cutoffMinutes ?? null,
          description: race.description ?? undefined,
          status: 'Completed',
          sortOrder: race.sortOrder,
          ticketStatus: race.ticketStatus,
          resultType: race.resultType,
          maxParticipants: race.maxParticipants ?? null,
          itraPoints: race.itraPoints ?? null,
          certifiedBy: race.certifiedBy ?? undefined,
          prizeMoney: race.prizeMoney,
          championshipCategory: race.championshipCategory ?? undefined,
          dateOfRace: race.dateOfRace ?? null,
          startTime: race.startTime ?? null,
        })
      ));
      await refreshExpandedEvent();
      onNotify(`Marked ${pastActive.length} race${pastActive.length !== 1 ? 's' : ''} as completed`);
    } catch {
      onNotify('Failed to mark races as completed', 'error');
    }
  };

  const handleCycleEventStatus = async (event: EventSummaryDto) => {
    if (cyclingStatusIds.has(event.id)) return;
    if (event.status !== 'Unconfirmed' && event.status !== 'Confirmed') return;
    const next: EventStatus = event.status === 'Unconfirmed' ? 'Confirmed' : 'Unconfirmed';
    patchEventLocally(event.id, { status: next });
    if (expandedEventId === event.id) setExpandedDetail(prev => prev ? { ...prev, status: next } : prev);
    setCyclingStatusIds(prev => new Set(prev).add(event.id));
    try {
      await updateEventSilently(event.id, {
        name: event.name,
        nameEn: event.nameEn ?? undefined,
        description: event.description ?? undefined,
        descriptionEn: event.descriptionEn ?? undefined,
        type: event.type,
        activityType: event.activityType,
        status: next,
        organizerName: event.organizerName ?? undefined,
        organizerNameEn: event.organizerNameEn ?? undefined,
        organizerWebsite: event.organizerWebsite ?? undefined,
        organizerId: event.organizerId ?? null,
        alertMessage: event.alertMessage ?? undefined,
        alertMessageEn: event.alertMessageEn ?? undefined,
        alertSeverity: event.alertSeverity ?? undefined,
        locationId: event.locationId ?? null,
        scheduleRule: event.scheduleRule ?? null,
        socialLinks: event.socialLinks ?? null,
        gpxPointLat: event.gpxPointLat ?? null,
        gpxPointLng: event.gpxPointLng ?? null,
        translationHashes: event.translationHashes,
      });
    } catch {
      patchEventLocally(event.id, { status: event.status });
      if (expandedEventId === event.id) setExpandedDetail(prev => prev ? { ...prev, status: event.status as EventStatus } : prev);
      onNotify('Failed to update event status', 'error');
    } finally {
      setCyclingStatusIds(prev => { const s = new Set(prev); s.delete(event.id); return s; });
    }
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
        nameEn: trimToUndefined(eventForm.nameEn),
        description: trimToUndefined(eventForm.description),
        descriptionEn: trimToUndefined(eventForm.descriptionEn),
        type: eventForm.type,
        activityType: eventForm.activityType,
        status: eventForm.status,
        organizerName: trimToUndefined(eventForm.organizerName),
        organizerNameEn: trimToUndefined(eventForm.organizerNameEn),
        organizerWebsite: trimToUndefined(eventForm.organizerWebsite),
        organizerId: eventForm.organizerId || null,
        alertMessage: trimToUndefined(eventForm.alertMessage),
        alertMessageEn: trimToUndefined(eventForm.alertMessageEn),
        alertSeverity: eventForm.alertMessage.trim() ? eventForm.alertSeverity : undefined,
        locationId: eventForm.locationId || null,
        scheduleRule: buildScheduleRule(eventForm),
        socialLinks: socialLinks.length > 0 ? socialLinks : null,
        gpxPointLat: eventForm.gpxPointLat.trim() ? parseFloat(eventForm.gpxPointLat) : null,
        gpxPointLng: eventForm.gpxPointLng.trim() ? parseFloat(eventForm.gpxPointLng) : null,
        translationHashes: (() => {
          const h: Record<string, string> = { ...(eventForm.translationHashes ?? {}) };
          if (eventForm.name?.trim() && eventForm.nameEn?.trim() && eventForm.nameEn !== eventForm._initialNameEn)
            h['Name'] = hashText(eventForm.name.trim());
          if (eventForm.description?.trim() && eventForm.descriptionEn?.trim() && eventForm.descriptionEn !== eventForm._initialDescriptionEn)
            h['Description'] = hashText(eventForm.description.trim());
          if (eventForm.organizerName?.trim() && eventForm.organizerNameEn?.trim() && eventForm.organizerNameEn !== eventForm._initialOrganizerNameEn)
            h['Organizer'] = hashText(eventForm.organizerName.trim());
          if (eventForm.alertMessage?.trim() && eventForm.alertMessageEn?.trim() && eventForm.alertMessageEn !== eventForm._initialAlertMessageEn)
            h['Alert'] = hashText(eventForm.alertMessage.trim());
          return Object.keys(h).length > 0 ? h : undefined;
        })(),
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
        endDate: editionForm.endDate || null,
        title: trimToUndefined(editionForm.title),
        titleEn: trimToUndefined(editionForm.titleEn),
        registrationUrl: trimToUndefined(editionForm.registrationUrl),
        resultsUrl: trimToUndefined(editionForm.resultsUrl),
        notes: trimToUndefined(editionForm.notes),
        notesEn: trimToUndefined(editionForm.notesEn),
        registrationStatus: editionForm.registrationStatus,
        trailId: isRaceOrSeries ? null : (editionForm.trailId || null),
        translationHashes: (() => {
          const h: Record<string, string> = { ...(editionForm.translationHashes ?? {}) };
          if (editionForm.title?.trim() && editionForm.titleEn?.trim() && editionForm.titleEn !== editionForm._initialTitleEn)
            h['Title'] = hashText(editionForm.title.trim());
          if (editionForm.notes?.trim() && editionForm.notesEn?.trim() && editionForm.notesEn !== editionForm._initialNotesEn)
            h['Notes'] = hashText(editionForm.notes.trim());
          return Object.keys(h).length > 0 ? h : undefined;
        })(),
      };
      const editionLabel = trimToUndefined(editionForm.title) || editionForm.date || editionForm.year || 'Untitled edition';

      if (editEditionId) {
        await updateEdition(editEditionId, {
          year: input.year,
          date: input.date,
          endDate: input.endDate,
          title: input.title,
          titleEn: input.titleEn,
          registrationUrl: input.registrationUrl,
          resultsUrl: input.resultsUrl,
          notes: input.notes,
          notesEn: input.notesEn,
          registrationStatus: input.registrationStatus,
          trailId: input.trailId,
          translationHashes: input.translationHashes,
        });
        onNotify(`Edition "${editionLabel}" updated`);
        const origDate = editionForm._originalDate;
        if (origDate && input.date && origDate !== input.date) {
          const offsetDays = dayjs(input.date).diff(dayjs(origDate), 'day');
          const racesWithDates = expandedDetail?.editions
            .find(ed => ed.id === editEditionId)?.races
            .filter(r => r.dateOfRace) ?? [];
          if (offsetDays !== 0 && racesWithDates.length > 0) {
            setPendingDateShift({ offsetDays, races: racesWithDates });
          }
        }
      } else {
        const newEditionId = await createEdition(input);
        const sourceEdition = cloneFromEditionId
          ? expandedDetail?.editions.find(ed => ed.id === cloneFromEditionId)
          : null;

        if (isRaceOrSeries) {
          if (sourceEdition && sourceEdition.races.length > 0) {
            const datesPreFilled = !!editionForm.date && !!sourceEdition.date && sourceEdition.races.some(r => r.dateOfRace);
            const results = await Promise.allSettled(sourceEdition.races.map(race =>
              createRace({
                eventEditionId: newEditionId,
                trailId: race.trailId ?? null,
                name: race.name,
                distanceLabel: race.distanceLabel ?? undefined,
                distanceLabelEn: race.distanceLabelEn ?? undefined,
                cutoffMinutes: race.cutoffMinutes ?? null,
                description: race.description ?? undefined,
                status: 'Active',
                sortOrder: race.sortOrder,
                ticketStatus: 'Available',
                resultType: race.resultType,
                maxParticipants: race.maxParticipants ?? null,
                itraPoints: race.itraPoints ?? null,
                certifiedBy: race.certifiedBy ?? undefined,
                prizeMoney: race.prizeMoney,
                championshipCategory: race.championshipCategory ?? undefined,
                dateOfRace: computeClonedRaceDate(sourceEdition.date, race.dateOfRace, editionForm.date),
                startTime: race.startTime ? race.startTime.slice(0, 5) : null,
              }),
            ));
            const failed = results.filter(r => r.status === 'rejected').length;
            const succeeded = results.length - failed;
            if (failed > 0) {
              onNotify(`Edition "${editionLabel}" created but only ${succeeded}/${results.length} races were cloned — review and add missing ones`, 'error');
            } else {
              onNotify(`Edition "${editionLabel}" created with ${succeeded} cloned race${succeeded === 1 ? '' : 's'}${datesPreFilled ? ' — dates pre-filled, review below' : ' — set their dates below'}`);
            }
          } else {
            await createRace({
              eventEditionId: newEditionId,
              trailId: null,
              name: editionForm.eventName || 'Race',
              status: 'Active',
              sortOrder: 0,
              ticketStatus: 'Available',
              resultType: 'Time',
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
                resultType: 'Time',
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
        nameEn: trimToUndefined(raceForm.nameEn),
        distanceLabel: trimToUndefined(raceForm.distanceLabel),
        distanceLabelEn: trimToUndefined(raceForm.distanceLabelEn),
        cutoffMinutes: parsedCutoffMinutes,
        description: trimToUndefined(raceForm.description),
        descriptionEn: trimToUndefined(raceForm.descriptionEn),
        status: raceForm.status,
        sortOrder: raceForm.sortOrder.trim() ? Number(raceForm.sortOrder) : 0,
        ticketStatus: raceForm.ticketStatus,
        resultType: raceForm.resultType,
        maxParticipants: raceForm.maxParticipants.trim() ? Number(raceForm.maxParticipants) : null,
        itraPoints: raceForm.itraPoints.trim() !== '' ? Number(raceForm.itraPoints) : null,
        certifiedBy: trimToUndefined(raceForm.certifiedBy),
        certifiedByEn: trimToUndefined(raceForm.certifiedByEn),
        prizeMoney: raceForm.prizeMoney.trim() ? Number(raceForm.prizeMoney) : 0,
        championshipCategory: trimToUndefined(raceForm.championshipCategory),
        championshipCategoryEn: trimToUndefined(raceForm.championshipCategoryEn),
        dateOfRace: raceForm.dateOfRace || null,
        startTime: raceForm.startTime || null,
        activityType: raceForm.activityType || null,
        translationHashes: (() => {
          const h: Record<string, string> = { ...(raceForm.translationHashes ?? {}) };
          if (raceForm.name?.trim() && raceForm.nameEn?.trim() && raceForm.nameEn !== raceForm._initialNameEn)
            h['Name'] = hashText(raceForm.name.trim());
          if (raceForm.description?.trim() && raceForm.descriptionEn?.trim() && raceForm.descriptionEn !== raceForm._initialDescriptionEn)
            h['Description'] = hashText(raceForm.description.trim());
          if (raceForm.certifiedBy?.trim() && raceForm.certifiedByEn?.trim() && raceForm.certifiedByEn !== raceForm._initialCertifiedByEn)
            h['CertifiedBy'] = hashText(raceForm.certifiedBy.trim());
          if (raceForm.championshipCategory?.trim() && raceForm.championshipCategoryEn?.trim() && raceForm.championshipCategoryEn !== raceForm._initialChampionshipCategoryEn)
            h['Championship'] = hashText(raceForm.championshipCategory.trim());
          return Object.keys(h).length > 0 ? h : undefined;
        })(),
      };

      if (editRaceId) {
        await updateRace(editRaceId, {
          trailId: input.trailId,
          name: input.name,
          nameEn: input.nameEn,
          distanceLabel: input.distanceLabel,
          distanceLabelEn: input.distanceLabelEn,
          cutoffMinutes: input.cutoffMinutes,
          description: input.description,
          descriptionEn: input.descriptionEn,
          status: input.status,
          sortOrder: input.sortOrder,
          ticketStatus: input.ticketStatus,
          resultType: input.resultType,
          maxParticipants: input.maxParticipants,
          itraPoints: input.itraPoints,
          certifiedBy: input.certifiedBy,
          certifiedByEn: input.certifiedByEn,
          prizeMoney: input.prizeMoney,
          championshipCategory: input.championshipCategory,
          championshipCategoryEn: input.championshipCategoryEn,
          dateOfRace: input.dateOfRace,
          startTime: input.startTime,
          activityType: input.activityType,
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
                distanceLabelEn: input.distanceLabelEn,
                cutoffMinutes: input.cutoffMinutes,
                description: input.description,
                status: input.status,
                sortOrder: isSeries ? r.sortOrder : input.sortOrder,
                ticketStatus: input.ticketStatus,
                resultType: input.resultType,
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

  const handleCopyRacesFromPrevious = (edition: EventEditionDto) => {
    if (!expandedDetail) return;

    const allSorted = [...expandedDetail.editions].sort(sortEditions);
    const targetIndex = allSorted.findIndex(ed => ed.id === edition.id);

    let sourceEdition: EventEditionDto | undefined;
    for (let i = targetIndex - 1; i >= 0; i--) {
      if (allSorted[i].races.length > 0) { sourceEdition = allSorted[i]; break; }
    }
    if (!sourceEdition) {
      sourceEdition = [...allSorted].reverse().find(ed => ed.id !== edition.id && ed.races.length > 0);
    }
    if (!sourceEdition) return;

    setCopyRacesConfirm({ edition, source: sourceEdition });
  };

  const handleConfirmCopyRaces = async () => {
    if (!copyRacesConfirm) return;
    const { edition, source: sourceEdition } = copyRacesConfirm;
    setCopyRacesConfirm(null);

    const raceCount = sourceEdition.races.length;
    const label = buildEditionLabel(sourceEdition);
    setSaving(true);
    try {
      await Promise.all(sourceEdition.races.map(race =>
        createRace({
          eventEditionId: edition.id,
          trailId: race.trailId ?? null,
          name: race.name,
          distanceLabel: race.distanceLabel ?? undefined,
          distanceLabelEn: race.distanceLabelEn ?? undefined,
          cutoffMinutes: race.cutoffMinutes ?? null,
          description: race.description ?? undefined,
          status: 'Active',
          sortOrder: race.sortOrder,
          ticketStatus: 'Available',
          resultType: race.resultType,
          maxParticipants: race.maxParticipants ?? null,
          itraPoints: race.itraPoints,
          certifiedBy: race.certifiedBy ?? undefined,
          prizeMoney: race.prizeMoney,
          championshipCategory: race.championshipCategory ?? undefined,
          dateOfRace: computeClonedRaceDate(sourceEdition.date, race.dateOfRace, edition.date),
          startTime: race.startTime ? race.startTime.slice(0, 5) : null,
        }),
      ));
      const datesPreFilled = !!edition.date && !!sourceEdition.date && sourceEdition.races.some(r => r.dateOfRace);
      onNotify(`Copied ${raceCount} race${raceCount === 1 ? '' : 's'} from "${label}"${datesPreFilled ? ' — dates pre-filled, review below' : ''}`);
      await refreshExpandedEvent();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to copy races', 'error');
    } finally {
      setSaving(false);
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
          event,
          detail: detail ?? null,
          sourceEdition: source ?? null,
          year: nextYear,
          date: suggestedDate,
          endDate: suggestedEndDate,
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
              resultType: race.resultType,
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
    await refreshEvents();
    await refreshExpandedEvent();
    if (failed > 0) {
      onNotify(`Created ${succeeded} edition${succeeded !== 1 ? 's' : ''}, ${failed} failed`, 'error');
    } else {
      onNotify(`Created ${succeeded} edition${succeeded !== 1 ? 's' : ''} with cloned races`);
    }
  };

  const handleCycleRegistrationStatus = async (edition: EventEditionDto) => {
    if (cyclingRegIds.has(edition.id)) return;
    const cycle: RegistrationStatus[] = ['NotStarted', 'Open', 'Closed'];
    const next = cycle[(cycle.indexOf(edition.registrationStatus) + 1) % cycle.length];
    patchEditionInDetail(edition.id, { registrationStatus: next });
    setCyclingRegIds(prev => new Set(prev).add(edition.id));
    try {
      await updateEditionSilently(edition.id, {
        year: edition.year ?? null,
        date: edition.date ?? null,
        endDate: edition.endDate ?? null,
        title: edition.title ?? undefined,
        titleEn: edition.titleEn ?? undefined,
        registrationUrl: edition.registrationUrl ?? undefined,
        resultsUrl: edition.resultsUrl ?? undefined,
        notes: edition.notes ?? undefined,
        notesEn: edition.notesEn ?? undefined,
        registrationStatus: next,
        trailId: edition.trailId ?? null,
        translationHashes: edition.translationHashes,
      });
    } catch (err) {
      patchEditionInDetail(edition.id, { registrationStatus: edition.registrationStatus });
      onNotify(err instanceof Error ? err.message : 'Failed to update status', 'error');
    } finally {
      setCyclingRegIds(prev => { const s = new Set(prev); s.delete(edition.id); return s; });
    }
  };

  const handleSaveNotesPopover = async () => {
    if (!notesPopover) return;
    const { edition, notes, notesEn } = notesPopover;
    try {
      await updateEdition(edition.id, {
        year: edition.year,
        date: edition.date,
        endDate: edition.endDate,
        title: edition.title ?? undefined,
        titleEn: edition.titleEn ?? undefined,
        registrationUrl: edition.registrationUrl ?? undefined,
        resultsUrl: edition.resultsUrl ?? undefined,
        registrationStatus: edition.registrationStatus,
        trailId: edition.trailId,
        notes: notes || undefined,
        notesEn: notesEn || undefined,
        translationHashes: edition.translationHashes,
      });
      setNotesPopover(null);
      await refreshExpandedEvent();
    } catch {
      onNotify('Failed to save notes', 'error');
    }
  };

  const handleEditionYearChange = (yearStr: string) => {
    // Keep title in sync with year if it still matches the old year value
    if (!editEditionId && (editionForm.title === editionForm.year || editionForm.title === '')) {
      setEditionField('title', yearStr);
    }
    setEditionField('year', yearStr);
    if (editEditionId || yearStr.length !== 4 || !expandedDetail) return;
    const toYear = Number(yearStr);
    const editionsWithRaces = expandedDetail.editions.filter(ed => ed.races.length > 0 && ed.year != null);
    if (editionsWithRaces.length === 0) return;
    const source = editionsWithRaces.reduce((best, ed) =>
      Math.abs((ed.year ?? 0) - toYear) < Math.abs((best.year ?? 0) - toYear) ? ed : best,
    editionsWithRaces[0]);
    if (source.year === toYear) return;
    setCloneFromEditionId(source.id);
    const suggestedDate = suggestEditionDateForYear(source.date, toYear);
    if (suggestedDate) {
      setEditionField('date', suggestedDate);
      if (isPastDate(suggestedDate)) setEditionField('registrationStatus', 'Closed');
    }
    setEditionField('registrationUrl', bumpYearInUrl(source.registrationUrl ?? '', source.year, toYear) || (source.registrationUrl ?? ''));
    setEditionField('resultsUrl', bumpYearInUrl(source.resultsUrl ?? '', source.year, toYear) || (source.resultsUrl ?? ''));
  };

  const openBulkDates = (edition: EventEditionDto) => {
    // Find the nearest older edition with races to show previous-year date hints
    const allSorted = [...(expandedDetail?.editions ?? [])].sort(sortEditions); // newest first
    const idx = allSorted.findIndex(ed => ed.id === edition.id);
    let prevEdition: EventEditionDto | undefined;
    for (let i = idx + 1; i < allSorted.length; i++) {
      if (allSorted[i].races.length > 0) { prevEdition = allSorted[i]; break; }
    }
    setBulkDatesEditionDate(edition.date ?? '');
    setBulkDatesIsSeries(expandedDetail?.type === 'Series');
    setBulkDatesScheduleRule(expandedDetail?.scheduleRule ?? null);
    setBulkDatesEditionYear(edition.year ?? null);
    setBulkDates(
      [...edition.races].sort(sortRaces).map(race => {
        const prevRace = prevEdition?.races.find(r => r.name === race.name);
        return {
          race,
          dateOfRace: race.dateOfRace ?? '',
          startTime: race.startTime ? race.startTime.slice(0, 5) : '',
          prevDateOfRace: prevRace?.dateOfRace ?? undefined,
        };
      }),
    );
    setShowBulkDatesDialog(true);
  };

  const handleSaveUrlPopover = async () => {
    if (!urlPopover) return;
    const { edition, regUrl, resultsUrl } = urlPopover;
    try {
      await updateEdition(edition.id, {
        year: edition.year,
        date: edition.date,
        endDate: edition.endDate,
        title: edition.title ?? undefined,
        titleEn: edition.titleEn ?? undefined,
        registrationStatus: edition.registrationStatus,
        trailId: edition.trailId,
        notes: edition.notes ?? undefined,
        notesEn: edition.notesEn ?? undefined,
        translationHashes: edition.translationHashes,
        registrationUrl: regUrl || undefined,
        resultsUrl: resultsUrl || undefined,
      });
      setUrlPopover(null);
      await refreshExpandedEvent();
    } catch {
      onNotify('Failed to save URLs', 'error');
    }
  };

  const handleShiftRaceDates = async () => {
    if (!pendingDateShift) return;
    const { offsetDays, races } = pendingDateShift;
    setPendingDateShift(null);
    try {
      await Promise.all(races.map(race =>
        updateRace(race.id, {
          trailId: race.trailId ?? null,
          name: race.name,
          distanceLabel: race.distanceLabel ?? undefined,
          distanceLabelEn: race.distanceLabelEn ?? undefined,
          cutoffMinutes: race.cutoffMinutes ?? null,
          description: race.description ?? undefined,
          status: race.status,
          sortOrder: race.sortOrder,
          ticketStatus: race.ticketStatus,
          resultType: race.resultType,
          maxParticipants: race.maxParticipants ?? null,
          itraPoints: race.itraPoints ?? null,
          certifiedBy: race.certifiedBy ?? undefined,
          prizeMoney: race.prizeMoney,
          championshipCategory: race.championshipCategory ?? undefined,
          dateOfRace: dayjs(race.dateOfRace!).add(offsetDays, 'day').format('YYYY-MM-DD'),
          startTime: race.startTime ?? null,
        })
      ));
      await refreshExpandedEvent();
      const sign = offsetDays > 0 ? '+' : '';
      onNotify(`Shifted ${races.length} race date${races.length !== 1 ? 's' : ''} by ${sign}${offsetDays} day${Math.abs(offsetDays) !== 1 ? 's' : ''}`);
    } catch {
      onNotify('Failed to shift race dates', 'error');
    }
  };

  const handleSaveBulkDates = async () => {
    setSaving(true);
    try {
      await Promise.all(bulkDates.map(({ race, dateOfRace, startTime }) =>
        updateRace(race.id, {
          trailId: race.trailId ?? null,
          name: race.name,
          distanceLabel: race.distanceLabel ?? undefined,
          distanceLabelEn: race.distanceLabelEn ?? undefined,
          cutoffMinutes: race.cutoffMinutes ?? null,
          description: race.description ?? undefined,
          status: race.status,
          sortOrder: race.sortOrder,
          ticketStatus: race.ticketStatus,
          resultType: race.resultType,
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleRaceDragEnd = async (event: DragEndEvent, edition: EventEditionDto) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sorted = [...edition.races].sort(sortRaces);
    const oldIndex = sorted.findIndex(r => r.id === active.id);
    const newIndex = sorted.findIndex(r => r.id === over.id);
    const reordered = arrayMove(sorted, oldIndex, newIndex);

    // Optimistic update so the list doesn't snap back during API calls
    setLocalRaceOrder(prev => new Map(prev).set(edition.id, reordered.map(r => r.id)));

    try {
      await Promise.all(reordered.map((race, idx) =>
        idx !== sorted.indexOf(race) ? updateRace(race.id, {
          trailId: race.trailId ?? null,
          name: race.name,
          distanceLabel: race.distanceLabel ?? undefined,
          distanceLabelEn: race.distanceLabelEn ?? undefined,
          cutoffMinutes: race.cutoffMinutes ?? null,
          description: race.description ?? undefined,
          status: race.status,
          sortOrder: idx,
          ticketStatus: race.ticketStatus,
          resultType: race.resultType,
          maxParticipants: race.maxParticipants ?? null,
          itraPoints: race.itraPoints ?? null,
          certifiedBy: race.certifiedBy ?? undefined,
          prizeMoney: race.prizeMoney,
          championshipCategory: race.championshipCategory ?? undefined,
          dateOfRace: race.dateOfRace ?? null,
          startTime: race.startTime ?? null,
        }) : Promise.resolve(),
      ));
      await refreshExpandedEvent();
      setLocalRaceOrder(prev => { const m = new Map(prev); m.delete(edition.id); return m; });
    } catch (err) {
      setLocalRaceOrder(prev => { const m = new Map(prev); m.delete(edition.id); return m; });
      onNotify(err instanceof Error ? err.message : 'Failed to reorder races', 'error');
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

  const selectedBulkCount = bulkMissingItems.filter(i => i.selected).length;

  const attentionItems: { key: string; label: string }[] = [];
  {
    const noEdition = events.filter(e =>
      !e.hasFutureEdition && (e.type === 'Race' || e.type === 'Series') && e.status !== 'Cancelled'
    ).length;
    if (noEdition > 0) attentionItems.push({ key: 'noEdition', label: `${noEdition} active event${noEdition !== 1 ? 's' : ''} missing a future edition` });
  }
  {
    const seriesMissingReg = events.filter(e =>
      e.type === 'Series' && e.nextEditionDate && e.nextEditionDate <= in30daysStr &&
      e.seriesRaces?.some(r => !r.registrationUrl)
    ).length;
    if (seriesMissingReg > 0) attentionItems.push({ key: 'seriesMissingReg', label: `${seriesMissingReg} series event${seriesMissingReg !== 1 ? 's' : ''} with races in ≤30 days missing registration URL` });
  }
  {
    const pastActive = events.filter(e =>
      e.status === 'Confirmed' && e.nextEditionDate && e.nextEditionDate < todayStr
    ).length;
    if (pastActive > 0) attentionItems.push({ key: 'pastActive', label: `${pastActive} event${pastActive !== 1 ? 's' : ''} whose latest edition has passed — check results URL and registration status` });
  }

  return (
    <Box>
      {attentionItems.length > 0 && showAttentionPanel && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          onClose={() => setShowAttentionPanel(false)}
        >
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Needs attention</Typography>
          <Stack component="ul" sx={{ m: 0, pl: 2, gap: 0.25 }}>
            {attentionItems.map(item => (
              <li key={item.key}>
                <Typography
                  variant="body2"
                  component="button"
                  onClick={() => setAttentionFilter(attentionFilter === item.key as typeof attentionFilter ? null : item.key as typeof attentionFilter)}
                  sx={{ background: 'none', border: 'none', p: 0, cursor: 'pointer', textAlign: 'left', textDecoration: attentionFilter === item.key ? 'underline' : 'underline dotted', textUnderlineOffset: 3, color: 'inherit' }}
                >
                  {item.label} {attentionFilter === item.key ? '(showing — click to clear)' : '→ click to filter'}
                </Typography>
              </li>
            ))}
          </Stack>
        </Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <TrophyIcon color="primary" />
          <Typography variant="h5">Events</Typography>
          <Chip label={searchQuery.trim() || hasActiveFilters ? `${filteredEvents.length} / ${events.length}` : events.length} size="small" color="primary" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {events.some(e => (e.type === 'Race' || e.type === 'Series') && e.status !== 'Cancelled' && !e.hasFutureEdition) && (
            <Button variant="outlined" startIcon={<BulkAddIcon />} onClick={openBulkMissingEditions}>
              Create Missing Editions
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateEvent}>
            New Event
          </Button>
        </Box>
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
              <TableCell sortDirection={sortBy === 'updatedAt' ? sortDir : false}>
                <TableSortLabel active={sortBy === 'updatedAt'} direction={sortBy === 'updatedAt' ? sortDir : 'desc'} onClick={() => handleRequestSort('updatedAt')}>
                  Updated
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEvents.map(event => (
              <Fragment key={event.id}>
                <TableRow id={`event-row-${event.id}`} hover sx={{ cursor: 'pointer', ...(event.type === 'Advertisement' && { bgcolor: 'rgba(255, 193, 7, 0.08)' }) }} onClick={() => toggleExpand(event)}>
                  <TableCell sx={expandedEventId === event.id ? { borderTop: '2px solid', borderLeft: '2px solid', borderColor: 'primary.main' } : {}}>
                    <IconButton size="small">
                      {expandedEventId === event.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="body2" fontWeight={700}>{event.name}</Typography>
                      {eventHasStaleTx(event) && (
                        <Tooltip title="English translation may be outdated — IS text changed since last translate">
                          <Chip label="EN" size="small" color="warning" variant="filled" sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.75 } }} />
                        </Tooltip>
                      )}
                    </Box>
                    <Tooltip title="Click to copy slug">
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontFamily="monospace"
                        sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                        onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(event.slug); onNotify(`Copied: ${event.slug}`); }}
                      >
                        {event.slug}
                      </Typography>
                    </Tooltip>
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
                        <Typography variant="body2">{fmtDate(event.nextEditionDate)}</Typography>
                        {formatDaysUntil(event.daysUntil) && (event.daysUntil == null || event.daysUntil >= 0) && (
                          <Chip
                            label={formatDaysUntil(event.daysUntil)}
                            size="small"
                            variant="outlined"
                            color={event.daysUntil != null && event.daysUntil <= 7 ? 'warning' : 'default'}
                            sx={{ mt: 0.5 }}
                          />
                        )}
                        {event.status !== 'Cancelled' && !event.hasFutureEdition && (
                          <Chip
                            label="Edition missing"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Box>
                    ) : event.status !== 'Cancelled' && !event.hasFutureEdition ? (
                      <Chip
                        label={event.editionCount === 0 ? 'No editions' : 'Edition missing'}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
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
                        onClick={(event.status === 'Unconfirmed' || event.status === 'Confirmed') && !cyclingStatusIds.has(event.id) ? () => handleCycleEventStatus(event) : undefined}
                        disabled={cyclingStatusIds.has(event.id)}
                        sx={(event.status === 'Unconfirmed' || event.status === 'Confirmed') ? { cursor: 'pointer' } : undefined}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                      <Chip label={event.editionCount} size="small" variant="outlined" />
                      {event.editionEffectiveCancelled && (
                        <Tooltip title="Current/upcoming edition is cancelled">
                          <Chip label="Cancelled" size="small" color="error" />
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{event.locationName ?? '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {event.updatedAt ? new Date(event.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" onClick={clickEvent => clickEvent.stopPropagation()} sx={expandedEventId === event.id ? { borderTop: '2px solid', borderRight: '2px solid', borderColor: 'primary.main' } : {}}>
                    {PUBLIC_SITE_URL && (
                      <Tooltip title="View on public site">
                        <IconButton size="small" component="a" href={`${PUBLIC_SITE_URL}/events/${event.slug}`} target="_blank" rel="noopener noreferrer">
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {onViewEventDetail && (
                      <Tooltip title="Editions & races">
                        <IconButton size="small" onClick={() => onViewEventDetail(event.slug)}>
                          <OpenInNewIcon fontSize="small" sx={{ color: 'primary.main' }} />
                        </IconButton>
                      </Tooltip>
                    )}
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
                              <Typography variant="subtitle1" fontWeight={700}>
                                <Typography component="span" variant="subtitle1" color="text.secondary" fontWeight={400}>Edition list for: </Typography>
                                {expandedDetail.name}
                              </Typography>
                              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                {(() => {
                                  const staleCount = expandedDetail.editions.filter(ed => (ed.endDate ?? ed.date) && isPastDate(ed.endDate ?? ed.date ?? '') && (ed.registrationStatus === 'Open' || ed.registrationStatus === 'NotStarted')).length;
                                  return staleCount > 0 ? (
                                    <Button size="small" variant="outlined" color="warning" onClick={handleCloseRegistrationOnPastEditions}>
                                      Close registration on {staleCount} past edition{staleCount !== 1 ? 's' : ''}
                                    </Button>
                                  ) : null;
                                })()}
                                {(() => {
                                  const pastCount = expandedDetail.editions.flatMap(ed => ed.races).filter(r => r.status === 'Active' && r.dateOfRace && isPastDate(r.dateOfRace)).length;
                                  return pastCount > 0 ? (
                                    <Button size="small" variant="outlined" color="warning" onClick={handleMarkPastRacesCompleted}>
                                      Mark {pastCount} past race{pastCount !== 1 ? 's' : ''} completed
                                    </Button>
                                  ) : null;
                                })()}
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
                                      label="Event website"
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
                              ) : (() => {
                                if (!visibleEditions) return null;
                                const { visible, hiddenCount } = visibleEditions;
                                return (
                                <>
                                {visible.map((edition, idx) => (
                                  <Paper key={edition.id} variant="outlined" sx={{
                                    mb: 1.5,
                                    borderLeft: '4px solid',
                                    borderLeftColor: EDITION_BORDER_COLORS[idx % EDITION_BORDER_COLORS.length],
                                  }}>
                                    <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexGrow: 1 }}>
                                        <IconButton size="small" onClick={() => toggleEditionExpand(edition.id)}>
                                          {expandedEditionIds.includes(edition.id) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                        </IconButton>
                                        <Box sx={{ flexGrow: 1 }}>
                                          <Typography variant="body2" fontWeight={700}>{buildEditionLabel(edition)}</Typography>
                                          {edition.notes && !expandedEditionIds.includes(edition.id) && (
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontStyle: 'italic' }} noWrap>
                                              {edition.notes}
                                            </Typography>
                                          )}
                                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                                            <Chip
                                              label={edition.date
                                                ? edition.endDate ? `${edition.date} – ${edition.endDate}` : edition.date
                                                : edition.year != null ? String(edition.year) : 'Date TBD'}
                                              size="small"
                                              variant="outlined"
                                            />
                                            <Tooltip title={cyclingRegIds.has(edition.id) ? 'Updating…' : 'Click to cycle: NotStarted → Open → Closed'}>
                                              <Chip
                                                label={edition.registrationStatus}
                                                size="small"
                                                color={getRegistrationStatusColor(edition.registrationStatus)}
                                                onClick={cyclingRegIds.has(edition.id) ? undefined : () => handleCycleRegistrationStatus(edition)}
                                                disabled={cyclingRegIds.has(edition.id)}
                                                sx={{ cursor: cyclingRegIds.has(edition.id) ? 'default' : 'pointer' }}
                                              />
                                            </Tooltip>
                                            <Chip label={`${edition.races.length} race${edition.races.length === 1 ? '' : 's'}`} size="small" variant="outlined" />
                                            {edition.trailName && <Chip label={`Trail: ${edition.trailName}`} size="small" variant="outlined" />}
                                            {expandedDetail.type === 'Series' && edition.races.length > 0 && (() => {
                                              const ready = edition.races.filter(r => r.dateOfRace && r.trailId && r.distanceLabel).length;
                                              const total = edition.races.length;
                                              const allReady = ready === total;
                                              return (
                                                <Tooltip title={allReady ? 'All legs ready' : `${total - ready} leg${total - ready !== 1 ? 's' : ''} missing date, trail or distance`}>
                                                  <Chip
                                                    label={`${ready}/${total} legs ready`}
                                                    size="small"
                                                    color={allReady ? 'success' : 'warning'}
                                                    variant={allReady ? 'outlined' : 'filled'}
                                                  />
                                                </Tooltip>
                                              );
                                            })()}
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
                                            {(edition.endDate ?? edition.date) && isPastDate(edition.endDate ?? edition.date ?? '') && !edition.resultsUrl && (
                                              <Tooltip title="Results URL missing — click to add">
                                                <Chip
                                                  label="Results missing"
                                                  size="small"
                                                  color="warning"
                                                  variant="outlined"
                                                  onClick={(e) => setUrlPopover({ anchorEl: e.currentTarget, edition, regUrl: edition.registrationUrl ?? '', resultsUrl: '' })}
                                                  sx={{ cursor: 'pointer' }}
                                                />
                                              </Tooltip>
                                            )}
                                            {editionHasStaleTx(edition) && (
                                              <Tooltip title="Edition translation (title/notes) may be outdated">
                                                <Chip label="EN" size="small" color="warning" variant="filled" sx={STALE_TX_CHIP_SX} />
                                              </Tooltip>
                                            )}
                                          </Stack>
                                        </Box>
                                      </Box>
                                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        {onNavigateToRaceManager && (edition.date || edition.endDate) && (
                                          <Tooltip title={`Open in Race Manager (${edition.date ?? edition.endDate})`}>
                                            <IconButton size="small" onClick={() => onNavigateToRaceManager(edition.date ?? edition.endDate ?? '')}>
                                              <FlagIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        )}
                                        <Tooltip title={edition.notes ? `Notes: ${edition.notes.slice(0, 60)}${edition.notes.length > 60 ? '…' : ''}` : 'Add notes'}>
                                          <IconButton size="small" color={edition.notes ? 'primary' : 'default'} onClick={(e) => setNotesPopover({ anchorEl: e.currentTarget, edition, notes: edition.notes ?? '', notesEn: edition.notesEn ?? '' })}>
                                            <NotesIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Edit registration & results URLs">
                                          <IconButton size="small" onClick={(e) => setUrlPopover({ anchorEl: e.currentTarget, edition, regUrl: edition.registrationUrl ?? '', resultsUrl: edition.resultsUrl ?? '' })}>
                                            <LinkIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
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
                                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                            {expandedDetail?.type === 'Series' && edition.races.length > 0 && edition.races.some(r => !r.trailId) && (
                                              <Autocomplete
                                                size="small"
                                                options={sortedTrails}
                                                getOptionLabel={(t) => t.name}
                                                sx={{ width: 200 }}
                                                onChange={(_, trail) => { if (trail) handleSetTrailForAllRaces(edition, trail.id); }}
                                                renderInput={(params) => <TextField {...params} label="Set trail for all legs" />}
                                              />
                                            )}
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
                                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleRaceDragEnd(e, edition)}>
                                            {(() => {
                                              const localOrder = localRaceOrder.get(edition.id);
                                              const displayRaces = localOrder
                                                ? localOrder.map(id => edition.races.find(r => r.id === id)!).filter(Boolean)
                                                : [...edition.races].sort(sortRaces);
                                              return (
                                            <SortableContext items={displayRaces.map(r => r.id)} strategy={verticalListSortingStrategy}>
                                              <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                {displayRaces.map(race => (
                                                  <SortableRaceItem
                                                    key={race.id}
                                                    race={race}
                                                    onEdit={() => openEditRace(race)}
                                                    onDuplicate={() => openDuplicateRace(race)}
                                                    onDelete={() => handleDeleteRace(race)}
                                                    onCycleTicketStatus={() => handleCycleTicketStatus(race)}
                                                    onCycleRaceStatus={() => handleCycleRaceStatus(race)}
                                                    onCopyDate={(date) => handleCopyRaceDate(race, date)}
                                                    editionDate={edition.date ?? null}
                                                    siblingDates={[...new Set(edition.races.filter(r => r.id !== race.id && r.dateOfRace).map(r => r.dateOfRace!))]}
                                                    ticketLoading={cyclingTicketIds.has(race.id)}
                                                    raceStatusLoading={cyclingRaceStatusIds.has(race.id)}
                                                    staleTx={raceHasStaleTx(race)}
                                                    getIcon={getTrailActivityIcon}
                                                    formatDateLabel={formatDateLabel}
                                                    formatTimeLabel={formatTimeLabel}
                                                  />
                                                ))}
                                              </List>
                                            </SortableContext>
                                              );
                                            })()}
                                          </DndContext>
                                        )}
                                      </Box>
                                    </Collapse>
                                  </Paper>
                                ))}
                                {!showOlderEditions && hiddenCount > 0 && (
                                  <Button size="small" variant="text" sx={{ mt: 0.5 }} onClick={() => setShowOlderEditions(true)}>
                                    Show {hiddenCount} older edition{hiddenCount !== 1 ? 's' : ''}
                                  </Button>
                                )}
                                {showOlderEditions && hiddenCount > 0 && (
                                  <Button size="small" variant="text" sx={{ mt: 0.5 }} onClick={() => setShowOlderEditions(false)}>
                                    Hide older editions
                                  </Button>
                                )}
                                </>
                                );
                              })()}
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
            <BilingualTextField
              label="Name"
              valueIs={eventForm.name}
              valueEn={eventForm.nameEn}
              onChangeIs={(v) => setEventField('name', v)}
              onChangeEn={(v) => setEventField('nameEn', v)}
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
            <BilingualTextField
              label="Description"
              valueIs={eventForm.description}
              valueEn={eventForm.descriptionEn}
              onChangeIs={(v) => setEventField('description', v)}
              onChangeEn={(v) => setEventField('descriptionEn', v)}
              multiline
              rows={3}
              fullWidth
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Autocomplete
                options={organizers}
                value={organizers.find(o => o.id === eventForm.organizerId) ?? null}
                onChange={(_, value) => setEventField('organizerId', value?.id ?? '')}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                renderInput={(params) => <TextField {...params} label="Organizer" placeholder="Search organizers…" />}
              />
              <TextField
                label="Event Website (override)"
                value={eventForm.organizerWebsite}
                onChange={(event) => setEventField('organizerWebsite', event.target.value)}
                placeholder="https://…"
                fullWidth
                helperText="Leave blank to use the organizer's website"
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
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Typography variant="subtitle2">GPX Pin (overrides location on map)</Typography>
                <Tooltip title="Pick on map">
                  <IconButton size="small" onClick={() => setShowMapPicker(true)}>
                    <MapIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <TrailStartPicker
                  trailsWithCoords={linkedTrailsWithCoords}
                  onPick={(lat, lng) => {
                    setEventField('gpxPointLat', String(parseFloat(lat.toFixed(6))));
                    setEventField('gpxPointLng', String(parseFloat(lng.toFixed(6))));
                  }}
                />
                {(eventForm.gpxPointLat || eventForm.gpxPointLng) && (
                  <Tooltip title="Clear pin">
                    <IconButton size="small" onClick={() => { setEventField('gpxPointLat', ''); setEventField('gpxPointLng', ''); }}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Latitude"
                  value={eventForm.gpxPointLat}
                  onChange={(e) => setEventField('gpxPointLat', e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text');
                    const parsed = parseCoordPaste(text);
                    if (parsed) {
                      e.preventDefault();
                      setEventField('gpxPointLat', String(parseFloat(parsed.lat.toFixed(6))));
                      setEventField('gpxPointLng', String(parseFloat(parsed.lng.toFixed(6))));
                    }
                  }}
                  placeholder="e.g. 64.1355 — or paste 'lat, lng'"
                  inputProps={{ inputMode: 'decimal' }}
                />
                <TextField
                  label="Longitude"
                  value={eventForm.gpxPointLng}
                  onChange={(e) => setEventField('gpxPointLng', e.target.value)}
                  placeholder="e.g. -21.8954"
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Alert Banner</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2, alignItems: 'flex-start' }}>
                <BilingualTextField
                  label="Alert Message"
                  valueIs={eventForm.alertMessage}
                  valueEn={eventForm.alertMessageEn}
                  onChangeIs={(v) => setEventField('alertMessage', v)}
                  onChangeEn={(v) => setEventField('alertMessageEn', v)}
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
                    <DatePicker
                      label="Date"
                      value={eventForm.scheduleDate ? dayjs(eventForm.scheduleDate) : null}
                      onChange={(val: Dayjs | null) => setEventField('scheduleDate', val ? val.format('YYYY-MM-DD') : '')}
                      slotProps={{ textField: { fullWidth: true } }}
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
        <DialogActions sx={{ justifyContent: 'space-between', borderTop: 1, borderColor: 'divider' }}>
          <Button
            startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
            disabled={translating || (!eventForm.name.trim() && !eventForm.description.trim() && !eventForm.organizerName.trim() && !eventForm.alertMessage.trim())}
            onClick={async () => {
              const [nameEn, descEn, orgEn, alertEn] = await translate([
                eventForm.name, eventForm.description, eventForm.organizerName, eventForm.alertMessage,
              ]);
              if (nameEn) setEventField('nameEn', nameEn);
              if (descEn) setEventField('descriptionEn', descEn);
              if (orgEn) setEventField('organizerNameEn', orgEn);
              if (alertEn) setEventField('alertMessageEn', alertEn);
            }}
          >
            Translate to EN
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setShowEventDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEvent} disabled={!eventForm.name.trim() || saving}>
              {saving ? <CircularProgress size={20} /> : editEventId ? 'Update Event' : 'Create Event'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <GpxMapPicker
        open={showMapPicker}
        initialLat={eventForm.gpxPointLat ? parseFloat(eventForm.gpxPointLat) : null}
        initialLng={eventForm.gpxPointLng ? parseFloat(eventForm.gpxPointLng) : null}
        onConfirm={(lat, lng) => {
          setEventField('gpxPointLat', String(parseFloat(lat.toFixed(6))));
          setEventField('gpxPointLng', String(parseFloat(lng.toFixed(6))));
        }}
        onClose={() => setShowMapPicker(false)}
      />

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
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr 2fr' }, gap: 2 }}>
              <TextField
                label="Year"
                type="number"
                value={editionForm.year}
                onChange={(event) => handleEditionYearChange(event.target.value)}
                onFocus={() => { if (!editionForm.year) setEditionField('year', new Date().getFullYear().toString()); }}
              />
              <DatePicker
                label="Start Date"
                value={editionForm.date ? dayjs(editionForm.date) : null}
                onChange={(val: Dayjs | null) => {
                  const d = val ? val.format('YYYY-MM-DD') : '';
                  setEditionField('date', d);
                  if (!editEditionId && isPastDate(editionForm.endDate || d)) setEditionField('registrationStatus', 'Closed');
                }}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <DatePicker
                label="End Date (multi-day)"
                value={editionForm.endDate ? dayjs(editionForm.endDate) : null}
                onChange={(val: Dayjs | null) => {
                  const d = val ? val.format('YYYY-MM-DD') : '';
                  setEditionField('endDate', d);
                  if (!editEditionId && isPastDate(d || editionForm.date)) setEditionField('registrationStatus', 'Closed');
                }}
                minDate={editionForm.date ? dayjs(editionForm.date) : undefined}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Box>
            <BilingualTextField
              label="Title"
              valueIs={editionForm.title}
              valueEn={editionForm.titleEn}
              onChangeIs={(v) => setEditionField('title', v)}
              onChangeEn={(v) => setEditionField('titleEn', v)}
              placeholder="e.g. 2026 Summer Edition"
              fullWidth
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
            <TextField
              label="Registration URL"
              fullWidth
              value={editionForm.registrationUrl}
              onChange={(event) => setEditionField('registrationUrl', event.target.value)}
              placeholder="https://..."
              InputProps={{ endAdornment: editionForm.registrationUrl ? (
                <IconButton size="small" onClick={() => setEditionField('registrationUrl', '')}><ClearIcon fontSize="small" /></IconButton>
              ) : null }}
            />
            <TextField
              label="Results URL"
              fullWidth
              value={editionForm.resultsUrl}
              onChange={(event) => setEditionField('resultsUrl', event.target.value)}
              placeholder="https://..."
              InputProps={{ endAdornment: editionForm.resultsUrl ? (
                <IconButton size="small" onClick={() => setEditionField('resultsUrl', '')}><ClearIcon fontSize="small" /></IconButton>
              ) : null }}
            />
            <BilingualTextField
              label="Notes"
              valueIs={editionForm.notes}
              valueEn={editionForm.notesEn}
              onChangeIs={(v) => setEditionField('notes', v)}
              onChangeEn={(v) => setEditionField('notesEn', v)}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', borderTop: 1, borderColor: 'divider' }}>
          <Button
            startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
            disabled={translating || (!editionForm.title.trim() && !editionForm.notes.trim())}
            onClick={async () => {
              const [titleEn, notesEn] = await translate([editionForm.title, editionForm.notes]);
              if (titleEn) setEditionField('titleEn', titleEn);
              if (notesEn) setEditionField('notesEn', notesEn);
            }}
          >
            Translate to EN
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setShowEditionDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEdition} disabled={saving}>
              {saving ? <CircularProgress size={20} /> : editEditionId ? 'Update Edition' : 'Create Edition'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog open={showRaceDialog} onClose={() => setShowRaceDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editRaceId ? 'Edit Race' : 'Add Race'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {!editRaceId && prefillRaces.length > 0 && (
              <FormControl fullWidth size="small">
                <InputLabel>Prefill from race in this edition</InputLabel>
                <Select
                  value=""
                  label="Prefill from race in this edition"
                  onChange={(e) => {
                    const source = prefillRaces.find(r => r.id === e.target.value);
                    if (!source) return;
                    const base = buildRaceForm(source);
                    setRaceForm(prev => ({
                      ...base,
                      eventEditionId: prev.eventEditionId,
                      sortOrder: prev.sortOrder,
                      startTime: '',
                    }));
                  }}
                >
                  {prefillRaces.map(r => (
                    <MenuItem key={r.id} value={r.id}>
                      {r.name}{r.distanceLabel ? ` · ${r.distanceLabel}` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Autocomplete
                options={sortedTrails}
                value={sortedTrails.find(trail => trail.id === raceForm.trailId) ?? null}
                onChange={(_, value) => {
                  setRaceField('trailId', value?.id ?? '');
                  if (value && !editRaceId) {
                    const rounded = Math.round(value.length / 1000);
                    setRaceForm(prev => ({
                      ...prev,
                      trailId: value.id,
                      name: prev.name.trim() ? prev.name : `${rounded} km`,
                      distanceLabel: prev.distanceLabel.trim() ? prev.distanceLabel : `${rounded}`,
                    }));
                  }
                }}
                getOptionLabel={(trail) => `${trail.name} (${(trail.length / 1000).toFixed(1)} km)`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="Linked Trail" />}
              />
              <FormControl fullWidth>
                <InputLabel>Activity Type (override)</InputLabel>
                <Select
                  value={raceForm.activityType}
                  label="Activity Type (override)"
                  onChange={(e) => setRaceField('activityType', e.target.value as ActivityType | '')}
                >
                  <MenuItem value=""><em>From trail / not set</em></MenuItem>
                  {ACTIVITY_TYPES.map(at => (
                    <MenuItem key={at} value={at}>{ACTIVITY_ICONS[at]} {at}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <BilingualTextField
              label="Race Name"
              placeholder="e.g. 55 km"
              valueIs={raceForm.name}
              valueEn={raceForm.nameEn}
              onChangeIs={(v) => setRaceField('name', v)}
              onChangeEn={(v) => setRaceField('nameEn', v)}
              required
              fullWidth
            />
            <BilingualTextField
              label="Distance Label"
              placeholder="e.g. 50K"
              valueIs={raceForm.distanceLabel}
              valueEn={raceForm.distanceLabelEn}
              onChangeIs={(v) => setRaceField('distanceLabel', v)}
              onChangeEn={(v) => setRaceField('distanceLabelEn', v)}
              fullWidth
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 140px' }, gap: 2 }}>
              <TextField
                label="Cutoff Time (hrs)"
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
              <BilingualTextField
                label="Certified By"
                valueIs={raceForm.certifiedBy}
                valueEn={raceForm.certifiedByEn}
                onChangeIs={(v) => setRaceField('certifiedBy', v)}
                onChangeEn={(v) => setRaceField('certifiedByEn', v)}
                fullWidth
              />
              <BilingualTextField
                label="Championship Category"
                valueIs={raceForm.championshipCategory}
                valueEn={raceForm.championshipCategoryEn}
                onChangeIs={(v) => setRaceField('championshipCategory', v)}
                onChangeEn={(v) => setRaceField('championshipCategoryEn', v)}
                fullWidth
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <DatePicker
                label="Date of Race"
                value={raceForm.dateOfRace ? dayjs(raceForm.dateOfRace) : null}
                onChange={(val: Dayjs | null) => {
                  const d = val ? val.format('YYYY-MM-DD') : '';
                  setRaceField('dateOfRace', d);
                  if (!editRaceId && isPastDate(d)) {
                    setRaceField('status', 'Completed');
                    setRaceField('ticketStatus', 'Closed');
                  }
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    InputProps: raceDialogEdition?.date ? {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Tooltip title={`Copy date from edition (${raceDialogEdition.date})`}>
                            <IconButton size="small" onClick={() => setRaceField('dateOfRace', raceDialogEdition!.date!)}>
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    } : undefined,
                  },
                }}
              />
              <TimePicker
                label="Start Time"
                ampm={false}
                value={raceForm.startTime ? dayjs(`2000-01-01T${raceForm.startTime}`) : null}
                onChange={(val: Dayjs | null) => setRaceField('startTime', val ? val.format('HH:mm') : '')}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Box>
            <BilingualTextField
              label="Description"
              valueIs={raceForm.description}
              valueEn={raceForm.descriptionEn}
              onChangeIs={(v) => setRaceField('description', v)}
              onChangeEn={(v) => setRaceField('descriptionEn', v)}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Button
              startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
              disabled={translating || (!raceForm.name.trim() && !raceForm.description.trim() && !raceForm.certifiedBy.trim() && !raceForm.championshipCategory.trim())}
              onClick={async () => {
                const [nameEn, descEn, certEn, champEn] = await translate([
                  raceForm.name, raceForm.description, raceForm.certifiedBy, raceForm.championshipCategory,
                ]);
                if (nameEn) setRaceField('nameEn', nameEn);
                if (descEn) setRaceField('descriptionEn', descEn);
                if (certEn) setRaceField('certifiedByEn', certEn);
                if (champEn) setRaceField('championshipCategoryEn', champEn);
              }}
            >
              Translate to EN
            </Button>
            {editRaceId && expandedDetail && (
              expandedDetail.type === 'Series'
                ? expandedDetail.editions.find(ed => ed.id === raceForm.eventEditionId)?.races && expandedDetail.editions.find(ed => ed.id === raceForm.eventEditionId)!.races.length > 1
                : expandedDetail.editions.length > 1
            ) && (
              <FormControlLabel
                control={<Switch checked={applyToAllEditions} onChange={(_, checked) => setApplyToAllEditions(checked)} size="small" />}
                label={<Typography variant="body2">{expandedDetail.type === 'Series' ? 'Apply to other races in edition' : 'Apply to other editions'}</Typography>}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
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

      {/* Copy races confirmation dialog */}
      <Dialog open={!!copyRacesConfirm} onClose={() => setCopyRacesConfirm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Copy Races</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Copy <strong>{copyRacesConfirm?.source.races.length} race{copyRacesConfirm?.source.races.length === 1 ? '' : 's'}</strong> from edition <strong>{copyRacesConfirm ? buildEditionLabel(copyRacesConfirm.source) : ''}</strong> into this edition?
          </DialogContentText>
          <DialogContentText sx={{ mt: 1.5 }}>
            Races will be cloned with statuses reset to Active/Available.
            {copyRacesConfirm?.edition.date && copyRacesConfirm?.source.date
              ? ' Dates will be pre-filled based on the offset from the previous edition.'
              : ' Dates will need to be set manually.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyRacesConfirm(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmCopyRaces} disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Copy Races'}</Button>
        </DialogActions>
      </Dialog>

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
                        <Typography variant="body2">{item.date || <em style={{ color: 'gray' }}>TBD</em>}</Typography>
                      </Box>
                      {bulkMissingItems.some(i => i.endDate) && (
                        <Box component="td" sx={{ py: 1, pr: 1 }}>
                          <Typography variant="body2">{item.endDate || <em style={{ color: 'gray' }}>—</em>}</Typography>
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
            startIcon={<BulkAddIcon />}
            onClick={handleBulkCreateMissingEditions}
            disabled={bulkMissingLoading || !!bulkMissingProgress || selectedBulkCount === 0}
          >
            Create {selectedBulkCount || ''} Edition{selectedBulkCount !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick URL edit popover */}
      {urlPopover && (() => {
        const targetYear = urlPopover.edition.year;
        const source = [...(expandedDetail?.editions ?? [])]
          .sort(sortEditions)
          .find(ed => ed.id !== urlPopover.edition.id && (ed.registrationUrl || ed.resultsUrl));
        const suggestedReg = source?.registrationUrl ?? '';
        const suggestedResults = source && targetYear
          ? bumpYearInUrl(source.resultsUrl ?? '', source.year, targetYear) || (source.resultsUrl ?? '')
          : (source?.resultsUrl ?? '');
        const hasSuggestion = !!source && (suggestedReg || suggestedResults);
        return (
          <Popover
            open
            anchorEl={urlPopover.anchorEl}
            onClose={() => setUrlPopover(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, width: 380 }}>
              <Typography variant="subtitle2">URLs — {buildEditionLabel(urlPopover.edition)}</Typography>
              {hasSuggestion && (
                <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Suggest from {source!.year ?? 'previous'} edition
                    </Typography>
                    <Button
                      size="small"
                      sx={{ minWidth: 0, py: 0 }}
                      onClick={() => setUrlPopover(prev => prev ? { ...prev, regUrl: suggestedReg, resultsUrl: suggestedResults } : null)}
                    >
                      Apply all
                    </Button>
                  </Box>
                  {suggestedReg && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.7rem' }}>{suggestedReg}</Typography>
                      <Tooltip title="Use for registration URL">
                        <IconButton size="small" onClick={() => setUrlPopover(prev => prev ? { ...prev, regUrl: suggestedReg } : null)}>
                          <CopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                  {suggestedResults && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.7rem' }}>{suggestedResults}</Typography>
                      <Tooltip title="Use for results URL">
                        <IconButton size="small" onClick={() => setUrlPopover(prev => prev ? { ...prev, resultsUrl: suggestedResults } : null)}>
                          <CopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              )}
              <TextField
                label="Registration URL"
                size="small"
                fullWidth
                value={urlPopover.regUrl}
                onChange={(e) => setUrlPopover(prev => prev ? { ...prev, regUrl: e.target.value } : null)}
                placeholder="https://..."
              />
              <TextField
                label="Results URL"
                size="small"
                fullWidth
                value={urlPopover.resultsUrl}
                onChange={(e) => setUrlPopover(prev => prev ? { ...prev, resultsUrl: e.target.value } : null)}
                placeholder="https://..."
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button size="small" onClick={() => setUrlPopover(null)}>Cancel</Button>
                <Button size="small" variant="contained" onClick={handleSaveUrlPopover}>Save</Button>
              </Box>
            </Box>
          </Popover>
        );
      })()}

      {/* Quick notes edit popover */}
      {notesPopover && (
        <Popover
          open
          anchorEl={notesPopover.anchorEl}
          onClose={() => setNotesPopover(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, width: 360 }}>
            <Typography variant="subtitle2">Notes — {buildEditionLabel(notesPopover.edition)}</Typography>
            <TextField
              label="Notes (IS)"
              size="small"
              fullWidth
              multiline
              rows={3}
              autoFocus
              value={notesPopover.notes}
              onChange={(e) => setNotesPopover(prev => prev ? { ...prev, notes: e.target.value } : null)}
              placeholder="Internal notes about this edition…"
            />
            <TextField
              label="Notes (EN)"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={notesPopover.notesEn}
              onChange={(e) => setNotesPopover(prev => prev ? { ...prev, notesEn: e.target.value } : null)}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button size="small" onClick={() => setNotesPopover(null)}>Cancel</Button>
              <Button size="small" variant="contained" onClick={handleSaveNotesPopover}>Save</Button>
            </Box>
          </Box>
        </Popover>
      )}

      {/* Shift race dates confirm dialog */}
      <Dialog open={!!pendingDateShift} onClose={() => setPendingDateShift(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Shift race dates?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The edition date moved by {pendingDateShift && (pendingDateShift.offsetDays > 0 ? '+' : '')}{pendingDateShift?.offsetDays} day{Math.abs(pendingDateShift?.offsetDays ?? 0) !== 1 ? 's' : ''}.
            Shift {pendingDateShift?.races.length} race date{(pendingDateShift?.races.length ?? 0) !== 1 ? 's' : ''} by the same amount?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDateShift(null)}>Skip</Button>
          <Button variant="contained" onClick={handleShiftRaceDates}>Shift Dates</Button>
        </DialogActions>
      </Dialog>

      {/* Bulk date entry dialog */}
      <Dialog open={showBulkDatesDialog} onClose={() => setShowBulkDatesDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set Race Dates</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {bulkDatesEditionDate && !bulkDatesIsSeries && bulkDates.some(d => !d.dateOfRace) && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<CalendarIcon />}
                onClick={() => setBulkDates(prev => prev.map(d => d.dateOfRace ? d : { ...d, dateOfRace: bulkDatesEditionDate }))}
                sx={{ alignSelf: 'flex-start' }}
              >
                Fill empty dates from edition ({bulkDatesEditionDate})
              </Button>
            )}
            {bulkDatesIsSeries && bulkDatesScheduleRule && bulkDatesEditionYear && bulkDatesScheduleRule.weekOfMonth && bulkDatesScheduleRule.dayOfWeek && bulkDatesScheduleRule.monthStart && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<CalendarIcon />}
                onClick={() => {
                  const suggested = suggestSeriesLegDates(bulkDatesScheduleRule!, bulkDatesEditionYear!, bulkDates.length);
                  setBulkDates(prev => prev.map((d, i) => d.dateOfRace ? d : { ...d, dateOfRace: suggested[i] ?? d.dateOfRace }));
                }}
                sx={{ alignSelf: 'flex-start' }}
              >
                Suggest dates from schedule ({bulkDatesScheduleRule.weekOfMonth === 1 ? '1st' : bulkDatesScheduleRule.weekOfMonth === 2 ? '2nd' : bulkDatesScheduleRule.weekOfMonth === 3 ? '3rd' : `${bulkDatesScheduleRule.weekOfMonth}th`} {bulkDatesScheduleRule.dayOfWeek} monthly)
              </Button>
            )}
            {bulkDates.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No races in this edition.</Typography>
            ) : bulkDates.map((entry, i) => (
              <Box key={entry.race.id}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {entry.race.name}{entry.race.distanceLabel ? ` · ${entry.race.distanceLabel}` : ''}
                  </Typography>
                  {entry.prevDateOfRace && (
                    <Typography variant="caption" color="text.disabled">
                      prev: {formatDateLabel(entry.prevDateOfRace, entry.prevDateOfRace)}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <DatePicker
                    label="Date"
                    value={entry.dateOfRace ? dayjs(entry.dateOfRace) : null}
                    onChange={(val: Dayjs | null) => setBulkDates(prev => prev.map((d, j) => j === i ? { ...d, dateOfRace: val ? val.format('YYYY-MM-DD') : '' } : d))}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                  <TimePicker
                    label="Start time"
                    ampm={false}
                    value={entry.startTime ? dayjs(`2000-01-01T${entry.startTime}`) : null}
                    onChange={(val: Dayjs | null) => setBulkDates(prev => prev.map((d, j) => j === i ? { ...d, startTime: val ? val.format('HH:mm') : '' } : d))}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        InputProps: entry.startTime && bulkDates.length > 1 ? {
                          endAdornment: (
                            <InputAdornment position="end">
                              <Tooltip title="Apply to all races">
                                <IconButton size="small" onClick={() => setBulkDates(prev => prev.map(d => ({ ...d, startTime: entry.startTime })))}>
                                  <CopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </InputAdornment>
                          ),
                        } : undefined,
                      },
                    }}
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
