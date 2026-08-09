import { useState, useMemo, type ReactNode } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Alert,
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
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DragHandleIcon from '@mui/icons-material/DragIndicator';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import {
  useEventDetail,
  type EventDetailDto,
  type EventEditionDto,
  type RaceDto,
  type RegistrationStatus,
  type UpdateEventInput,
} from '../hooks/useEvents';
import { useTrails } from '../hooks/useTrails';
import { apiFetch } from '../hooks/api';
import RaceFormCard from '../components/events/RaceFormCard';
import EventFormCard from '../components/events/EventFormCard';
import BilingualTextField from '../components/BilingualTextField';
import { BilingualLangProvider, useBilingualLang } from '../contexts/BilingualLangContext';
import {
  getRaceStatusColor,
  getTicketStatusColor,
  raceHasStaleTx,
} from '../utils/eventForms';

const PUBLIC_SITE_URL = ((import.meta.env.VITE_PUBLIC_SITE_URL ?? '') as string).replace(/\/$/, '');

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
  if (ed.date) return ed.endDate ? `${ed.date} – ${ed.endDate}` : ed.date;
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
  onSaved: () => void;
  onNotify: (msg: ReactNode, sev?: 'success' | 'error') => void;
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

function EditionDialogInner({ open, edition, eventId, onClose, onSaved, onNotify }: EditionDialogProps) {
  const isNew = edition === null;
  const [form, setForm] = useState<EditionFormState>(edition ? buildEditionForm(edition) : emptyEditionForm());
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
        await apiFetch(`/api/v1/admin/events/${eventId}/editions`, {
          method: 'POST', body: JSON.stringify(input),
        });
        onNotify('Edition created', 'success');
      } else {
        await apiFetch(`/api/v1/admin/editions/${edition!.id}`, {
          method: 'PUT', body: JSON.stringify({ id: edition!.id, ...input }),
        });
        onNotify('Edition saved', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save edition', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      TransitionProps={{ onEnter: () => setForm(edition ? buildEditionForm(edition) : emptyEditionForm()) }}>
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
              onChange={e => set('year', e.target.value)} />
            <TextField size="small" fullWidth label="Start date" type="date" value={form.date}
              onChange={e => set('date', e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField size="small" fullWidth label="End date" type="date" value={form.endDate}
              onChange={e => set('endDate', e.target.value)} InputLabelProps={{ shrink: true }} />
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

// ── Main page ─────────────────────────────────────────────────────────────────

interface EventDetailPageProps {
  onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
}

export default function EventDetailPage({ onNotify }: EventDetailPageProps) {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { detail, loading, error, refresh } = useEventDetail(slug);
  const { trails } = useTrails();

  const [expandedEditionIds, setExpandedEditionIds] = useState<Set<string>>(new Set());
  const [showOlderEditions, setShowOlderEditions] = useState(false);

  // { editionId, race: RaceDto | null } — null race = create mode; undefined = no form open
  const [raceForm, setRaceForm] = useState<{ editionId: string; race: RaceDto | null } | null>(null);

  const [editingEvent, setEditingEvent] = useState(false);

  const [editionDialogOpen, setEditionDialogOpen] = useState(false);
  const [editingEdition, setEditingEdition] = useState<EventEditionDto | null>(null);

  const [deletingEditionId, setDeletingEditionId] = useState<string | null>(null);

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
    // Ensure the edition is expanded so the form is visible
    setExpandedEditionIds(prev => { const n = new Set(prev); n.add(edition.id); return n; });
    setRaceForm({ editionId: edition.id, race });
  };

  const handleRaceSaved = async () => {
    setRaceForm(null);
    await refresh();
  };

  const handleRaceDeleted = async () => {
    setRaceForm(null);
    await refresh();
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

  const handleCycleRegStatus = async (edition: EventEditionDto) => {
    const cycle: RegistrationStatus[] = ['NotStarted', 'Open', 'Closed'];
    const next = cycle[(cycle.indexOf(edition.registrationStatus) + 1) % cycle.length]!;
    try {
      await apiFetch(`/api/v1/admin/editions/${edition.id}`, {
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
      });
      await refresh();
    } catch {
      onNotify('Failed to update registration status', 'error');
    }
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
              <Chip label={detail.status} size="small"
                color={detail.status === 'Confirmed' ? 'success' : detail.status === 'Cancelled' ? 'error' : detail.status === 'Unconfirmed' ? 'warning' : 'default'} />
              <Chip label={detail.activityType} size="small" variant="outlined" />
              <Chip label={detail.type} size="small" variant="outlined" />
              {detail.locationName && <Chip label={detail.locationName} size="small" variant="outlined" />}
              {detail.organizerName && (
                <Typography variant="caption" color="text.secondary">by {detail.organizerName}</Typography>
              )}
            </Stack>
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

              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 90 }}>
                {edition.date ?? (edition.year ? `Year ${edition.year}` : 'No date')}
              </Typography>
              {edition.endDate && edition.endDate !== edition.date && (
                <Typography variant="caption" color="text.secondary">– {edition.endDate}</Typography>
              )}
              <Typography variant="body2" color={expanded ? 'primary.main' : 'text.secondary'} sx={{ flex: 1 }} noWrap>
                {editionLabel(edition)}
              </Typography>

              <Stack direction="row" spacing={0.5} alignItems="center" onClick={e => e.stopPropagation()}>
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
                <Tooltip title="Edit edition">
                  <IconButton size="small" onClick={() => { setEditingEdition(edition); setEditionDialogOpen(true); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Clone edition (opens events list)">
                  <IconButton size="small" onClick={() => navigate('/events', { state: { cloneEditionId: edition.id, openEventId: detail.id } })}>
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
                  <Button size="small" startIcon={<AddIcon />} onClick={() => openRaceForm(null, edition)}>
                    Add race
                  </Button>
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
                        <TableCell>Date / start</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Tickets</TableCell>
                        <TableCell>Max</TableCell>
                        <TableCell align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...edition.races]
                        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
                        .map(race => {
                          const staleTx = raceHasStaleTx(race);
                          return (
                            <TableRow
                              key={race.id}
                              hover
                              sx={{
                                cursor: 'pointer',
                                bgcolor: raceForm?.race?.id === race.id ? 'primary.50' : undefined,
                              }}
                              onClick={() => openRaceForm(race, edition)}
                            >
                              <TableCell sx={{ px: 0.5, color: 'text.disabled' }}>
                                <DragHandleIcon fontSize="small" />
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                  <Typography variant="body2" fontWeight={600}>{race.name}</Typography>
                                  {staleTx && (
                                    <Tooltip title="EN translation may be outdated">
                                      <Chip label="EN" size="small" color="warning"
                                        sx={{ height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.75 } }} />
                                    </Tooltip>
                                  )}
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">{race.distanceLabel ?? '—'}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {race.dateOfRace ?? <span style={{ color: 'orange' }}>Missing</span>}
                                  {race.startTime && ` · ${race.startTime.slice(0, 5)}`}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip label={race.status} size="small" color={getRaceStatusColor(race.status)} />
                              </TableCell>
                              <TableCell>
                                <Chip label={race.ticketStatus} size="small" variant="outlined"
                                  color={getTicketStatusColor(race.ticketStatus)} />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {race.maxParticipants ?? '—'}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" onClick={e => e.stopPropagation()}>
                                <Stack direction="row" justifyContent="flex-end" spacing={0.25}>
                                  <Tooltip title="Edit race">
                                    <IconButton size="small" onClick={() => openRaceForm(race, edition)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Duplicate race (opens events list)">
                                    <IconButton size="small"
                                      onClick={() => navigate('/events', { state: { duplicateRaceId: race.id, openEventId: detail.id } })}>
                                      <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}

                {/* Inline race form — shown when this edition is the target */}
                {raceForm?.editionId === edition.id && (
                  <RaceFormCard
                    race={raceForm.race}
                    edition={edition}
                    trails={trails}
                    onClose={() => setRaceForm(null)}
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
        onClose={() => setEditionDialogOpen(false)}
        onSaved={() => { setEditionDialogOpen(false); void refresh(); }}
        onNotify={onNotify}
      />
    </Box>
  );
}
