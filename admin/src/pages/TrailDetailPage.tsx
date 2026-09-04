import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Link,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HistoryIcon from '@mui/icons-material/History';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import VideocamIcon from '@mui/icons-material/Videocam';
import AddIcon from '@mui/icons-material/Add';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import ArchiveIcon from '@mui/icons-material/Archive';
import RestoreIcon from '@mui/icons-material/Restore';
import { useTrailDetail, useTrailRaces, useInvalidateTrailData, trailStatusLabel, type TrailDetail, type TrailLinkedRace } from '../hooks/useTrails';
import { usePageShortcuts } from '../hooks/usePageShortcuts';
import { useLocations } from '../hooks/useLocations';
import { useTags } from '../hooks/useTags';
import { apiFetch } from '../hooks/api';
import TrailMap, { type GeoJsonGeometry } from '../components/TrailMap';
import ElevationChart from '../components/ElevationChart';
import TrailFormCard from '../components/trails/TrailFormCard';
import ChangeLogList from '../components/ChangeLogList';
import TrailStatusLegendDialog from '../components/trails/TrailStatusLegendDialog';
import TrailActionDialog, { type TrailAction } from '../components/trails/TrailActionDialog';
import { InlineEditSelect, InlineEditText } from '../components/InlineEditCell';

const PUBLIC_SITE_URL = ((import.meta.env.VITE_PUBLIC_SITE_URL ?? '') as string).replace(/\/$/, '');
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';
const MAP_HEIGHT = 220;

// Visibility states only. 'Flagged' is gone — "needs a look" is now the needsReview
// bookmark, independent of visibility. 'Archived' is a soft-delete rather than a
// visibility choice, so it gets its own button next to Delete instead of sitting here.
const statusOptions = ['Draft', 'Published', 'EventOnly']
  .map(value => ({ value, label: trailStatusLabel(value) }));

const activityOptions = [
  { value: 'TrailRunning', label: 'Trail Run' },
  { value: 'Running', label: 'Road Run' },
  { value: 'Cycling', label: 'Cycling' },
  { value: 'Hiking', label: 'Hike' },
];

const difficultyOptions = [
  { value: 'Easy', label: 'Easy' },
  { value: 'Moderate', label: 'Moderate' },
  { value: 'Hard', label: 'Hard' },
  { value: 'Expert', label: 'Expert' },
  { value: 'Extreme', label: 'Extreme' },
];

const trailTypeOptions = [
  { value: 'OutAndBack', label: 'Out and Back' },
  { value: 'Loop', label: 'Loop' },
  { value: 'PointToPoint', label: 'Point to Point' },
];

const terrainTypeOptions = [
  { value: '', label: 'None' },
  { value: 'Mountainous', label: 'Mountainous' },
  { value: 'Hilly', label: 'Hilly' },
  { value: 'Flat', label: 'Flat' },
];

const visibilityOptions = [
  { value: 'Public', label: 'Public' },
  { value: 'Friends', label: 'Friends' },
  { value: 'Private', label: 'Private' },
];

/** Caption label stacked above its value — used for both the editable pills and the info groups. */
function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1.4 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>{children}</Box>
    </Box>
  );
}

function editionLabel(r: TrailLinkedRace): string {
  if (r.editionTitle?.trim()) return r.editionTitle;
  if (r.editionDate) return r.editionDate;
  if (r.editionYear != null) return `${r.editionYear}`;
  return 'Untitled edition';
}

function statusColor(status: string): 'success' | 'warning' | 'info' | 'default' {
  if (status === 'Published') return 'success';
  if (status === 'Flagged') return 'warning';
  if (status === 'EventOnly') return 'info';
  return 'default';
}

interface GpxReplaceZoneProps {
  trailId: string;
  onReplaced: (stats: { length: number; elevationGain: number; elevationLoss: number; detectedType: string; difficulty: string }) => void;
  onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
}

