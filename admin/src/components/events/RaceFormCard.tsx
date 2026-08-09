import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import type { EventEditionDto, RaceDto } from '../../hooks/useEvents';
import type { Trail } from '../../hooks/useTrails';
import { useTranslate } from '../../hooks/useTranslate';
import { normalizeCutoffTimeOnBlur, normalizeCutoffTimeInput, parseHHmmToMinutes } from '../../utils/cutoffTime';
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
import BilingualTextField from '../BilingualTextField';
import { BilingualLangProvider, useBilingualLang } from '../../contexts/BilingualLangContext';

interface RaceFormCardProps {
  race: RaceDto | null;
  edition: EventEditionDto;
  trails: Trail[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
  onCreateRace: (input: object) => Promise<string>;
  onUpdateRace: (id: string, input: object) => Promise<void>;
  onDeleteRace: (id: string) => Promise<void>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="caption" fontWeight={600} letterSpacing={0.6}
      textTransform="uppercase" color="text.secondary"
      sx={{ display: 'block', mb: 1, mt: 0.5 }}
    >
      {children}
    </Typography>
  );
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

function RaceFormCardInner({
  race, edition, trails,
  onClose, onSaved, onDeleted, onNotify,
  onCreateRace, onUpdateRace, onDeleteRace,
}: RaceFormCardProps) {
  const isNew = race === null;
  const [form, setForm] = useState<RaceFormState>(
    race ? buildRaceForm(race) : createEmptyRaceForm(edition.id, edition.races.length),
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));

  useEffect(() => {
    setForm(race ? buildRaceForm(race) : createEmptyRaceForm(edition.id, edition.races.length));
    setConfirmDelete(false);
  }, [race, edition]);

