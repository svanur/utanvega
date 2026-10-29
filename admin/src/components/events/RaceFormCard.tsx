import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs from 'dayjs';
import TranslateIcon from '@mui/icons-material/Translate';
import type { EventEditionDto, RaceDto } from '../../hooks/useEvents';
import type { Trail } from '../../hooks/useTrails';
import { useTranslate } from '../../hooks/useTranslate';
import { normalizeCutoffTimeOnBlur, normalizeCutoffTimeInput, parseHHmmToMinutes, timeLimitArrowKey } from '../../utils/cutoffTime';
import {
  ACTIVITY_TYPES,
  RACE_STATUSES,
  RESULT_TYPES,
  TICKET_STATUSES,
  buildRaceForm,
  buildRaceSavePayload,
  combineRegistrationOpensMinutes,
  computeRegistrationOpensPreview,
  createEmptyRaceForm,
  raceHasStaleTx,
  REGISTRATION_OPENS_INVALID_MESSAGE,
  type RaceFormState,
} from '../../utils/eventForms';
import BilingualTextField from '../BilingualTextField';
import BilingualLangToggle from '../BilingualLangToggle';
import { BilingualLangProvider } from '../../contexts/BilingualLangContext';
import { clampItraPoints, correctEmptyToOneFromSpinner } from '../../utils/itraPoints';

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
  initialValues?: RaceFormState;
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

