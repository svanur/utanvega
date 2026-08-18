import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Chip, Box, Checkbox, TableSortLabel, Tooltip, IconButton, Paper, Autocomplete, TextField } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import MapIcon from '@mui/icons-material/Map';
import RestoreIcon from '@mui/icons-material/Restore';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import LoopIcon from '@mui/icons-material/Loop';
import UndoIcon from '@mui/icons-material/Undo';
import AddIcon from '@mui/icons-material/Add';
import VideocamIcon from '@mui/icons-material/Videocam';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { trailStatusLabel, type Trail } from '../hooks/useTrails';
import type { LocationDto } from '../hooks/useLocations';
import type { TagDto } from '../hooks/useTags';
import { InlineEditText, InlineEditSelect } from './InlineEditCell';
import { memo, useCallback, useMemo, useState } from 'react';

const SITE_URL = import.meta.env.VITE_SITE_URL?.trim() || 'https://utanvega.vercel.app';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface TrailTableProps {
  trails: Trail[];
  selectedIds: string[];
  orderBy: string;
  order: 'asc' | 'desc';
  onRequestSort: (property: string) => void;
  onSelectAll: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectOne: (id: string) => void;
  onViewMap: (trail: { id: string; name: string }) => void;
  onEdit: (trailId: string) => void;
  onDelete: (trail: { id: string; name: string; slug: string }) => void;
  onRestore: (trail: Trail) => void;
  onUpdateStatus: (trailId: string, status: string) => void;
  onPatchTrail: (trailId: string, field: string, value: string) => Promise<void>;
  allLocations: LocationDto[];
  onAddLocation: (trailId: string, locationId: string, role?: string) => Promise<void>;
  onRemoveLocation: (trailId: string, locationId: string) => Promise<void>;
  allTags: TagDto[];
  onAddTag: (trailId: string, tagId: string) => Promise<void>;
  onRemoveTag: (trailId: string, tagId: string) => Promise<void>;
  /** Optional: makes the whole row clickable. Inline-edit controls keep working. */
  onRowClick?: (trail: Trail) => void;
}

export default function TrailTable({
  trails,
  selectedIds,
  orderBy,
  order,
  onRequestSort,
  onSelectAll,
  onSelectOne,
  onViewMap,
  onEdit,
  onDelete,
  onRestore,
  onUpdateStatus,
  onPatchTrail,
  allLocations,
  onAddLocation,
  onRemoveLocation,
  allTags,
  onAddTag,
  onRemoveTag,
  onRowClick,
}: TrailTableProps) {
  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={selectedIds.length > 0 && selectedIds.length < trails.length}
                checked={trails.length > 0 && selectedIds.length === trails.length}
                onChange={onSelectAll}
              />
            </TableCell>
            <TableCell>
              <TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order : 'asc'} onClick={() => onRequestSort('name')}>
                Name
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel active={orderBy === 'length'} direction={orderBy === 'length' ? order : 'asc'} onClick={() => onRequestSort('length')}>
                Length (km)
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel active={orderBy === 'elevationGain'} direction={orderBy === 'elevationGain' ? order : 'asc'} onClick={() => onRequestSort('elevationGain')}>
                Elev ↑↓
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel active={orderBy === 'trailType'} direction={orderBy === 'trailType' ? order : 'asc'} onClick={() => onRequestSort('trailType')}>
                Type
              </TableSortLabel>
            </TableCell>
            <TableCell>Location</TableCell>
            <TableCell>Tags</TableCell>
            <TableCell>
              <TableSortLabel active={orderBy === 'status'} direction={orderBy === 'status' ? order : 'asc'} onClick={() => onRequestSort('status')}>
                Status
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel active={orderBy === 'updatedAt'} direction={orderBy === 'updatedAt' ? order : 'desc'} onClick={() => onRequestSort('updatedAt')}>
                Updated
              </TableSortLabel>
            </TableCell>
            <TableCell align="center" />
          </TableRow>
        </TableHead>
        <TableBody>
          {trails.map((trail) => (
            <TrailRow
              key={trail.id}
              trail={trail}
              selected={selectedIds.includes(trail.id)}
              onSelectOne={onSelectOne}
              onViewMap={onViewMap}
              onEdit={onEdit}
              onDelete={onDelete}
              onRestore={onRestore}
              onUpdateStatus={onUpdateStatus}
              onPatchTrail={onPatchTrail}
              allLocations={allLocations}
              onAddLocation={onAddLocation}
              onRemoveLocation={onRemoveLocation}
              allTags={allTags}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onRowClick={onRowClick}
            />
          ))}
          {trails.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} align="center">No trails found. Upload a GPX to get started!</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const trailTypeConfig: Record<string, { label: string; icon: React.ReactElement; color: 'primary' | 'secondary' | 'info' }> = {
  Loop: { label: 'Loop', icon: <LoopIcon sx={{ fontSize: 16 }} />, color: 'primary' },
  OutAndBack: { label: 'Out & Back', icon: <UndoIcon sx={{ fontSize: 16 }} />, color: 'secondary' },
  PointToPoint: { label: 'Point to Point', icon: <TrendingFlatIcon sx={{ fontSize: 16 }} />, color: 'info' },
};

const difficultyColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  Easy: 'success',
  Moderate: 'warning',
  Hard: 'error',
  Expert: 'error',
};

function TrailTypeChip({ type }: { type: string }) {
  const config = trailTypeConfig[type] ?? { label: type, icon: <LoopIcon sx={{ fontSize: 16 }} />, color: 'primary' as const };
  return (
    <Chip
      icon={config.icon}
      label={config.label}
      size="small"
      color={config.color}
      variant="outlined"
      sx={{ fontSize: '0.7rem', height: 24 }}
    />
  );
}

function DifficultyChip({ difficulty }: { difficulty: string }) {
  if (!difficulty) return null;
  return (
    <Chip
      label={difficulty}
      size="small"
      color={difficultyColors[difficulty] ?? 'default'}
      variant="outlined"
      sx={{ fontSize: '0.7rem', height: 24 }}
    />
  );
}

interface TrailRowProps {
  trail: Trail;
  selected: boolean;
  onSelectOne: (id: string) => void;
  onViewMap: (trail: { id: string; name: string }) => void;
  onEdit: (trailId: string) => void;
  onDelete: (trail: { id: string; name: string; slug: string }) => void;
  onRestore: (trail: Trail) => void;
  onUpdateStatus: (trailId: string, status: string) => void;
  onPatchTrail: (trailId: string, field: string, value: string) => Promise<void>;
  allLocations: LocationDto[];
  onAddLocation: (trailId: string, locationId: string, role?: string) => Promise<void>;
  onRemoveLocation: (trailId: string, locationId: string) => Promise<void>;
  allTags: TagDto[];
  onAddTag: (trailId: string, tagId: string) => Promise<void>;
  onRemoveTag: (trailId: string, tagId: string) => Promise<void>;
  onRowClick?: (trail: Trail) => void;
}

// Anything matching this inside a row is a control the admin came to interact with, so a click
// on it must not also navigate away. `[data-inline-edit]` covers the InlineEdit* cells, whose
// display mode is a plain Box rather than a real button.
const ROW_INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, [role="button"], [role="combobox"], .MuiChip-root, [data-inline-edit]';

const statusOptions = ['Draft', 'Published', 'EventOnly', 'Archived']
  .map(value => ({ value, label: trailStatusLabel(value) }));

const difficultyOptions = [
  { value: 'Easy', label: 'Easy' },
  { value: 'Moderate', label: 'Moderate' },
  { value: 'Hard', label: 'Hard' },
  { value: 'Expert', label: 'Expert' },
];

const activityOptions = [
  { value: 'TrailRunning', label: 'Trail Run' },
  { value: 'Running', label: 'Road Run' },
  { value: 'Hiking', label: 'Hike' },
  { value: 'Cycling', label: 'Cycling' },
];

