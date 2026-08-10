import { useState, useMemo, type ReactNode } from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
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
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Menu,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DragHandleIcon from '@mui/icons-material/DragIndicator';
import FlagIcon from '@mui/icons-material/Flag';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  useEventDetail,
  type CreateRaceInput,
  type EventDetailDto,
  type EventEditionDto,
  type EventStatus,
  type RaceDto,
  type RaceStatus,
  type RegistrationStatus,
  type TicketStatus,
  type UpdateEventInput,
} from '../hooks/useEvents';
import { useTrails } from '../hooks/useTrails';
import { apiFetch } from '../hooks/api';
import RaceFormCard from '../components/events/RaceFormCard';
import EventFormCard from '../components/events/EventFormCard';
import BilingualTextField from '../components/BilingualTextField';
import { BilingualLangProvider, useBilingualLang } from '../contexts/BilingualLangContext';
import {
  buildRaceForm,
  getRaceStatusColor,
  getTicketStatusColor,
  raceHasStaleTx,
  RACE_STATUSES,
  TICKET_STATUSES,
  type RaceFormState,
} from '../utils/eventForms';
import { hashText } from '../utils/translationHash';

const PUBLIC_SITE_URL = ((import.meta.env.VITE_PUBLIC_SITE_URL ?? '') as string).replace(/\/$/, '');

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
  return `${d}. ${months[(m ?? 1) - 1]} ${y}`;
}

function isPastDate(dateStr: string): boolean {
  return !!dateStr && dateStr < new Date().toISOString().slice(0, 10);
}

function bumpYearInUrl(url: string, fromYear: number | null | undefined, toYear: number): string {
  if (!url || !fromYear) return '';
  return url.split(String(fromYear)).join(String(toYear));
}

function suggestEditionDateForYear(prevDateStr: string | null | undefined, toYear: number): string {
  if (!prevDateStr) return '';
  const prev = new Date(prevDateStr + 'T00:00:00');
  const candidate = new Date(prev);
  candidate.setFullYear(toYear);
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
  const durationDays = Math.round(
    (new Date(prevEndStr + 'T00:00:00').getTime() - new Date(prevStartStr + 'T00:00:00').getTime()) / 86400000,
  );
  if (durationDays <= 0) return '';
  const newEnd = new Date(newStartStr + 'T00:00:00');
  newEnd.setDate(newEnd.getDate() + durationDays);
  return newEnd.toISOString().slice(0, 10);
}

