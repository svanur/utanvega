import { useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import type { ActivityType, EventStatus, EventType } from '../../hooks/useEvents';
import type { CreateEventInput } from '../../hooks/useEvents';
import { useTranslate } from '../../hooks/useTranslate';
import { trimToUndefined } from '../../utils/strings';
import BilingualTextField from '../BilingualTextField';
import { BilingualLangProvider, useBilingualLang } from '../../contexts/BilingualLangContext';

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
const EVENT_STATUSES: EventStatus[] = ['Unconfirmed', 'Confirmed', 'Cancelled', 'Hidden', 'Unlisted'];
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

function empty(): FormState {
  return { name: '', nameEn: '', slug: '', type: 'Race', activityType: 'TrailRunning', status: 'Unconfirmed' };
}

interface CreateEventDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (slug: string) => void;
  onNotify: (msg: ReactNode, sev?: 'success' | 'error') => void;
  createEvent: (input: CreateEventInput) => Promise<{ id: string; slug: string }>;
}

function CreateEventDialogInner({ open, onClose, onCreated, onNotify, createEvent }: CreateEventDialogProps) {
  const [form, setForm] = useState<FormState>(empty());
  const [saving, setSaving] = useState(false);
  const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

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
      onCreated(slug);
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionProps={{ onEnter: () => setForm(empty()) }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          New Event
          <LangToggleButton />
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <BilingualTextField
            size="small" fullWidth label="Name" autoFocus required
            error={!form.name.trim()}
            valueIs={form.name} valueEn={form.nameEn}
            onChangeIs={v => set('name', v)} onChangeEn={v => set('nameEn', v)}
          />

          <TextField
            size="small" fullWidth label="Slug" value={form.slug}
            onChange={e => set('slug', e.target.value)}
            placeholder="Auto-generated from name if empty"
            helperText="Lowercase, hyphens only"
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={form.type} label="Type" onChange={e => set('type', e.target.value as EventType)}>
                {EVENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Activity</InputLabel>
              <Select value={form.activityType} label="Activity" onChange={e => set('activityType', e.target.value as ActivityType)}>
                {ACTIVITY_TYPES.map(at => <MenuItem key={at} value={at}>{ACTIVITY_ICONS[at] ?? '🏅'} {at}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={form.status} label="Status" onChange={e => set('status', e.target.value as EventStatus)}>
                {EVENT_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button
          size="small"
          startIcon={translating ? <CircularProgress size={14} /> : <TranslateIcon />}
          disabled={translating || !form.name.trim()}
          onClick={() => void handleTranslate()}
        >
          Translate to EN
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="contained" disabled={!form.name.trim() || saving} onClick={() => void handleSave()}>
            {saving ? <CircularProgress size={18} /> : 'Create Event'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default function CreateEventDialog(props: CreateEventDialogProps) {
  return (
    <BilingualLangProvider>
      <CreateEventDialogInner {...props} />
    </BilingualLangProvider>
  );
}
