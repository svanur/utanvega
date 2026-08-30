import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Box, Typography, Alert, CircularProgress, MenuItem, Paper, Chip, Tabs, Tab, Autocomplete, Checkbox, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MapIcon from '@mui/icons-material/Map';
import TagIcon from '@mui/icons-material/LocalOffer';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import RaceIcon from '@mui/icons-material/EmojiEvents';
import TranslateIcon from '@mui/icons-material/Translate';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '../hooks/api';
import type { TrailDetail } from '../hooks/useTrails';
import { useLocations } from '../hooks/useLocations';
import { useTags } from '../hooks/useTags';
import { useTranslate } from '../hooks/useTranslate';
import BilingualTextField from './BilingualTextField';
import type { EventDetailDto, EventEditionDto, EventSummaryDto, RaceDto } from '../hooks/useEvents';
import ChangeLogList from './ChangeLogList';
import { generateSlug } from '../utils/slugify';
import { hashText } from '../utils/translationHash';
import {
    TRAIL_ACTIVITY_TYPES as activityTypes,
    TRAIL_DIFFICULTIES as difficulties,
    TRAIL_TYPES as trailTypes,
    TRAIL_VISIBILITIES as visibilities,
    TRAIL_TERRAIN_TYPES as terrainTypes,
} from '../utils/trailOptions';

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


