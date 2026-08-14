import { useEffect, useState, type ReactNode } from 'react';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import type { EventEditionDto, RaceDto } from '../../hooks/useEvents';
import type { Trail } from '../../hooks/useTrails';
import { useTranslate } from '../../hooks/useTranslate';
import { normalizeCutoffTimeOnBlur, normalizeCutoffTimeInput, parseHHmmToMinutes, timeLimitArrowKey } from '../../utils/cutoffTime';
import {
  ACTIVITY_TYPES,
  RACE_STATUSES,
  TICKET_STATUSES,
  buildRaceForm,
  buildRaceSavePayload,
  createEmptyRaceForm,
  raceHasStaleTx,
  type RaceFormState,
} from '../../utils/eventForms';

const DRAWER_WIDTH = 420;

interface RaceDrawerProps {
  open: boolean;
  race: RaceDto | null;
  edition: EventEditionDto | null;
  trails: Trail[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
  onCreateRace: (input: object) => Promise<string>;
  onUpdateRace: (id: string, input: object) => Promise<void>;
  onDeleteRace: (id: string) => Promise<void>;
}

function FormRow({ children }: { children: ReactNode }) {
  return <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>{children}</Stack>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="caption"
      fontWeight={600}
      letterSpacing={0.6}
      textTransform="uppercase"
      color="text.secondary"
      sx={{ display: 'block', mb: 1, mt: 0.5 }}
    >
      {children}
    </Typography>
  );
}

