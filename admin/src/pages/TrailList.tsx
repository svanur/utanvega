import { Typography, CircularProgress, Alert, Box, Link, Stack, Button, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import BuildIcon from '@mui/icons-material/Build';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useEffect, useMemo, useState } from 'react';
import { useTrails, Trail } from '../hooks/useTrails';
import { useTags } from '../hooks/useTags';
import { apiFetch } from '../hooks/api';
import TrailEditDialog from '../components/TrailEditDialog';
import TrailToolsPanel from '../components/TrailToolsPanel';
import TrailFilterBar from '../components/TrailFilterBar';
import TrailTable from '../components/TrailTable';
import { TrailMapDialog, DeleteTrailDialog, BulkUploadDialog } from '../components/TrailDialogs';

export default function TrailList({ onNotify, initialTrailId, initialSearch }: { onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void, initialTrailId?: string | null, initialSearch?: string | null }) {
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

  useEffect(() => {
    const handler = () => setShowTools(prev => !prev);
    window.addEventListener('admin:toggle-tools', handler);
    return () => window.removeEventListener('admin:toggle-tools', handler);
  }, []);

  const [search, setSearch] = useState(initialSearch || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [orderBy, setOrderBy] = useState<string>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const locationOptions = useMemo(() => {
    const names = new Set<string>();
    trails.forEach(t => t.locations?.forEach(l => names.add(l.name)));
    return [...names].sort();
  }, [trails]);

  const filteredAndSortedTrails = useMemo(() => {
    return trails
      .filter((trail) => {
        const matchesSearch = 
          trail.name.toLowerCase().includes(search.toLowerCase()) || 
          trail.slug.toLowerCase().includes(search.toLowerCase()) ||
          (trail.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
        const matchesStatus = statusFilter === 'all' || trail.status === statusFilter;
        const matchesType = typeFilter === 'all' || trail.trailType === typeFilter;
        const matchesDifficulty = difficultyFilter === 'all' || trail.difficulty === difficultyFilter;
        const matchesActivity = activityFilter === 'all' || trail.activityType === activityFilter;
        const matchesLocation = locationFilter === 'all' 
          || (locationFilter === 'none' && (!trail.locations || trail.locations.length === 0))
          || trail.locations?.some(l => l.name === locationFilter);
        return matchesSearch && matchesStatus && matchesType && matchesDifficulty && matchesActivity && matchesLocation;
      })
      .sort((a, b) => {
        const isAsc = order === 'asc';
        let comparison = 0;
        
        const aValue = (a as unknown as Record<string, string | number>)[orderBy];
        const bValue = (b as unknown as Record<string, string | number>)[orderBy];

        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        return isAsc ? comparison : -comparison;
      });
  }, [trails, search, statusFilter, typeFilter, difficultyFilter, activityFilter, locationFilter, orderBy, order]);

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDifficultyFilter('all');
    setActivityFilter('all');
    setLocationFilter('all');
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
    } catch (_err) {
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
    } catch (_err) {
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
    } catch (_err) {
        onNotify('Failed to delete trail', 'error');
    } finally {
        setDeleting(false);
    }
  };

  const handleRestore = async (trail: Trail) => {
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
    } catch (_err) {
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
    } catch (_err) {
        onNotify('Failed to update trail status', 'error');
    }
  };

  const handlePatchTrail = async (trailId: string, field: string, value: string) => {
    await apiFetch(`/api/v1/admin/trails/${trailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trailId, [field]: value }),
    });
    onNotify(`Updated ${field}`);
    refresh();
  };

  const handleRecalculateDifficulties = async () => {
    setRecalculating(true);
    try {
        const data = await apiFetch<{ count: number }>('/api/v1/admin/trails/recalculate-all-difficulties', { method: 'POST' });
        onNotify(`Recalculated difficulty for ${data.count} trails`);
        refresh();
    } catch (_err) {
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
        <Typography variant="h4">
          Trails <Chip label={filteredAndSortedTrails.length} size="small" color="primary" sx={{ ml: 1, verticalAlign: 'middle' }} />
        </Typography>
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

      <TrailToolsPanel
        showTools={showTools}
        selectedIds={selectedIds}
        includeDeleted={includeDeleted}
        onIncludeDeletedChange={setIncludeDeleted}
        onShowBulkUpload={() => setShowBulkUpload(true)}
        recalculating={recalculating}
        bulkActioning={bulkActioning}
        tags={tags}
        onRecalculateDifficulties={handleRecalculateDifficulties}
        onBulkAction={handleBulkAction}
        onBulkTag={handleBulkTag}
      />

      <TrailFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        difficultyFilter={difficultyFilter}
        onDifficultyFilterChange={setDifficultyFilter}
        activityFilter={activityFilter}
        onActivityFilterChange={setActivityFilter}
        locationFilter={locationFilter}
        onLocationFilterChange={setLocationFilter}
        locationOptions={locationOptions}
        includeDeleted={includeDeleted}
        onResetFilters={handleResetFilters}
      />

      <TrailTable
        trails={filteredAndSortedTrails}
        selectedIds={selectedIds}
        orderBy={orderBy}
        order={order}
        onRequestSort={handleRequestSort}
        onSelectAll={handleSelectAll}
        onSelectOne={handleSelectOne}
        onViewMap={setSelectedTrailMap}
        onEdit={setSelectedTrailEdit}
        onDelete={setTrailToDelete}
        onRestore={handleRestore}
        onUpdateStatus={handleUpdateStatus}
        onPatchTrail={handlePatchTrail}
      />

      <TrailMapDialog trail={selectedTrailMap} onClose={() => setSelectedTrailMap(null)} />

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

      <DeleteTrailDialog
        trail={trailToDelete}
        deleting={deleting}
        onClose={() => setTrailToDelete(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}