export default function TrailEditDialog({ open, trailId, onClose, onSaveSuccess }: { open: boolean, trailId: string | null, onClose: () => void, onSaveSuccess: (trail?: { id: string, slug: string, name: string }) => void }) {
    const [trail, setTrail] = useState<TrailDetail | null>(null);
    const initialEnRef = useRef<{ nameEn: string | null; descriptionEn: string | null }>({ nameEn: null, descriptionEn: null });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [slugUnlocked, setSlugUnlocked] = useState(false);
    const { locations: allLocations } = useLocations();
    const { tags: allTags } = useTags();

    const { translate, translating } = useTranslate();
    const [classifyingTerrain, setClassifyingTerrain] = useState(false);
    const [newLocId, setNewLocId] = useState('');
    const [newLocRole, setNewLocRole] = useState<'Start' | 'End' | 'BelongsTo' | 'PassingThrough'>('BelongsTo');
    const [activeTab, setActiveTab] = useState(0);
    const [allRaces, setAllRaces] = useState<LinkedTrailRace[]>([]);
    const [racesLoading, setRacesLoading] = useState(false);
    const [allEvents, setAllEvents] = useState<EventSummaryDto[]>([]);
    const [allEditions, setAllEditions] = useState<LinkableEdition[]>([]);
    const [selectedEventToLink, setSelectedEventToLink] = useState<EventSummaryDto | null>(null);
    const [selectedEditionToLink, setSelectedEditionToLink] = useState<LinkableEdition | null>(null);

    useEffect(() => {
        if (open && trailId) {
            setSlugUnlocked(false);
            const fetchData = async () => {
                try {
                    setLoading(true);
                    setRacesLoading(true);
                    setError(null);

                    const [data, eventDetails] = await Promise.all([
                        apiFetch<TrailDetail>(`/api/v1/admin/trails/${trailId}`),
                        apiFetch<EventDetailDto[]>('/api/v1/admin/events/details'),
                    ]);

                    setTrail(data);
                    initialEnRef.current = { nameEn: data.nameEn ?? null, descriptionEn: data.descriptionEn ?? null };
                    setAllEvents(eventDetails.map(d => ({
                        id: d.id,
                        name: d.name,
                        slug: d.slug,
                        description: d.description,
                        type: d.type,
                        activityType: d.activityType,
                        status: d.status,
                        organizerName: d.organizerName,
                        organizerWebsite: d.organizerWebsite,
                        alertMessage: d.alertMessage,
                        alertSeverity: d.alertSeverity,
                        locationId: d.locationId,
                        locationName: d.locationName,
                        scheduleRule: d.scheduleRule,
                        socialLinks: d.socialLinks,
                        nextEditionDate: d.nextEditionDate,
                        daysUntil: d.daysUntil,
                        editionCount: d.editions.length,
                        createdAt: d.createdAt,
                        updatedAt: d.updatedAt,
                    } as EventSummaryDto)));
                    setAllEditions(eventDetails.flatMap(detail => detail.editions.map(edition => ({
                        id: edition.id,
                        eventId: detail.id,
                        eventName: detail.name,
                        label: buildEditionLabel(edition),
                        date: edition.date,
                    }))));
                    setAllRaces(eventDetails.flatMap(detail => detail.editions.flatMap(edition => edition.races.map(race => ({
                        ...race,
                        eventId: detail.id,
                        eventName: detail.name,
                        eventSlug: detail.slug,
                        editionId: edition.id,
                        editionLabel: buildEditionLabel(edition),
                    })))));
                } catch (_err) {
                    setError('Failed to load trail details.');
                } finally {
                    setLoading(false);
                    setRacesLoading(false);
                }
            };
            fetchData();
        }
    }, [open, trailId]);

    const handleSave = async () => {
        if (!trail) return;
        try {
            setSaving(true);
            await apiFetch(`/api/v1/admin/trails/${trailId}`, {
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
                    locations: trail.locations.map(l => ({
                        locationId: l.locationId,
                        role: l.role,
                        order: l.order
                    })),
                    tagIds: trail.tags.map(t => t.tagId)
                }),
            });
            onSaveSuccess({ id: trail.id, slug: trail.slug, name: trail.name });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save trail.');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof TrailDetail, value: string) => {
        if (!trail) return;
        setTrail({ ...trail, [field]: value });
        if (field === 'name') {
            setTrail(prev => prev ? { ...prev, name: value, slug: generateSlug(value) } : null);
        }
    };

    const handleAddLocation = () => {
        if (!trail || !newLocId) return;
        if (trail.locations.some(l => l.locationId === newLocId)) {
            setError('This location is already linked to this trail.');
            return;
        }
        const updatedLocations = [...trail.locations, { locationId: newLocId, role: newLocRole, order: trail.locations.length }];
        setTrail({ ...trail, locations: updatedLocations });
        setNewLocId('');
    };

    const handleRemoveLocation = (locId: string) => {
        if (!trail) return;
        const updatedLocations = trail.locations.filter(l => l.locationId !== locId);
        setTrail({ ...trail, locations: updatedLocations });
    };

    const handleLinkEventRace = async () => {
        if (!trail || !selectedEventToLink || !selectedEditionToLink) return;

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
                    eventEditionId: selectedEditionToLink.id,
                    trailId: trail.id,
                    name: raceName,
                    distanceLabel: `${distanceKm} km`,
                    cutoffMinutes: null,
                    description: undefined,
                    status: 'Active',
                    sortOrder: existingSortOrder,
                    ticketStatus: 'Available',
                    resultType: 'Time',
                    maxParticipants: null,
                    itraPoints: 0,
                    certifiedBy: undefined,
                    prizeMoney: 0,
                    championshipCategory: undefined,
                    dateOfRace: selectedEditionToLink.date,
                    startTime: null,
                }),
            });

            const newRace: LinkedTrailRace = {
                id: result.id,
                eventEditionId: selectedEditionToLink.id,
                trailId: trail.id,
                trailName: trail.name,
                trailSlug: trail.slug,
                name: raceName,
                nameEn: null,
                distanceLabel: `${distanceKm} km`,
                distanceLabelEn: null,
                cutoffMinutes: null,
                description: null,
                descriptionEn: null,
                status: 'Active',
                sortOrder: existingSortOrder,
                ticketStatus: 'Available',
                resultType: 'Time',
                maxParticipants: null,
                itraPoints: 0,
                certifiedBy: null,
                certifiedByEn: null,
                prizeMoney: 0,
                championshipCategory: null,
                championshipCategoryEn: null,
                dateOfRace: selectedEditionToLink.date,
                startTime: null,
                trailDistanceMeters: trail.length,
                trailElevationGain: trail.elevationGain,
                activityType: null,
                eventId: selectedEventToLink.id,
                eventName: selectedEventToLink.name,
                eventSlug: selectedEventToLink.slug,
                editionId: selectedEditionToLink.id,
                editionLabel: selectedEditionToLink.label,
            };

            setAllRaces(prev => [...prev, newRace]);
            setSelectedEventToLink(null);
            setSelectedEditionToLink(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to link event race.');
        }
    };

    const handleUnlinkRace = async (race: LinkedTrailRace) => {
        try {
            await apiFetch(`/api/v1/admin/races/${race.id}`, { method: 'DELETE' });
            setAllRaces(prev => prev.filter(r => r.id !== race.id));
        } catch (_err) {
            setError('Failed to unlink race.');
        }
    };

    // maxAltitude of exactly 0 is indistinguishable from a degenerate elevation profile
    // (missing elevation used to be stored as all-zero rather than absent — see #465),
    // so treat it the same as "no usable altitude data".
    const altitudeUnusable = trail?.maxAltitude == null || trail?.maxAltitude === 0;
    // Mirrors the classify-terrain endpoint's own guard (and detect-terrain-types' skip
    // condition) so Auto suggest never sends a request the server would reject anyway.
    const trailTooShortToClassify = (trail?.length ?? 0) <= 1000;

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="h6">Edit Trail</Typography>
                        {trail && (
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                <Chip size="small" label={`${(trail.length / 1000).toFixed(1)} km`} variant="outlined" />
                                <Chip size="small" label={`↑ ${Math.round(trail.elevationGain)}m`} color="success" variant="outlined" />
                                <Chip size="small" label={`↓ ${Math.round(trail.elevationLoss)}m`} color="error" variant="outlined" />
                            </Box>
                        )}
                    </Box>
                    <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                        <Tab label="General" />
                        <Tab icon={<MapIcon />} label="Map" />
                        <Tab icon={<HistoryIcon />} label="History" />
                    </Tabs>
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                {activeTab === 0 ? (
                    loading ? <CircularProgress /> : trail ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                            {error && <Alert severity="error">{error}</Alert>}
                            <BilingualTextField
                                label="Name"
                                fullWidth
                                valueIs={trail.name}
                                valueEn={trail.nameEn ?? ''}
                                onChangeIs={(v) => handleChange('name', v)}
                                onChangeEn={(v) => setTrail(prev => prev ? { ...prev, nameEn: v } : null)}
                            />
                            <TextField
                                label="Slug" fullWidth value={trail.slug}
                                onChange={(e) => handleChange('slug', e.target.value)}
                                disabled={!slugUnlocked}
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
                                label="Description"
                                multiline
                                rows={4}
                                fullWidth
                                valueIs={trail.description}
                                valueEn={trail.descriptionEn ?? ''}
                                onChangeIs={(v) => handleChange('description', v)}
                                onChangeEn={(v) => setTrail(prev => prev ? { ...prev, descriptionEn: v } : null)}
                            />
                            <TextField
                                label="YouTube URL"
                                fullWidth
                                type="url"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={trail.youtubeUrl || ''}
                                onChange={(e) => handleChange('youtubeUrl', e.target.value)}
                                helperText="360° trail video from youtube.com/@360RunsIceland"
                            />
                            
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                <TextField select label="Activity" value={trail.activityType} onChange={(e) => handleChange('activityType', e.target.value)}>
                                    {activityTypes.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                                <TextField select label="Status" value={trail.status} onChange={(e) => handleChange('status', e.target.value)}>
                                    {trailStatuses.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                            </Box>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                                <TextField select label="Difficulty" value={trail.difficulty} onChange={(e) => handleChange('difficulty', e.target.value)}>
                                    {difficulties.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                                <TextField select label="Visibility" value={trail.visibility} onChange={(e) => handleChange('visibility', e.target.value)}>
                                    {visibilities.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                                <TextField select label="Trail Type" value={trail.type} onChange={(e) => handleChange('type', e.target.value)}>
                                    {trailTypes.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                <TextField select label="Terrain Type" value={trail.terrainType || ''} onChange={(e) => handleChange('terrainType', e.target.value)} sx={{ minWidth: 180 }}>
                                    {terrainTypes.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                </TextField>
                                {trail.length > 0 && trail.elevationGain > 0 && (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        sx={{ mt: 1 }}
                                        startIcon={classifyingTerrain ? <CircularProgress size={16} /> : undefined}
                                        disabled={altitudeUnusable || trailTooShortToClassify || classifyingTerrain}
                                        title={
                                            altitudeUnusable ? 'Requires GPX data with altitude information'
                                                : trailTooShortToClassify ? 'Trail is too short to classify (must be over 1000m)'
                                                    : undefined
                                        }
                                        onClick={async () => {
                                            setClassifyingTerrain(true);
                                            try {
                                                // Mountain Index — computed server-side by MountainIndexClassifier so the
                                                // suggestion here always matches what detect-terrain-types would persist.
                                                const result = await apiFetch<{ terrainType: string }>('/api/v1/admin/trails/classify-terrain', {
                                                    method: 'POST',
                                                    body: JSON.stringify({
                                                        length: trail.length,
                                                        elevationGain: trail.elevationGain,
                                                        maxAltitude: trail.maxAltitude,
                                                    }),
                                                });
                                                handleChange('terrainType', result.terrainType);
                                            } catch (err) {
                                                setError(err instanceof Error ? err.message : 'Failed to classify terrain.');
                                            } finally {
                                                setClassifyingTerrain(false);
                                            }
                                        }}
                                    >
                                        Auto suggest
                                    </Button>
                                )}
                            </Box>

                            <Typography variant="subtitle1" sx={{ mt: 2 }}>Linked Locations</Typography>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                    {trail.locations.map(tl => {
                                        const locName = allLocations.find(l => l.id === tl.locationId)?.name || 'Unknown';
                                        return (
                                            <Chip 
                                                key={tl.locationId}
                                                label={`${locName} (${tl.role})`}
                                                onDelete={() => handleRemoveLocation(tl.locationId)}
                                                color="primary"
                                                variant="outlined"
                                            />
                                        );
                                    })}
                                    {trail.locations.length === 0 && <Typography variant="body2" color="text.secondary">No locations linked.</Typography>}
                                </Box>
                                
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                    <Autocomplete
                                        size="small"
                                        sx={{ flexGrow: 1 }}
                                        options={allLocations.filter(l => !trail.locations.some(tl => tl.locationId === l.id))}
                                        getOptionLabel={(opt) => `${opt.name} (${opt.type})`}
                                        value={allLocations.find(l => l.id === newLocId) ?? null}
                                        onChange={(_e, val) => setNewLocId(val?.id ?? '')}
                                        renderInput={(params) => <TextField {...params} label="Add Location" placeholder="Search locations..." />}
                                        isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                    />
                                    <TextField 
                                        select 
                                        label="Role" 
                                        size="small"
                                        value={newLocRole} 
                                        onChange={(e) => setNewLocRole(e.target.value as typeof newLocRole)}
                                        sx={{ width: 150 }}
                                    >
                                        {roles.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                                    </TextField>
                                    <Button 
                                        variant="outlined" 
                                        startIcon={<AddIcon />}
                                        onClick={handleAddLocation}
                                        sx={{ mt: 0.5 }}
                                    >
                                        Add
                                    </Button>
                                </Box>
                            </Paper>

                            <Typography variant="subtitle1" sx={{ mt: 2 }}>
                                <TagIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                                Tags
                            </Typography>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Autocomplete
                                    multiple
                                    size="small"
                                    disableCloseOnSelect
                                    options={allTags}
                                    getOptionLabel={(opt) => opt.name}
                                    value={allTags.filter(t => trail.tags.some(tt => tt.tagId === t.id))}
                                    onChange={(_e, selected) => {
                                        setTrail({
                                            ...trail,
                                            tags: selected.map(t => ({ tagId: t.id, name: t.name, slug: t.slug, color: t.color })),
                                        });
                                    }}
                                    isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                    renderOption={(props, option, { selected }) => (
                                        <li {...props} key={option.id}>
                                            <Checkbox
                                                icon={<CheckBoxOutlineBlank fontSize="small" />}
                                                checkedIcon={<CheckBoxIcon fontSize="small" />}
                                                checked={selected}
                                                sx={{ mr: 1 }}
                                            />
                                            {option.color && <Box component="span" sx={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: option.color, mr: 1 }} />}
                                            {option.name}
                                        </li>
                                    )}
                                    renderTags={(value, getTagProps) =>
                                        value.map((tag, index) => {
                                            const { key, ...rest } = getTagProps({ index });
                                            return (
                                                <Chip
                                                    key={key}
                                                    label={tag.name}
                                                    {...rest}
                                                    sx={{
                                                        backgroundColor: tag.color || undefined,
                                                        color: tag.color ? '#fff' : undefined,
                                                        '& .MuiChip-deleteIcon': { color: tag.color ? 'rgba(255,255,255,0.7)' : undefined },
                                                    }}
                                                    variant={tag.color ? 'filled' : 'outlined'}
                                                />
                                            );
                                        })
                                    }
                                    renderInput={(params) => <TextField {...params} label="Tags" placeholder="Search tags..." />}
                                />
                            </Paper>

                            <Typography variant="subtitle1" sx={{ mt: 2 }}>
                                <RaceIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
                                Add trail to event race
                            </Typography>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                {racesLoading ? <CircularProgress size={20} /> : (
                                    <>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                            {allRaces.filter(r => r.trailId === trail.id).map(race => (
                                                <Chip
                                                    key={race.id}
                                                    label={`${race.eventName} / ${race.editionLabel} — ${race.name}${race.distanceLabel ? ` (${race.distanceLabel})` : ''}`}
                                                    onDelete={() => handleUnlinkRace(race)}
                                                    color="secondary"
                                                    variant="outlined"
                                                />
                                            ))}
                                            {allRaces.filter(r => r.trailId === trail.id).length === 0 && (
                                                <Typography variant="body2" color="text.secondary">No event races linked.</Typography>
                                            )}
                                        </Box>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 2, alignItems: 'flex-start' }}>
                                            <Autocomplete
                                                size="small"
                                                options={allEvents}
                                                getOptionLabel={(opt) => opt.name}
                                                value={selectedEventToLink}
                                                onChange={(_e, val) => {
                                                    setSelectedEventToLink(val);
                                                    setSelectedEditionToLink(null);
                                                }}
                                                renderInput={(params) => <TextField {...params} label="Event" placeholder="Search events..." />}
                                                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                            />
                                            <Autocomplete
                                                size="small"
                                                options={allEditions.filter(edition => edition.eventId === selectedEventToLink?.id)}
                                                getOptionLabel={(opt) => `${opt.label}${opt.date ? ` (${opt.date})` : ''}`}
                                                value={selectedEditionToLink}
                                                onChange={(_e, val) => setSelectedEditionToLink(val)}
                                                renderInput={(params) => <TextField {...params} label="Edition" placeholder="Choose edition..." />}
                                                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                                disabled={!selectedEventToLink}
                                            />
                                            <Button
                                                variant="outlined"
                                                startIcon={<AddIcon />}
                                                onClick={handleLinkEventRace}
                                                disabled={!selectedEditionToLink}
                                                sx={{ mt: 0.5 }}
                                            >
                                                Link
                                            </Button>
                                        </Box>
                                    </>
                                )}
                            </Paper>
                        </Box>
                    ) : <Typography>Trail not found.</Typography>
                ) : activeTab === 1 ? (
                    <TrailMapTab trailId={trailId} onGpxReplaced={(stats) => {
                        if (trail) setTrail({ ...trail, length: stats.length, elevationGain: stats.elevationGain, elevationLoss: stats.elevationLoss, type: stats.detectedType, difficulty: stats.difficulty });
                    }} />
                ) : (
                    <ChangeLogList entityName="Trail" entityId={trailId || undefined} title="Trail History" />
                )}
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'space-between', borderTop: 1, borderColor: 'divider' }}>
                {activeTab === 0 ? (
                    <Button
                        startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
                        disabled={translating || (!trail?.name.trim() && !trail?.description.trim())}
                        onClick={async () => {
                            if (!trail) return;
                            const [nameEn, descEn] = await translate([trail.name, trail.description]);
                            if (nameEn) setTrail(prev => prev ? { ...prev, nameEn } : null);
                            if (descEn) setTrail(prev => prev ? { ...prev, descriptionEn: descEn } : null);
                        }}
                    >
                        Translate to EN
                    </Button>
                ) : <Box />}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    {activeTab === 0 && (
                        <Button onClick={handleSave} variant="contained" disabled={saving || !trail}>{saving ? 'Saving...' : 'Save Changes'}</Button>
                    )}
                </Box>
            </DialogActions>
        </Dialog>
    );
}

