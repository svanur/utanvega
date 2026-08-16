import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import TagIcon from '@mui/icons-material/LocalOffer';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import RaceIcon from '@mui/icons-material/EmojiEvents';
import TranslateIcon from '@mui/icons-material/Translate';
import { apiFetch } from '../../hooks/api';
import { useInvalidateTrailData, type TrailDetail } from '../../hooks/useTrails';
import { useLocations } from '../../hooks/useLocations';
import { useTags } from '../../hooks/useTags';
import { useTranslate } from '../../hooks/useTranslate';
import BilingualTextField from '../BilingualTextField';
import { BilingualLangProvider, useBilingualLang } from '../../contexts/BilingualLangContext';
import type { EventDetailDto, EventEditionDto, EventSummaryDto, RaceDto } from '../../hooks/useEvents';
import { generateSlug } from '../../utils/slugify';
import { hashText } from '../../utils/translationHash';
import {
  TRAIL_ACTIVITY_TYPES as activityTypes,
  TRAIL_DIFFICULTIES as difficulties,
  TRAIL_TYPES as trailTypes,
  TRAIL_VISIBILITIES as visibilities,
  TRAIL_TERRAIN_TYPES as terrainTypes,
} from '../../utils/trailOptions';

let eventDetailsCache: EventDetailDto[] | null = null;

type LinkableEdition = {
  id: string;
  eventId: string;
  eventName: string;
  label: string;
  date: string | null;
};

type LinkedTrailRace = RaceDto & {
  eventId: string;
  eventName: string;
  eventSlug: string;
  editionId: string;
  editionLabel: string;
};

const roles = ['Start', 'End', 'BelongsTo', 'PassingThrough'];

function buildEditionLabel(edition: Pick<EventEditionDto, 'title' | 'year' | 'date'>): string {
  if (edition.title?.trim()) return edition.title;
  if (edition.date) return edition.date;
  if (edition.year != null) return `Edition ${edition.year}`;
  return 'Untitled edition';
}

const trailStatuses = [
  { value: 'Draft', label: 'Hidden' },
  { value: 'Published', label: 'Published' },
  { value: 'Archived', label: 'Archived' },
  { value: 'EventOnly', label: 'Event Only' },
];


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

interface TrailFormCardProps {
  trail: TrailDetail;
  onClose: () => void;
  onSaved: (updated: { id: string; slug: string; name: string }) => void;
  onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
}

