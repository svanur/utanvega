import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Chip, Button, CircularProgress, Alert, Box, Dialog, DialogTitle, DialogContent, IconButton, DialogActions, FormControlLabel, Switch, Checkbox, TextField, TableSortLabel, InputAdornment, MenuItem, Select, FormControl, InputLabel, Tooltip, Link, Collapse, Divider, Stack } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MapIcon from '@mui/icons-material/Map';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalculateIcon from '@mui/icons-material/Calculate';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import BuildIcon from '@mui/icons-material/Build';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { useMemo, useState } from 'react';
import { useTrails } from '../hooks/useTrails';
import { useTags } from '../hooks/useTags';
import { apiFetch } from '../hooks/api';
import TrailMap from '../components/TrailMap';
import TrailEditDialog from '../components/TrailEditDialog';
import GpxBulkUpload from '../components/GpxBulkUpload';

export default function TrailList({ onNotify, initialTrailId }: { onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void, initialTrailId?: string | null }) {
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const { trails, loading, error, refresh } = useTrails(includeDeleted);
  const { tags } = useTags();
  const [selectedTrailMap, setSelectedTrailMap] = useState<{ id: string, name: string } | null>(null);
  const [selectedTrailEdit, setSelectedTrailEdit] = useState<string | null>(initialTrailId || null);
  const [trailToDelete, setTrailToDelete] = useState<{ id: string, name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActioning, setBulkActioning] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [showTools, setShowTools] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [orderBy, setOrderBy] = useState<string>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const filteredAndSortedTrails = useMemo(() => {
    return trails
      .filter((trail) => {
        const matchesSearch = 
          trail.name.toLowerCase().includes(search.toLowerCase()) || 
          (trail.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
        const matchesStatus = statusFilter === 'all' || trail.status === statusFilter;
        const matchesType = typeFilter === 'all' || trail.trailType === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        const isAsc = order === 'asc';
        let comparison = 0;
        
        const aValue = (a as any)[orderBy];
        const bValue = (b as any)[orderBy];

        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        return isAsc ? comparison : -comparison;
      });
  }, [trails, search, statusFilter, typeFilter, orderBy, order]);

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setOrderBy('name');
    setOrder('asc');
    setIncludeDeleted(false);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(filteredAndSortedTrails.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkTag = async (tagId: string, action: 'add' | 'remove') => {
    if (selectedIds.length === 0) return;
    try {
      setBulkActioning(true);
      const endpoint = action === 'add' ? '/api/v1/admin/trails/bulk-add-tag' : '/api/v1/admin/trails/bulk-remove-tag';
      const result = await apiFetch<{ added?: number; removed?: number }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trailIds: selectedIds, tagId }),
      });
      const count = action === 'add' ? result.added : result.removed;
      const tagName = tags.find(t => t.id === tagId)?.name || 'tag';
      onNotify(`${action === 'add' ? 'Added' : 'Removed'} "${tagName}" ${action === 'add' ? 'to' : 'from'} ${count} trail(s)`);
      refresh();
    } catch (err) {
      onNotify(`Failed to ${action} tag`, 'error');
    } finally {
      setBulkActioning(false);
    }
  };

  const handleBulkAction = async (action: 'Delete' | 'UpdateStatus', value?: string) => {
    if (selectedIds.length === 0) return;
    
    const confirmMessage = action === 'Delete' 
        ? `Are you sure you want to delete ${selectedIds.length} trails?`
        : `Are you sure you want to update status for ${selectedIds.length} trails?`;

    if (!window.confirm(confirmMessage)) return;

    try {
        setBulkActioning(true);
        await apiFetch('/api/v1/admin/trails/bulk-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ids: selectedIds,
                action: action,
                value: value
            }),
        });
        onNotify(`Bulk action '${action}' completed successfully`);
        setSelectedIds([]);
        refresh();
    } catch (err) {
        onNotify(`Failed to perform bulk action: ${action}`, 'error');
    } finally {
        setBulkActioning(false);
    }
  };

  const handleDelete = async () => {
    if (!trailToDelete) return;
    try {
        setDeleting(true);
        await apiFetch(`/api/v1/admin/trails/${trailToDelete.id}`, { method: 'DELETE' });
        setTrailToDelete(null);
        onNotify('Trail deleted successfully');
        refresh();
    } catch (err) {
        onNotify('Failed to delete trail', 'error');
    } finally {
        setDeleting(false);
    }
  };

  const handleRestore = async (trail: any) => {
    try {
        await apiFetch(`/api/v1/admin/trails/${trail.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...trail,
                status: 'Draft',
                updatedBy: 'admin'
            }),
        });
        onNotify('Trail restored to Draft');
        refresh();
    } catch (err) {
        onNotify('Failed to restore trail', 'error');
    }
  };

  const handleUpdateStatus = async (trailId: string, newStatus: string) => {
    try {
        await apiFetch(`/api/v1/admin/trails/${trailId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStatus),
        });
        onNotify(`Trail status updated to ${newStatus}`);
        refresh();
    } catch (err) {
        onNotify('Failed to update trail status', 'error');
    }
  };

  const handleRecalculateDifficulties = async () => {
    setRecalculating(true);
    try {
        const data = await apiFetch<{ count: number }>('/api/v1/admin/trails/recalculate-all-difficulties', { method: 'POST' });
        onNotify(`Recalculated difficulty for ${data.count} trails`);
        refresh();
    } catch (err) {
        onNotify('Failed to recalculate difficulties', 'error');
    } finally {
        setRecalculating(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;

  return (
    <Box>
      {/* Header Row: Title + Quick Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Trails</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button startIcon={<RefreshIcon />} size="small" onClick={refresh}>Refresh</Button>
          <Button
            startIcon={showTools ? <ExpandLessIcon /> : <BuildIcon />}
            size="small"
            variant={showTools ? 'contained' : 'outlined'}
            onClick={() => setShowTools(!showTools)}
          >
            Tools
          </Button>
        </Stack>
      </Box>

      {/* Collapsible Tools Panel */}
      <Collapse in={showTools}>
        <Paper sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={2}>
            {/* Upload Section */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>📤 Upload</Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<CloudUploadIcon />}
                onClick={() => setShowBulkUpload(true)}
              >
                Bulk Upload GPX
              </Button>
            </Box>

            <Divider />

            {/* Maintenance Section */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>🔧 Maintenance</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Tooltip title="Recalculate difficulty for all trails based on distance, elevation and activity type">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={recalculating ? <CircularProgress size={16} /> : <CalculateIcon />}
                    onClick={handleRecalculateDifficulties}
                    disabled={recalculating}
                  >
                    Recalculate Difficulties
                  </Button>
                </Tooltip>
                <FormControlLabel
                  control={<Switch size="small" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />}
                  label={<Typography variant="body2">Show Deleted</Typography>}
                />
              </Stack>
            </Box>

            {/* Bulk Actions Section (visible when items selected) */}
            {selectedIds.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    ⚡ Bulk Actions ({selectedIds.length} selected)
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleBulkAction('Delete')}
                      disabled={bulkActioning}
                    >
                      Delete
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleBulkAction('UpdateStatus', 'Published')}
                      disabled={bulkActioning}
                    >
                      Publish
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleBulkAction('UpdateStatus', 'Draft')}
                      disabled={bulkActioning}
                    >
                      Draft
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleBulkAction('UpdateStatus', 'Archived')}
                      disabled={bulkActioning}
                    >
                      Archive
                    </Button>
                  </Stack>
                  {tags.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        <LocalOfferIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                        Add/Remove Tag:
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {tags.map(tag => (
                          <Chip
                            key={tag.id}
                            label={tag.name}
                            size="small"
                            onClick={() => handleBulkTag(tag.id, 'add')}
                            onDelete={() => handleBulkTag(tag.id, 'remove')}
                            disabled={bulkActioning}
                            sx={{
                              borderColor: tag.color || undefined,
                              '& .MuiChip-deleteIcon': { fontSize: 16 },
                            }}
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
              </>
            )}
          </Stack>
        </Paper>
      </Collapse>

      {/* Inline selection indicator (when tools panel is closed) */}
      {!showTools && selectedIds.length > 0 && (
        <Paper sx={{ mb: 2, p: 1.5, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.selected' }}>
          <Typography variant="body2" fontWeight={600}>{selectedIds.length} selected</Typography>
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => handleBulkAction('Delete')} disabled={bulkActioning}>Delete</Button>
          <Button size="small" variant="outlined" onClick={() => handleBulkAction('UpdateStatus', 'Published')} disabled={bulkActioning}>Publish</Button>
          <Button size="small" variant="outlined" onClick={() => handleBulkAction('UpdateStatus', 'Draft')} disabled={bulkActioning}>Draft</Button>
          <Button size="small" variant="outlined" onClick={() => handleBulkAction('UpdateStatus', 'Archived')} disabled={bulkActioning}>Archive</Button>
        </Paper>
      )}

      <Paper sx={{ mb: 3, p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="Draft">Draft</MenuItem>
            <MenuItem value="Published">Published</MenuItem>
            <MenuItem value="Archived">Archived</MenuItem>
            {includeDeleted && <MenuItem value="Deleted">Deleted</MenuItem>}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            label="Type"
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="Loop">Loop</MenuItem>
            <MenuItem value="OutAndBack">Out and Back</MenuItem>
            <MenuItem value="PointToPoint">Point to Point</MenuItem>
          </Select>
        </FormControl>
        <Tooltip title="Reset all filters">
          <IconButton onClick={handleResetFilters}>
            <FilterAltOffIcon />
          </IconButton>
        </Tooltip>
      </Paper>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedIds.length > 0 && selectedIds.length < filteredAndSortedTrails.length}
                  checked={filteredAndSortedTrails.length > 0 && selectedIds.length === filteredAndSortedTrails.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={() => handleRequestSort('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'length'}
                  direction={orderBy === 'length' ? order : 'asc'}
                  onClick={() => handleRequestSort('length')}
                >
                  Length (km)
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'elevationGain'}
                  direction={orderBy === 'elevationGain' ? order : 'asc'}
                  onClick={() => handleRequestSort('elevationGain')}
                >
                  Gain (m)
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'elevationLoss'}
                  direction={orderBy === 'elevationLoss' ? order : 'asc'}
                  onClick={() => handleRequestSort('elevationLoss')}
                >
                  Loss (m)
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'trailType'}
                  direction={orderBy === 'trailType' ? order : 'asc'}
                  onClick={() => handleRequestSort('trailType')}
                >
                  Type
                </TableSortLabel>
              </TableCell>
              <TableCell>Location</TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'status'}
                  direction={orderBy === 'status' ? order : 'asc'}
                  onClick={() => handleRequestSort('status')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Web</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedTrails.map((trail) => (
              <TableRow 
                key={trail.id} 
                selected={selectedIds.includes(trail.id)}
                sx={{ opacity: trail.status === 'Deleted' ? 0.6 : 1, bgcolor: trail.status === 'Deleted' ? 'action.hover' : 'inherit' }}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.includes(trail.id)}
                    onChange={() => handleSelectOne(trail.id)}
                  />
                </TableCell>
                <TableCell component="th" scope="row">
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{trail.name}</Typography>
                    {trail.description && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 300 }}>
                            {trail.description}
                        </Typography>
                    )}
                </TableCell>
                <TableCell align="right">{(trail.length / 1000).toFixed(2)}</TableCell>
                <TableCell align="right">{Math.round(trail.elevationGain)}</TableCell>
                <TableCell align="right">{Math.round(trail.elevationLoss)}</TableCell>
                <TableCell>{trail.trailType}</TableCell>
                <TableCell>
                  {trail.locations?.map(l => l.name).join(', ') || 'N/A'}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={trail.status} 
                    color={trail.status === 'Published' ? 'success' : trail.status === 'Deleted' ? 'error' : 'default'} 
                    size="small" 
                    onClick={() => {
                      if (trail.status === 'Deleted') return;
                      const nextStatus = trail.status === 'Published' ? 'Draft' : 'Published';
                      handleUpdateStatus(trail.id, nextStatus);
                    }}
                    sx={{ cursor: trail.status === 'Deleted' ? 'default' : 'pointer' }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="View trail on website">
                    <IconButton 
                      size="small" 
                      component="a" 
                      href={`https://utanvega.vercel.app/trails/${trail.slug}`} 
                      target="_blank"
                    >
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  <Button size="small" startIcon={<MapIcon />} onClick={() => setSelectedTrailMap({ id: trail.id, name: trail.name })}>Map</Button>
                  {trail.status === 'Deleted' ? (
                    <Button size="small" color="success" startIcon={<RestoreIcon />} onClick={() => handleRestore(trail)}>Restore</Button>
                  ) : (
                    <>
                      <Button size="small" startIcon={<EditIcon />} onClick={() => setSelectedTrailEdit(trail.id)}>Edit</Button>
                      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => setTrailToDelete({ id: trail.id, name: trail.name })}>Delete</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {trails.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center">No trails found. Upload a GPX to get started!</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog 
        open={Boolean(selectedTrailMap)} 
        onClose={() => setSelectedTrailMap(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
            {selectedTrailMap?.name} - Trail Map
            <IconButton
                aria-label="close"
                onClick={() => setSelectedTrailMap(null)}
                sx={{ position: 'absolute', right: 8, top: 8 }}
            >
                <CloseIcon />
            </IconButton>
        </DialogTitle>
        <DialogContent dividers>
            {selectedTrailMap && <TrailMap trailId={selectedTrailMap.id} trailName={selectedTrailMap.name} />}
        </DialogContent>
      </Dialog>

      <TrailEditDialog 
        open={Boolean(selectedTrailEdit)} 
        trailId={selectedTrailEdit} 
        onClose={() => setSelectedTrailEdit(null)} 
        onSaveSuccess={(trail) => {
            if (trail) {
              onNotify(
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">Trail '{trail.name}' updated successfully.</Typography>
                      <Link 
                        component="button"
                        onClick={() => setSelectedTrailEdit(trail.id)}
                        color="inherit" 
                        sx={{ fontWeight: 'bold', textDecoration: 'underline', verticalAlign: 'baseline', fontSize: 'inherit', p: 0 }}
                      >
                        View Trail
                      </Link>
                </Box>
              );
            } else {
              onNotify('Trail updated successfully');
            }
            refresh();
        }}
      />

      <BulkUploadDialog 
        open={showBulkUpload} 
        onClose={() => setShowBulkUpload(false)} 
        onUploadSuccess={refresh}
        onNotify={onNotify}
      />

      <Dialog open={Boolean(trailToDelete)} onClose={() => setTrailToDelete(null)}>
        <DialogTitle>Delete Trail?</DialogTitle>
        <DialogContent>
            Are you sure you want to delete <strong>{trailToDelete?.name}</strong>? This action cannot be undone.
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setTrailToDelete(null)} disabled={deleting}>Cancel</Button>
            <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
            </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function BulkUploadDialog({ open, onClose, onUploadSuccess, onNotify }: { 
  open: boolean, 
  onClose: () => void, 
  onUploadSuccess: () => void, 
  onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void 
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Bulk Upload GPX Files
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select or drag multiple GPX files. Each file will create a new trail with the filename as the trail name.
        </Typography>
        <GpxBulkUpload 
          onUploadSuccess={() => {
            onUploadSuccess();
            onClose();
          }} 
          onNotify={onNotify} 
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
