import { useId, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Step,
  StepLabel,
  Stepper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TranslateIcon from '@mui/icons-material/Translate';
import {
  EVENTS_QUERY_KEY,
  useEvents,
  type ActivityType,
  type EditionStatus,
  type EventStatus,
  type EventType,
  type RegistrationStatus,
} from '../hooks/useEvents';
import { apiFetch } from '../hooks/api';
import { useTranslate } from '../hooks/useTranslate';
import { useBackToList } from '../hooks/useBackToList';
import { trimToUndefined } from '../utils/strings';
import { EDITION_STATUSES, EDITION_STATUS_LABELS, referenceDateForYear } from '../utils/eventForms';
import BilingualTextField from '../components/BilingualTextField';
import { BilingualLangProvider } from '../contexts/BilingualLangContext';
import { useBilingualLang } from '../hooks/useBilingualLang';

// #664: first step of the events-wizard milestone — replaces CreateEventDialog.
// #665: added the second ("Edition details") step below, which creates the new event's first
// edition inline via CreateEditionCommand — the admin no longer has to leave the wizard and open
// EventDetailPage's EditionDialogInner just to add it. Races (#666) is a separate, already-blocked
// issue, so the Stepper still stops at two steps rather than a placeholder third.

// Mobile-first requirement (AGENTS.md Definition of Done): unlike CreateEventDialog's compact
// size="small" controls, this is new work checked at 375px, so the Type/Activity/Status Selects
// and the action buttons are bumped to the 44px touch-target minimum below.
const TOUCH_TARGET_SX = { minHeight: 44 };

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

const EVENT_TYPES: EventType[] = ['Race', 'Series', 'Social', 'Advertisement', 'Festival', 'Other'];
const ACTIVITY_TYPES: ActivityType[] = ['TrailRunning', 'Running', 'Cycling', 'Hiking', 'FunRun', 'ObstacleCourse', 'CrossCountryRun', 'Swim', 'Canicross', 'IronMan', 'Other'];
const EVENT_STATUSES: EventStatus[] = ['Hidden', 'Unconfirmed', 'Confirmed', 'Cancelled', 'Unlisted'];
const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  Unconfirmed: 'Unconfirmed',
  Confirmed: 'Confirmed',
  Cancelled: 'Cancelled',
  Hidden: 'Draft — hidden from all',
  Unlisted: 'Unlisted — view by URL',
};
const ACTIVITY_ICONS: Record<string, string> = {
  TrailRunning: '🏃‍♂️', Running: '🏃', Hiking: '🥾', Cycling: '🚴', FunRun: '🎊',
  ObstacleCourse: '🧗', CrossCountryRun: '🌾', Swim: '🏊', Canicross: '🐕', IronMan: '🥇', Other: '🏅',
};

interface FormState {
  name: string;
  nameEn: string;
  slug: string;
  type: EventType;
  activityType: ActivityType;
  status: EventStatus;
}

// #663: new events default to Hidden ("Draft") rather than Unconfirmed.
function empty(): FormState {
  return { name: '', nameEn: '', slug: '', type: 'Race', activityType: 'TrailRunning', status: 'Hidden' };
}

interface EventWizardPageProps {
  onNotify: (msg: ReactNode, sev?: 'success' | 'error') => void;
}

// #665: the event created by Step 1 — carried into Step 2 so it can POST the edition against the
// right eventId and, on success, navigate to /events/{slug} the same way Step 1 used to do
// directly before this issue.
interface CreatedEvent {
  id: string;
  slug: string;
}

interface EventDetailsStepProps extends EventWizardPageProps {
  // Lifted up to EventWizardPage (rather than owned locally) so clicking "Back" on Step 2 returns
  // here with these values still populated instead of remounting from empty().
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  onCreated: (event: CreatedEvent) => void;
}

