import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Chip, Button, Box, Checkbox, TableSortLabel, Tooltip, IconButton, Paper, Link } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MapIcon from '@mui/icons-material/Map';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import LoopIcon from '@mui/icons-material/Loop';
import UndoIcon from '@mui/icons-material/Undo';
import type { Trail } from '../hooks/useTrails';

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

interface TrailRowProps {
  trail: Trail;
  selected: boolean;
  onSelect: () => void;
  onViewMap: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onUpdateStatus: (trailId: string, status: string) => void;
}

function TrailRow({ trail, selected, onSelect, onViewMap, onEdit, onDelete, onRestore, onUpdateStatus }: TrailRowProps) {
  return (
    <TableRow
      selected={selected}
      sx={{ opacity: trail.status === 'Deleted' ? 0.6 : 1, bgcolor: trail.status === 'Deleted' ? 'action.hover' : 'inherit' }}
    >
      <TableCell padding="checkbox">
        <Checkbox checked={selected} onChange={onSelect} />
      </TableCell>
      <TableCell component="th" scope="row">
        <Link
          component="button"
          variant="body2"
          sx={{ fontWeight: 'bold', textAlign: 'left', cursor: 'pointer' }}
          underline="hover"
          onClick={onEdit}
        >
          {trail.name}
        </Link>
        {trail.description && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 300 }}>
            {trail.description}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">{(trail.length / 1000).toFixed(2)}</TableCell>
      <TableCell align="right">
        <Typography variant="body2" component="span">↑{Math.round(trail.elevationGain)}</Typography>
        <Typography variant="body2" component="span" color="text.secondary"> ↓{Math.round(trail.elevationLoss)}</Typography>
      </TableCell>
      <TableCell><TrailTypeChip type={trail.trailType} /></TableCell>
      <TableCell>
        {trail.locations?.map(l => l.name).join(', ') || 'N/A'}
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {trail.tags?.map(tag => (
            <Chip
              key={tag.slug}
              label={tag.name}
              size="small"
              variant="outlined"
              sx={{ borderColor: tag.color || undefined, fontSize: '0.7rem', height: 22 }}
            />
          ))}
        </Box>
      </TableCell>
      <TableCell>
        <Chip
          label={trail.status}
          color={trail.status === 'Published' ? 'success' : trail.status === 'Deleted' ? 'error' : 'default'}
          size="small"
          onClick={() => {
            if (trail.status === 'Deleted') return;
            const nextStatus = trail.status === 'Published' ? 'Draft' : 'Published';
            onUpdateStatus(trail.id, nextStatus);
          }}
          sx={{ cursor: trail.status === 'Deleted' ? 'default' : 'pointer' }}
        />
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
