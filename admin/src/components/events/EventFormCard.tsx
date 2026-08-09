import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
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
import type {
  ActivityType,
  AlertSeverity,
  EventDetailDto,
  EventStatus,
  EventType,
  UpdateEventInput,
} from '../../hooks/useEvents';
import { useTranslate } from '../../hooks/useTranslate';
import { trimToUndefined } from '../../utils/strings';
import BilingualTextField from '../BilingualTextField';
import { BilingualLangProvider, useBilingualLang } from '../../contexts/BilingualLangContext';

const EVENT_TYPES: EventType[] = ['Race', 'Series', 'Advertisement', 'Festival', 'Other'];
const ACTIVITY_TYPES: ActivityType[] = ['TrailRunning', 'Running', 'Cycling', 'Hiking', 'FunRun', 'ObstacleCourse', 'CrossCountryRun', 'Swim', 'Social', 'Other'];
const EVENT_STATUSES: EventStatus[] = ['Unconfirmed', 'Confirmed', 'Cancelled', 'Hidden', 'Unlisted'];
const ALERT_SEVERITIES: AlertSeverity[] = ['info', 'success', 'warning', 'error'];

interface EventFormState {
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  type: EventType;
  activityType: ActivityType;
  status: EventStatus;
  organizerName: string;
  organizerNameEn: string;
  organizerWebsite: string;
  alertMessage: string;
  alertMessageEn: string;
  alertSeverity: AlertSeverity | '';
}

