import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  IconButton, LinearProgress, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TranslateIcon from '@mui/icons-material/Translate';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiFetch } from '../hooks/api';
import { useTranslate } from '../hooks/useTranslate';
import type { EventDetailDto, EventEditionDto, RaceDto } from '../hooks/useEvents';
import type { LocationDto } from '../hooks/useLocations';
import type { OrganizerDto } from '../hooks/useOrganizers';
import type { TagDto } from '../hooks/useTags';

// ─── types ────────────────────────────────────────────────────────────────────

interface FieldDef {
  label: string;
  getIs: (item: EntityItem) => string | null | undefined;
  getEn: (item: EntityItem) => string | null | undefined;
}

type EntityKind = 'Event' | 'Edition' | 'Race' | 'Location' | 'Organizer' | 'Tag';

type RawItem = EventDetailDto | EventEditionDto | RaceDto | LocationDto | OrganizerDto | TagDto;

interface EntityItem {
  id: string;
  kind: EntityKind;
  displayName: string;
  parentName?: string;
  fields: FieldDef[];
  raw: RawItem;
}

// ─── field definitions ────────────────────────────────────────────────────────

const EVENT_FIELDS: FieldDef[] = [
  { label: 'Name',        getIs: r => (r.raw as EventDetailDto).name,         getEn: r => (r.raw as EventDetailDto).nameEn },
  { label: 'Description', getIs: r => (r.raw as EventDetailDto).description,  getEn: r => (r.raw as EventDetailDto).descriptionEn },
  { label: 'Organizer',   getIs: r => (r.raw as EventDetailDto).organizerName,getEn: r => (r.raw as EventDetailDto).organizerNameEn },
  { label: 'Alert',       getIs: r => (r.raw as EventDetailDto).alertMessage, getEn: r => (r.raw as EventDetailDto).alertMessageEn },
];

const EDITION_FIELDS: FieldDef[] = [
  { label: 'Title', getIs: r => (r.raw as EventEditionDto).title, getEn: r => (r.raw as EventEditionDto).titleEn },
  { label: 'Notes', getIs: r => (r.raw as EventEditionDto).notes, getEn: r => (r.raw as EventEditionDto).notesEn },
];

const RACE_FIELDS: FieldDef[] = [
  { label: 'Name',         getIs: r => (r.raw as RaceDto).name,                getEn: r => (r.raw as RaceDto).nameEn },
  { label: 'Description',  getIs: r => (r.raw as RaceDto).description,         getEn: r => (r.raw as RaceDto).descriptionEn },
  { label: 'CertifiedBy',  getIs: r => (r.raw as RaceDto).certifiedBy,         getEn: r => (r.raw as RaceDto).certifiedByEn },
  { label: 'Championship', getIs: r => (r.raw as RaceDto).championshipCategory,getEn: r => (r.raw as RaceDto).championshipCategoryEn },
];

const LOCATION_FIELDS: FieldDef[] = [
  { label: 'Name',        getIs: r => (r.raw as LocationDto).name,        getEn: r => (r.raw as LocationDto).nameEn },
  { label: 'Description', getIs: r => (r.raw as LocationDto).description, getEn: r => (r.raw as LocationDto).descriptionEn },
];

const ORGANIZER_FIELDS: FieldDef[] = [
  { label: 'Description', getIs: r => (r.raw as OrganizerDto).description, getEn: r => (r.raw as OrganizerDto).descriptionEn },
];

const TAG_FIELDS: FieldDef[] = [
  { label: 'Name', getIs: r => (r.raw as TagDto).name, getEn: r => (r.raw as TagDto).nameEn },
];

const FIELDS_BY_KIND: Record<EntityKind, FieldDef[]> = {
  Event: EVENT_FIELDS, Edition: EDITION_FIELDS, Race: RACE_FIELDS,
  Location: LOCATION_FIELDS, Organizer: ORGANIZER_FIELDS, Tag: TAG_FIELDS,
};