function computeClonedRaceDate(
  sourceEditionDate: string | null | undefined,
  raceDateOfRace: string | null | undefined,
  newEditionDate: string | null | undefined,
): string | null {
  if (!sourceEditionDate || !raceDateOfRace || !newEditionDate) return null;
  const offsetDays = Math.round(
    (new Date(raceDateOfRace + 'T00:00:00').getTime() - new Date(sourceEditionDate + 'T00:00:00').getTime()) / 86400000,
  );
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

function editionHasStaleTx(edition: EventEditionDto): boolean {
  const h = edition.translationHashes ?? {};
  return isTxStale(edition.title, edition.titleEn, h['Title'])
    || isTxStale(edition.notes, edition.notesEn, h['Notes']);
}

const DAY_OF_WEEK_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

function nthWeekdayOfMonth(year: number, month: number, weekOfMonth: number, dayOfWeek: string): string {
  const dayIdx = DAY_OF_WEEK_INDEX[dayOfWeek] ?? 0;
  const firstOfMonth = dayjs(new Date(year, month - 1, 1));
  const firstOccurrence = firstOfMonth.day() <= dayIdx
    ? firstOfMonth.day(dayIdx)
    : firstOfMonth.day(dayIdx + 7);
  return firstOccurrence.add((weekOfMonth - 1) * 7, 'day').format('YYYY-MM-DD');
}

function suggestSeriesLegDates(rule: import('../hooks/useEvents').ScheduleRule, year: number, legCount: number): string[] {
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

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatSchedule(rule: import('../hooks/useEvents').ScheduleRule | null | undefined): string | null {
  if (!rule) return null;
  if (rule.type === 'Fixed') return rule.date ? fmtDate(rule.date) : null;
  if (rule.type === 'Yearly') {
    if (rule.dayOfMonth != null)
      return `${MONTHS[rule.month ?? 1]} ${rule.dayOfMonth}`;
    if (rule.weekOfMonth != null && rule.dayOfWeek && rule.month != null) {
      const w = rule.weekOfMonth === -1 ? 'Last' : `${rule.weekOfMonth}.`;
      return `${w} ${rule.dayOfWeek} in ${MONTHS[rule.month]}`;
    }
  }
  if (rule.type === 'Seasonal' && rule.dayOfWeek && rule.monthStart != null && rule.monthEnd != null) {
    const w = rule.weekOfMonth != null
      ? (rule.weekOfMonth === -1 ? 'Last ' : `${rule.weekOfMonth}. `)
      : 'Every ';
    return `${w}${rule.dayOfWeek}, ${MONTHS[rule.monthStart]}–${MONTHS[rule.monthEnd]}`;
  }
  if (rule.type === 'Approximate' && rule.month != null) {
    return rule.monthEnd != null
      ? `Usually ${MONTHS[rule.month]}–${MONTHS[rule.monthEnd]}`
      : `Usually in ${MONTHS[rule.month]}`;
  }
  return null;
}

const REGISTRATION_STATUSES: RegistrationStatus[] = ['NotStarted', 'Open', 'Closed'];

function getRegistrationStatusColor(status: RegistrationStatus): 'default' | 'success' | 'warning' {
  if (status === 'Open') return 'success';
  if (status === 'Closed') return 'default';
  return 'warning';
}

function sortEditions(a: EventEditionDto, b: EventEditionDto): number {
  if (a.date && b.date) return b.date.localeCompare(a.date);
  if (a.date) return -1;
  if (b.date) return 1;
  if (a.year != null && b.year != null) return b.year - a.year;
  return 0;
}

function editionLabel(ed: EventEditionDto): string {
  if (ed.title?.trim()) return ed.title;
  if (ed.date) return ed.endDate ? `${fmtDate(ed.date)} – ${fmtDate(ed.endDate)}` : fmtDate(ed.date);
  if (ed.year != null) return `Edition ${ed.year}`;
  return 'Untitled edition';
}

// ── Edition inline create/edit dialog ────────────────────────────────────────

interface EditionFormState {
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
}

function emptyEditionForm(): EditionFormState {
  return {
    year: String(new Date().getFullYear()),
    date: '', endDate: '', title: '', titleEn: '',
    registrationUrl: '', resultsUrl: '', notes: '', notesEn: '',
    registrationStatus: 'NotStarted', trailId: '',
  };
}

function buildEditionForm(ed: EventEditionDto): EditionFormState {
  return {
    year: ed.year?.toString() ?? '',
    date: ed.date ?? '', endDate: ed.endDate ?? '',
    title: ed.title ?? '', titleEn: ed.titleEn ?? '',
    registrationUrl: ed.registrationUrl ?? '', resultsUrl: ed.resultsUrl ?? '',
    notes: ed.notes ?? '', notesEn: ed.notesEn ?? '',
    registrationStatus: ed.registrationStatus, trailId: ed.trailId ?? '',
  };
}

interface EditionDialogProps {
  open: boolean;
  edition: EventEditionDto | null;
  eventId: string;
  onClose: () => void;
  onSaved: (newEditionId?: string) => void;
  onNotify: (msg: ReactNode, sev?: 'success' | 'error') => void;
  initialValues?: EditionFormState;
}

function LangToggleButton() {
  const { lang, toggle } = useBilingualLang();
  return (
    <Chip
      label={lang === 'is' ? 'IS' : 'EN'}
      size="small"
      onClick={toggle}
      color={lang === 'en' ? 'primary' : 'default'}
      variant={lang === 'en' ? 'filled' : 'outlined'}
      sx={{ fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', minWidth: 36 }}
    />
  );
}

function EditionDialogInner({ open, edition, eventId, onClose, onSaved, onNotify, initialValues }: EditionDialogProps) {
  const isNew = edition === null;
  const [form, setForm] = useState<EditionFormState>(initialValues ?? (edition ? buildEditionForm(edition) : emptyEditionForm()));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof EditionFormState>(k: K, v: EditionFormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    const input = {
      eventId,
      year: form.year.trim() ? Number(form.year) : null,
      date: form.date || null,
      endDate: form.endDate || null,
      title: form.title.trim() || undefined,
      titleEn: form.titleEn.trim() || undefined,
      registrationUrl: form.registrationUrl.trim() || undefined,
      resultsUrl: form.resultsUrl.trim() || undefined,
      notes: form.notes.trim() || undefined,
      notesEn: form.notesEn.trim() || undefined,
      registrationStatus: form.registrationStatus,
      trailId: form.trailId || null,
    };
    setSaving(true);
    try {
      if (isNew) {
        const result = await apiFetch<{ id: string }>(`/api/v1/admin/events/${eventId}/editions`, {
          method: 'POST', body: JSON.stringify(input),
        });
        onNotify('Edition created', 'success');
        onSaved(result.id);
      } else {
        await apiFetch(`/api/v1/admin/editions/${edition!.id}`, {
          method: 'PUT', body: JSON.stringify({ id: edition!.id, ...input }),
        });
        onNotify('Edition saved', 'success');
        onSaved();
      }
      onClose();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save edition', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      TransitionProps={{ onEnter: () => setForm(initialValues ?? (edition ? buildEditionForm(edition) : emptyEditionForm())) }}>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          {isNew ? 'Add edition' : 'Edit edition'}
          <LangToggleButton />
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1.5}>
            <TextField size="small" fullWidth label="Year" type="number" value={form.year}
              onChange={e => {
                const newYear = e.target.value;
                const oldYear = form.year;
                setForm(prev => {
                  const updates: Partial<EditionFormState> = { year: newYear };
                  const ny = parseInt(newYear, 10);
                  const oy = parseInt(oldYear, 10);
                  if (newYear.length === 4 && !isNaN(ny) && oldYear.length === 4 && !isNaN(oy)) {
                    if (prev.date) updates.date = prev.date.replace(/^\d{4}/, newYear);
                    if (prev.endDate) updates.endDate = prev.endDate.replace(/^\d{4}/, newYear);
                    if (/^\d{4}$/.test(prev.title.trim())) updates.title = newYear;
                    if (prev.resultsUrl) updates.resultsUrl = prev.resultsUrl.replace(new RegExp(`${oy}(/?)$`), `${newYear}$1`);
                  }
                  return { ...prev, ...updates };
                });
              }} />
            <DatePicker label="Start date"
              value={form.date ? dayjs(form.date) : null}
              onChange={v => set('date', v ? v.format('YYYY-MM-DD') : '')}
              slotProps={{ textField: { size: 'small', fullWidth: true } }} />
            <DatePicker label="End date"
              value={form.endDate ? dayjs(form.endDate) : null}
              onChange={v => set('endDate', v ? v.format('YYYY-MM-DD') : '')}
              slotProps={{ textField: { size: 'small', fullWidth: true } }} />
          </Stack>
          <BilingualTextField
            size="small" fullWidth label="Title"
            valueIs={form.title} valueEn={form.titleEn}
            onChangeIs={v => set('title', v)} onChangeEn={v => set('titleEn', v)}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Registration status</InputLabel>
            <Select value={form.registrationStatus} label="Registration status"
              onChange={e => set('registrationStatus', e.target.value as RegistrationStatus)}>
              {REGISTRATION_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" fullWidth label="Registration URL" value={form.registrationUrl}
            onChange={e => set('registrationUrl', e.target.value)} />
          <TextField size="small" fullWidth label="Results URL" value={form.resultsUrl}
            onChange={e => set('resultsUrl', e.target.value)} />
          <BilingualTextField
            size="small" fullWidth label="Notes" multiline rows={2}
            valueIs={form.notes} valueEn={form.notesEn}
            onChangeIs={v => set('notes', v)} onChangeEn={v => set('notesEn', v)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Add edition' : 'Save edition'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditionDialog(props: EditionDialogProps) {
  return (
    <BilingualLangProvider>
      <EditionDialogInner {...props} />
    </BilingualLangProvider>
  );
}

// ── Sortable race row ─────────────────────────────────────────────────────────

interface SortableRaceRowProps {
  race: RaceDto;
  edition: EventEditionDto;
  isActive: boolean;
  staleTx: boolean;
  detail: EventDetailDto | null;
  onOpen: () => void;
  onDuplicate: () => void;
  onCycleStatus: () => void;
  onCycleTicket: () => void;
  patchRaceInDetail: (raceId: string, patch: Partial<RaceDto>) => void;
  racePayload: (race: RaceDto, patch: Partial<RaceDto>) => object;
}

function SortableRaceRow({ race, edition, isActive, staleTx, detail, onOpen, onDuplicate, onCycleStatus, onCycleTicket, patchRaceInDetail, racePayload }: SortableRaceRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: race.id });
  const [copyDateAnchor, setCopyDateAnchor] = useState<HTMLElement | null>(null);

  const handleCopyDate = async (date: string) => {
    await apiFetch(`/api/v1/admin/races/${race.id}`, { method: 'PUT', body: JSON.stringify(racePayload(race, { dateOfRace: date })) });
    patchRaceInDetail(race.id, { dateOfRace: date });
  };

  const siblingDates = edition.races.filter(r => r.id !== race.id && r.dateOfRace).map(r => r.dateOfRace!);
  const sources = [
    ...(edition.date ? [{ date: edition.date, label: `Parent: ${fmtDate(edition.date)}` }] : []),
    ...siblingDates.filter(d => d !== edition.date).map(d => ({ date: d, label: `Sibling: ${fmtDate(d)}` })),
  ];

  return (
    <TableRow
      ref={setNodeRef}
      hover
      sx={{
        cursor: 'pointer',
        bgcolor: isActive ? 'primary.50' : undefined,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={onOpen}
    >
      <TableCell sx={{ px: 0.5, color: 'text.disabled', cursor: 'grab' }} {...attributes} {...listeners} onClick={e => e.stopPropagation()}>
        <DragHandleIcon fontSize="small" />
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="body2" fontWeight={600}>{race.name}</Typography>
          {staleTx && (
            <Tooltip title="EN translation may be outdated">
              <Chip label="EN" size="small" color="warning" sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.75 } }} />
            </Tooltip>
          )}
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">{race.distanceLabel ?? '—'}</Typography>
      </TableCell>
      <TableCell>
        {race.trailName
          ? <Typography variant="body2" color="text.secondary">{race.trailName}</Typography>
          : <Chip label="No route" size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }} />
        }
      </TableCell>
      <TableCell onClick={e => e.stopPropagation()}>
        {race.dateOfRace ? (
          <Typography variant="body2">
            {fmtDate(race.dateOfRace)}{race.startTime && ` · ${race.startTime.slice(0, 5)}`}
          </Typography>
        ) : (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="body2" color="warning.main">Missing</Typography>
            {sources.length === 1 && (
              <Tooltip title={sources[0].label}>
                <Chip size="small" variant="outlined" color="info"
                  label={sources[0].date === edition.date ? 'Copy parent' : 'Copy sibling'}
                  onClick={() => void handleCopyDate(sources[0].date)}
                  sx={{ cursor: 'pointer', height: 20, fontSize: '0.65rem' }} />
              </Tooltip>
            )}
            {sources.length > 1 && (
              <>
                <Chip size="small" variant="outlined" color="info" label="Copy date"
                  onClick={e => { e.stopPropagation(); setCopyDateAnchor(e.currentTarget); }}
                  sx={{ cursor: 'pointer', height: 20, fontSize: '0.65rem' }} />
                <Menu anchorEl={copyDateAnchor} open={!!copyDateAnchor} onClose={() => setCopyDateAnchor(null)}>
                  {sources.map(s => (
                    <MenuItem key={s.date} onClick={() => { void handleCopyDate(s.date); setCopyDateAnchor(null); }}>{s.label}</MenuItem>
                  ))}
                </Menu>
              </>
            )}
          </Stack>
        )}
      </TableCell>
      <TableCell>
        <Tooltip title="Click to cycle status">
          <Chip label={race.status} size="small" color={getRaceStatusColor(race.status)}
            onClick={e => { e.stopPropagation(); onCycleStatus(); }} sx={{ cursor: 'pointer' }} />
        </Tooltip>
      </TableCell>
      <TableCell>
        <Tooltip title="Click to cycle ticket status">
          <Chip label={race.ticketStatus} size="small" variant="outlined" color={getTicketStatusColor(race.ticketStatus)}
            onClick={e => { e.stopPropagation(); onCycleTicket(); }} sx={{ cursor: 'pointer' }} />
        </Tooltip>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">{race.maxParticipants ?? '—'}</Typography>
      </TableCell>
      <TableCell align="right" onClick={e => e.stopPropagation()}>
        <Stack direction="row" justifyContent="flex-end" spacing={0.25}>
          <Tooltip title="Edit race">
            <IconButton size="small" onClick={onOpen}><EditIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Duplicate race">
            <IconButton size="small" onClick={e => { e.stopPropagation(); onDuplicate(); }}><ContentCopyIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface EventDetailPageProps {
  onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
  onNavigateToRaceManager?: (date: string) => void;
}

export default function EventDetailPage({ onNotify, onNavigateToRaceManager }: EventDetailPageProps) {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { detail, loading, error, refresh, setDetail } = useEventDetail(slug);
  const { trails } = useTrails();

  const [expandedEditionIds, setExpandedEditionIds] = useState<Set<string>>(new Set());
  const [showOlderEditions, setShowOlderEditions] = useState(false);

  // race: null = new, RaceDto with id = edit, RaceDto with id='' = duplicate (new seeded from existing)
  const [raceForm, setRaceForm] = useState<{ editionId: string; race: RaceDto | null } | null>(null);

  const [editingEvent, setEditingEvent] = useState(false);

  const [editionDialogOpen, setEditionDialogOpen] = useState(false);
  const [editingEdition, setEditingEdition] = useState<EventEditionDto | null>(null);
  const [editionInitialValues, setEditionInitialValues] = useState<EditionFormState | undefined>(undefined);
  const [cloneFromEditionId, setCloneFromEditionId] = useState<string | null>(null);

  const [deletingEditionId, setDeletingEditionId] = useState<string | null>(null);
  const [copyRacesConfirm, setCopyRacesConfirm] = useState<{ edition: EventEditionDto; source: EventEditionDto } | null>(null);
  const [copyingRaces, setCopyingRaces] = useState(false);
  const [showBulkDatesDialog, setShowBulkDatesDialog] = useState(false);
  const [bulkDatesEdition, setBulkDatesEdition] = useState<EventEditionDto | null>(null);
  const [bulkDates, setBulkDates] = useState<Array<{ race: RaceDto; dateOfRace: string; startTime: string; prevDateOfRace?: string }>>([]);
  const [savingBulkDates, setSavingBulkDates] = useState(false);
  const [localRaceOrder, setLocalRaceOrder] = useState<Map<string, string[]>>(new Map());
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(false);

  const currentYear = new Date().getFullYear();

  const editionsByYear = useMemo(() => {
    if (!detail) return { visible: [], hidden: 0 };
    const sorted = [...detail.editions].sort(sortEditions);
    const today = new Date().toISOString().slice(0, 10);
    const older = sorted.filter(ed => {
      const edYear = ed.year ?? (ed.date ? Number(ed.date.slice(0, 4)) : null);
      if (edYear == null || edYear >= currentYear) return false;
      if (ed.date && ed.date >= today) return false;
      return true;
    });
    const visible = showOlderEditions ? sorted : sorted.filter(ed => !older.includes(ed));
    return { visible, hidden: older.length };
  }, [detail, showOlderEditions, currentYear]);

  const toggleEdition = (id: string) =>
    setExpandedEditionIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const openRaceForm = (race: RaceDto | null, edition: EventEditionDto) => {
    setExpandedEditionIds(prev => { const n = new Set(prev); n.add(edition.id); return n; });
    setRaceForm({ editionId: edition.id, race });
  };

  const [duplicateRaceValues, setDuplicateRaceValues] = useState<RaceFormState | undefined>(undefined);

  const openDuplicateRace = (race: RaceDto, edition: EventEditionDto) => {
    const maxSort = Math.max(...edition.races.map(r => r.sortOrder), -1);
    const values: RaceFormState = { ...buildRaceForm(race), sortOrder: String(maxSort + 1) };
    setExpandedEditionIds(prev => { const n = new Set(prev); n.add(edition.id); return n; });
    setDuplicateRaceValues(values);
    setRaceForm({ editionId: edition.id, race: null });
  };

  const handleCreateRace = async (editionId: string, input: object): Promise<string> => {
    const result = await apiFetch<{ id: string }>(`/api/v1/admin/editions/${editionId}/races`, {
      method: 'POST', body: JSON.stringify(input),
    });
    return result.id;
  };

  const handleCloneEdition = (edition: EventEditionDto) => {
    const nextYear = (edition.year ?? new Date().getFullYear()) + 1;
    const suggestedDate = suggestEditionDateForYear(edition.date, nextYear);
    const suggestedEndDate = suggestEditionEndDateForYear(edition.date, edition.endDate, suggestedDate);
    setCloneFromEditionId(edition.id);
    setEditionInitialValues({
      year: String(nextYear),
      date: suggestedDate,
      endDate: suggestedEndDate,
      title: edition.title ? String(nextYear) : '',
      titleEn: '',
      registrationUrl: bumpYearInUrl(edition.registrationUrl ?? '', edition.year, nextYear),
      resultsUrl: bumpYearInUrl(edition.resultsUrl ?? '', edition.year, nextYear),
      notes: '',
      notesEn: '',
      registrationStatus: suggestedDate && isPastDate(suggestedDate) ? 'Closed' : 'NotStarted',
      trailId: edition.trailId ?? '',
    });
    setEditingEdition(null); // null = create mode
    setEditionDialogOpen(true);
  };

  const handleRaceSaved = async () => {
    setRaceForm(null);
    setDuplicateRaceValues(undefined);
    await refresh();
  };

  const handleRaceDeleted = async () => {
    setRaceForm(null);
    setDuplicateRaceValues(undefined);
    await refresh();
  };

  const EVENT_STATUSES_CYCLE: EventStatus[] = ['Unconfirmed', 'Confirmed', 'Cancelled', 'Hidden', 'Unlisted'];

  const handleCycleEventStatus = () => {
    const next = EVENT_STATUSES_CYCLE[(EVENT_STATUSES_CYCLE.indexOf(detail!.status) + 1) % EVENT_STATUSES_CYCLE.length]!;
    setDetail(prev => prev ? { ...prev, status: next } : prev);
    apiFetch(`/api/v1/admin/events/${detail!.id}`, {
      method: 'PUT',
      body: JSON.stringify({ id: detail!.id, name: detail!.name, type: detail!.type, activityType: detail!.activityType, status: next,
        organizerId: detail!.organizerId, locationId: detail!.locationId, scheduleRule: detail!.scheduleRule, socialLinks: detail!.socialLinks,
        gpxPointLat: detail!.gpxPointLat, gpxPointLng: detail!.gpxPointLng }),
    }).catch(() => {
      setDetail(prev => prev ? { ...prev, status: detail!.status } : prev);
      onNotify('Failed to update event status', 'error');
    });
  };

  const handleUpdateEvent = async (id: string, input: Omit<UpdateEventInput, 'id'>) => {
    await apiFetch(`/api/v1/admin/events/${id}`, {
      method: 'PUT', body: JSON.stringify({ id, ...input }),
    });
    await refresh();
  };

  const handleEventSaved = (updated: EventDetailDto) => {
    void refresh();
    // header will re-render on next refresh; detail already patched optimistically in EventFormCard
    void updated;
  };

  const patchRaceInDetail = (raceId: string, patch: Partial<RaceDto>) =>
    setDetail(prev => prev ? {
      ...prev,
      editions: prev.editions.map(ed => ({
        ...ed,
        races: ed.races.map(r => r.id === raceId ? { ...r, ...patch } : r),
      })),
    } : prev);

  const racePayload = (race: RaceDto, patch: Partial<RaceDto>) => {
    const r = { ...race, ...patch };
    return {
      id: r.id,
      trailId: r.trailId,
      name: r.name,
      nameEn: r.nameEn,
      distanceLabel: r.distanceLabel,
      distanceLabelEn: r.distanceLabelEn,
      cutoffMinutes: r.cutoffMinutes,
      description: r.description,
      descriptionEn: r.descriptionEn,
      status: r.status,
      sortOrder: r.sortOrder,
      ticketStatus: r.ticketStatus,
      maxParticipants: r.maxParticipants,
      itraPoints: r.itraPoints,
      certifiedBy: r.certifiedBy,
      certifiedByEn: r.certifiedByEn,
      prizeMoney: r.prizeMoney,
      championshipCategory: r.championshipCategory,
      championshipCategoryEn: r.championshipCategoryEn,
      dateOfRace: r.dateOfRace,
      startTime: r.startTime,
      activityType: r.activityType,
    };
  };

  const handleSetTrailForAllRaces = async (edition: EventEditionDto, trailId: string) => {
    const races = edition.races.filter(r => !r.trailId);
    if (races.length === 0) return;
    const trail = trails.find(t => t.id === trailId);
    const trailName = trail?.name ?? null;
    try {
      await Promise.all(races.map(race =>
        apiFetch(`/api/v1/admin/races/${race.id}`, {
          method: 'PUT', body: JSON.stringify(racePayload(race, { trailId })),
        }),
      ));
      races.forEach(race => patchRaceInDetail(race.id, { trailId, trailName }));
      onNotify(`Trail set on ${races.length} race${races.length !== 1 ? 's' : ''}`, 'success');
    } catch {
      onNotify('Failed to set trail', 'error');
    }
  };

  const handleCopyRacesFromPrevious = (edition: EventEditionDto) => {
    if (!detail) return;
    const allSorted = [...detail.editions].sort(sortEditions);
    const targetIdx = allSorted.findIndex(ed => ed.id === edition.id);
    let source: EventEditionDto | undefined;
    for (let i = targetIdx - 1; i >= 0; i--) {
      if (allSorted[i].races.length > 0) { source = allSorted[i]; break; }
    }
    if (!source) source = [...allSorted].reverse().find(ed => ed.id !== edition.id && ed.races.length > 0);
    if (!source) return;
    setCopyRacesConfirm({ edition, source });
  };

  const handleConfirmCopyRaces = async () => {
    if (!copyRacesConfirm) return;
    const { edition, source } = copyRacesConfirm;
    setCopyRacesConfirm(null);
    setCopyingRaces(true);
    try {
      await Promise.all(source.races.map(race =>
        apiFetch(`/api/v1/admin/editions/${edition.id}/races`, {
          method: 'POST',
          body: JSON.stringify({
            eventEditionId: edition.id,
            trailId: race.trailId ?? null,
            name: race.name,
            distanceLabel: race.distanceLabel ?? undefined,
            distanceLabelEn: race.distanceLabelEn ?? undefined,
            cutoffMinutes: race.cutoffMinutes ?? null,
            description: race.description ?? undefined,
            status: 'Active', sortOrder: race.sortOrder, ticketStatus: 'Available',
            maxParticipants: race.maxParticipants ?? null, itraPoints: race.itraPoints ?? null,
            certifiedBy: race.certifiedBy ?? undefined, prizeMoney: race.prizeMoney,
            championshipCategory: race.championshipCategory ?? undefined,
            dateOfRace: computeClonedRaceDate(source.date, race.dateOfRace, edition.date),
            startTime: race.startTime ? race.startTime.slice(0, 5) : null,
          } satisfies CreateRaceInput),
        }),
      ));
      const datesPreFilled = !!edition.date && !!source.date && source.races.some(r => r.dateOfRace);
      onNotify(`Copied ${source.races.length} race${source.races.length === 1 ? '' : 's'} from "${source.title ?? source.year ?? ''}"${datesPreFilled ? ' — dates pre-filled' : ''}`, 'success');
      await refresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to copy races', 'error');
    } finally {
      setCopyingRaces(false);
    }
  };

  const openBulkDates = (edition: EventEditionDto) => {
    const allSorted = [...(detail?.editions ?? [])].sort(sortEditions);
    const idx = allSorted.findIndex(ed => ed.id === edition.id);
    let prevEdition: EventEditionDto | undefined;
    for (let i = idx - 1; i >= 0; i--) {
      if (allSorted[i].races.length > 0) { prevEdition = allSorted[i]; break; }
    }
    setBulkDatesEdition(edition);
    setBulkDates(
      [...edition.races].sort(sortRaces).map(race => {
        const prevRace = prevEdition?.races.find(r => r.name === race.name);
        return { race, dateOfRace: race.dateOfRace ?? '', startTime: race.startTime ? race.startTime.slice(0, 5) : '', prevDateOfRace: prevRace?.dateOfRace ?? undefined };
      }),
    );
    setShowBulkDatesDialog(true);
  };

  const handleSaveBulkDates = async () => {
    setSavingBulkDates(true);
    try {
      await Promise.all(bulkDates.map(({ race, dateOfRace, startTime }) =>
        apiFetch(`/api/v1/admin/races/${race.id}`, {
          method: 'PUT', body: JSON.stringify(racePayload(race, { dateOfRace: dateOfRace || null, startTime: startTime || null })),
        }),
      ));
      onNotify(`Dates saved for ${bulkDates.length} race${bulkDates.length === 1 ? '' : 's'}`, 'success');
      setShowBulkDatesDialog(false);
      await refresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save dates', 'error');
    } finally {
      setSavingBulkDates(false);
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
    setLocalRaceOrder(prev => new Map(prev).set(edition.id, reordered.map(r => r.id)));
    try {
      await Promise.all(reordered.map((race, idx) =>
        idx !== sorted.indexOf(race)
          ? apiFetch(`/api/v1/admin/races/${race.id}`, { method: 'PUT', body: JSON.stringify(racePayload(race, { sortOrder: idx })) })
          : Promise.resolve(),
      ));
      await refresh();
      setLocalRaceOrder(prev => { const m = new Map(prev); m.delete(edition.id); return m; });
    } catch {
      setLocalRaceOrder(prev => { const m = new Map(prev); m.delete(edition.id); return m; });
      onNotify('Failed to reorder races', 'error');
    }
  };

  const handleDeleteEvent = async () => {
    if (!detail) return;
    if (!confirmDeleteEvent) { setConfirmDeleteEvent(true); return; }
    try {
      await apiFetch(`/api/v1/admin/events/${detail.id}`, { method: 'DELETE' });
      onNotify(`"${detail.name}" deleted`);
      navigate('/events');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete event', 'error');
      setConfirmDeleteEvent(false);
    }
  };

  const handleCycleRaceStatus = (race: RaceDto) => {
    const next = RACE_STATUSES[(RACE_STATUSES.indexOf(race.status) + 1) % RACE_STATUSES.length]! as RaceStatus;
    patchRaceInDetail(race.id, { status: next });
    apiFetch(`/api/v1/admin/races/${race.id}`, {
      method: 'PUT', body: JSON.stringify(racePayload(race, { status: next })),
    }).catch(() => {
      patchRaceInDetail(race.id, { status: race.status });
      onNotify('Failed to update race status', 'error');
    });
  };

  const handleCycleTicketStatus = (race: RaceDto) => {
    const next = TICKET_STATUSES[(TICKET_STATUSES.indexOf(race.ticketStatus) + 1) % TICKET_STATUSES.length]! as TicketStatus;
    patchRaceInDetail(race.id, { ticketStatus: next });
    apiFetch(`/api/v1/admin/races/${race.id}`, {
      method: 'PUT', body: JSON.stringify(racePayload(race, { ticketStatus: next })),
    }).catch(() => {
      patchRaceInDetail(race.id, { ticketStatus: race.ticketStatus });
      onNotify('Failed to update ticket status', 'error');
    });
  };

  const handleDeleteEdition = async (edition: EventEditionDto) => {
    if (deletingEditionId !== edition.id) {
      setDeletingEditionId(edition.id);
      return;
    }
    try {
      await apiFetch(`/api/v1/admin/editions/${edition.id}`, { method: 'DELETE' });
      onNotify('Edition deleted');
      setDeletingEditionId(null);
      await refresh();
    } catch {
      onNotify('Failed to delete edition', 'error');
    }
  };

  const handleCycleRegStatus = (edition: EventEditionDto) => {
    const cycle: RegistrationStatus[] = ['NotStarted', 'Open', 'Closed'];
    const next = cycle[(cycle.indexOf(edition.registrationStatus) + 1) % cycle.length]!;
    // Optimistic update
    setDetail(prev => prev ? {
      ...prev,
      editions: prev.editions.map(ed => ed.id === edition.id ? { ...ed, registrationStatus: next } : ed),
    } : prev);
    apiFetch(`/api/v1/admin/editions/${edition.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: edition.id,
        eventId: edition.eventId,
        registrationStatus: next,
        year: edition.year,
        date: edition.date,
        endDate: edition.endDate,
        title: edition.title ?? undefined,
        titleEn: edition.titleEn ?? undefined,
        registrationUrl: edition.registrationUrl ?? undefined,
        resultsUrl: edition.resultsUrl ?? undefined,
        notes: edition.notes ?? undefined,
        notesEn: edition.notesEn ?? undefined,
        trailId: edition.trailId,
      }),
    }).catch(() => {
      // Roll back on failure
      setDetail(prev => prev ? {
        ...prev,
        editions: prev.editions.map(ed => ed.id === edition.id ? { ...ed, registrationStatus: edition.registrationStatus } : ed),
      } : prev);
      onNotify('Failed to update registration status', 'error');
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !detail) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error ?? 'Event not found'}
        <Button size="small" sx={{ ml: 2 }} onClick={() => navigate('/events')}>Back to events</Button>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Breadcrumb */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
        <IconButton size="small" component={RouterLink} to="/events">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography
          variant="body2"
          color="text.secondary"
          component={RouterLink}
          to="/events"
          sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          Events
        </Typography>
        <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        <Typography variant="body2" fontWeight={500}>{detail.name}</Typography>
      </Stack>

      {/* Event header card */}
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1.5}>
          <Box>
            <Typography variant="h5" fontWeight={600} gutterBottom>{detail.name}</Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center">
              <Tooltip title="Click to cycle status">
                <Chip label={detail.status} size="small"
                  color={detail.status === 'Confirmed' ? 'success' : detail.status === 'Cancelled' ? 'error' : detail.status === 'Unconfirmed' ? 'warning' : 'default'}
                  onClick={handleCycleEventStatus}
                  sx={{ cursor: 'pointer' }} />
              </Tooltip>
              <Chip label={detail.activityType} size="small" variant="outlined" />
              <Chip label={detail.type} size="small" variant="outlined" />
              {detail.locationName && <Chip label={detail.locationName} size="small" variant="outlined" />}
              {detail.organizerName && (
                <Typography variant="caption" color="text.secondary">by {detail.organizerName}</Typography>
              )}
            </Stack>
            {formatSchedule(detail.scheduleRule) && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                🗓 {formatSchedule(detail.scheduleRule)}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} flexShrink={0}>
            {PUBLIC_SITE_URL && (
              <Tooltip title="View on site">
                <Button size="small" variant="outlined" startIcon={<OpenInNewIcon />}
                  href={`${PUBLIC_SITE_URL}/events/${detail.slug}`} target="_blank" rel="noopener">
                  View
                </Button>
              </Tooltip>
            )}
            <Button size="small"
              variant={editingEvent ? 'contained' : 'outlined'}
              startIcon={<EditIcon />}
              onClick={() => setEditingEvent(v => !v)}
            >
              {editingEvent ? 'Close editor' : 'Edit event'}
            </Button>
            <Button size="small" variant="contained" startIcon={<AddIcon />}
              onClick={() => { setEditingEdition(null); setEditionDialogOpen(true); }}>
              Add edition
            </Button>
            <Tooltip title={confirmDeleteEvent ? 'Click again to confirm delete' : 'Delete event'}>
              <Button size="small" color="error"
                variant={confirmDeleteEvent ? 'contained' : 'outlined'}
                startIcon={<DeleteIcon />}
                onClick={() => void handleDeleteEvent()}
                onBlur={() => setConfirmDeleteEvent(false)}
              >
                {confirmDeleteEvent ? 'Confirm delete' : 'Delete'}
              </Button>
            </Tooltip>
          </Stack>
        </Stack>
        {detail.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {detail.description}
          </Typography>
        )}
      </Box>

      {editingEvent && (
        <EventFormCard
          event={detail}
          onClose={() => setEditingEvent(false)}
          onSaved={handleEventSaved}
          onNotify={onNotify}
          onUpdateEvent={handleUpdateEvent}
        />
      )}

      {/* Editions */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6" fontWeight={600}>
          Editions
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {detail.editions.length} total
          </Typography>
        </Typography>
        {editionsByYear.hidden > 0 && (
          <Button size="small" variant="text" onClick={() => setShowOlderEditions(v => !v)}>
            {showOlderEditions ? 'Hide older' : `Show ${editionsByYear.hidden} older`}
          </Button>
        )}
      </Stack>

      {editionsByYear.visible.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="body2">No editions yet.</Typography>
          <Button size="small" sx={{ mt: 1 }} onClick={() => { setEditingEdition(null); setEditionDialogOpen(true); }}>
            Add first edition
          </Button>
        </Box>
      )}

      {editionsByYear.visible.map(edition => {
        const expanded = expandedEditionIds.has(edition.id);
        const raceCount = edition.races.length;
        const isPast = edition.date ? edition.date < new Date().toISOString().slice(0, 10) : false;

        return (
          <Box
            key={edition.id}
            sx={{
              border: '1px solid',
              borderColor: expanded ? 'primary.main' : 'divider',
              borderRadius: 2,
              mb: 1.5,
              overflow: 'hidden',
            }}
          >
            {/* Edition header */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                px: 2, py: 1.25,
                cursor: 'pointer',
                bgcolor: expanded ? 'primary.50' : 'background.paper',
                '&:hover': { bgcolor: expanded ? 'primary.50' : 'action.hover' },
              }}
              onClick={() => toggleEdition(edition.id)}
            >
              {expanded
                ? <ExpandMoreIcon fontSize="small" color="primary" />
                : <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />}

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {editionLabel(edition)}
                </Typography>
                {edition.date ? (
                  <Typography variant="caption" color="text.secondary">
                    {fmtDate(edition.date)}
                    {edition.endDate && edition.endDate !== edition.date ? ` – ${fmtDate(edition.endDate)}` : ''}
                  </Typography>
                ) : (
                  <Chip label="Date missing" size="small" color="warning" variant="outlined"
                    sx={{ height: 16, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }} />
                )}
              </Box>

              <Stack direction="row" spacing={0.5} alignItems="center" onClick={e => e.stopPropagation()}>
                {editionHasStaleTx(edition) && (
                  <Tooltip title="EN translation may be outdated">
                    <Chip label="EN" size="small" color="warning"
                      sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }} />
                  </Tooltip>
                )}
                <Chip
                  label={edition.registrationStatus}
                  size="small"
                  color={getRegistrationStatusColor(edition.registrationStatus)}
                  onClick={() => void handleCycleRegStatus(edition)}
                  sx={{ cursor: 'pointer' }}
                />
                <Chip
                  label={raceCount === 0 ? 'No races' : `${raceCount} race${raceCount !== 1 ? 's' : ''}`}
                  size="small"
                  variant="outlined"
                  color={raceCount === 0 && !isPast ? 'warning' : 'default'}
                />
                {onNavigateToRaceManager && (edition.date || edition.endDate) && (
                  <Tooltip title={`Open in Race Manager (${edition.date ?? edition.endDate})`}>
                    <IconButton size="small" onClick={() => onNavigateToRaceManager(edition.date ?? edition.endDate ?? '')}>
                      <FlagIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Edit edition">
                  <IconButton size="small" onClick={() => { setEditingEdition(edition); setEditionDialogOpen(true); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Clone edition to next year">
                  <IconButton size="small" onClick={() => handleCloneEdition(edition)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={deletingEditionId === edition.id ? 'Click again to confirm' : 'Delete edition'}>
                  <IconButton
                    size="small"
                    color={deletingEditionId === edition.id ? 'error' : 'default'}
                    onClick={() => void handleDeleteEdition(edition)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Edition body */}
            <Collapse in={expanded}>
              <Divider />
              <Box sx={{ px: 2, pt: 1.5, pb: 2, bgcolor: 'background.paper' }}>

                {/* Edition meta row */}
                <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
                  {edition.registrationUrl && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Registration</Typography>
                      <Typography variant="body2" component="a" href={edition.registrationUrl} target="_blank" rel="noopener"
                        sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                        {edition.registrationUrl.replace(/^https?:\/\//, '').slice(0, 40)}
                        {edition.registrationUrl.length > 50 ? '…' : ''}
                      </Typography>
                    </Box>
                  )}
                  {edition.resultsUrl && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Results</Typography>
                      <Typography variant="body2" component="a" href={edition.resultsUrl} target="_blank" rel="noopener"
                        sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                        {edition.resultsUrl.replace(/^https?:\/\//, '').slice(0, 40)}
                      </Typography>
                    </Box>
                  )}
                  {edition.trailName && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Trail</Typography>
                      <Typography variant="body2">{edition.trailName}</Typography>
                    </Box>
                  )}
                  {edition.notes && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Notes</Typography>
                      <Typography variant="body2" color="text.secondary">{edition.notes}</Typography>
                    </Box>
                  )}
                </Stack>

                {/* Races */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={600} textTransform="uppercase" letterSpacing={0.5} color="text.secondary">
                    Races
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {detail?.type === 'Series' && edition.races.length > 0 && edition.races.some(r => !r.trailId) && (
                      <Autocomplete
                        size="small"
                        options={trails.filter(t => t.status === 'Published' || t.status === 'EventOnly').sort((a, b) => a.name.localeCompare(b.name))}
                        getOptionLabel={t => t.name}
                        sx={{ width: 220 }}
                        onChange={(_, trail) => { if (trail) void handleSetTrailForAllRaces(edition, trail.id); }}
                        renderInput={params => <TextField {...params} label="Set trail for all legs" />}
                      />
                    )}
                    {edition.races.length === 0 && detail?.editions.some(ed => ed.id !== edition.id && ed.races.length > 0) && (
                      <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => handleCopyRacesFromPrevious(edition)} disabled={copyingRaces}>
                        Copy races
                      </Button>
                    )}
                    {edition.races.length > 0 && (
                      <Button size="small" startIcon={<CalendarMonthIcon />} onClick={() => openBulkDates(edition)}>
                        Set dates
                      </Button>
                    )}
                    <Button size="small" startIcon={<AddIcon />} onClick={() => openRaceForm(null, edition)}>
                      Add race
                    </Button>
                  </Stack>
                </Stack>

                {edition.races.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    No races yet.
                  </Typography>
                ) : (
                  <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.75 } }}>
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' } }}>
                        <TableCell sx={{ width: 24, px: 0.5 }} />
                        <TableCell>Name</TableCell>
                        <TableCell>Distance</TableCell>
                        <TableCell>Route</TableCell>
                        <TableCell>Date / start</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Tickets</TableCell>
                        <TableCell>Max</TableCell>
                        <TableCell align="right" />
                      </TableRow>
                    </TableHead>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => void handleRaceDragEnd(e, edition)}>
                    <SortableContext items={(localRaceOrder.get(edition.id) ?? [...edition.races].sort(sortRaces).map(r => r.id))} strategy={verticalListSortingStrategy}>
                    <TableBody>
                      {(localRaceOrder.get(edition.id)
                        ? localRaceOrder.get(edition.id)!.map(id => edition.races.find(r => r.id === id)!).filter(Boolean)
                        : [...edition.races].sort(sortRaces)
                      ).map(race => {
                          const staleTx = raceHasStaleTx(race);
                          return (
                            <SortableRaceRow
                              key={race.id}
                              race={race}
                              edition={edition}
                              isActive={raceForm?.race?.id === race.id}
                              onOpen={() => openRaceForm(race, edition)}
                              onDuplicate={() => openDuplicateRace(race, edition)}
                              onCycleStatus={() => handleCycleRaceStatus(race)}
                              onCycleTicket={() => handleCycleTicketStatus(race)}
                              staleTx={staleTx}
                              detail={detail}
                              patchRaceInDetail={patchRaceInDetail}
                              racePayload={racePayload}
                            />
                          );
                        })}
                    </TableBody>
                    </SortableContext>
                    </DndContext>
                  </Table>
                )}

                {/* Inline race form — shown when this edition is the target */}
                {raceForm?.editionId === edition.id && (
                  <RaceFormCard
                    race={raceForm.race}
                    edition={edition}
                    trails={trails}
                    initialValues={duplicateRaceValues}
                    onClose={() => { setRaceForm(null); setDuplicateRaceValues(undefined); }}
                    onSaved={() => void handleRaceSaved()}
                    onDeleted={() => void handleRaceDeleted()}
                    onNotify={onNotify}
                    onCreateRace={(input) => apiFetch(`/api/v1/admin/editions/${edition.id}/races`, {
                      method: 'POST', body: JSON.stringify(input),
                    }).then((r) => (r as { id: string }).id)}
                    onUpdateRace={(id, input) => apiFetch(`/api/v1/admin/races/${id}`, {
                      method: 'PUT', body: JSON.stringify({ id, ...input }),
                    })}
                    onDeleteRace={(id) => apiFetch(`/api/v1/admin/races/${id}`, { method: 'DELETE' })}
                  />
                )}
              </Box>
            </Collapse>
          </Box>
        );
      })}

      {/* Edition dialog */}
      <EditionDialog
        open={editionDialogOpen}
        edition={editingEdition}
        eventId={detail.id}
        initialValues={editionInitialValues}
        onClose={() => { setEditionDialogOpen(false); setCloneFromEditionId(null); setEditionInitialValues(undefined); }}
        onSaved={async (newEditionId) => {
          setEditionDialogOpen(false);
          if (newEditionId && cloneFromEditionId) {
            const sourceEdition = detail?.editions.find(ed => ed.id === cloneFromEditionId);
            const newEdition = { date: editingEdition?.date ?? null };
            if (sourceEdition && sourceEdition.races.length > 0) {
              const results = await Promise.allSettled(
                [...sourceEdition.races].sort(sortRaces).map(race =>
                  apiFetch(`/api/v1/admin/editions/${newEditionId}/races`, {
                    method: 'POST',
                    body: JSON.stringify({
                      eventEditionId: newEditionId,
                      trailId: race.trailId ?? null,
                      name: race.name,
                      nameEn: race.nameEn ?? undefined,
                      distanceLabel: race.distanceLabel ?? undefined,
                      distanceLabelEn: race.distanceLabelEn ?? undefined,
                      cutoffMinutes: race.cutoffMinutes ?? null,
                      description: race.description ?? undefined,
                      status: 'Active' as const,
                      sortOrder: race.sortOrder,
                      ticketStatus: 'Available' as const,
                      maxParticipants: race.maxParticipants ?? null,
                      itraPoints: race.itraPoints ?? null,
                      certifiedBy: race.certifiedBy ?? undefined,
                      prizeMoney: race.prizeMoney,
                      championshipCategory: race.championshipCategory ?? undefined,
                      dateOfRace: computeClonedRaceDate(sourceEdition.date, race.dateOfRace, newEdition.date),
                      startTime: race.startTime ? race.startTime.slice(0, 5) : null,
                    } satisfies CreateRaceInput),
                  }),
                ),
              );
              const failed = results.filter(r => r.status === 'rejected').length;
              if (failed > 0)
                onNotify(`Edition created but ${failed}/${results.length} races failed to clone`, 'error');
              else
                onNotify(`Edition cloned with ${results.length} race${results.length === 1 ? '' : 's'}`, 'success');
            }
            setCloneFromEditionId(null);
            setEditionInitialValues(undefined);
          }
          void refresh();
        }}
        onNotify={onNotify}
      />

      {/* Copy races confirmation */}
      <Dialog open={!!copyRacesConfirm} onClose={() => setCopyRacesConfirm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Copy Races</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Copy <strong>{copyRacesConfirm?.source.races.length} race{copyRacesConfirm?.source.races.length === 1 ? '' : 's'}</strong> from edition <strong>{copyRacesConfirm?.source.title ?? copyRacesConfirm?.source.year}</strong> into this edition?
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5 }} color="text.secondary">
            Races will be cloned with statuses reset to Active/Available.
            {copyRacesConfirm?.edition.date && copyRacesConfirm?.source.date
              ? ' Dates will be pre-filled based on the offset from the source edition.'
              : ' Dates will need to be set manually.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyRacesConfirm(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleConfirmCopyRaces()} disabled={copyingRaces}>
            {copyingRaces ? <CircularProgress size={20} /> : 'Copy Races'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk set dates dialog */}
      <Dialog open={showBulkDatesDialog} onClose={() => setShowBulkDatesDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set Race Dates — {bulkDatesEdition?.title ?? bulkDatesEdition?.year}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {bulkDatesEdition?.date && detail?.type !== 'Series' && bulkDates.some(d => !d.dateOfRace) && (
              <Button size="small" variant="outlined" startIcon={<CalendarMonthIcon />}
                onClick={() => setBulkDates(prev => prev.map(d => d.dateOfRace ? d : { ...d, dateOfRace: bulkDatesEdition.date! }))}
                sx={{ alignSelf: 'flex-start' }}
              >
                Fill empty dates from edition ({fmtDate(bulkDatesEdition.date)})
              </Button>
            )}
            {detail?.type === 'Series' && detail.scheduleRule && bulkDatesEdition?.year &&
              detail.scheduleRule.weekOfMonth && detail.scheduleRule.dayOfWeek && detail.scheduleRule.monthStart && (
              <Button size="small" variant="outlined" startIcon={<CalendarMonthIcon />}
                onClick={() => {
                  const suggested = suggestSeriesLegDates(detail.scheduleRule!, bulkDatesEdition.year!, bulkDates.length);
                  setBulkDates(prev => prev.map((d, i) => d.dateOfRace ? d : { ...d, dateOfRace: suggested[i] ?? d.dateOfRace }));
                }}
                sx={{ alignSelf: 'flex-start' }}
              >
                Suggest dates from schedule
              </Button>
            )}
            {bulkDates.map((entry, i) => (
              <Box key={entry.race.id}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.75 }}>
                  {entry.race.name}{entry.race.distanceLabel ? ` · ${entry.race.distanceLabel}` : ''}
                  {entry.prevDateOfRace && <Box component="span" sx={{ ml: 1, color: 'text.disabled', fontWeight: 400 }}>prev: {fmtDate(entry.prevDateOfRace)}</Box>}
                </Typography>
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
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBulkDatesDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveBulkDates()} disabled={savingBulkDates}>
            {savingBulkDates ? <CircularProgress size={20} /> : 'Save Dates'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