function buildForm(event: EventDetailDto): EventFormState {
  return {
    name: event.name,
    nameEn: event.nameEn ?? '',
    description: event.description ?? '',
    descriptionEn: event.descriptionEn ?? '',
    type: event.type,
    activityType: event.activityType,
    status: event.status,
    organizerName: event.organizerName ?? '',
    organizerNameEn: event.organizerNameEn ?? '',
    organizerWebsite: event.organizerWebsite ?? '',
    alertMessage: event.alertMessage ?? '',
    alertMessageEn: event.alertMessageEn ?? '',
    alertSeverity: event.alertSeverity ?? '',
  };
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

interface EventFormCardProps {
  event: EventDetailDto;
  onClose: () => void;
  onSaved: (updated: EventDetailDto) => void;
  onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
  onUpdateEvent: (id: string, input: Omit<UpdateEventInput, 'id'>) => Promise<void>;
}

function EventFormCardInner({ event, onClose, onSaved, onNotify, onUpdateEvent }: EventFormCardProps) {
  const [form, setForm] = useState<EventFormState>(buildForm(event));
  const [saving, setSaving] = useState(false);
  const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));

  useEffect(() => {
    setForm(buildForm(event));
  }, [event]);

  const set = <K extends keyof EventFormState>(k: K, v: EventFormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleTranslate = async () => {
    const fields = [
      { key: 'nameEn' as const,           src: form.name },
      { key: 'descriptionEn' as const,    src: form.description },
      { key: 'organizerNameEn' as const,  src: form.organizerName },
      { key: 'alertMessageEn' as const,   src: form.alertMessage },
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
    if (!form.name.trim()) { onNotify('Event name is required', 'error'); return; }
    setSaving(true);
    try {
      const input: Omit<UpdateEventInput, 'id'> = {
        name: form.name.trim(),
        nameEn: trimToUndefined(form.nameEn),
        description: trimToUndefined(form.description),
        descriptionEn: trimToUndefined(form.descriptionEn),
        type: form.type,
        activityType: form.activityType,
        status: form.status,
        organizerName: trimToUndefined(form.organizerName),
        organizerNameEn: trimToUndefined(form.organizerNameEn),
        organizerWebsite: trimToUndefined(form.organizerWebsite),
        alertMessage: trimToUndefined(form.alertMessage),
        alertMessageEn: trimToUndefined(form.alertMessageEn),
        alertSeverity: form.alertSeverity || undefined,
        organizerId: event.organizerId,
        locationId: event.locationId,
        scheduleRule: event.scheduleRule,
        socialLinks: event.socialLinks,
        gpxPointLat: event.gpxPointLat,
        gpxPointLng: event.gpxPointLng,
      };
      await onUpdateEvent(event.id, input);
      onNotify('Event saved', 'success');
      onSaved({ ...event, ...input, id: event.id, slug: event.slug });
      onClose();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save event', 'error');
    } finally {
      setSaving(false);
    }
  };

  const canTranslate = !!(form.name.trim() || form.description.trim() || form.organizerName.trim() || form.alertMessage.trim());

  return (
    <Box
      sx={{
        border: '2px solid',
        borderColor: 'primary.main',
        borderRadius: 2,
        p: 2.5,
        bgcolor: 'background.paper',
        mt: 1.5,
        mb: 2,
      }}
    >
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>Edit event</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <LangToggleButton />
          <Typography variant="caption" color="text.secondary">{event.slug}</Typography>
        </Stack>
      </Stack>

      {/* Two-column layout */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>

        {/* ── Left column ── */}
        <Box>
          <SectionLabel>Identity</SectionLabel>
          <BilingualTextField
            size="small" fullWidth label="Name" sx={{ mb: 1.5 }}
            valueIs={form.name} valueEn={form.nameEn}
            onChangeIs={v => set('name', v)} onChangeEn={v => set('nameEn', v)}
            required error={!form.name.trim()}
          />
          <BilingualTextField
            size="small" fullWidth label="Description" multiline rows={8} sx={{ mb: 1.5 }}
            valueIs={form.description} valueEn={form.descriptionEn}
            onChangeIs={v => set('description', v)} onChangeEn={v => set('descriptionEn', v)}
          />
        </Box>

        {/* ── Right column ── */}
        <Box>
          <SectionLabel>Classification</SectionLabel>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={form.type} label="Type" onChange={e => set('type', e.target.value as EventType)}>
                {EVENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={form.status} label="Status" onChange={e => set('status', e.target.value as EventStatus)}>
                {EVENT_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
            <InputLabel>Activity</InputLabel>
            <Select value={form.activityType} label="Activity" onChange={e => set('activityType', e.target.value as ActivityType)}>
              {ACTIVITY_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>

          <Divider sx={{ my: 1.5 }} />

          <SectionLabel>Organizer</SectionLabel>
          <BilingualTextField
            size="small" fullWidth label="Organizer name" sx={{ mb: 1.5 }}
            valueIs={form.organizerName} valueEn={form.organizerNameEn}
            onChangeIs={v => set('organizerName', v)} onChangeEn={v => set('organizerNameEn', v)}
          />
          <TextField
            size="small" fullWidth label="Organizer website" value={form.organizerWebsite}
            onChange={e => set('organizerWebsite', e.target.value)}
            placeholder="https://…"
          />
        </Box>
      </Box>

      {/* Alert — full width */}
      <Divider sx={{ my: 2 }} />
      <SectionLabel>Alert banner</SectionLabel>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <BilingualTextField
          size="small" fullWidth label="Alert message" multiline rows={2}
          valueIs={form.alertMessage} valueEn={form.alertMessageEn}
          onChangeIs={v => set('alertMessage', v)} onChangeEn={v => set('alertMessageEn', v)}
        />
        <FormControl size="small" sx={{ minWidth: 120, flexShrink: 0 }}>
          <InputLabel>Severity</InputLabel>
          <Select value={form.alertSeverity} label="Severity"
            onChange={e => set('alertSeverity', e.target.value as AlertSeverity | '')}>
            <MenuItem value=""><em>None</em></MenuItem>
            {ALERT_SEVERITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {form.alertMessage.trim() && form.alertSeverity && (
        <Alert severity={form.alertSeverity} sx={{ mt: 1.5 }}>
          {form.alertMessage}
        </Alert>
      )}

      {/* Footer */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
        <Button
          size="small"
          startIcon={translating ? <CircularProgress size={14} /> : <TranslateIcon />}
          disabled={translating || !canTranslate}
          onClick={() => void handleTranslate()}
        >
          Translate to EN
        </Button>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            size="small" variant="contained"
            onClick={() => void handleSave()}
            disabled={saving || !form.name.trim()}
            startIcon={saving ? <CircularProgress size={14} /> : undefined}
          >
            {saving ? 'Saving…' : 'Save event'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function EventFormCard(props: EventFormCardProps) {
  return (
    <BilingualLangProvider>
      <EventFormCardInner {...props} />
    </BilingualLangProvider>
  );
}