export default function RaceDrawer({
  open,
  race,
  edition,
  trails,
  onClose,
  onSaved,
  onDeleted,
  onNotify,
  onCreateRace,
  onUpdateRace,
  onDeleteRace,
}: RaceDrawerProps) {
  const isNew = race === null;
  const [form, setForm] = useState<RaceFormState>(
    race ? buildRaceForm(race) : createEmptyRaceForm(edition?.id ?? '', 0),
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));

  useEffect(() => {
    if (open) {
      setForm(race ? buildRaceForm(race) : createEmptyRaceForm(edition?.id ?? '', (edition?.races.length ?? 0)));
      setConfirmDelete(false);
    }
  }, [open, race, edition]);

  const set = <K extends keyof RaceFormState>(field: K, value: RaceFormState[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const sortedTrails = [...trails]
    .filter(t => t.status === 'Published' || t.status === 'EventOnly')
    .sort((a, b) => a.name.localeCompare(b.name));

  const staleTx = race ? raceHasStaleTx(race) : false;

  const handleRetranslate = async () => {
    const fields = [
      { key: 'nameEn' as const,               src: form.name,               init: form._initialNameEn },
      { key: 'descriptionEn' as const,         src: form.description,        init: form._initialDescriptionEn },
      { key: 'certifiedByEn' as const,         src: form.certifiedBy,        init: form._initialCertifiedByEn },
      { key: 'championshipCategoryEn' as const, src: form.championshipCategory, init: form._initialChampionshipCategoryEn },
    ].filter(f => f.src?.trim());

    if (fields.length === 0) return;
    const translated = await translate(fields.map(f => f.src));
    if (!translated) return;
    setForm(prev => {
      const next = { ...prev };
      fields.forEach((f, i) => { (next as unknown as Record<string, string>)[f.key] = translated[i] ?? ''; });
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      onNotify('Race name is required', 'error');
      return;
    }

    const normalizedCutoff = normalizeCutoffTimeOnBlur(form.cutoffTime);
    if (normalizedCutoff !== form.cutoffTime) set('cutoffTime', normalizedCutoff);

    const cutoffMinutes = parseHHmmToMinutes(normalizedCutoff);
    if (normalizedCutoff.trim() && cutoffMinutes == null) {
      onNotify('Time limit must be in HH:mm format', 'error');
      return;
    }
    if (cutoffMinutes === 0) {
      onNotify('Time limit cannot be 00:00. Clear the field to remove it.', 'error');
      return;
    }

    const payload = buildRaceSavePayload({ ...form, cutoffTime: normalizedCutoff });
    setSaving(true);
    try {
      if (isNew) {
        await onCreateRace(payload);
        onNotify('Race created', 'success');
      } else {
        await onUpdateRace(race!.id, payload);
        onNotify('Race saved', 'success');
      }
      onSaved();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save race', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    try {
      await onDeleteRace(race!.id);
      onNotify('Race deleted');
      onDeleted();
    } catch {
      onNotify('Failed to delete race', 'error');
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Header */}
      <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="h6" fontWeight={600} noWrap>
          {isNew ? 'Add race' : form.name || 'Edit race'}
        </Typography>
        {edition && (
          <Typography variant="caption" color="text.secondary">
            {edition.title ?? edition.date ?? `Edition ${edition.year}`} · {edition.date ?? '—'}
          </Typography>
        )}
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>

        {staleTx && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button size="small" startIcon={<TranslateIcon />} onClick={() => void handleRetranslate()} disabled={translating}>
                {translating ? 'Translating…' : 'Re-translate'}
              </Button>
            }
          >
            EN translation may be outdated
          </Alert>
        )}

        {/* ── Identity ── */}
        <SectionLabel>Name &amp; distance</SectionLabel>
        <FormRow>
          <TextField size="small" fullWidth label="Name (IS)" value={form.name}
            onChange={e => set('name', e.target.value)} required error={!form.name.trim()} />
          <TextField size="small" fullWidth label="Name (EN)" value={form.nameEn}
            onChange={e => set('nameEn', e.target.value)} />
        </FormRow>
        <FormRow>
          <TextField size="small" fullWidth label="Distance label (IS)" value={form.distanceLabel}
            onChange={e => set('distanceLabel', e.target.value)} placeholder="e.g. 50 km" />
          <TextField size="small" fullWidth label="Distance label (EN)" value={form.distanceLabelEn}
            onChange={e => set('distanceLabelEn', e.target.value)} />
        </FormRow>

        <Divider sx={{ my: 2 }} />

        {/* ── Schedule ── */}
        <SectionLabel>Schedule</SectionLabel>
        <FormRow>
          <TextField size="small" fullWidth label="Date" type="date" value={form.dateOfRace}
            onChange={e => set('dateOfRace', e.target.value)}
            InputLabelProps={{ shrink: true }} />
          <TimePicker
            label="Start time"
            ampm={false}
            value={form.startTime ? dayjs(`2000-01-01T${form.startTime}`) : null}
            onChange={(val: Dayjs | null) => set('startTime', val ? val.format('HH:mm') : '')}
            slotProps={{ textField: { size: 'small', fullWidth: true } }}
          />
        </FormRow>
        <FormRow>
          <Autocomplete
            size="small"
            fullWidth
            options={sortedTrails}
            getOptionLabel={t => t.name}
            value={sortedTrails.find(t => t.id === form.trailId) ?? null}
            onChange={(_, v) => set('trailId', v?.id ?? '')}
            renderInput={params => <TextField {...params} label="Trail" />}
          />
          <TextField size="small" fullWidth label="Time limit (HH:mm)" value={form.cutoffTime}
            onChange={e => set('cutoffTime', normalizeCutoffTimeInput(e.target.value))}
            onBlur={e => set('cutoffTime', normalizeCutoffTimeOnBlur(e.target.value))}
            onKeyDown={e => timeLimitArrowKey(e as React.KeyboardEvent<HTMLInputElement>, form.cutoffTime, v => set('cutoffTime', v))}
            placeholder="e.g. 12:00" />
        </FormRow>

        <Divider sx={{ my: 2 }} />

        {/* ── Status & Tickets ── */}
        <SectionLabel>Status &amp; tickets</SectionLabel>
        <FormRow>
          <FormControl size="small" fullWidth>
            <InputLabel>Race status</InputLabel>
            <Select value={form.status} label="Race status" onChange={e => set('status', e.target.value as typeof form.status)}>
              {RACE_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Ticket status</InputLabel>
            <Select value={form.ticketStatus} label="Ticket status" onChange={e => set('ticketStatus', e.target.value as typeof form.ticketStatus)}>
              {TICKET_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </FormRow>
        <FormRow>
          <TextField size="small" fullWidth label="Max participants" type="number" value={form.maxParticipants}
            onChange={e => set('maxParticipants', e.target.value)} />
          <TextField size="small" fullWidth label="Sort order" type="number" value={form.sortOrder}
            onChange={e => set('sortOrder', e.target.value)} />
        </FormRow>

        <Divider sx={{ my: 2 }} />

        {/* ── Details ── */}
        <SectionLabel>Details</SectionLabel>
        <FormRow>
          <FormControl size="small" fullWidth>
            <InputLabel>Activity type</InputLabel>
            <Select value={form.activityType} label="Activity type" onChange={e => set('activityType', e.target.value as typeof form.activityType)}>
              <MenuItem value=""><em>Inherit from event</em></MenuItem>
              {ACTIVITY_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" fullWidth label="ITRA points" type="number" value={form.itraPoints}
            onChange={e => set('itraPoints', e.target.value)} />
        </FormRow>
        <FormRow>
          <TextField size="small" fullWidth label="Certified by (IS)" value={form.certifiedBy}
            onChange={e => set('certifiedBy', e.target.value)} />
          <TextField size="small" fullWidth label="Certified by (EN)" value={form.certifiedByEn}
            onChange={e => set('certifiedByEn', e.target.value)} />
        </FormRow>
        <FormRow>
          <TextField size="small" fullWidth label="Prize money" type="number" value={form.prizeMoney}
            onChange={e => set('prizeMoney', e.target.value)} />
          <TextField size="small" fullWidth label="Championship category (IS)" value={form.championshipCategory}
            onChange={e => set('championshipCategory', e.target.value)} />
        </FormRow>
        <FormRow>
          <TextField size="small" fullWidth label="Championship category (EN)" value={form.championshipCategoryEn}
            onChange={e => set('championshipCategoryEn', e.target.value)} />
        </FormRow>
        <TextField size="small" fullWidth multiline rows={2} label="Description (IS)" value={form.description}
          onChange={e => set('description', e.target.value)} sx={{ mb: 1.5 }} />
        <TextField size="small" fullWidth multiline rows={2} label="Description (EN)" value={form.descriptionEn}
          onChange={e => set('descriptionEn', e.target.value)} sx={{ mb: 1.5 }} />

        {/* Translation chips */}
        {(form.nameEn || form.descriptionEn) && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {form.nameEn && <Chip size="small" label={`EN: ${form.nameEn}`} variant="outlined" sx={{ maxWidth: 180 }} />}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          {!isNew ? (
            <Tooltip title={confirmDelete ? 'Click again to confirm deletion' : ''}>
              <Button
                size="small"
                color="error"
                variant={confirmDelete ? 'contained' : 'outlined'}
                onClick={() => void handleDelete()}
                disabled={saving}
              >
                {confirmDelete ? 'Confirm delete' : 'Delete'}
              </Button>
            </Tooltip>
          ) : <Box />}
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => { setConfirmDelete(false); onClose(); }} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => void handleSave()}
              disabled={saving || !form.name.trim()}
              startIcon={saving ? <CircularProgress size={14} /> : undefined}
            >
              {saving ? 'Saving…' : isNew ? 'Add race' : 'Save race'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
}
