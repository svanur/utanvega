import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
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
import { useEvents, type ActivityType, type EventStatus, type EventType } from '../hooks/useEvents';
import { useTranslate } from '../hooks/useTranslate';
import { useBackToList } from '../hooks/useBackToList';
import { trimToUndefined } from '../utils/strings';
import BilingualTextField from '../components/BilingualTextField';
import { BilingualLangProvider } from '../contexts/BilingualLangContext';
import { useBilingualLang } from '../hooks/useBilingualLang';

// #664: first step of the events-wizard milestone — replaces CreateEventDialog. Only the "Event
// details" step exists here; Edition (#665) and Races (#666) steps are separate, already-blocked
// issues, so the Stepper below deliberately renders a single step rather than placeholders.

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

function EventDetailsStep({ onNotify }: EventWizardPageProps) {
  const navigate = useNavigate();
  const handleBackToList = useBackToList('/events');
  const { events, createEvent } = useEvents();
  const [form, setForm] = useState<FormState>(empty());
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
      const { slug } = await createEvent({
        name: form.name.trim(),
        nameEn: trimToUndefined(form.nameEn),
        slug: trimToUndefined(form.slug),
        type: form.type,
        activityType: form.activityType,
        status: form.status,
      });
      onNotify(`"${form.name.trim()}" created`, 'success');
      navigate(`/events/${slug}`);
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

export default function EventWizardPage({ onNotify }: EventWizardPageProps) {
  const handleBackToList = useBackToList('/events');

  return (
    <BilingualLangProvider>
      <Box>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
          <IconButton onClick={handleBackToList} aria-label="Back to events" sx={{ minWidth: 44, minHeight: 44 }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5">New Event</Typography>
        </Stack>

        <Stepper activeStep={0} sx={{ mb: 3, maxWidth: 640 }}>
          <Step>
            <StepLabel>Event details</StepLabel>
          </Step>
        </Stepper>

        <EventDetailsStep onNotify={onNotify} />
      </Box>
    </BilingualLangProvider>
  );
}