function GpxReplaceZone({ trailId, onReplaced, onNotify }: GpxReplaceZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const replaceGpx = async (file: File) => {
    if (!confirm('Replace GPX data? This will overwrite the current route, recalculate distance, elevation and trail type.')) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const result = await apiFetch<{ length: number; elevationGain: number; elevationLoss: number; detectedType: string; difficulty: string }>(
        `/api/v1/admin/trails/${trailId}/gpx`,
        { method: 'PUT', body: formData }
      );
      onNotify(`GPX replaced! ${(result.length / 1000).toFixed(1)} km, ↑${Math.round(result.elevationGain)}m ↓${Math.round(result.elevationLoss)}m, ${result.detectedType}`, 'success');
      onReplaced(result);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to replace GPX data.', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = Array.from(e.dataTransfer.files).find(f => f.name.toLowerCase().endsWith('.gpx'));
    if (file) void replaceGpx(file);
    else onNotify('Please drop a .gpx file', 'error');
  };

  return (
    <Paper
      variant="outlined"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => !uploading && fileInputRef.current?.click()}
      sx={{
        height: '100%',
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        backgroundColor: dragActive ? 'action.hover' : 'background.paper',
        border: '2px dashed',
        borderColor: dragActive ? 'primary.main' : 'divider',
        cursor: uploading ? 'default' : 'pointer',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void replaceGpx(file);
        }}
      />
      {uploading ? (
        <CircularProgress size={22} />
      ) : (
        <>
          <CloudUploadIcon sx={{ fontSize: 22, color: 'text.secondary', mb: 0.5 }} />
          <Typography variant="caption" color="text.secondary">
            Drag &amp; drop a .gpx file to replace this route, or click to select a file
          </Typography>
        </>
      )}
    </Paper>
  );
}