function RaceFormCardInner({
  race, edition, trails,
  onClose, onSaved, onDeleted, onNotify,
  onCreateRace, onUpdateRace, onDeleteRace,
  initialValues,
}: RaceFormCardProps) {
  const isNew = race === null;
  const raceStatusHelperId = useId();
  const ticketStatusHelperId = useId();
  const [form, setForm] = useState<RaceFormState>(
    initialValues ?? (race ? buildRaceForm(race) : createEmptyRaceForm(edition.id, edition.races.length, edition.status)),
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));
  // Tracks whether the pending ITRA points change was preceded by real user input
  // (a keystroke or a paste) rather than a native spin-button click — see
  // correctEmptyToOneFromSpinner in utils/itraPoints.ts for why this distinction matters.
  const itraRealInputRef = useRef(false);

  useEffect(() => {
    setForm(initialValues ?? (race ? buildRaceForm(race) : createEmptyRaceForm(edition.id, edition.races.length, edition.status)));
    setConfirmDelete(false);
  }, [race, edition, initialValues]);

  const set = <K extends keyof RaceFormState>(field: K, value: RaceFormState[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const sortedTrails = [...trails]
    .filter(t => t.status === 'Published' || t.status === 'EventOnly')
    .sort((a, b) => a.name.localeCompare(b.name));

  const staleTx = race ? raceHasStaleTx(race) : false;

  // #1563: recomputed on every render from the four fields it depends on, so it stays live as
  // the admin types — no save/reopen needed to see what the days/hours-before window resolves to.
  const registrationOpensPreview = computeRegistrationOpensPreview(
    form.dateOfRace, form.startTime, form.registrationOpensDaysBefore, form.registrationOpensHoursBefore,
  );

  const handleTranslate = async () => {
    // #1548: name/nameEn is a proper noun, not prose — DeepL mistranslates race names.
    // Pass it through verbatim instead of routing it through the translate API.
    const fields = [
      { key: 'descriptionEn' as const,          src: form.description },
      { key: 'certifiedByEn' as const,          src: form.certifiedBy },
      { key: 'championshipCategoryEn' as const, src: form.championshipCategory },
      { key: 'distanceLabelEn' as const,        src: form.distanceLabel },
    ].filter(f => f.src?.trim());
    if (!fields.length && !form.name.trim()) return;
    const translated = fields.length ? await translate(fields.map(f => f.src)) : null;
    if (fields.length && !translated) return;
    setForm(prev => {
      const next = { ...prev };
      fields.forEach((f, i) => { (next as unknown as Record<string, string>)[f.key] = translated![i] ?? ''; });
      if (form.name.trim()) next.nameEn = form.name;
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { onNotify('Race name is required', 'error'); return; }
    const normalizedCutoff = normalizeCutoffTimeOnBlur(form.cutoffTime);
    if (normalizedCutoff !== form.cutoffTime) set('cutoffTime', normalizedCutoff);
    const cutoffMinutes = parseHHmmToMinutes(normalizedCutoff);
    if (normalizedCutoff.trim() && cutoffMinutes == null) { onNotify('Time limit must be in HH:mm format', 'error'); return; }
    if (cutoffMinutes === 0) { onNotify('Time limit cannot be 00:00. Clear the field to remove it.', 'error'); return; }

    // #1553: mirrors the cutoffMinutes validation immediately above — reject a non-integer or
    // negative days/hours value inline before save, rather than letting buildRaceSavePayload
    // silently write NaN (which JSON.stringify would round-trip as null, storing nothing the
    // admin actually typed).
    if (Number.isNaN(combineRegistrationOpensMinutes(form.registrationOpensDaysBefore, form.registrationOpensHoursBefore))) {
      onNotify(REGISTRATION_OPENS_INVALID_MESSAGE, 'error');
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
          <BilingualLangToggle />
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
            placeholder="Leave blank to use the trail's distance"
          />

          <Divider sx={{ my: 2 }} />

          <SectionLabel>Schedule</SectionLabel>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <DatePicker
              label="Date"
              value={form.dateOfRace ? dayjs(form.dateOfRace) : null}
              onChange={v => set('dateOfRace', v ? v.format('YYYY-MM-DD') : '')}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
            <TimePicker
              label="Start time"
              ampm={false}
              value={form.startTime ? dayjs(`2000-01-01T${form.startTime}`) : null}
              onChange={(val: dayjs.Dayjs | null) => set('startTime', val ? val.format('HH:mm') : '')}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <Autocomplete
              size="small" fullWidth
              options={sortedTrails}
              getOptionLabel={t => t.name}
              value={sortedTrails.find(t => t.id === form.trailId) ?? null}
              onChange={(_, v) => set('trailId', v?.id ?? '')}
              renderInput={params => <TextField {...params} label="Trail" />}
            />
            <TextField size="small" fullWidth label="Time limit" value={form.cutoffTime}
              onChange={e => set('cutoffTime', normalizeCutoffTimeInput(e.target.value))}
              onBlur={e => set('cutoffTime', normalizeCutoffTimeOnBlur(e.target.value))}
              onKeyDown={e => timeLimitArrowKey(e as React.KeyboardEvent<HTMLInputElement>, form.cutoffTime, v => set('cutoffTime', v))}
              placeholder="e.g. 12:00" />
          </Stack>
          {/* #1553: this race's own registration-opens window, independent of the edition's
              shared RegistrationOpens/Closes — for Series editions whose races each open on
              their own schedule (e.g. one short window per race-day). Blank in both fields means
              no window of its own: this race falls back to the edition-level window unchanged. */}
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <TextField
              size="small" fullWidth label="Days before" type="number"
              value={form.registrationOpensDaysBefore}
              onChange={e => set('registrationOpensDaysBefore', e.target.value)}
              inputProps={{ min: 0, step: 1 }}
            />
            <TextField
              size="small" fullWidth label="Hours before" type="number"
              value={form.registrationOpensHoursBefore}
              onChange={e => set('registrationOpensHoursBefore', e.target.value)}
              inputProps={{ min: 0, step: 1 }}
            />
          </Stack>
          {/* #1563: live, read-only preview of what the days/hours-before window above resolves
              to — mirrors EditionStatusHelpers.ComputeEffectiveTicketStatus's raceInstant formula
              client-side, no new API call. */}
          {registrationOpensPreview.kind !== 'none' && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {registrationOpensPreview.kind === 'invalid' && REGISTRATION_OPENS_INVALID_MESSAGE}
              {registrationOpensPreview.kind === 'needsDate' && 'Set a race date to preview when registration opens'}
              {registrationOpensPreview.kind === 'computed' && (
                <>
                  {`Registration opens ${registrationOpensPreview.opensAt.format('D MMM YYYY HH:mm')}`}
                  {(edition.registrationStatus === 'NotRequired' || edition.registrationStatus === 'Invitational') &&
                    ` — won't take effect while the edition's registration status stays ${edition.registrationStatus}`}
                </>
              )}
            </Typography>
          )}
        </Box>

        {/* ── Right column ── */}
        <Box>
          <SectionLabel>Status &amp; tickets</SectionLabel>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <FormControl size="small" fullWidth disabled={edition.status === 'Cancelled' || edition.status === 'Completed'}>
              <InputLabel>Race status</InputLabel>
              <Select value={form.status} label="Race status" onChange={e => set('status', e.target.value as typeof form.status)}
                aria-describedby={edition.status === 'Cancelled' || edition.status === 'Completed' ? raceStatusHelperId : undefined}>
                {RACE_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
              {edition.status === 'Cancelled' && (
                <FormHelperText id={raceStatusHelperId}>Locked — the edition is cancelled</FormHelperText>
              )}
              {edition.status === 'Completed' && (
                <FormHelperText id={raceStatusHelperId}>Locked — the edition is completed</FormHelperText>
              )}
            </FormControl>
            <FormControl size="small" fullWidth disabled={form.status === 'Cancelled'}>
              <InputLabel>Ticket status</InputLabel>
              <Select value={form.ticketStatus} label="Ticket status" onChange={e => set('ticketStatus', e.target.value as typeof form.ticketStatus)}
                aria-describedby={form.status === 'Cancelled' ? ticketStatusHelperId : undefined}>
                {TICKET_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
              {form.status === 'Cancelled' && (
                <FormHelperText id={ticketStatusHelperId}>Locked — the race is cancelled</FormHelperText>
              )}
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
              <InputLabel>Activity</InputLabel>
              <Select value={form.activityType} label="Activity" onChange={e => set('activityType', e.target.value as typeof form.activityType)}>
                <MenuItem value=""><em>Inherit from event</em></MenuItem>
                {ACTIVITY_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" fullWidth label="ITRA pts" type="number" value={form.itraPoints}
              inputProps={{ min: 0, max: 6, step: 1 }}
              onKeyDown={e => {
                // The ArrowUp key is unambiguous (unlike a digit key, it can never be a
                // legitimate typed value), so it can be special-cased directly here,
                // ahead of and independent of the keydown/paste/onChange ref below: stop
                // the browser's native step (which would otherwise land on 1, not 0 — see
                // correctEmptyToOneFromSpinner in utils/itraPoints.ts) and snap straight
                // to the minimum.
                if (e.key === 'ArrowUp' && form.itraPoints.trim() === '') {
                  e.preventDefault();
                  set('itraPoints', '0');
                  return;
                }
                itraRealInputRef.current = true;
              }}
              // A mouse-only context-menu paste (right-click → Paste) fires onChange
              // with no preceding keydown, same as a spin-button click — so it needs its
              // own ref-setting handler to be recognized as real input. (Ctrl+V is
              // already covered by onKeyDown above, since the 'v' keydown fires first.)
              onPaste={() => { itraRealInputRef.current = true; }}
              // Dragging text into the field (drag-and-drop insertion) also fires onChange
              // with no preceding keydown or paste event, same as a spin-button click — so
              // it needs the same ref-setting treatment as onPaste above.
              onDrop={() => { itraRealInputRef.current = true; }}
              onChange={e => {
                const realUserInputOccurred = itraRealInputRef.current;
                itraRealInputRef.current = false;
                set('itraPoints', correctEmptyToOneFromSpinner(form.itraPoints, e.target.value, realUserInputOccurred));
              }}
              onBlur={e => {
                itraRealInputRef.current = false;
                set('itraPoints', clampItraPoints(e.target.value));
              }} />
            <FormControl size="small" fullWidth>
              <InputLabel>Result type</InputLabel>
              <Select value={form.resultType} label="Result type" onChange={e => set('resultType', e.target.value as typeof form.resultType)}>
                {RESULT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
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
              size="small" fullWidth label="Category"
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
              {confirmDelete ? 'Confirm removal' : 'Remove race'}
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