function EventDetailsStep({ onNotify, form, setForm, onCreated }: EventDetailsStepProps) {
  const handleBackToList = useBackToList('/events');
  const { events, createEvent } = useEvents();
  const [saving, setSaving] = useState(false);
  const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));
  // Which of IS/EN is currently shown in the Name BilingualTextField below — the #899
  // duplicate-Name match must follow this so it always compares what's actually on screen.
  const { lang } = useBilingualLang();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  // #899: advisory-only — a Name exactly matching (case-insensitive, trimmed) an existing event's
  // name is flagged near the field below, but never blocks Create.
  const visibleName = lang === 'en' ? form.nameEn : form.name;
  const trimmedName = visibleName.trim();
  const duplicateNameMatch = trimmedName
    ? events.find(event => {
        const eventName = (lang === 'en' ? event.nameEn : event.name) ?? '';
        return eventName.trim().toLowerCase() === trimmedName.toLowerCase();
      })
    : undefined;

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const { id, slug } = await createEvent({
        name: form.name.trim(),
        nameEn: trimToUndefined(form.nameEn),
        slug: trimToUndefined(form.slug),
        type: form.type,
        activityType: form.activityType,
        status: form.status,
      });
      onNotify(`"${form.name.trim()}" created`, 'success');
      // #665: the event now exists — advance to Step 2 in the same page rather than navigating
      // away, so the admin can add its first edition without leaving the wizard.
      onCreated({ id, slug });
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to create event', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTranslate = async () => {
    if (!form.name.trim()) return;
    const [nameEn] = await translate([form.name]);
    if (nameEn) set('nameEn', nameEn);
  };

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Event details</Typography>
        <LangToggleButton />
      </Stack>

      <Stack spacing={2.5}>
        <BilingualTextField
          size="small" fullWidth label="Name" autoFocus required
          error={!form.name.trim()}
          valueIs={form.name} valueEn={form.nameEn}
          onChangeIs={v => set('name', v)} onChangeEn={v => set('nameEn', v)}
        />
        {duplicateNameMatch && (
          <Alert severity="warning">
            An event named &quot;{lang === 'en' ? duplicateNameMatch.nameEn : duplicateNameMatch.name}&quot; already exists
          </Alert>
        )}

        <TextField
          size="small" fullWidth label="Slug" value={form.slug}
          onChange={e => set('slug', e.target.value)}
          placeholder="Auto-generated from name if empty"
          helperText="Lowercase, hyphens only"
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}>
          <FormControl size="small" fullWidth sx={{ '& .MuiOutlinedInput-root': TOUCH_TARGET_SX }}>
            <InputLabel>Type</InputLabel>
            <Select value={form.type} label="Type" onChange={e => set('type', e.target.value as EventType)}>
              {EVENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth sx={{ '& .MuiOutlinedInput-root': TOUCH_TARGET_SX }}>
            <InputLabel>Activity</InputLabel>
            <Select value={form.activityType} label="Activity" onChange={e => set('activityType', e.target.value as ActivityType)}>
              {ACTIVITY_TYPES.map(at => <MenuItem key={at} value={at}>{ACTIVITY_ICONS[at] ?? '🏅'} {at}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth sx={{ '& .MuiOutlinedInput-root': TOUCH_TARGET_SX }}>
            <InputLabel>Status</InputLabel>
            <Select value={form.status} label="Status" onChange={e => set('status', e.target.value as EventStatus)}>
              {EVENT_STATUSES.map(s => <MenuItem key={s} value={s}>{EVENT_STATUS_LABELS[s]}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mt: 3 }}>
        <Button
          startIcon={translating ? <CircularProgress size={14} /> : <TranslateIcon />}
          disabled={translating || !form.name.trim()}
          onClick={() => void handleTranslate()}
          sx={TOUCH_TARGET_SX}
        >
          Translate to EN
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={handleBackToList} disabled={saving} sx={TOUCH_TARGET_SX}>Cancel</Button>
          <Button variant="contained" disabled={!form.name.trim() || saving} onClick={() => void handleSave()} sx={TOUCH_TARGET_SX}>
            {saving ? <CircularProgress size={18} /> : 'Create Event'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

// #665: mirrors EventDetailPage's EditionFormState/emptyEditionForm(), minus TrailId and
// needsReview — neither applies to a not-yet-created edition (EditionDialogInner already hides
// needsReview the same way when isNew, and TrailId/PhotoGalleryManager stay dialog-only per this
// issue's scope, reachable later from EventDetailPage once the edition exists).
interface EditionFormState {
  year: string;
  date: string;
  endDate: string;
  title: string;
  titleEn: string;
  status: EditionStatus;
  registrationStatus: RegistrationStatus;
  registrationOpens: string;
  registrationCloses: string;
  registrationUrl: string;
  resultsUrl: string;
  notes: string;
  notesEn: string;
}

// New editions default to Hidden, same as EventDetailPage's emptyEditionForm(). Deliberately not
// ported: the Year-field nudge that dialog applies afterwards (shouldNudgeStatusForYear/
// editionStatusForYear) — here Status/RegistrationStatus are submitted as-picked (or left at these
// defaults) and CreateEditionCommand's own past-date-defaults-to-Completed logic governs instead.
function emptyEditionForm(): EditionFormState {
  return {
    year: String(new Date().getFullYear()),
    date: '', endDate: '', title: '', titleEn: '',
    status: 'Hidden',
    registrationStatus: 'NotStarted', registrationOpens: '', registrationCloses: '',
    registrationUrl: '', resultsUrl: '', notes: '', notesEn: '',
  };
}

const REGISTRATION_STATUSES: RegistrationStatus[] = ['NotStarted', 'Open', 'Closed', 'NotRequired'];

interface EditionDetailsStepProps extends EventWizardPageProps {
  eventId: string;
  eventSlug: string;
  onBack: () => void;
}

function EditionDetailsStep({ onNotify, eventId, eventSlug, onBack }: EditionDetailsStepProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EditionFormState>(emptyEditionForm());
  const [saving, setSaving] = useState(false);
  const registrationStatusHelperId = useId();

  const set = <K extends keyof EditionFormState>(k: K, v: EditionFormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  // Drives which month/year the date pickers below open on when they have no value of their own
  // yet — same helper EditionDialogInner uses for its own four date pickers.
  const referenceDate = referenceDateForYear(form.year);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Same POST shape as EditionDialogInner's handleSave (EventDetailPage.tsx) for a new
      // edition, minus trailId (not offered here, see scope note above) — CreateEditionCommand's
      // TrailId is optional and simply stays null when omitted.
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
        registrationOpens: form.registrationOpens || null,
        registrationCloses: form.registrationCloses || null,
        status: form.status,
      };
      await apiFetch(`/api/v1/admin/events/${eventId}/editions`, {
        method: 'POST', body: JSON.stringify(input),
      });
      // The events list's editionCount/nextEditionDate would otherwise stay stale until its own
      // 30s staleTime lapses — invalidate it now, same as useEvents().createEdition does.
      await queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
      onNotify('Edition created', 'success');
      navigate(`/events/${eventSlug}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to create edition', 'error');
    } finally {
      setSaving(false);
    }
  };

  // #665: the Event created in Step 1 is a real, already-persisted record — Cancel here only
  // abandons the not-yet-created edition, so it lands on the event's own detail page (where the
  // admin can see the event exists with no editions yet) rather than the generic events list.
  const handleCancel = () => navigate(`/events/${eventSlug}`);

  const registrationDatesSet = !!form.registrationOpens && !!form.registrationCloses;

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Edition details</Typography>
        <LangToggleButton />
      </Stack>

      <Stack spacing={2.5}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}>
          <TextField
            size="small" fullWidth label="Year" type="number" value={form.year}
            inputProps={{ min: 1900, max: 2100 }}
            onChange={e => set('year', e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': TOUCH_TARGET_SX }}
          />
          <DatePicker label="Start date"
            value={form.date ? dayjs(form.date) : null}
            onChange={v => set('date', v ? v.format('YYYY-MM-DD') : '')}
            referenceDate={referenceDate}
            slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': TOUCH_TARGET_SX } } }} />
          <DatePicker label="End date (multi-day)"
            value={form.endDate ? dayjs(form.endDate) : null}
            onChange={v => set('endDate', v ? v.format('YYYY-MM-DD') : '')}
            referenceDate={referenceDate}
            slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': TOUCH_TARGET_SX } } }} />
        </Box>

        <BilingualTextField
          size="small" fullWidth label="Title"
          valueIs={form.title} valueEn={form.titleEn}
          onChangeIs={v => set('title', v)} onChangeEn={v => set('titleEn', v)}
        />

        <FormControl size="small" fullWidth sx={{ '& .MuiOutlinedInput-root': TOUCH_TARGET_SX }}>
          <InputLabel>Status</InputLabel>
          <Select value={form.status} label="Status" onChange={e => set('status', e.target.value as EditionStatus)}>
            {EDITION_STATUSES.map(s => <MenuItem key={s} value={s}>{EDITION_STATUS_LABELS[s]}</MenuItem>)}
          </Select>
        </FormControl>

        <Typography
          variant="caption" fontWeight={600} letterSpacing={0.6}
          textTransform="uppercase" color="text.secondary"
          sx={{ display: 'block' }}
        >
          Registration
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <DatePicker label="Registration opens"
            value={form.registrationOpens ? dayjs(form.registrationOpens) : null}
            onChange={v => set('registrationOpens', v ? v.format('YYYY-MM-DD') : '')}
            referenceDate={referenceDate}
            slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': TOUCH_TARGET_SX } } }} />
          <DatePicker label="Registration closes"
            value={form.registrationCloses ? dayjs(form.registrationCloses) : null}
            onChange={v => set('registrationCloses', v ? v.format('YYYY-MM-DD') : '')}
            referenceDate={referenceDate}
            slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': TOUCH_TARGET_SX } } }} />
        </Box>

        <FormControl size="small" fullWidth disabled={registrationDatesSet} sx={{ '& .MuiOutlinedInput-root': TOUCH_TARGET_SX }}>
          <InputLabel>Registration status</InputLabel>
          <Select value={form.registrationStatus} label="Registration status"
            onChange={e => set('registrationStatus', e.target.value as RegistrationStatus)}
            aria-describedby={registrationDatesSet ? registrationStatusHelperId : undefined}>
            {REGISTRATION_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
          {registrationDatesSet && (
            <FormHelperText id={registrationStatusHelperId}>Computed automatically from Registration opens/closes</FormHelperText>
          )}
        </FormControl>

        <TextField size="small" fullWidth label="Registration URL" value={form.registrationUrl}
          onChange={e => set('registrationUrl', e.target.value)} />
        <TextField size="small" fullWidth label="Results URL" value={form.resultsUrl}
          onChange={e => set('resultsUrl', e.target.value)} />

        <BilingualTextField
          size="small" fullWidth label="Edition description" multiline rows={2}
          valueIs={form.notes} valueEn={form.notesEn}
          onChangeIs={v => set('notes', v)} onChangeEn={v => set('notesEn', v)}
        />
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mt: 3 }}>
        <Button onClick={onBack} disabled={saving} sx={TOUCH_TARGET_SX}>Back</Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={handleCancel} disabled={saving} sx={TOUCH_TARGET_SX}>Cancel</Button>
          <Button variant="contained" disabled={saving} onClick={() => void handleSave()} sx={TOUCH_TARGET_SX}>
            {saving ? <CircularProgress size={18} /> : 'Create Edition'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function EventWizardPage({ onNotify }: EventWizardPageProps) {
  const handleBackToList = useBackToList('/events');
  const [activeStep, setActiveStep] = useState(0);
  const [eventForm, setEventForm] = useState<FormState>(empty());
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null);

  return (
    <BilingualLangProvider>
      <Box>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
          <IconButton onClick={handleBackToList} aria-label="Back to events" sx={{ minWidth: 44, minHeight: 44 }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5">New Event</Typography>
        </Stack>

        <Stepper activeStep={activeStep} sx={{ mb: 3, maxWidth: 640 }}>
          <Step>
            <StepLabel>Event details</StepLabel>
          </Step>
          <Step>
            <StepLabel>Edition details</StepLabel>
          </Step>
        </Stepper>

        {activeStep === 0 && (
          <EventDetailsStep
            onNotify={onNotify}
            form={eventForm}
            setForm={setEventForm}
            onCreated={event => { setCreatedEvent(event); setActiveStep(1); }}
          />
        )}
        {activeStep === 1 && createdEvent && (
          <EditionDetailsStep
            onNotify={onNotify}
            eventId={createdEvent.id}
            eventSlug={createdEvent.slug}
            onBack={() => setActiveStep(0)}
          />
        )}
      </Box>
    </BilingualLangProvider>
  );
}
