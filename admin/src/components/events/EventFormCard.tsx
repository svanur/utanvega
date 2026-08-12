import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import TranslateIcon from '@mui/icons-material/Translate';
import type {
  ActivityType,
  AlertSeverity,
  DayOfWeek,
  EventDetailDto,
  EventStatus,
  EventType,
  ScheduleRule,
  ScheduleType,
  SocialLink,
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
const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface ScheduleFormState {
  hasSchedule: boolean;
  type: ScheduleType;
  yearlyMode: 'weekday' | 'date';
  month: number;
  week: number;
  day: DayOfWeek;
  dayOfMonth: number;
  monthStart: number;
  monthEnd: number;
  seasonalWeek: number | '';
  fixedDate: string;
}

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
  schedule: ScheduleFormState;
  socialLinks: SocialLink[];
}

function buildScheduleForm(rule: ScheduleRule | null): ScheduleFormState {
  return {
    hasSchedule: rule != null,
    type: rule?.type ?? 'Yearly',
    yearlyMode: rule?.dayOfMonth != null ? 'date' : 'weekday',
    month: rule?.month ?? 7,
    week: rule?.weekOfMonth ?? 2,
    day: rule?.dayOfWeek ?? 'Saturday',
    dayOfMonth: rule?.dayOfMonth ?? 1,
    monthStart: rule?.monthStart ?? 10,
    monthEnd: rule?.monthEnd ?? 3,
    seasonalWeek: rule?.type === 'Seasonal' ? (rule.weekOfMonth ?? '') : '',
    fixedDate: rule?.date ?? '',
  };
}