// EN field key map for building PATCH payloads
const EN_FIELD_MAP: Record<EntityKind, Record<string, string>> = {
  Event:     { Name: 'nameEn', Description: 'descriptionEn', Organizer: 'organizerNameEn', Alert: 'alertMessageEn' },
  Edition:   { Title: 'titleEn', Notes: 'notesEn' },
  Race:      { Name: 'nameEn', Description: 'descriptionEn', CertifiedBy: 'certifiedByEn', Championship: 'championshipCategoryEn' },
  Location:  { Name: 'nameEn', Description: 'descriptionEn' },
  Organizer: { Description: 'descriptionEn' },
  Tag:       { Name: 'nameEn' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function isMissing(f: FieldDef, item: EntityItem): boolean {
  return !!(f.getIs(item)?.trim()) && !f.getEn(item)?.trim();
}

function coveragePct(items: EntityItem[]): number {
  let filled = 0, total = 0;
  for (const item of items) {
    for (const f of item.fields) {
      if (!f.getIs(item)?.trim()) continue;
      total++;
      if (f.getEn(item)?.trim()) filled++;
    }
  }
  return total === 0 ? 100 : Math.round((filled / total) * 100);
}

// ─── save helpers (full PUT — no PATCH endpoints) ─────────────────────────────

async function savePatch(item: EntityItem, patch: Record<string, string>) {
  if (item.kind === 'Event') {
    const e = item.raw as EventDetailDto;
    await apiFetch(`/api/v1/admin/events/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: e.name, nameEn: e.nameEn, slug: e.slug,
        description: e.description, descriptionEn: e.descriptionEn,
        type: e.type, activityType: e.activityType, status: e.status,
        organizerName: e.organizerName, organizerNameEn: e.organizerNameEn,
        organizerWebsite: e.organizerWebsite, organizerId: e.organizerId,
        alertMessage: e.alertMessage, alertMessageEn: e.alertMessageEn,
        alertSeverity: e.alertSeverity, locationId: e.locationId,
        scheduleRule: e.scheduleRule, socialLinks: e.socialLinks,
        ...patch,
      }),
    });
  } else if (item.kind === 'Edition') {
    const ed = item.raw as EventEditionDto;
    await apiFetch(`/api/v1/admin/editions/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: ed.id, year: ed.year, date: ed.date,
        title: ed.title, titleEn: ed.titleEn,
        registrationUrl: ed.registrationUrl, resultsUrl: ed.resultsUrl,
        notes: ed.notes, notesEn: ed.notesEn,
        registrationStatus: ed.registrationStatus, trailId: ed.trailId,
        ...patch,
      }),
    });
  } else if (item.kind === 'Race') {
    const rc = item.raw as RaceDto;
    await apiFetch(`/api/v1/admin/races/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: rc.id, trailId: rc.trailId,
        name: rc.name, nameEn: rc.nameEn,
        distanceLabel: rc.distanceLabel, cutoffMinutes: rc.cutoffMinutes,
        description: rc.description, descriptionEn: rc.descriptionEn,
        status: rc.status, sortOrder: rc.sortOrder,
        ticketStatus: rc.ticketStatus, maxParticipants: rc.maxParticipants,
        itraPoints: rc.itraPoints, certifiedBy: rc.certifiedBy, certifiedByEn: rc.certifiedByEn,
        prizeMoney: rc.prizeMoney,
        championshipCategory: rc.championshipCategory, championshipCategoryEn: rc.championshipCategoryEn,
        dateOfRace: rc.dateOfRace, startTime: rc.startTime,
        ...patch,
      }),
    });
  } else if (item.kind === 'Location') {
    const l = item.raw as LocationDto;
    await apiFetch(`/api/v1/admin/locations/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: l.name, nameEn: l.nameEn, slug: l.slug,
        description: l.description, descriptionEn: l.descriptionEn,
        type: l.type, parentId: l.parentId,
        latitude: l.latitude, longitude: l.longitude, radius: l.radius,
        ...patch,
      }),
    });
  } else if (item.kind === 'Organizer') {
    const o = item.raw as OrganizerDto;
    await apiFetch(`/api/v1/admin/organizers/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: o.name, kennitala: o.kennitala, phone: o.phone,
        email: o.email, website: o.website,
        description: o.description, descriptionEn: o.descriptionEn,
        contactName: o.contactName,
        ...patch,
      }),
    });
  } else {
    const t = item.raw as TagDto;
    await apiFetch(`/api/v1/admin/tags/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: t.name, nameEn: t.nameEn, color: t.color, ...patch }),
    });
  }
}

// ─── build item list from API data ────────────────────────────────────────────