function FitBounds({ positions }: { positions: L.LatLngExpression[] }) {
    const map = useMap();
    useEffect(() => {
        if (positions.length > 0) {
            map.fitBounds(L.latLngBounds(positions), { padding: [30, 30] });
        }
    }, [map, positions]);
    return null;
}

function TrailMapTab({ trailId, onGpxReplaced }: { trailId: string | null; onGpxReplaced?: (stats: { length: number; elevationGain: number; elevationLoss: number; detectedType: string; difficulty: string }) => void }) {
    const [positions, setPositions] = useState<[number, number][]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchGeometry = useCallback(async () => {
        if (!trailId) return;
        try {
            setLoading(true);
            const geo = await apiFetch<{ coordinates: number[][] }>(`/api/v1/admin/trails/${trailId}/geometry`);
            if (geo?.coordinates) {
                setPositions(geo.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]));
            }
        } catch {
            setError('No GPX geometry available for this trail.');
        } finally {
            setLoading(false);
        }
    }, [trailId]);

    useEffect(() => { void fetchGeometry(); }, [fetchGeometry]);

    const handleGpxReplace = async (file: File) => {
        if (!trailId) return;
        if (!confirm('Replace GPX data? This will overwrite the current route, recalculate distance, elevation and trail type.')) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploading(true);
            setUploadResult(null);
            setError(null);
            const result = await apiFetch<{ length: number; elevationGain: number; elevationLoss: number; detectedType: string; difficulty: string }>(
                `/api/v1/admin/trails/${trailId}/gpx`,
                { method: 'PUT', body: formData }
            );
            setUploadResult(`GPX replaced! ${(result.length / 1000).toFixed(1)} km, ↑${Math.round(result.elevationGain)}m ↓${Math.round(result.elevationLoss)}m, ${result.detectedType}`);
            onGpxReplaced?.(result);
            await fetchGeometry();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to replace GPX data.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (loading) return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;

    const start = positions.length > 0 ? positions[0] : null;
    const end = positions.length > 0 ? positions[positions.length - 1] : null;

    return (
        <Box sx={{ mt: 1 }}>
            {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
            {uploadResult && <Alert severity="success" sx={{ mb: 1 }}>{uploadResult}</Alert>}

            {start && end && (
                <Box sx={{ height: 400 }}>
                    <MapContainer
                        center={start}
                        zoom={13}
                        style={{ height: '100%', width: '100%', borderRadius: 8 }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Polyline positions={positions} color="#1976d2" weight={4} />
                        <CircleMarker center={start} radius={8} pathOptions={{ color: '#2e7d32', fillColor: '#4caf50', fillOpacity: 1 }} />
                        <CircleMarker center={end} radius={8} pathOptions={{ color: '#c62828', fillColor: '#ef5350', fillOpacity: 1 }} />
                        <FitBounds positions={positions} />
                    </MapContainer>
                </Box>
            )}

            {!start && !error && <Alert severity="info" sx={{ mb: 1 }}>No geometry data available.</Alert>}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".gpx"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleGpxReplace(file);
                    }}
                />
                <Button
                    variant="outlined"
                    color="warning"
                    startIcon={uploading ? <CircularProgress size={16} /> : <UploadFileIcon />}
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {uploading ? 'Replacing...' : 'Replace GPX'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                    Upload a new .gpx file to replace the current route data
                </Typography>
            </Box>
        </Box>
    );
}
