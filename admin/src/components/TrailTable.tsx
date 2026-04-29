import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Chip, Button, Box, Checkbox, TableSortLabel, Tooltip, IconButton, Paper, Autocomplete, TextField } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MapIcon from '@mui/icons-material/Map';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import LoopIcon from '@mui/icons-material/Loop';
import UndoIcon from '@mui/icons-material/Undo';
import AddIcon from '@mui/icons-material/Add';
import type { Trail } from '../hooks/useTrails';
import type { LocationDto } from '../hooks/useLocations';
import type { TagDto } from '../hooks/useTags';
import { InlineEditText, InlineEditSelect } from './InlineEditCell';
import { useState } from 'react';

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
  onDelete: (trail: { id: string; name: string }) => void;
  onRestore: (trail: Trail) => void;
  onUpdateStatus: (trailId: string, status: string) => void;
  onPatchTrail: (trailId: string, field: string, value: string) => Promise<void>;
  allLocations: LocationDto[];
  onAddLocation: (trailId: string, locationId: string, role?: string) => Promise<void>;
  onRemoveLocation: (trailId: string, locationId: string) => Promise<void>;
  allTags: TagDto[];
  onAddTag: (trailId: string, tagId: string) => Promise<void>;
  onRemoveTag: (trailId: string, tagId: string) => Promise<void>;
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
            <TableCell align="center">Web</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {trails.map((trail) => (
            <TrailRow
              key={trail.id}
              trail={trail}
              selected={selectedIds.includes(trail.id)}
              onSelect={() => onSelectOne(trail.id)}
              onViewMap={() => onViewMap({ id: trail.id, name: trail.name })}
              onEdit={() => onEdit(trail.id)}
              onDelete={() => onDelete({ id: trail.id, name: trail.name })}
              onRestore={() => onRestore(trail)}
              onUpdateStatus={onUpdateStatus}
              onPatchTrail={onPatchTrail}
              allLocations={allLocations}
              onAddLocation={onAddLocation}
              onRemoveLocation={onRemoveLocation}
              allTags={allTags}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
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
  onSelect: () => void;
  onViewMap: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onUpdateStatus: (trailId: string, status: string) => void;
  onPatchTrail: (trailId: string, field: string, value: string) => Promise<void>;
  allLocations: LocationDto[];
  onAddLocation: (trailId: string, locationId: string, role?: string) => Promise<void>;
  onRemoveLocation: (trailId: string, locationId: string) => Promise<void>;
  allTags: TagDto[];
  onAddTag: (trailId: string, tagId: string) => Promise<void>;
  onRemoveTag: (trailId: string, tagId: string) => Promise<void>;
}

const statusOptions = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Published', label: 'Published' },
  { value: 'Flagged', label: 'Flagged' },
  { value: 'Archived', label: 'Archived' },
  { value: 'RaceOnly', label: 'Race Only' },
];

const difficultyOptions = [
  { value: 'Easy', label: 'Easy' },
  { value: 'Moderate', label: 'Moderate' },
  { value: 'Hard', label: 'Hard' },
  { value: 'Expert', label: 'Expert' },
];

const activityOptions = [
  { value: 'TrailRunning', label: 'Trail Running' },
  { value: 'Running', label: 'Running' },
  { value: 'Hiking', label: 'Hiking' },
  { value: 'Cycling', label: 'Cycling' },
];

function TrailRow({ trail, selected, onSelect, onViewMap, onEdit, onDelete, onRestore, onUpdateStatus: _onUpdateStatus, onPatchTrail, allLocations, onAddLocation, onRemoveLocation, allTags, onAddTag, onRemoveTag }: TrailRowProps) {
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const linkedIds = new Set(trail.locations?.map(l => l.id) ?? []);
  const availableLocations = allLocations.filter(l => !linkedIds.has(l.id));
  const linkedTagSlugs = new Set(trail.tags?.map(t => t.slug) ?? []);
  const availableTags = allTags.filter(t => !linkedTagSlugs.has(t.slug));
  return (
    <TableRow
      selected={selected}
      sx={{ opacity: trail.status === 'Deleted' ? 0.6 : 1, bgcolor: trail.status === 'Deleted' ? 'action.hover' : 'inherit' }}
    >
      <TableCell padding="checkbox">
        <Checkbox checked={selected} onChange={onSelect} />
      </TableCell>
      <TableCell component="th" scope="row">
        <InlineEditText
          value={trail.name}
          onSave={(v) => onPatchTrail(trail.id, 'name', v)}
          fontWeight="bold"
        />
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
        {trail.status === 'Deleted' ? (
          <Chip label="Deleted" color="error" size="small" />
        ) : (
          <InlineEditSelect
            value={trail.status}
            options={statusOptions}
            onSave={(v) => onPatchTrail(trail.id, 'status', v)}
            renderDisplay={(v) => (
              <Chip
                label={v === 'RaceOnly' ? 'Race Only' : v}
                color={v === 'Published' ? 'success' : v === 'Flagged' ? 'warning' : v === 'RaceOnly' ? 'info' : 'default'}
                size="small"
              />
            )}
          />
        )}
      </TableCell>
      <TableCell align="center">
        <Tooltip title="View trail on website">
          <IconButton size="small" component="a" href={`https://utanvega.vercel.app/trails/${trail.slug}`} target="_blank">
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
      <TableCell align="right">
        <Button size="small" startIcon={<MapIcon />} onClick={onViewMap}>Map</Button>
        {trail.status === 'Deleted' ? (
          <Button size="small" color="success" startIcon={<RestoreIcon />} onClick={onRestore}>Restore</Button>
        ) : (
          <>
            <Button size="small" startIcon={<EditIcon />} onClick={onEdit}>Edit</Button>
            <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>Delete</Button>
          </>
        )}
      </TableCell>
    </TableRow>
  );
}