function buildItems(
  events: EventDetailDto[],
  locations: LocationDto[],
  organizers: OrganizerDto[],
  tags: TagDto[],
): EntityItem[] {
  const items: EntityItem[] = [];

  for (const e of events) {
    items.push({ id: e.id, kind: 'Event', displayName: e.name, fields: EVENT_FIELDS, raw: e });
    for (const ed of e.editions ?? []) {
      const edLabel = ed.title ?? (ed.year ? String(ed.year) : ed.date ?? ed.id);
      items.push({
        id: ed.id, kind: 'Edition',
        displayName: edLabel,
        parentName: e.name,
        fields: EDITION_FIELDS,
        raw: ed,
      });
      for (const rc of ed.races ?? []) {
        items.push({
          id: rc.id, kind: 'Race',
          displayName: rc.name,
          parentName: `${e.name} › ${edLabel}`,
          fields: RACE_FIELDS,
          raw: rc,
        });
      }
    }
  }

  for (const l of locations) {
    items.push({ id: l.id, kind: 'Location', displayName: l.name, fields: LOCATION_FIELDS, raw: l });
  }
  for (const o of organizers) {
    items.push({ id: o.id, kind: 'Organizer', displayName: o.name, fields: ORGANIZER_FIELDS, raw: o });
  }
  for (const t of tags) {
    items.push({ id: t.id, kind: 'Tag', displayName: t.name, fields: TAG_FIELDS, raw: t });
  }

  return items;
}

// ─── subcomponents ────────────────────────────────────────────────────────────

function CoverageCard({ label, pct, count }: { label: string; pct: number; count: number }) {
  const color = pct >= 90 ? 'success' : pct >= 50 ? 'warning' : 'error';
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 130 }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h4" fontWeight={700} color={`${color}.main`}>{pct}%</Typography>
        <LinearProgress variant="determinate" value={pct} color={color} sx={{ mt: 0.5, borderRadius: 1 }} />
        <Typography variant="caption" color="text.secondary">{count} items</Typography>
      </CardContent>
    </Card>
  );
}

function StatusDot({ filled, source }: { filled: boolean; source: boolean }) {
  if (!source) return <Typography variant="caption" color="text.disabled">—</Typography>;
  return filled
    ? <CheckCircleIcon fontSize="small" color="success" />
    : <RadioButtonUncheckedIcon fontSize="small" color="error" />;
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  onNotify: (message: string, severity?: 'success' | 'error') => void;
}