  const set = <K extends keyof RaceFormState>(field: K, value: RaceFormState[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const sortedTrails = [...trails]
    .filter(t => t.status === 'Published' || t.status === 'EventOnly')
    .sort((a, b) => a.name.localeCompare(b.name));

  const staleTx = race ? raceHasStaleTx(race) : false;

  const handleTranslate = async () => {
    const fields = [
      { key: 'nameEn' as const,                src: form.name },
      { key: 'descriptionEn' as const,          src: form.description },
      { key: 'certifiedByEn' as const,          src: form.certifiedBy },
      { key: 'championshipCategoryEn' as const, src: form.championshipCategory },
      { key: 'distanceLabelEn' as const,        src: form.distanceLabel },
    ].filter(f => f.src?.trim());
    if (!fields.length) return;
    const translated = await translate(fields.map(f => f.src));
    if (!translated) return;
    setForm(prev => {
      const next = { ...prev };
      fields.forEach((f, i) => { (next as unknown as Record<string, string>)[f.key] = translated[i] ?? ''; });
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { onNotify('Race name is required', 'error'); return; }
    const normalizedCutoff = normalizeCutoffTimeOnBlur(form.cutoffTime);
    if (normalizedCutoff !== form.cutoffTime) set('cutoffTime', normalizedCutoff);
    const cutoffMinutes = parseHHmmToMinutes(normalizedCutoff);
    if (normalizedCutoff.trim() && cutoffMinutes == null) { onNotify('Cutoff time must be in HH:mm format', 'error'); return; }
    if (cutoffMinutes === 0) { onNotify('Cutoff time cannot be 00:00. Clear the field to remove it.', 'error'); return; }

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

  const canTranslate = !!(form.name.trim() || form.description.trim() || form.certifiedBy.trim() || form.championshipCategory.trim() || form.distanceLabel.trim());

  return (
    <Box
      sx={{
        border: '2px solid',
        borderColor: 'primary.main',
        borderRadius: 2,
        p: 2.5,
        bgcolor: 'background.paper',
        mt: 1.5,
      }}
    >
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {isNew ? 'Add race' : `Edit: ${form.name || race?.name}`}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <LangToggleButton />
          <Typography variant="caption" color="text.secondary">
            {edition.title ?? edition.date ?? `Edition ${edition.year}`}
          </Typography>
        </Stack>
      </Stack>

      {staleTx && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button size="small" startIcon={<TranslateIcon />} onClick={() => void handleTranslate()} disabled={translating}>
              {translating ? 'Translating…' : 'Re-translate'}
            </Button>
          }
        >
          EN translation may be outdated
        </Alert>
      )}

      {/* Two-column layout */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>

        {/* ── Left column ── */}
        <Box>
          <SectionLabel>Name &amp; distance</SectionLabel>
          <BilingualTextField
            size="small" fullWidth label="Name" sx={{ mb: 1.5 }}
            valueIs={form.name} valueEn={form.nameEn}
            onChangeIs={v => set('name', v)} onChangeEn={v => set('nameEn', v)}
            required error={!form.name.trim()}
          />
          <BilingualTextField
            size="small" fullWidth label="Distance label" sx={{ mb: 1.5 }}
            valueIs={form.distanceLabel} valueEn={form.distanceLabelEn}
            onChangeIs={v => set('distanceLabel', v)} onChangeEn={v => set('distanceLabelEn', v)}
            placeholder="e.g. 50 km"
          />

          <Divider sx={{ my: 2 }} />

          <SectionLabel>Schedule</SectionLabel>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <TextField size="small" fullWidth label="Date" type="date" value={form.dateOfRace}
              onChange={e => set('dateOfRace', e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField size="small" fullWidth label="Start time" type="time" value={form.startTime}
              onChange={e => set('startTime', e.target.value)} InputLabelProps={{ shrink: true }} />
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <TextField size="small" fullWidth label="Cutoff time (HH:mm)" value={form.cutoffTime}
              onChange={e => set('cutoffTime', normalizeCutoffTimeInput(e.target.value))}
              onBlur={e => set('cutoffTime', normalizeCutoffTimeOnBlur(e.target.value))}
              placeholder="e.g. 12:00" />
            <Autocomplete
              size="small" fullWidth
              options={sortedTrails}
              getOptionLabel={t => t.name}
              value={sortedTrails.find(t => t.id === form.trailId) ?? null}
              onChange={(_, v) => set('trailId', v?.id ?? '')}
              renderInput={params => <TextField {...params} label="Trail" />}
            />
          </Stack>
        </Box>

        {/* ── Right column ── */}
        <Box>
          <SectionLabel>Status &amp; tickets</SectionLabel>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
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
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <TextField size="small" fullWidth label="Max participants" type="number" value={form.maxParticipants}
              onChange={e => set('maxParticipants', e.target.value)} />
            <TextField size="small" fullWidth label="Sort order" type="number" value={form.sortOrder}
              onChange={e => set('sortOrder', e.target.value)} />
          </Stack>

          <Divider sx={{ my: 2 }} />

          <SectionLabel>Details</SectionLabel>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Activity type</InputLabel>
              <Select value={form.activityType} label="Activity type" onChange={e => set('activityType', e.target.value as typeof form.activityType)}>
                <MenuItem value=""><em>Inherit from event</em></MenuItem>
                {ACTIVITY_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" fullWidth label="ITRA points" type="number" value={form.itraPoints}
              onChange={e => set('itraPoints', e.target.value)} />
          </Stack>
          <BilingualTextField
            size="small" fullWidth label="Certified by" sx={{ mb: 1.5 }}
            valueIs={form.certifiedBy} valueEn={form.certifiedByEn}
            onChangeIs={v => set('certifiedBy', v)} onChangeEn={v => set('certifiedByEn', v)}
          />
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <TextField size="small" fullWidth label="Prize money" type="number" value={form.prizeMoney}
              onChange={e => set('prizeMoney', e.target.value)} />
            <BilingualTextField
              size="small" fullWidth label="Championship category"
              valueIs={form.championshipCategory} valueEn={form.championshipCategoryEn}
              onChangeIs={v => set('championshipCategory', v)} onChangeEn={v => set('championshipCategoryEn', v)}
            />
          </Stack>
        </Box>
      </Box>

      {/* Description — full width */}
      <Divider sx={{ my: 2 }} />
      <BilingualTextField
        size="small" fullWidth label="Description" multiline rows={2}
        valueIs={form.description} valueEn={form.descriptionEn}
        onChangeIs={v => set('description', v)} onChangeEn={v => set('descriptionEn', v)}
      />

      {/* Footer */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
        {/* Left: delete (edit mode) or translate */}
        <Stack direction="row" spacing={1} alignItems="center">
          {!isNew && (
            <Button
              size="small" color="error"
              variant={confirmDelete ? 'contained' : 'outlined'}
              onClick={() => void handleDelete()}
              disabled={saving}
            >
              {confirmDelete ? 'Confirm delete' : 'Delete race'}
            </Button>
          )}
          <Button
            size="small"
            startIcon={translating ? <CircularProgress size={14} /> : <TranslateIcon />}
            disabled={translating || !canTranslate}
            onClick={() => void handleTranslate()}
          >
            Translate to EN
          </Button>
        </Stack>

        {/* Right: cancel / save */}
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => { setConfirmDelete(false); onClose(); }} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="small" variant="contained"
            onClick={() => void handleSave()}
            disabled={saving || !form.name.trim()}
            startIcon={saving ? <CircularProgress size={14} /> : undefined}
          >
            {saving ? 'Saving…' : isNew ? 'Add race' : 'Save race'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function RaceFormCard(props: RaceFormCardProps) {
  return (
    <BilingualLangProvider>
      <RaceFormCardInner {...props} />
    </BilingualLangProvider>
  );
}
