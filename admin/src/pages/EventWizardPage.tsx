import { useEffect, useId, useRef, useState, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
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
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DeleteIcon from '@mui/icons-material/Delete';
import TranslateIcon from '@mui/icons-material/Translate';
import {
  useEventDetail,
  useEvents,
  type ActivityType,
  type EditionStatus,
  type EventStatus,
  type EventType,
  type RegistrationStatus,
} from '../hooks/useEvents';
import { useTrails, type Trail } from '../hooks/useTrails';
import { useTranslate } from '../hooks/useTranslate';
import { useBackToList } from '../hooks/useBackToList';
import { usePageShortcuts } from '../hooks/usePageShortcuts';
import { trimToUndefined } from '../utils/strings';
import {
  buildRaceSavePayload,
  createEmptyRaceForm,
  editionStatusForYear,
  EDITION_STATUSES,
  EDITION_STATUS_LABELS,
  referenceDateForYear,
  shouldNudgeStatusForYear,
  titleSyncForYear,
} from '../utils/eventForms';
import BilingualTextField from '../components/BilingualTextField';
import BilingualLangToggle from '../components/BilingualLangToggle';
import { BilingualLangProvider } from '../contexts/BilingualLangContext';
import { useBilingualLang } from '../hooks/useBilingualLang';

// #664: first step of the events-wizard milestone — replaces CreateEventDialog.
// #665: added the second ("Edition details") step below, which creates the new event's first
// edition inline via CreateEditionCommand — the admin no longer has to leave the wizard and open
// EventDetailPage's EditionDialogInner just to add it.
// #666: added the third ("Races") step below, so races can be batch-created against the trail
// list inline too, rather than requiring a trip to the per-race RaceFormCard on EventDetailPage
// once per race.

// Mobile-first requirement (AGENTS.md Definition of Done): unlike CreateEventDialog's compact
// size="small" controls, this is new work checked at 375px, so the Type/Activity/Status Selects
// and the action buttons are bumped to the 44px touch-target minimum below.
const TOUCH_TARGET_SX = { minHeight: 44 };

// #666: RacesStep's trail multi-select needs the same Icelandic-aware fuzzy match
// AdminSpotlightSearch.tsx already has — copied rather than extracted into a shared util per this
// issue's explicit scope (dedupe is a separate, deliberate follow-up, not incidental cleanup here).
function normalizeIcelandic(s: string): string {
  return s
    .toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ý/g, 'y')
    .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae')
    .replace(/ö/g, 'o');
}