function TrailRowComponent({ trail, selected, onSelectOne, onViewMap, onEdit: _onEdit, onDelete: _onDelete, onRestore, onUpdateStatus: _onUpdateStatus, onPatchTrail, allLocations, onAddLocation, onRemoveLocation, allTags, onAddTag, onRemoveTag, onRowClick }: TrailRowProps) {
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);

  const linkedIds = useMemo(() => new Set(trail.locations?.map(l => l.id) ?? []), [trail.locations]);
  const availableLocations = useMemo(() => allLocations.filter(l => !linkedIds.has(l.id)), [allLocations, linkedIds]);
  const linkedTagSlugs = useMemo(() => new Set(trail.tags?.map(t => t.slug) ?? []), [trail.tags]);
  const availableTags = useMemo(() => allTags.filter(t => !linkedTagSlugs.has(t.slug)), [allTags, linkedTagSlugs]);

  const handleSelect = useCallback(() => onSelectOne(trail.id), [onSelectOne, trail.id]);
  const handleViewMap = useCallback(() => onViewMap({ id: trail.id, name: trail.name }), [onViewMap, trail.id, trail.name]);
  const handleRestore = useCallback(() => onRestore(trail), [onRestore, trail]);

  const handleRowClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!onRowClick) return;
    // Ignore clicks that landed on a control, and clicks that were really a text selection.
    if ((e.target as HTMLElement).closest(ROW_INTERACTIVE_SELECTOR)) return;
    if (window.getSelection()?.toString()) return;
    onRowClick(trail);
  }, [onRowClick, trail]);

  return (
    <TableRow
      selected={selected}
      hover={!!onRowClick}
      onClick={handleRowClick}
      sx={{
        opacity: trail.status === 'Archived' ? 0.6 : 1,
        bgcolor: trail.status === 'Archived' ? 'action.hover' : 'inherit',
        ...(onRowClick && { cursor: 'pointer' }),
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox checked={selected} onChange={handleSelect} />
      </TableCell>
      <TableCell component="th" scope="row">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {trail.needsReview && (
            <Tooltip title="Marked for review">
              <BookmarkIcon color="warning" sx={{ fontSize: 16, flexShrink: 0 }} />
            </Tooltip>
          )}
          <InlineEditText
            value={trail.name}
            onSave={(v) => onPatchTrail(trail.id, 'name', v)}
            fontWeight="bold"
          />
        </Box>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 300, fontFamily: 'monospace', opacity: 0.7 }}>
          /{trail.slug}
        </Typography>
        <InlineEditText
          value={trail.description || ''}
          onSave={(v) => onPatchTrail(trail.id, 'description', v)}
          variant="caption"
          multiline
          placeholder="Add description..."
        />
      </TableCell>
      <TableCell align="right">{(trail.length / 1000).toFixed(2)}</TableCell>
      <TableCell align="right">
        <Typography variant="body2" component="span">↑{Math.round(trail.elevationGain)}</Typography>
        <Typography variant="body2" component="span" color="text.secondary"> ↓{Math.round(trail.elevationLoss)}</Typography>
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <InlineEditSelect
            value={trail.difficulty || 'Moderate'}
            options={difficultyOptions}
            onSave={(v) => onPatchTrail(trail.id, 'difficulty', v)}
            renderDisplay={(v) => <DifficultyChip difficulty={v} />}
          />
          {trail.terrainType && (
            <Chip
              label={trail.terrainType}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 24, alignSelf: 'flex-start' }}
            />
          )}
          <InlineEditSelect
            value={trail.activityType}
            options={activityOptions}
            onSave={(v) => onPatchTrail(trail.id, 'activityType', v)}
            renderDisplay={(v) => (
              <Chip
                label={activityOptions.find(o => o.value === v)?.label || v}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 24 }}
              />
            )}
          />
          <TrailTypeChip type={trail.trailType} />
        </Box>
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {trail.locations?.map(l => (
            <Chip
              key={l.id}
              label={l.name}
              size="small"
              variant="outlined"
              onDelete={() => onRemoveLocation(trail.id, l.id)}
              sx={{ fontSize: '0.7rem', height: 24 }}
            />
          ))}
          {showAddLocation ? (
            <Autocomplete
              size="small"
              options={availableLocations}
              getOptionLabel={(opt) => opt.name}
              onChange={(_e, val) => {
                if (val) {
                  onAddLocation(trail.id, val.id);
                  setShowAddLocation(false);
                }
              }}
              onBlur={() => setShowAddLocation(false)}
              openOnFocus
              autoHighlight
              sx={{ minWidth: 180 }}
              renderInput={(params) => (
                <TextField {...params} placeholder="Add location..." autoFocus variant="standard" size="small" />
              )}
            />
          ) : (
            <IconButton size="small" onClick={() => setShowAddLocation(true)} sx={{ width: 24, height: 24 }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {trail.tags?.map(tag => {
            const tagDto = allTags.find(t => t.slug === tag.slug);
            return (
              <Chip
                key={tag.slug}
                label={tag.name}
                size="small"
                variant="outlined"
                onDelete={tagDto ? () => onRemoveTag(trail.id, tagDto.id) : undefined}
                sx={{ borderColor: tag.color || undefined, fontSize: '0.7rem', height: 22 }}
              />
            );
          })}
          {showAddTag ? (
            <Autocomplete
              size="small"
              options={availableTags}
              getOptionLabel={(opt) => opt.name}
              onChange={(_e, val) => {
                if (val) {
                  onAddTag(trail.id, val.id);
                  setShowAddTag(false);
                }
              }}
              onBlur={() => setShowAddTag(false)}
              openOnFocus
              autoHighlight
              sx={{ minWidth: 160 }}
              renderOption={(props, option) => (
                <li {...props}>
                  <Chip
                    label={option.name}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: option.color || undefined, fontSize: '0.7rem', height: 22 }}
                  />
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} placeholder="Add tag..." autoFocus variant="standard" size="small" />
              )}
            />
          ) : (
            <IconButton size="small" onClick={() => setShowAddTag(true)} sx={{ width: 24, height: 24 }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      </TableCell>
      <TableCell>
        {trail.status === 'Archived' ? (
          <Chip label="Archived" color="default" size="small" />
        ) : (
          <InlineEditSelect
            value={trail.status}
            options={statusOptions}
            onSave={(v) => onPatchTrail(trail.id, 'status', v)}
            renderDisplay={(v) => (
              <Chip
                label={trailStatusLabel(v)}
                color={v === 'Published' ? 'success' : v === 'Flagged' ? 'warning' : v === 'EventOnly' ? 'info' : 'default'}
                size="small"
              />
            )}
          />
        )}
      </TableCell>
      <TableCell>
        <Typography variant="caption" color="text.secondary" noWrap>
          {trail.updatedAt ? new Date(trail.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
          <Tooltip title="View on map">
            <IconButton size="small" onClick={handleViewMap} aria-label={`View map for ${trail.name}`}>
              <MapIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View trail on website">
            <IconButton size="small" component="a" href={`${SITE_URL}/trails/${trail.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${trail.name} on website`}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download GPX">
            <IconButton
              size="small"
              component="a"
              href={`${API_URL}/api/v1/trails/${trail.slug}/gpx`}
              download={`${trail.slug}.gpx`}
              aria-label={`Download GPX for ${trail.name}`}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {trail.youtubeUrl && /^https?:\/\//i.test(trail.youtubeUrl) && (
            <Tooltip title="360° video">
              <IconButton size="small" component="a" href={trail.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label={`360° video for ${trail.name}`}>
                <VideocamIcon fontSize="small" color="error" />
              </IconButton>
            </Tooltip>
          )}
          {trail.status === 'Archived' && (
            <Tooltip title="Restore trail">
              <IconButton size="small" color="success" onClick={handleRestore} aria-label={`Restore ${trail.name}`}>
                <RestoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
}

const TrailRow = memo(TrailRowComponent);