export default function TrailDetailPage({ onNotify }: { onNotify: (message: ReactNode, severity?: 'success' | 'error') => void }) {
  const { idOrSlug = '' } = useParams<{ idOrSlug: string }>();
  const navigate = useNavigate();
  const { detail: trail, loading, error, refresh, setDetail } = useTrailDetail(idOrSlug);
  const { races } = useTrailRaces(idOrSlug);
  const { locations: allLocations } = useLocations();
  const { tags: allTags } = useTags();
  const { invalidateLists } = useInvalidateTrailData();

  const [editingTrail, setEditingTrail] = useState(false);
  const [pendingAction, setPendingAction] = useState<TrailAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [statusLegendOpen, setStatusLegendOpen] = useState(false);

  // Prefer navigate(-1) so the list's filter/sort/search state (kept in its URL query
  // string) is restored — matches the 'u' shortcut and the browser back button. Falls
  // back to the bare list path when there's no prior in-app history entry to pop to
  // (e.g. this page was opened directly from a bookmark or shared link).
  const handleBackToList = () => {
    const idx = window.history.state?.idx;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
    } else {
      navigate('/trails');
    }
  };

  usePageShortcuts([
    { key: 'u', handler: () => navigate(-1) },
    { key: 'e', handler: () => setEditingTrail(v => !v) },
    { key: 'v', handler: () => { if (isPubliclyVisible && PUBLIC_SITE_URL) window.open(`${PUBLIC_SITE_URL}/trails/${trail?.slug}`, '_blank'); } },
    { key: 'Escape', allowInInput: true, handler: () => setEditingTrail(false) },
  ]);

  // Canonicalize the URL to the slug once the trail loads (some entry points only have the id on hand).
  useEffect(() => {
    if (trail && idOrSlug !== trail.slug) {
      navigate(`/trails/${trail.slug}`, { replace: true });
    }
  }, [trail, idOrSlug, navigate]);

  const handlePatchField = async <K extends keyof TrailDetail>(field: K, value: string) => {
    if (!trail) return;
    await apiFetch(`/api/v1/admin/trails/${trail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: trail.id, [field]: value }),
    });
    setDetail(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const handleToggleNeedsReview = async () => {
    if (!trail) return;
    const next = !trail.needsReview;
    // Optimistic: the toggle should feel instant, and a failure just flips it back.
    setDetail(prev => prev ? { ...prev, needsReview: next } : prev);
    try {
      await apiFetch(`/api/v1/admin/trails/${trail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trail.id, needsReview: next }),
      });
      void invalidateLists();
      onNotify(next ? 'Marked for review' : 'Review mark cleared');
    } catch (err) {
      setDetail(prev => prev ? { ...prev, needsReview: !next } : prev);
      onNotify(err instanceof Error ? err.message : 'Failed to update review mark', 'error');
    }
  };

  const handleRemoveLocation = async (locationId: string) => {
    if (!trail) return;
    try {
      await apiFetch(`/api/v1/admin/trails/${trail.id}/locations/${locationId}`, { method: 'DELETE' });
      setDetail(prev => prev ? { ...prev, locations: prev.locations.filter(l => l.locationId !== locationId) } : prev);
      void invalidateLists();
      onNotify('Location removed');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to remove location', 'error');
    }
  };

  const handleAddLocation = async (locationId: string) => {
    if (!trail) return;
    try {
      await apiFetch(`/api/v1/admin/trails/${trail.id}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, role: 'BelongsTo' }),
      });
      setDetail(prev => prev ? {
        ...prev,
        locations: [...prev.locations, { locationId, role: 'BelongsTo' as const, order: prev.locations.length }],
      } : prev);
      void invalidateLists();
      onNotify('Location added');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to add location', 'error');
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!trail) return;
    try {
      await apiFetch('/api/v1/admin/trails/bulk-remove-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trailIds: [trail.id], tagId }),
      });
      setDetail(prev => prev ? { ...prev, tags: prev.tags.filter(t => t.tagId !== tagId) } : prev);
      void invalidateLists();
      onNotify('Tag removed');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to remove tag', 'error');
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (!trail) return;
    const tag = allTags.find(t => t.id === tagId);
    if (!tag) return;
    try {
      await apiFetch('/api/v1/admin/trails/bulk-add-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trailIds: [trail.id], tagId }),
      });
      setDetail(prev => prev ? {
        ...prev,
        tags: [...prev.tags, { tagId: tag.id, name: tag.name, slug: tag.slug, color: tag.color }],
      } : prev);
      void invalidateLists();
      onNotify(`Tag "${tag.name}" added`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to add tag', 'error');
    }
  };

  const handleConfirmAction = async () => {
    if (!trail || !pendingAction) return;
    try {
      setActionBusy(true);
      if (pendingAction === 'delete') {
        await apiFetch(`/api/v1/admin/trails/${trail.id}`, { method: 'DELETE' });
        void invalidateLists();
        onNotify('Trail deleted successfully');
        navigate('/trails');
      } else {
        await handlePatchField('status', 'Archived');
        void invalidateLists();
        onNotify('Trail archived');
      }
      setPendingAction(null);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : `Failed to ${pendingAction} trail`, 'error');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !trail) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error ?? 'Trail not found'}
        <Button size="small" sx={{ ml: 2 }} onClick={() => navigate('/trails')}>Back to trails</Button>
      </Alert>
    );
  }

  // The public trail endpoint only serves Published and EventOnly trails, so every other
  // status would land the admin on a 404 (see GetTrailBySlugQuery in the backend).
  const isPubliclyVisible = trail.status === 'Published' || trail.status === 'EventOnly';

  return (
    <Box>
      {/* Breadcrumb */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
        <IconButton size="small" onClick={handleBackToList}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography
          variant="body2"
          color="text.secondary"
          component={RouterLink}
          to="/trails"
          onClick={e => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            handleBackToList();
          }}
          sx={{ cursor: 'pointer', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          Trails
        </Typography>
        <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        <Typography variant="body2" fontWeight={500}>{trail.name}</Typography>
      </Stack>

      {/* Trail header card */}
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1.5}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h5" fontWeight={600} gutterBottom>{trail.name}</Typography>
              <Tooltip title={trail.needsReview
                ? 'Marked for review — click to clear. Does not affect the public site.'
                : 'Mark for review — an admin-only bookmark, does not affect the public site.'}>
                <IconButton size="small" onClick={() => void handleToggleNeedsReview()} sx={{ mb: 0.5 }}>
                  {trail.needsReview
                    ? <BookmarkIcon fontSize="small" color="warning" />
                    : <BookmarkBorderIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={1.25} alignItems="flex-end">
              <LabeledField label="Status">
                <InlineEditSelect
                  value={trail.status}
                  options={statusOptions}
                  onSave={(v) => handlePatchField('status', v)}
                  renderDisplay={(v) => (
                    <Chip label={trailStatusLabel(v)} size="small" color={statusColor(v)} sx={{ cursor: 'pointer' }} />
                  )}
                />
                <Tooltip title="What do the statuses mean?">
                  <IconButton size="small" onClick={() => setStatusLegendOpen(true)} sx={{ width: 20, height: 20 }}>
                    <HelpOutlineIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              </LabeledField>
              <LabeledField label="Visibility">
                <InlineEditSelect
                  value={trail.visibility}
                  options={visibilityOptions}
                  onSave={(v) => handlePatchField('visibility', v)}
                  renderDisplay={(v) => <Chip label={v} size="small" variant="outlined" sx={{ cursor: 'pointer' }} />}
                />
              </LabeledField>
              <LabeledField label="Difficulty">
                <InlineEditSelect
                  value={trail.difficulty}
                  options={difficultyOptions}
                  onSave={(v) => handlePatchField('difficulty', v)}
                  renderDisplay={(v) => <Chip label={v} size="small" variant="outlined" sx={{ cursor: 'pointer' }} />}
                />
              </LabeledField>
              <LabeledField label="Terrain">
                <InlineEditSelect
                  value={trail.terrainType ?? ''}
                  options={terrainTypeOptions}
                  onSave={(v) => handlePatchField('terrainType', v)}
                  renderDisplay={(v) => <Chip label={v || 'No terrain'} size="small" variant="outlined" sx={{ cursor: 'pointer' }} />}
                />
              </LabeledField>
              <LabeledField label="Activity">
                <InlineEditSelect
                  value={trail.activityType}
                  options={activityOptions}
                  onSave={(v) => handlePatchField('activityType', v)}
                  renderDisplay={(v) => <Chip label={activityOptions.find(o => o.value === v)?.label ?? v} size="small" variant="outlined" sx={{ cursor: 'pointer' }} />}
                />
              </LabeledField>
              <LabeledField label="Trail type">
                <InlineEditSelect
                  value={trail.type}
                  options={trailTypeOptions}
                  onSave={(v) => handlePatchField('type', v)}
                  renderDisplay={(v) => <Chip label={trailTypeOptions.find(o => o.value === v)?.label ?? v} size="small" variant="outlined" sx={{ cursor: 'pointer' }} />}
                />
              </LabeledField>
              <LabeledField label="Distance">
                <Chip label={`${(trail.length / 1000).toFixed(1)} km`} size="small" variant="outlined" />
              </LabeledField>
              <LabeledField label="Elevation gain">
                <Chip label={`↑ ${Math.round(trail.elevationGain)}m`} size="small" color="success" variant="outlined" />
              </LabeledField>
              <LabeledField label="Elevation loss">
                <Chip label={`↓ ${Math.round(trail.elevationLoss)}m`} size="small" color="error" variant="outlined" />
              </LabeledField>
              <LabeledField label="Climb ratio">
                <Chip
                  label={trail.length > 0 ? `${Math.round(trail.elevationGain / (trail.length / 1000))} m/km` : '—'}
                  size="small"
                  variant="outlined"
                />
              </LabeledField>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} flexShrink={0}>
            {PUBLIC_SITE_URL && (
              <Tooltip title={isPubliclyVisible
                ? 'View on site'
                : `${trailStatusLabel(trail.status)} trails are not published on the public site`}>
                {/* span keeps the tooltip working while the button is disabled */}
                <span>
                  <Button
                    size="small" variant="outlined" startIcon={<OpenInNewIcon />}
                    disabled={!isPubliclyVisible}
                    {...(isPubliclyVisible && {
                      href: `${PUBLIC_SITE_URL}/trails/${trail.slug}`,
                      target: '_blank',
                      rel: 'noopener',
                    })}
                  >
                    View
                  </Button>
                </span>
              </Tooltip>
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              component="a"
              href={`${API_URL}/api/v1/trails/${trail.slug}/gpx`}
              download={`${trail.slug}.gpx`}
            >
              GPX
            </Button>
            <Button size="small"
              variant={editingTrail ? 'contained' : 'outlined'}
              startIcon={<EditIcon />}
              onClick={() => setEditingTrail(v => !v)}
            >
              {editingTrail ? 'Close editor' : 'Edit trail'}
            </Button>
            {trail.status === 'Archived' ? (
              <Tooltip title="Restore this trail to Hidden">
                <Button size="small" variant="outlined" startIcon={<RestoreIcon />}
                  onClick={async () => {
                    try {
                      await handlePatchField('status', 'Draft');
                      onNotify('Trail restored');
                    } catch (err) {
                      onNotify(err instanceof Error ? err.message : 'Failed to restore trail', 'error');
                    }
                  }}>
                  Restore
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title="Archive — takes the trail out of circulation without deleting it">
                <Button size="small" color="warning" variant="outlined" startIcon={<ArchiveIcon />}
                  onClick={() => setPendingAction('archive')}>
                  Archive
                </Button>
              </Tooltip>
            )}
            <Tooltip title="Delete — archives the trail and moves it to a new web address, freeing the current one for another trail to use. Restorable, but not back to its original address.">
              <Button size="small" color="error" variant="outlined" startIcon={<DeleteIcon />}
                onClick={() => setPendingAction('delete')}>
                Delete
              </Button>
            </Tooltip>
          </Stack>
        </Stack>
        <Box sx={{ mt: 1.5 }}>
          <InlineEditText
            value={trail.description}
            onSave={(v) => handlePatchField('description', v)}
            variant="body2"
            multiline
            placeholder="Add description..."
          />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 3, rowGap: 1.25, mt: 2 }}>
          <LabeledField label="Locations">
            {trail.locations.map(l => (
              <Chip
                key={l.locationId}
                size="small"
                variant="outlined"
                label={`${allLocations.find(al => al.id === l.locationId)?.name ?? '…'} (${l.role})`}
                onDelete={() => void handleRemoveLocation(l.locationId)}
              />
            ))}
            {showAddLocation ? (
              <Autocomplete
                size="small"
                options={allLocations.filter(al => !trail.locations.some(l => l.locationId === al.id))}
                getOptionLabel={opt => opt.name}
                onChange={(_e, val) => { if (val) { void handleAddLocation(val.id); setShowAddLocation(false); } }}
                onBlur={() => setShowAddLocation(false)}
                openOnFocus
                autoHighlight
                sx={{ minWidth: 180 }}
                renderInput={params => <TextField {...params} placeholder="Add location..." autoFocus variant="standard" size="small" />}
              />
            ) : (
              <Tooltip title="Add location">
                <IconButton size="small" onClick={() => setShowAddLocation(true)} sx={{ width: 24, height: 24 }}>
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </LabeledField>

          <LabeledField label="Tags">
            {trail.tags.map(t => (
              <Chip
                key={t.tagId}
                size="small"
                label={t.name}
                variant={t.color ? 'filled' : 'outlined'}
                sx={{
                  backgroundColor: t.color || undefined,
                  color: t.color ? '#fff' : undefined,
                  '& .MuiChip-deleteIcon': { color: t.color ? 'rgba(255,255,255,0.7)' : undefined },
                }}
                onDelete={() => void handleRemoveTag(t.tagId)}
              />
            ))}
            {showAddTag ? (
              <Autocomplete
                size="small"
                options={allTags.filter(at => !trail.tags.some(t => t.tagId === at.id))}
                getOptionLabel={opt => opt.name}
                onChange={(_e, val) => { if (val) { void handleAddTag(val.id); setShowAddTag(false); } }}
                onBlur={() => setShowAddTag(false)}
                openOnFocus
                autoHighlight
                sx={{ minWidth: 180 }}
                renderInput={params => <TextField {...params} placeholder="Add tag..." autoFocus variant="standard" size="small" />}
              />
            ) : (
              <Tooltip title="Add tag">
                <IconButton size="small" onClick={() => setShowAddTag(true)} sx={{ width: 24, height: 24 }}>
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </LabeledField>

          <LabeledField label="360° video">
            {trail.youtubeUrl
              ? (
                <Link href={trail.youtubeUrl} target="_blank" rel="noopener"
                  variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <VideocamIcon sx={{ fontSize: 16 }} /> Watch on YouTube
                </Link>
              )
              : <Typography variant="caption" color="text.disabled">None</Typography>}
          </LabeledField>

          <LabeledField label="Event / Edition">
            {races.length > 0
              ? races.map(r => (
                  <Chip
                    key={r.id}
                    size="small"
                    variant="outlined"
                    component={RouterLink}
                    to={`/events/${r.eventSlug}`}
                    clickable
                    label={`${r.eventName} · ${editionLabel(r)} — ${r.raceName}`}
                  />
                ))
              : <Typography variant="caption" color="text.disabled">Not linked to any event</Typography>}
          </LabeledField>
        </Box>
      </Box>

      {editingTrail && (
        <TrailFormCard
          trail={trail}
          onClose={() => setEditingTrail(false)}
          onSaved={(updated) => {
            if (updated.slug !== trail.slug) {
              navigate(`/trails/${updated.slug}`, { replace: true });
            } else {
              refresh();
            }
          }}
          onNotify={onNotify}
        />
      )}

      {/* Map + GPX replace — map kept compact (75% width) so tiles load quickly.
          Grid tracks use minmax(0, ...) because Leaflet's tile container has intrinsic
          size and will otherwise ignore its allotted share and force the row to overflow. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 1fr)' }, gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <TrailMap
            key={`${trail.id}-${mapVersion}`}
            trailId={trail.id}
            trailName={trail.name}
            height={MAP_HEIGHT}
            onDataLoaded={setGeometry}
          />
          {geometry && geometry.coordinates.length >= 2 && (
            <ElevationChart coordinates={geometry.coordinates} />
          )}
        </Box>
        <Box sx={{ minWidth: 0, mt: 2 }}>
          <GpxReplaceZone
            trailId={trail.id}
            onNotify={onNotify}
            onReplaced={(stats) => {
              setDetail(prev => prev ? {
                ...prev,
                length: stats.length,
                elevationGain: stats.elevationGain,
                elevationLoss: stats.elevationLoss,
                type: stats.detectedType,
                difficulty: stats.difficulty,
              } : prev);
              setGeometry(null);
              setMapVersion(v => v + 1);
            }}
          />
        </Box>
      </Box>

      {/* History — collapsed by default; only fetched once expanded */}
      <Box sx={{ mt: 3 }}>
        <Button
          size="small"
          startIcon={<HistoryIcon />}
          endIcon={historyOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setHistoryOpen(v => !v)}
        >
          Trail History
        </Button>
        {historyOpen && <ChangeLogList entityName="Trail" entityId={trail.id} />}
      </Box>

      <TrailActionDialog
        action={pendingAction}
        trail={{ name: trail.name, slug: trail.slug }}
        linkedRaces={races}
        busy={actionBusy}
        onClose={() => setPendingAction(null)}
        onConfirm={() => void handleConfirmAction()}
      />

      <TrailStatusLegendDialog open={statusLegendOpen} onClose={() => setStatusLegendOpen(false)} />
    </Box>
  );
}