function scoreMatch(query: string, name: string, slug: string): number {
  const q = normalizeIcelandic(query);
  const n = normalizeIcelandic(name);
  const s = slug.toLowerCase();
  if (n === q || s === q) return 100;
  if (n.startsWith(q) || s.startsWith(q)) return 80;
  const words = n.split(/\s+/);
  if (words.some(w => w.startsWith(q))) return 60;
  if (n.includes(q) || s.includes(q)) return 40;
  return 0;
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

  usePageShortcuts([
    { key: 'Enter', ctrl: true, allowInInput: true, handler: () => { if (form.name.trim() && !saving) void handleSave(); } },
  ]);

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Event details</Typography>
        <BilingualLangToggle />
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

// New editions default to Hidden, same as EventDetailPage's emptyEditionForm(). #945: the
// Year-field nudge (shouldNudgeStatusForYear/editionStatusForYear) that dialog also applies is now
// ported to this step's own Year onChange below, rather than relying solely on
// CreateEditionCommand's own past-date-defaults-to-Completed logic, which only fires when an exact
// Date/EndDate is set — a year-only edition was previously never corrected either way.
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

// #666: the edition created here — carried into Step 3 (Races) so it can create races against the
// right editionId and so createEmptyRaceForm can mirror CreateRaceCommand's Completed-edition ->
// Completed/Closed override without re-fetching the edition it was just created from.
interface CreatedEdition {
  id: string;
  status: EditionStatus;
  year: string;
}

interface EditionDetailsStepProps extends EventWizardPageProps {
  eventId: string;
  eventSlug: string;
  // Lifted up to EventWizardPage (rather than owned locally) so clicking "Back" here to Step 1
  // and then forward again shows these values still populated instead of remounting from
  // emptyEditionForm() — mirrors EventDetailsStepProps' form/setForm above (#940).
  form: EditionFormState;
  setForm: Dispatch<SetStateAction<EditionFormState>>;
  onBack: () => void;
  onCreated: (edition: CreatedEdition) => void;
  // #942: set when this step is being revisited from Step 3's own new Back button to fix a field
  // on the edition already created earlier in this session — drives the create-vs-update branch
  // below, mirroring EditionDialogInner's isNew (EventDetailPage.tsx). Undefined on the first visit
  // (edition doesn't exist yet), the created edition's id on every subsequent visit — the parent
  // never clears createdEdition once set, so returning here after Step 3 always carries it.
  editionId?: string;
  // #957: lifted up to EventWizardPage (rather than owned locally as a ref declared inside this
  // component) for the same reason form/setForm above already are — a plain local ref is reset to
  // its initial value on every unmount, but a Back-to-Step-1-then-forward-again round trip must not
  // forget that the admin already made a manual Status/Registration-status choice, or the very next
  // Year edit would silently nudge right over it. Passed down as the ref object itself (rather than
  // a boolean + setter pair) since this step only ever mutates `.current` imperatively from event
  // handlers, never reads it during render — an ordinary prop drilling of the ref, not React state.
  statusManuallySetRef: MutableRefObject<boolean>;
}

// #956: exported (unlike EventDetailsStep above) so EventWizardPage.test.tsx can mount this step
// directly against its own controlled form/setForm state — the Year field's onChange wiring below
// (titleSyncForYear + editionStatusForYear + shouldNudgeStatusForYear, gated by the
// statusManuallySetRef guard) isn't reachable at the pure-function layer alone; eventForms.test.ts
// itself says as much in its own header comment. Mirrors how RacesStep was exported in PR #961 for
// the same reason.
export function EditionDetailsStep({ onNotify, eventId, eventSlug, form, setForm, onBack, onCreated, editionId, statusManuallySetRef }: EditionDetailsStepProps) {
  const navigate = useNavigate();
  const { createEdition, updateEdition } = useEvents();
  const [saving, setSaving] = useState(false);
  const registrationStatusHelperId = useId();
  const editionStatusHelperId = useId();
  // #964: explicit id/labelId pairing so these two Selects have an accessible name reachable via
  // getByLabelText — the plain <InputLabel> + Select `label` prop pairing everywhere else in this
  // step only paints the outline notch text, it doesn't associate the label with the control.
  const statusLabelId = useId();
  const registrationStatusLabelId = useId();
  const isEdit = editionId !== undefined;

  const set = <K extends keyof EditionFormState>(k: K, v: EditionFormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  // Drives which month/year the date pickers below open on when they have no value of their own
  // yet — same helper EditionDialogInner uses for its own four date pickers.
  const referenceDate = referenceDateForYear(form.year);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Same shape as EditionDialogInner's handleSave (EventDetailPage.tsx) for both branches
      // below, minus trailId (not offered here, see scope note above) — CreateEditionCommand's/
      // UpdateEditionCommand's TrailId is optional and simply stays null/unchanged when omitted.
      const payload = {
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
      if (isEdit) {
        // #942: the edition already exists (created on an earlier visit to this step) — PUT the
        // edit rather than POSTing a second, duplicate edition under the same event/year.
        await updateEdition(editionId, payload);
        onNotify('Edition saved', 'success');
        onCreated({ id: editionId, status: form.status, year: form.year });
      } else {
        const id = await createEdition({ eventId, ...payload });
        // useEvents().createEdition already invalidates the events list (editionCount/
        // nextEditionDate), which would otherwise stay stale until its own 30s staleTime lapses.
        onNotify('Edition created', 'success');
        // #666: the edition now exists — advance to Step 3 (Races) rather than navigating away
        // directly, mirroring EventDetailsStep's own onCreated(event) advance into this step.
        onCreated({ id, status: form.status, year: form.year });
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : `Failed to ${isEdit ? 'save' : 'create'} edition`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // #665: the Event created in Step 1 is a real, already-persisted record — Cancel here only
  // abandons the not-yet-created edition, so it lands on the event's own detail page (where the
  // admin can see the event exists with no editions yet) rather than the generic events list.
  const handleCancel = () => navigate(`/events/${eventSlug}`);

  usePageShortcuts([
    { key: 'Enter', ctrl: true, allowInInput: true, handler: () => { if (!saving) void handleSave(); } },
  ]);

  const registrationDatesSet = !!form.registrationOpens && !!form.registrationCloses;

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Edition details</Typography>
        <BilingualLangToggle />
      </Stack>

      <Stack spacing={2.5}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}>
          <TextField
            size="small" fullWidth label="Year" type="number" value={form.year}
            inputProps={{ min: 1900, max: 2100 }}
            onChange={e => {
              const newYear = e.target.value;
              setForm(prev => {
                const updates: Partial<EditionFormState> = { year: newYear };
                const ny = parseInt(newYear, 10);
                // Title/titleEn sync mirrors EditionDialogInner's own Year onChange
                // (EventDetailPage.tsx) — see titleSyncForYear for the "still looks auto-synced"
                // gating that keeps this from clobbering a title the admin has actually typed.
                const titleSync = titleSyncForYear(newYear, prev.title);
                if (titleSync) {
                  updates.title = titleSync.title;
                  updates.titleEn = titleSync.titleEn;
                }
                // #945: isEdit is true only on a Step-3-Back-triggered revisit to an edition that
                // already exists (see editionId's own doc comment above) — the nudge must not
                // re-fire and clobber a since-saved Status on that revisit, exactly as
                // EditionDialogInner doesn't nudge for an existing (!isNew) edition. The wizard has
                // no clone concept, so isClone is always false here.
                if (shouldNudgeStatusForYear(!isEdit, false, statusManuallySetRef.current) && newYear.length === 4 && !isNaN(ny)) {
                  const nudged = editionStatusForYear(ny);
                  if (nudged) {
                    updates.status = nudged.status;
                    updates.registrationStatus = nudged.registrationStatus;
                  }
                }
                return { ...prev, ...updates };
              });
            }}
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
          <InputLabel id={statusLabelId}>Status</InputLabel>
          <Select labelId={statusLabelId} value={form.status} label="Status"
            onChange={e => {
              statusManuallySetRef.current = true;
              set('status', e.target.value as EditionStatus);
            }}
            aria-describedby={isEdit && form.status !== 'Cancelled' && form.status !== 'Completed' ? editionStatusHelperId : undefined}>
            {EDITION_STATUSES.map(s => (
              // #942 (AGENTS.md "an action with consequences beyond the field it names is not a
              // field edit"): mirrors EditionDialogInner's guard on EventDetailPage.tsx — Cancelled/
              // Completed cascade to this edition's races via the backend's CancelWithRaces()/
              // CompleteWithRaces(), so once the edition is real (isEdit, reached by coming Back
              // from Step 3) they must not be landable on via a bare Save here. A brand-new,
              // not-yet-created edition has no races yet to cascade to, so both stay open on the
              // first (create) visit. Keep the option disabled (when isEdit) unless it's already the
              // current value, so the Select still renders it instead of showing blank.
              <MenuItem key={s} value={s} disabled={isEdit && (s === 'Cancelled' || s === 'Completed') && s !== form.status}>
                {EDITION_STATUS_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
          {isEdit && form.status !== 'Cancelled' && form.status !== 'Completed' && (
            <FormHelperText id={editionStatusHelperId}>Use the ✓/✕ icons on this edition&apos;s row on the event&apos;s detail page to complete or cancel it.</FormHelperText>
          )}
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
          <InputLabel id={registrationStatusLabelId}>Registration status</InputLabel>
          <Select labelId={registrationStatusLabelId} value={form.registrationStatus} label="Registration status"
            onChange={e => {
              statusManuallySetRef.current = true;
              set('registrationStatus', e.target.value as RegistrationStatus);
            }}
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
            {saving ? <CircularProgress size={18} /> : (isEdit ? 'Save Edition' : 'Create Edition')}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

// #666: third and final wizard step — races are batch-created against existing trails, rather
// than the admin having to open the standalone RaceFormCard once per race on EventDetailPage.
// Only trailId/name/sortOrder are seeded here (see createEmptyRaceForm for the rest of the
// Completed-edition-aware defaults) — fine-tuning any of that stays on RaceFormCard afterwards.
interface AddedRace {
  id: string;
  name: string;
}

interface RacesStepProps extends EventWizardPageProps {
  eventSlug: string;
  editionId: string;
  editionStatus: EditionStatus;
  editionYear: string;
  // #942: returns to Step 2 (Edition details) pre-filled with this edition's own values, rather
  // than there being no way back to fix a field once Step 3 has been reached.
  onBack: () => void;
}

// Exported (unlike EventDetailsStep/EditionDetailsStep above) so EventWizardPage.test.tsx can
// mount it directly against a shared QueryClient — the Step 3 -> 2 -> 3 unmount/remount this fixes
// isn't reachable by rendering just the default-exported wizard without driving all three steps'
// forms end to end.
export function RacesStep({ onNotify, eventSlug, editionId, editionStatus, editionYear, onBack }: RacesStepProps) {
  const navigate = useNavigate();
  const { trails } = useTrails();
  const { createRace, deleteRace, refresh } = useEvents();
  // #953: RacesStep unmounts on Back (Step 3 -> Step 2) and remounts fresh on return, which used to
  // reset addedRaces to [] below even though the races themselves were already persisted by
  // createRace. useEventDetail(eventSlug) is the same react-query-wrapped fetch EventDetailPage.tsx
  // already uses to read an edition's races — seeding addedRaces from it fixes the reset without a
  // new ad hoc fetch path or backend endpoint. Round 1 review (PR #961) caught that reading the
  // hook's reactive `detail` alone isn't enough: `useEventDetail`'s query has a 30s staleTime, and
  // neither createRace nor deleteRace invalidates it, so a Step 3 -> 2 -> 3 round trip completed
  // within 30s of the page load would silently reseed from the still-cached pre-mutation snapshot.
  // `refetch` (unlike the hook's own fire-and-forget `refresh`) always hits the network when called
  // imperatively regardless of staleTime — awaiting it below and seeding from *its* resolved data
  // (rather than the reactive `detail` value) guarantees the seed reflects whatever was actually
  // persisted by the time this step (re)mounts, no matter how quickly the round trip happens.
  const { refetch: refetchEventDetail } = useEventDetail(eventSlug);
  const [selectedTrails, setSelectedTrails] = useState<Trail[]>([]);
  const [addedRaces, setAddedRaces] = useState<AddedRace[]>([]);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Guards the seed effect below: flips true once addedRaces has been seeded from the refetched
  // edition, or as soon as the admin adds/removes a race locally (whichever comes first) — so a
  // refetch that resolves *after* a local add/remove can't overwrite the (already-correct, already
  // including that add/remove) optimistic local state with the pre-mutation response it started
  // fetching with.
  const seedingDoneRef = useRef(false);
  // #962: the next sortOrder handleAddRaces will hand out — a ref rather than deriving it from
  // addedRaces.length, because handleRemove shortens addedRaces by filtering it locally but never
  // renumbers anything server-side. Before this fix, a same-session add-add-remove-add sequence
  // (A, B added at sortOrder 0/1; A removed, so addedRaces.length drops back to 1; C added) reused
  // addedRaces.length as the next call's base offset and collided with B's still-persisted
  // sortOrder 1. This ref only ever increases — seeded once below from the edition's actual
  // persisted races (already sorted by sortOrder), and bumped again after every successful
  // handleAddRaces call — so a later add can never land on a sortOrder a removal made room for.
  const nextSortOrderRef = useRef(0);
  // #968: the seed effect below awaits refetchEventDetail() before it can apply its result, and
  // both handleAddRaces and handleRemove set seedingDoneRef.current = true *synchronously*, before
  // any network call of their own starts. If either fires quickly enough after a Step 3 -> 2 -> 3
  // remount — before this effect's own await resolves — the effect's post-await
  // `seedingDoneRef.current` check sees true and bails out, leaving addedRaces/nextSortOrderRef
  // unseeded for the rest of the mount (a narrower reappearance of #953/#962, still open per PR
  // #967's round-1 review). This ref holds the seed effect's own in-flight promise so a fast
  // handleAddRaces/handleRemove call can await it first — letting the effect finish seeding, exactly
  // as it would with no race in flight — before treating local state as authoritative. Cleared back
  // to null once the effect settles (whether it actually seeded, bailed out early, or was
  // cancelled), so a call arriving after seeding is already done skips the await entirely.
  const seedInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const seedPromise = (async () => {
      if (seedingDoneRef.current) return;
      const { data } = await refetchEventDetail();
      // Re-check after the await: a local add/remove (or an unmount) may have happened while this
      // fetch was in flight, in which case the response below is already stale and must be dropped.
      if (cancelled || seedingDoneRef.current) return;
      const edition = data?.editions.find(e => e.id === editionId);
      if (!edition) return;
      const sortedRaces = edition.races.slice().sort((a, b) => a.sortOrder - b.sortOrder);
      setAddedRaces(sortedRaces.map(r => ({ id: r.id, name: r.name })));
      // #962: seed the monotonic counter from whatever is actually persisted, rather than leaving
      // it at its initial 0 — a Step 3 -> 2 -> 3 remount must continue the existing sortOrder
      // sequence, not restart it and collide with the races seeded above.
      nextSortOrderRef.current = sortedRaces.length > 0
        ? sortedRaces[sortedRaces.length - 1].sortOrder + 1
        : 0;
      seedingDoneRef.current = true;
    })();
    seedInFlightRef.current = seedPromise;
    void seedPromise.finally(() => {
      // Only clear the ref if it's still pointing at *this* effect run's promise — a fast unmount
      // during the await could otherwise let a stale `.finally` from a superseded run clobber a
      // newer run's own in-flight promise.
      if (seedInFlightRef.current === seedPromise) seedInFlightRef.current = null;
    });
    return () => { cancelled = true; };
  }, [refetchEventDetail, editionId]);

  // Same status filter RaceFormCard's own Trail Autocomplete applies — Draft/Flagged/Archived
  // trails aren't meant to be attached to a race yet.
  const selectableTrails = trails.filter(t => t.status === 'Published' || t.status === 'EventOnly');

  const handleAddRaces = async () => {
    if (selectedTrails.length === 0) return;
    // #968: if the seed effect is still mid-flight (e.g. this click landed right after a Step 3 ->
    // 2 -> 3 remount, before its refetch resolved), wait for it to finish applying its result first
    // — otherwise the seedingDoneRef flip below would land before the effect's own post-await check
    // runs, causing it to silently drop its seed and leave addedRaces/nextSortOrderRef unseeded.
    if (seedInFlightRef.current) await seedInFlightRef.current;
    seedingDoneRef.current = true; // local state is authoritative from here on for this mount
    setAdding(true);
    // #666/#953: sortOrder increments from however many races already exist under this edition.
    // #962: reserve the *whole* attempted range up front, from nextSortOrderRef rather than
    // addedRaces.length — see that ref's own doc comment above for why addedRaces.length is unsafe
    // once a remove has happened this session. Reserving the full batch (not just the eventually-
    // successful subset) also means a partial failure can't leave the next call's base colliding
    // with a race that did succeed within this same batch.
    const baseSortOrder = nextSortOrderRef.current;
    nextSortOrderRef.current = baseSortOrder + selectedTrails.length;
    try {
      const results = await Promise.allSettled(
        selectedTrails.map((trail, i) => {
          const form = { ...createEmptyRaceForm(editionId, baseSortOrder + i, editionStatus), trailId: trail.id, name: trail.name };
          return createRace(buildRaceSavePayload(form)).then(id => ({ id, trail }));
        }),
      );
      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<{ id: string; trail: Trail }> => r.status === 'fulfilled')
        .map(r => r.value);
      const failed = results.length - succeeded.length;

      if (succeeded.length > 0) {
        setAddedRaces(prev => [...prev, ...succeeded.map(s => ({ id: s.id, name: s.trail.name }))]);
        const succeededIds = new Set(succeeded.map(s => s.trail.id));
        setSelectedTrails(prev => prev.filter(t => !succeededIds.has(t.id)));
      }

      // #666: partial-failure notify pattern mirrors EventDetailPage.tsx's clone-edition
      // Promise.allSettled handling — the successful creates are never rolled back.
      if (failed > 0) {
        onNotify(`${failed}/${results.length} race${results.length === 1 ? '' : 's'} failed to add`, 'error');
      } else {
        onNotify(`${succeeded.length} race${succeeded.length === 1 ? '' : 's'} added`, 'success');
      }
      // createRace doesn't invalidate the cache itself — refresh so the events list (and
      // EventDetailPage, once Finish navigates there) don't show a stale race count.
      await refresh();
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (race: AddedRace) => {
    // #968: same window as handleAddRaces above — a fast remove right after a remount could
    // otherwise flip seedingDoneRef before the in-flight seed effect gets to apply its result.
    if (seedInFlightRef.current) await seedInFlightRef.current;
    seedingDoneRef.current = true;
    setRemovingId(race.id);
    try {
      await deleteRace(race.id);
      setAddedRaces(prev => prev.filter(r => r.id !== race.id));
      await refresh();
      onNotify('Race removed', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to remove race', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  // #943: Autocomplete selections aren't persisted until "Add races" is clicked — Finish used to
  // navigate away regardless, silently dropping a staged selection. Mirrors the confirm() guard
  // TrailFormCard/EditionDialogInner already use for their own "pending selection would be
  // silently dropped" cases rather than introducing a new confirm-dialog component.
  const handleFinish = () => {
    if (selectedTrails.length > 0) {
      const proceed = confirm(
        `You have ${selectedTrails.length} trail${selectedTrails.length === 1 ? '' : 's'} selected above but haven't clicked "Add races" — `
        + `that selection will NOT be saved.\n\n`
        + `Cancel to go back and click "Add races", or OK to finish without it.`
      );
      if (!proceed) return;
    }
    navigate(`/events/${eventSlug}`);
  };

  usePageShortcuts([
    { key: 'Enter', ctrl: true, allowInInput: true, handler: () => { if (selectedTrails.length > 0 && !adding) void handleAddRaces(); } },
  ]);

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Races{editionYear.trim() ? ` — ${editionYear.trim()} edition` : ''}
      </Typography>

      <Autocomplete
        multiple
        disableCloseOnSelect
        options={selectableTrails}
        value={selectedTrails}
        onChange={(_e, value) => setSelectedTrails(value)}
        getOptionLabel={t => t.name}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        filterOptions={(options, state) => {
          const query = state.inputValue.trim();
          if (!query) return options;
          return options
            .map(o => ({ o, score: scoreMatch(query, o.name, o.slug) }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(x => x.o);
        }}
        renderOption={(props, option, { selected }) => {
          const { key, ...rest } = props;
          return (
            <Box component="li" key={key} {...rest} sx={{ ...TOUCH_TARGET_SX, display: 'flex', alignItems: 'center' }}>
              <Checkbox
                icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                checkedIcon={<CheckBoxIcon fontSize="small" />}
                checked={selected}
                sx={{ mr: 1 }}
              />
              {option.name} ({(option.length / 1000).toFixed(1)} km)
            </Box>
          );
        }}
        renderTags={(value, getTagProps) => value.map((trail, index) => {
          const { key, ...rest } = getTagProps({ index });
          return <Chip key={key} label={trail.name} {...rest} sx={{ minHeight: 32 }} />;
        })}
        renderInput={params => (
          <TextField {...params} label="Search trails to add" placeholder="Type a trail name…"
            sx={{ '& .MuiOutlinedInput-root': TOUCH_TARGET_SX }} />
        )}
        sx={{ mb: 2 }}
      />

      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 3 }}>
        <Button
          variant="contained"
          disabled={selectedTrails.length === 0 || adding}
          onClick={() => void handleAddRaces()}
          sx={TOUCH_TARGET_SX}
        >
          {adding
            ? <CircularProgress size={18} />
            : `Add ${selectedTrails.length} race${selectedTrails.length === 1 ? '' : 's'}`}
        </Button>
      </Stack>

      {addedRaces.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Added this session
          </Typography>
          <Stack spacing={1} sx={{ mb: 3 }}>
            {addedRaces.map(race => (
              <Stack
                key={race.id} direction="row" justifyContent="space-between" alignItems="center"
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.5 }}
              >
                <Typography variant="body2">{race.name}</Typography>
                <IconButton
                  aria-label={`Remove ${race.name}`}
                  onClick={() => void handleRemove(race)}
                  disabled={removingId === race.id}
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  {removingId === race.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                </IconButton>
              </Stack>
            ))}
          </Stack>
        </>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 3 }}>
        <Button onClick={onBack} sx={TOUCH_TARGET_SX}>Back</Button>
        <Button variant="contained" onClick={handleFinish} sx={TOUCH_TARGET_SX}>Finish</Button>
      </Stack>
    </Box>
  );
}

export default function EventWizardPage({ onNotify }: EventWizardPageProps) {
  const handleBackToList = useBackToList('/events');
  const [activeStep, setActiveStep] = useState(0);
  const [eventForm, setEventForm] = useState<FormState>(empty());
  const [editionForm, setEditionForm] = useState<EditionFormState>(emptyEditionForm());
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null);
  const [createdEdition, setCreatedEdition] = useState<CreatedEdition | null>(null);
  // #957: lifted out of EditionDetailsStep so a Step 2 -> Back -> Step 1 -> Step 2 round trip
  // doesn't reset it — see EditionDetailsStepProps' own doc comment on statusManuallySetRef above.
  const statusManuallySetRef = useRef(false);

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
          <Step>
            <StepLabel>Races</StepLabel>
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
            form={editionForm}
            setForm={setEditionForm}
            // #942: createdEdition is never cleared once set, so a Step-3-Back-triggered revisit
            // of this step always carries the same id forward — Undefined only on the very first
            // visit, before an edition exists to edit.
            editionId={createdEdition?.id}
            statusManuallySetRef={statusManuallySetRef}
            onBack={() => setActiveStep(0)}
            onCreated={edition => { setCreatedEdition(edition); setActiveStep(2); }}
          />
        )}
        {activeStep === 2 && createdEvent && createdEdition && (
          <RacesStep
            onNotify={onNotify}
            eventSlug={createdEvent.slug}
            editionId={createdEdition.id}
            editionStatus={createdEdition.status}
            editionYear={createdEdition.year}
            onBack={() => setActiveStep(1)}
          />
        )}
      </Box>
    </BilingualLangProvider>
  );
}