function buildScheduleRule(s: ScheduleFormState): ScheduleRule | null {
  if (!s.hasSchedule) return null;
  if (s.type === 'Yearly') {
    return s.yearlyMode === 'date'
      ? { type: 'Yearly', month: s.month, dayOfMonth: s.dayOfMonth }
      : { type: 'Yearly', month: s.month, weekOfMonth: s.week, dayOfWeek: s.day };
  }
  if (s.type === 'Seasonal') {
    return {
      type: 'Seasonal',
      monthStart: s.monthStart,
      monthEnd: s.monthEnd,
      weekOfMonth: s.seasonalWeek === '' ? undefined : s.seasonalWeek,
      dayOfWeek: s.day,
    };
  }
  if (s.type === 'Fixed') {
    if (!s.fixedDate) return null;
    return { type: 'Fixed', date: s.fixedDate };
  }
  if (s.type === 'Approximate') {
    return {
      type: 'Approximate',
      month: s.month,
      ...(s.monthEnd > 0 && { monthEnd: s.monthEnd }),
    };
  }
  return null;
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
    schedule: buildScheduleForm(event.scheduleRule ?? null),
    socialLinks: event.socialLinks?.map(l => ({ ...l })) ?? [],
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

  useEffect(() => { setForm(buildForm(event)); }, [event]);

  const set = <K extends keyof EventFormState>(k: K, v: EventFormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const setSched = <K extends keyof ScheduleFormState>(k: K, v: ScheduleFormState[K]) =>
    setForm(prev => ({ ...prev, schedule: { ...prev.schedule, [k]: v } }));

  const handleTranslate = async () => {
    const fields = [
      { key: 'nameEn' as const,          src: form.name },
      { key: 'descriptionEn' as const,   src: form.description },
      { key: 'organizerNameEn' as const, src: form.organizerName },
      { key: 'alertMessageEn' as const,  src: form.alertMessage },
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
      const socialLinks = form.socialLinks.filter(l => l.type.trim() && l.url.trim());
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
        scheduleRule: buildScheduleRule(form.schedule),
        socialLinks: socialLinks.length > 0 ? socialLinks : null,
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
  const s = form.schedule;

  return (
    <Box sx={{ border: '2px solid', borderColor: 'primary.main', borderRadius: 2, p: 2.5, bgcolor: 'background.paper', mt: 1.5, mb: 2 }}>

      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>Edit event</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <LangToggleButton />
          <Typography variant="caption" color="text.secondary">{event.slug}</Typography>
        </Stack>
      </Stack>

      {/* Row 1: two-column */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>

        {/* ── Left: Identity ── */}
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

        {/* ── Right: Classification + Organizer ── */}
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
                {EVENT_STATUSES.map(st => <MenuItem key={st} value={st}>{st}</MenuItem>)}
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

      {/* Row 2: Schedule + Social links side by side */}
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>

        {/* ── Schedule rule ── */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <SectionLabel>Schedule rule</SectionLabel>
            <FormControlLabel
              control={<Switch size="small" checked={s.hasSchedule} onChange={e => setSched('hasSchedule', e.target.checked)} />}
              label={<Typography variant="caption">{s.hasSchedule ? 'On' : 'Off'}</Typography>}
              sx={{ m: 0 }}
            />
          </Stack>

          {s.hasSchedule && (
            <Stack spacing={1.5}>
              {/* Type selector */}
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {(['Yearly', 'Seasonal', 'Fixed', 'Approximate'] as ScheduleType[]).map(t => (
                  <Button key={t} size="small"
                    variant={s.type === t ? 'contained' : 'outlined'}
                    onClick={() => setSched('type', t)}
                  >{t}</Button>
                ))}
              </Stack>

              {s.type === 'Yearly' && (
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant={s.yearlyMode === 'weekday' ? 'contained' : 'outlined'} onClick={() => setSched('yearlyMode', 'weekday')}>Weekday</Button>
                    <Button size="small" variant={s.yearlyMode === 'date' ? 'contained' : 'outlined'} onClick={() => setSched('yearlyMode', 'date')}>Date</Button>
                  </Stack>
                  {s.yearlyMode === 'weekday' ? (
                    <Box sx={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 1 }}>
                      <FormControl size="small">
                        <InputLabel>Week</InputLabel>
                        <Select value={s.week} label="Week" onChange={e => setSched('week', Number(e.target.value))}>
                          {[1,2,3,4,-1].map(w => <MenuItem key={w} value={w}>{w === -1 ? 'Last' : `${w}.`}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <FormControl size="small">
                        <InputLabel>Day</InputLabel>
                        <Select value={s.day} label="Day" onChange={e => setSched('day', e.target.value as DayOfWeek)}>
                          {DAYS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <FormControl size="small">
                        <InputLabel>Month</InputLabel>
                        <Select value={s.month} label="Month" onChange={e => setSched('month', Number(e.target.value))}>
                          {MONTHS.slice(1).map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 1 }}>
                      <FormControl size="small">
                        <InputLabel>Month</InputLabel>
                        <Select value={s.month} label="Month" onChange={e => setSched('month', Number(e.target.value))}>
                          {MONTHS.slice(1).map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <FormControl size="small">
                        <InputLabel>Day</InputLabel>
                        <Select value={s.dayOfMonth} label="Day" onChange={e => setSched('dayOfMonth', Number(e.target.value))}>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Box>
                  )}
                </Stack>
              )}

              {s.type === 'Seasonal' && (
                <Box sx={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 80px', gap: 1 }}>
                  <FormControl size="small">
                    <InputLabel>Week</InputLabel>
                    <Select value={s.seasonalWeek} label="Week" onChange={e => setSched('seasonalWeek', e.target.value === '' ? '' : Number(e.target.value))}>
                      <MenuItem value="">Every</MenuItem>
                      {[1,2,3,4,-1].map(w => <MenuItem key={w} value={w}>{w === -1 ? 'Last' : `${w}.`}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small">
                    <InputLabel>Day</InputLabel>
                    <Select value={s.day} label="Day" onChange={e => setSched('day', e.target.value as DayOfWeek)}>
                      {DAYS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small">
                    <InputLabel>From</InputLabel>
                    <Select value={s.monthStart} label="From" onChange={e => setSched('monthStart', Number(e.target.value))}>
                      {MONTHS_SHORT.slice(1).map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small">
                    <InputLabel>To</InputLabel>
                    <Select value={s.monthEnd} label="To" onChange={e => setSched('monthEnd', Number(e.target.value))}>
                      {MONTHS_SHORT.slice(1).map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>
              )}

              {s.type === 'Fixed' && (
                <DatePicker
                  label="Date"
                  value={s.fixedDate ? dayjs(s.fixedDate) : null}
                  onChange={v => setSched('fixedDate', v ? v.format('YYYY-MM-DD') : '')}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              )}

              {s.type === 'Approximate' && (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <FormControl size="small">
                    <InputLabel>Month</InputLabel>
                    <Select value={s.month} label="Month" onChange={e => setSched('month', Number(e.target.value))}>
                      {MONTHS.slice(1).map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small">
                    <InputLabel>Until (optional)</InputLabel>
                    <Select value={s.monthEnd} label="Until (optional)" onChange={e => setSched('monthEnd', Number(e.target.value))}>
                      <MenuItem value={0}>—</MenuItem>
                      {MONTHS.slice(1).map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>
              )}
            </Stack>
          )}
        </Box>

        {/* ── Social links ── */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <SectionLabel>Social links</SectionLabel>
            <Tooltip title="Add social link">
              <IconButton size="small" onClick={() => set('socialLinks', [...form.socialLinks, { type: '', url: '' }])}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          {form.socialLinks.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No social links.</Typography>
          ) : (
            <Stack spacing={1}>
              {form.socialLinks.map((link, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small" label="Type" value={link.type}
                    onChange={e => set('socialLinks', form.socialLinks.map((l, j) => j === i ? { ...l, type: e.target.value } : l))}
                    placeholder="Instagram"
                    sx={{ width: 130, flexShrink: 0 }}
                  />
                  <TextField
                    size="small" fullWidth label="URL" value={link.url}
                    onChange={e => set('socialLinks', form.socialLinks.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                    placeholder="https://…"
                  />
                  <IconButton size="small" color="error"
                    onClick={() => set('socialLinks', form.socialLinks.filter((_, j) => j !== i))}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      </Box>

      {/* Row 3: Alert banner — full width */}
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
            {ALERT_SEVERITIES.map(sv => <MenuItem key={sv} value={sv}>{sv}</MenuItem>)}
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