export default function TranslationHealth({ onNotify }: Props) {
  const [items, setItems] = useState<EntityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [bulkTranslating, setBulkTranslating] = useState(false);
  const [filterKind, setFilterKind] = useState<EntityKind | 'All'>('All');
  const [filterMissing, setFilterMissing] = useState(false);
  const { translate } = useTranslate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [events, locations, organizers, tags] = await Promise.all([
        apiFetch<EventDetailDto[]>('/api/v1/admin/events/details'),
        apiFetch<LocationDto[]>('/api/v1/admin/locations'),
        apiFetch<OrganizerDto[]>('/api/v1/admin/organizers'),
        apiFetch<TagDto[]>('/api/v1/admin/tags'),
      ]);
      setItems(buildItems(events, locations, organizers, tags));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byKind = useMemo(() => {
    const map: Record<EntityKind, EntityItem[]> = {
      Event: [], Edition: [], Race: [], Location: [], Organizer: [], Tag: [],
    };
    for (const item of items) map[item.kind].push(item);
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const base = filterKind === 'All' ? items : byKind[filterKind];
    return filterMissing ? base.filter(item => item.fields.some(f => isMissing(f, item))) : base;
  }, [items, byKind, filterKind, filterMissing]);

  const missingCount = useMemo(
    () => items.filter(item => item.fields.some(f => isMissing(f, item))).length,
    [items]
  );

  const translateItem = useCallback(async (item: EntityItem) => {
    const missingFields = item.fields.filter(f => isMissing(f, item));
    if (missingFields.length === 0) return;
    setTranslatingId(item.id);
    try {
      const translated = await translate(missingFields.map(f => f.getIs(item) ?? ''));
      const patch: Record<string, string> = {};
      missingFields.forEach((f, i) => {
        const key = EN_FIELD_MAP[item.kind][f.label];
        if (key && translated[i]) patch[key] = translated[i];
      });
      if (Object.keys(patch).length > 0) await savePatch(item, patch);
      await load();
      onNotify(`Translated "${item.displayName}"`, 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Translation failed', 'error');
    } finally {
      setTranslatingId(null);
    }
  }, [translate, load, onNotify]);

  const translateAll = useCallback(async () => {
    const missing = items.filter(item => item.fields.some(f => isMissing(f, item)));
    if (missing.length === 0) return;
    setBulkTranslating(true);
    let done = 0, failed = 0;
    for (const item of missing) {
      try {
        const missingFields = item.fields.filter(f => isMissing(f, item));
        const translated = await translate(missingFields.map(f => f.getIs(item) ?? ''));
        const patch: Record<string, string> = {};
        missingFields.forEach((f, i) => {
          const key = EN_FIELD_MAP[item.kind][f.label];
          if (key && translated[i]) patch[key] = translated[i];
        });
        if (Object.keys(patch).length > 0) await savePatch(item, patch);
        done++;
      } catch {
        failed++;
      }
    }
    await load();
    setBulkTranslating(false);
    onNotify(
      failed > 0 ? `Translated ${done}, failed ${failed}` : `Translated ${done} items`,
      failed > 0 ? 'error' : 'success'
    );
  }, [items, translate, load, onNotify]);

  const kinds: EntityKind[] = ['Event', 'Edition', 'Race', 'Location', 'Organizer', 'Tag'];

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
        <TranslateIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>Translation Health</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh">
          <IconButton onClick={load} size="small"><RefreshIcon /></IconButton>
        </Tooltip>
        <Button
          variant="contained"
          startIcon={bulkTranslating ? <CircularProgress size={16} color="inherit" /> : <TranslateIcon />}
          disabled={bulkTranslating || missingCount === 0}
          onClick={translateAll}
        >
          {bulkTranslating ? 'Translating…' : `Translate all missing (${missingCount})`}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        EN translation coverage across all content — events, editions, races, locations, organizers, and tags.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Coverage cards */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <CoverageCard label="Overall" pct={coveragePct(items)} count={items.length} />
        {kinds.map(k => (
          <CoverageCard key={k} label={k + 's'} pct={coveragePct(byKind[k])} count={byKind[k].length} />
        ))}
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        {(['All', ...kinds] as const).map(k => (
          <Chip
            key={k}
            label={k === 'All' ? `All (${items.length})` : `${k}s (${byKind[k]?.length ?? 0})`}
            onClick={() => setFilterKind(k)}
            color={filterKind === k ? 'primary' : 'default'}
            variant={filterKind === k ? 'filled' : 'outlined'}
            size="small"
          />
        ))}
        <Chip
          label={`Missing only (${missingCount})`}
          onClick={() => setFilterMissing(v => !v)}
          color={filterMissing ? 'warning' : 'default'}
          variant={filterMissing ? 'filled' : 'outlined'}
          size="small"
        />
      </Stack>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700 } }}>
              <TableCell width={90}>Type</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Fields</TableCell>
              <TableCell align="right" width={120}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {filterMissing ? 'All translations are complete! 🎉' : 'No items.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {filtered.map(item => {
              const hasMissing = item.fields.some(f => isMissing(f, item));
              const isTranslating = translatingId === item.id;
              return (
                <TableRow
                  key={`${item.kind}-${item.id}`}
                  hover
                  sx={hasMissing ? { bgcolor: 'warning.50' } : undefined}
                >
                  <TableCell>
                    <Chip label={item.kind} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={hasMissing ? 600 : 400}>
                      {item.displayName}
                    </Typography>
                    {item.parentName && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {item.parentName}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                      {item.fields.map(f => {
                        const hasSource = !!(f.getIs(item)?.trim());
                        const filled = !!(f.getEn(item)?.trim());
                        return (
                          <Tooltip
                            key={f.label}
                            title={
                              !hasSource ? `${f.label}: no IS content` :
                              filled ? `${f.label}: translated ✓` :
                              `${f.label}: missing EN`
                            }
                          >
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography variant="caption" color="text.secondary">{f.label}</Typography>
                              <StatusDot filled={filled} source={hasSource} />
                            </Stack>
                          </Tooltip>
                        );
                      })}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={isTranslating ? <CircularProgress size={14} /> : <TranslateIcon />}
                      disabled={!hasMissing || isTranslating || bulkTranslating}
                      onClick={() => translateItem(item)}
                    >
                      Translate
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