function TrailFormCardInner({ trail: initialTrail, onClose, onSaved, onNotify }: TrailFormCardProps) {
  const [trail, setTrail] = useState<TrailDetail>(initialTrail);
  const initialEnRef = useRef<{ nameEn: string | null; descriptionEn: string | null }>({
    nameEn: initialTrail.nameEn, descriptionEn: initialTrail.descriptionEn,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugUnlocked, setSlugUnlocked] = useState(false);
  const { locations: allLocations } = useLocations();
  const { tags: allTags } = useTags();
  const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));
  const { invalidateRaces, invalidateLists } = useInvalidateTrailData();

  const [newLocId, setNewLocId] = useState('');
  const [newLocRole, setNewLocRole] = useState<'Start' | 'End' | 'BelongsTo' | 'PassingThrough'>('BelongsTo');
  const [allRaces, setAllRaces] = useState<LinkedTrailRace[]>([]);
  const [racesLoading, setRacesLoading] = useState(true);
  const [allEvents, setAllEvents] = useState<EventSummaryDto[]>([]);
  const [allEditions, setAllEditions] = useState<LinkableEdition[]>([]);
  const [selectedEventToLink, setSelectedEventToLink] = useState<EventSummaryDto | null>(null);
  const [selectedEditionToLink, setSelectedEditionToLink] = useState<LinkableEdition | null>(null);

  useEffect(() => {
    const fetchLinkableRaces = async () => {
      try {
        setRacesLoading(true);
        const eventDetails = eventDetailsCache ?? await apiFetch<EventDetailDto[]>('/api/v1/admin/events/details');
        if (!eventDetailsCache) eventDetailsCache = eventDetails;
        setAllEvents(eventDetails.map(d => ({
          id: d.id, name: d.name, slug: d.slug, description: d.description, type: d.type,
          activityType: d.activityType, status: d.status, organizerName: d.organizerName,
          organizerWebsite: d.organizerWebsite, alertMessage: d.alertMessage, alertSeverity: d.alertSeverity,
          locationId: d.locationId, locationName: d.locationName, scheduleRule: d.scheduleRule,
          socialLinks: d.socialLinks, nextEditionDate: d.nextEditionDate, daysUntil: d.daysUntil,
          editionCount: d.editions.length, createdAt: d.createdAt, updatedAt: d.updatedAt,
        } as EventSummaryDto)));
        setAllEditions(eventDetails.flatMap(detail => detail.editions.map(edition => ({
          id: edition.id, eventId: detail.id, eventName: detail.name,
          label: buildEditionLabel(edition), date: edition.date,
        }))));
        setAllRaces(eventDetails.flatMap(detail => detail.editions.flatMap(edition => edition.races.map(race => ({
          ...race, eventId: detail.id, eventName: detail.name, eventSlug: detail.slug,
          editionId: edition.id, editionLabel: buildEditionLabel(edition),
        })))));
      } catch (_err) {
        onNotify('Failed to load linked event races.', 'error');
      } finally {
        setRacesLoading(false);
      }
    };
    fetchLinkableRaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (field: keyof TrailDetail, value: string) => {
    setTrail(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'name' && !slugUnlocked) next.slug = generateSlug(value);
      return next;
    });
  };

  const handleAddLocation = () => {
    if (!newLocId) return;
    if (trail.locations.some(l => l.locationId === newLocId)) {
      setError('This location is already linked to this trail.');
      return;
    }
    setTrail(prev => ({
      ...prev,
      locations: [...prev.locations, { locationId: newLocId, role: newLocRole, order: prev.locations.length }],
    }));
    setNewLocId('');
  };

  const handleRemoveLocation = (locId: string) => {
    setTrail(prev => ({ ...prev, locations: prev.locations.filter(l => l.locationId !== locId) }));
  };

  const handleLinkEventRace = async () => {
    if (!selectedEventToLink || !selectedEditionToLink) return;
    if (allRaces.some(r => r.editionId === selectedEditionToLink.id && r.trailId === trail.id)) {
      setError('This trail is already linked to the selected edition.');
      return;
    }
    try {
      const distanceKm = (trail.length / 1000).toFixed(1);
      const raceName = `${selectedEventToLink.name} ${distanceKm} km`;
      const existingSortOrder = allRaces.filter(r => r.editionId === selectedEditionToLink.id).length;
      const result = await apiFetch<{ id: string }>(`/api/v1/admin/editions/${selectedEditionToLink.id}/races`, {
        method: 'POST',
        body: JSON.stringify({
          eventEditionId: selectedEditionToLink.id, trailId: trail.id, name: raceName,
          distanceLabel: `${distanceKm} km`, cutoffMinutes: null, description: undefined,
          status: 'Active', sortOrder: existingSortOrder, ticketStatus: 'Available', resultType: 'Time',
          maxParticipants: null, itraPoints: 0, certifiedBy: undefined, prizeMoney: 0,
          championshipCategory: undefined, dateOfRace: selectedEditionToLink.date, startTime: null,
        }),
      });

      const newRace: LinkedTrailRace = {
        id: result.id, eventEditionId: selectedEditionToLink.id, trailId: trail.id, trailName: trail.name,
        trailSlug: trail.slug, name: raceName, nameEn: null, distanceLabel: `${distanceKm} km`,
        distanceLabelEn: null, cutoffMinutes: null, description: null, descriptionEn: null,
        status: 'Active', sortOrder: existingSortOrder, ticketStatus: 'Available', resultType: 'Time',
        maxParticipants: null, itraPoints: 0, certifiedBy: null, certifiedByEn: null, prizeMoney: 0,
        championshipCategory: null, championshipCategoryEn: null, dateOfRace: selectedEditionToLink.date,
        startTime: null, trailDistanceMeters: trail.length, trailElevationGain: trail.elevationGain,
        activityType: null, eventId: selectedEventToLink.id, eventName: selectedEventToLink.name,
        eventSlug: selectedEventToLink.slug, editionId: selectedEditionToLink.id,
        editionLabel: selectedEditionToLink.label,
      };

      setAllRaces(prev => [...prev, newRace]);
      setSelectedEventToLink(null);
      setSelectedEditionToLink(null);
      void invalidateRaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link event race.');
    }
  };

  const handleUnlinkRace = async (race: LinkedTrailRace) => {
    try {
      await apiFetch(`/api/v1/admin/races/${race.id}`, { method: 'DELETE' });
      setAllRaces(prev => prev.filter(r => r.id !== race.id));
      void invalidateRaces();
    } catch (_err) {
      setError('Failed to unlink race.');
    }
  };

  const handleTranslate = async () => {
    if (!trail.name.trim() && !trail.description.trim()) return;
    const [nameEn, descEn] = await translate([trail.name, trail.description]);
    if (nameEn) setTrail(prev => ({ ...prev, nameEn }));
    if (descEn) setTrail(prev => ({ ...prev, descriptionEn: descEn }));
  };

  const handleSave = async () => {
    // Linking a race is its own immediate POST via the Link button — it is NOT part of this
    // save payload. A selection left sitting in the dropdowns would be silently discarded when
    // the editor closes, so make that explicit rather than letting it look like it saved.
    if (selectedEventToLink) {
      const pending = selectedEditionToLink
        ? `"${selectedEventToLink.name} / ${selectedEditionToLink.label}"`
        : `"${selectedEventToLink.name}" (no edition selected yet)`;
      const proceed = confirm(
        `You picked ${pending} under "Add trail to event race" but haven't clicked Link — that link will NOT be saved.\n\n`
        + `Cancel to go back and click Link, or OK to save the rest of the trail without it.`
      );
      if (!proceed) return;
    }

    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/api/v1/admin/trails/${trail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: trail.id,
          name: trail.name,
          nameEn: trail.nameEn || null,
          slug: trail.slug,
          description: trail.description,
          descriptionEn: trail.descriptionEn || null,
          activityType: trail.activityType,
          status: trail.status,
          type: trail.type,
          difficulty: trail.difficulty,
          visibility: trail.visibility,
          youtubeUrl: trail.youtubeUrl || null,
          terrainType: trail.terrainType || null,
          updatedBy: 'admin',
          translationHashes: (() => {
            const h: Record<string, string> = { ...(trail.translationHashes ?? {}) };
            const init = initialEnRef.current;
            if (trail.name?.trim() && trail.nameEn?.trim() && trail.nameEn !== init.nameEn)
              h['Name'] = hashText(trail.name.trim());
            if (trail.description?.trim() && trail.descriptionEn?.trim() && trail.descriptionEn !== init.descriptionEn)
              h['Description'] = hashText(trail.description.trim());
            return Object.keys(h).length > 0 ? h : undefined;
          })(),
          locations: trail.locations.map(l => ({ locationId: l.locationId, role: l.role, order: l.order })),
          tagIds: trail.tags.map(t => t.tagId),
        }),
      });
      onNotify('Trail saved', 'success');
      // The trails list caches locations/tags too, so drop it as well — otherwise going back
      // to /trails shows pre-edit values until its staleTime expires.
      void invalidateLists();
      onSaved({ id: trail.id, slug: trail.slug, name: trail.name });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save trail.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ border: '2px solid', borderColor: 'primary.main', borderRadius: 2, p: 2.5, bgcolor: 'background.paper', mt: 1.5, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>Edit trail</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <LangToggleButton />
          <Typography variant="caption" color="text.secondary">{trail.slug}</Typography>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Box>
          <SectionLabel>Identity</SectionLabel>
          <BilingualTextField
            size="small" fullWidth label="Name" sx={{ mb: 1.5 }}
            valueIs={trail.name} valueEn={trail.nameEn ?? ''}
            onChangeIs={v => handleChange('name', v)}
            onChangeEn={v => setTrail(prev => ({ ...prev, nameEn: v }))}
          />
          <TextField
            size="small" fullWidth label="Slug" value={trail.slug}
            onChange={e => handleChange('slug', e.target.value)}
            disabled={!slugUnlocked}
            sx={{ mb: 1.5 }}
            helperText={slugUnlocked ? 'Changing the slug breaks existing bookmarks and shared links.' : undefined}
            InputProps={{
              endAdornment: (
                <Tooltip title={slugUnlocked ? 'Lock slug' : 'Changing the slug will break any existing bookmarks or shared links to this trail. Click to unlock.'}>
                  <IconButton size="small" onClick={() => setSlugUnlocked(v => !v)} color={slugUnlocked ? 'warning' : 'default'}>
                    {slugUnlocked ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              ),
            }}
          />
          <BilingualTextField
            size="small" fullWidth label="Description" multiline rows={6} sx={{ mb: 1.5 }}
            valueIs={trail.description} valueEn={trail.descriptionEn ?? ''}
            onChangeIs={v => handleChange('description', v)}
            onChangeEn={v => setTrail(prev => ({ ...prev, descriptionEn: v }))}
          />
        </Box>

        <Box>
          <SectionLabel>Classification</SectionLabel>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Activity</InputLabel>
              <Select value={trail.activityType} label="Activity" onChange={e => handleChange('activityType', e.target.value)}>
                {activityTypes.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={trail.status} label="Status" onChange={e => handleChange('status', e.target.value)}>
                {trailStatuses.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Difficulty</InputLabel>
              <Select value={trail.difficulty} label="Difficulty" onChange={e => handleChange('difficulty', e.target.value)}>
                {difficulties.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Visibility</InputLabel>
              <Select value={trail.visibility} label="Visibility" onChange={e => handleChange('visibility', e.target.value)}>
                {visibilities.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
            <InputLabel>Trail Type</InputLabel>
            <Select value={trail.type} label="Trail Type" onChange={e => handleChange('type', e.target.value)}>
              {trailTypes.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Terrain Type</InputLabel>
              <Select value={trail.terrainType || ''} label="Terrain Type" onChange={e => handleChange('terrainType', e.target.value)}>
                {terrainTypes.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </Select>
            </FormControl>
            {trail.length > 0 && trail.elevationGain > 0 && (
              <Button
                variant="outlined" size="small" sx={{ mt: 0.5 }}
                disabled={trail.maxAltitude == null}
                title={trail.maxAltitude == null ? 'Requires GPX data with altitude information' : undefined}
                onClick={() => {
                  const distanceKm = trail.length / 1000;
                  const climbRatio = trail.elevationGain / distanceKm;
                  const maxAlt = trail.maxAltitude ?? 0;
                  // Mountain Index (high-latitude / Iceland thresholds)
                  // Rule 1: low climb ratio (<20 m/km) → Flat
                  // Rule 2: high altitude (>600m) + climb ratio ≥ 30 m/km → Mountainous
                  // Rule 3: low altitude (<400m) → Hilly
                  // Rule 4: grey zone (400–600m) → Mountainous if climb ratio ≥ 50 m/km
                  let suggested: string;
                  if (climbRatio < 20) suggested = 'Flat';
                  else if (maxAlt > 600 && climbRatio >= 30) suggested = 'Mountainous';
                  else if (maxAlt < 400) suggested = 'Hilly';
                  else suggested = climbRatio >= 50 ? 'Mountainous' : 'Hilly';
                  handleChange('terrainType', suggested);
                }}
              >
                Auto suggest
              </Button>
            )}
          </Stack>
          <TextField
            size="small" fullWidth label="YouTube URL" type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={trail.youtubeUrl || ''}
            onChange={e => handleChange('youtubeUrl', e.target.value)}
            helperText="360° trail video from youtube.com/@360RunsIceland"
            sx={{ mt: 1.5 }}
          />
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      <SectionLabel>Linked Locations</SectionLabel>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {trail.locations.map(tl => {
            const locName = allLocations.find(l => l.id === tl.locationId)?.name || 'Unknown';
            return (
              <Chip key={tl.locationId} label={`${locName} (${tl.role})`}
                onDelete={() => handleRemoveLocation(tl.locationId)} color="primary" variant="outlined" />
            );
          })}
          {trail.locations.length === 0 && <Typography variant="body2" color="text.secondary">No locations linked.</Typography>}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Autocomplete
            size="small" sx={{ flexGrow: 1 }}
            options={allLocations.filter(l => !trail.locations.some(tl => tl.locationId === l.id))}
            getOptionLabel={opt => `${opt.name} (${opt.type})`}
            value={allLocations.find(l => l.id === newLocId) ?? null}
            onChange={(_e, val) => setNewLocId(val?.id ?? '')}
            renderInput={params => <TextField {...params} label="Add Location" placeholder="Search locations..." />}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
          />
          <TextField
            select label="Role" size="small" value={newLocRole}
            onChange={e => setNewLocRole(e.target.value as typeof newLocRole)}
            sx={{ width: 150 }}
          >
            {roles.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddLocation} sx={{ mt: 0.5 }}>
            Add
          </Button>
        </Box>
      </Paper>

      <SectionLabel><TagIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />Tags</SectionLabel>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Autocomplete
          multiple size="small" disableCloseOnSelect
          options={allTags}
          getOptionLabel={opt => opt.name}
          value={allTags.filter(t => trail.tags.some(tt => tt.tagId === t.id))}
          onChange={(_e, selected) => setTrail(prev => ({
            ...prev, tags: selected.map(t => ({ tagId: t.id, name: t.name, slug: t.slug, color: t.color })),
          }))}
          isOptionEqualToValue={(opt, val) => opt.id === val.id}
          renderOption={(props, option, { selected }) => (
            <li {...props} key={option.id}>
              <Checkbox icon={<CheckBoxOutlineBlank fontSize="small" />} checkedIcon={<CheckBoxIcon fontSize="small" />} checked={selected} sx={{ mr: 1 }} />
              {option.color && <Box component="span" sx={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: option.color, mr: 1 }} />}
              {option.name}
            </li>
          )}
          renderTags={(value, getTagProps) => value.map((tag, index) => {
            const { key, ...rest } = getTagProps({ index });
            return (
              <Chip key={key} label={tag.name} {...rest}
                sx={{ backgroundColor: tag.color || undefined, color: tag.color ? '#fff' : undefined,
                  '& .MuiChip-deleteIcon': { color: tag.color ? 'rgba(255,255,255,0.7)' : undefined } }}
                variant={tag.color ? 'filled' : 'outlined'} />
            );
          })}
          renderInput={params => <TextField {...params} label="Tags" placeholder="Search tags..." />}
        />
      </Paper>

      <SectionLabel><RaceIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />Add trail to event race</SectionLabel>
      <Paper variant="outlined" sx={{ p: 2 }}>
        {racesLoading ? <CircularProgress size={20} /> : (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {allRaces.filter(r => r.trailId === trail.id).map(race => (
                <Chip key={race.id}
                  label={`${race.eventName} / ${race.editionLabel} — ${race.name}${race.distanceLabel ? ` (${race.distanceLabel})` : ''}`}
                  onDelete={() => handleUnlinkRace(race)} color="secondary" variant="outlined" />
              ))}
              {allRaces.filter(r => r.trailId === trail.id).length === 0 && (
                <Typography variant="body2" color="text.secondary">No event races linked.</Typography>
              )}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 2, alignItems: 'flex-start' }}>
              <Autocomplete
                size="small" options={allEvents}
                getOptionLabel={opt => opt.name}
                value={selectedEventToLink}
                onChange={(_e, val) => { setSelectedEventToLink(val); setSelectedEditionToLink(null); }}
                renderInput={params => <TextField {...params} label="Event" placeholder="Search events..." />}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
              />
              <Autocomplete
                size="small"
                options={allEditions.filter(edition => edition.eventId === selectedEventToLink?.id)}
                getOptionLabel={opt => `${opt.label}${opt.date ? ` (${opt.date})` : ''}`}
                value={selectedEditionToLink}
                onChange={(_e, val) => setSelectedEditionToLink(val)}
                renderInput={params => <TextField {...params} label="Edition" placeholder="Choose edition..." />}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                disabled={!selectedEventToLink}
              />
              <Button
                variant={selectedEditionToLink ? 'contained' : 'outlined'}
                startIcon={<AddIcon />}
                onClick={handleLinkEventRace}
                disabled={!selectedEditionToLink}
                sx={{ mt: 0.5 }}
              >
                Link
              </Button>
            </Box>
            {selectedEventToLink && (
              <Alert severity="warning" sx={{ mt: 1.5, py: 0.25 }}>
                {selectedEditionToLink
                  ? 'Click Link to attach this trail to the selected edition — saving alone will not do it.'
                  : 'Choose an edition, then click Link — saving alone will not attach the trail.'}
              </Alert>
            )}
          </>
        )}
      </Paper>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2.5 }}>
        <Button
          size="small"
          startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
          disabled={translating || (!trail.name.trim() && !trail.description.trim())}
          onClick={() => void handleTranslate()}
        >
          Translate to EN
        </Button>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="small" variant="contained" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving...' : 'Save trail'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function TrailFormCard(props: TrailFormCardProps) {
  return (
    <BilingualLangProvider>
      <TrailFormCardInner {...props} />
    </BilingualLangProvider>
  );
}
