import { Typography, CircularProgress, Alert, Box, Stack, Button, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import BuildIcon from '@mui/icons-material/Build';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrails, Trail } from '../hooks/useTrails';
import { useTags } from '../hooks/useTags';
import { useLocations } from '../hooks/useLocations';
import { useRowFocus } from '../hooks/useRowFocus';
import { useUrlFilterState } from '../hooks/useUrlFilterState';
import { apiFetch } from '../hooks/api';
import TrailToolsPanel from '../components/TrailToolsPanel';
import TrailFilterBar from '../components/TrailFilterBar';
import TrailTable from '../components/TrailTable';
import { TrailMapDialog, DeleteTrailDialog, BulkUploadDialog } from '../components/TrailDialogs';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Mirrors the options TrailFilterBar actually offers — an unrecognized value (stale bookmark,
// hand-edited URL) falls back to the field's default rather than silently filtering to nothing.
const TRAILS_FILTER_SCHEMA = {
  search: { default: '' },
  statusFilter: { default: 'all', allowed: ['all', 'Draft', 'Published', 'EventOnly', 'Archived'] },
  typeFilter: { default: 'all', allowed: ['all', 'Loop', 'OutAndBack', 'PointToPoint'] },
  activityFilter: { default: 'all', allowed: ['all', 'TrailRunning', 'Running', 'Hiking', 'Cycling'] },
  locationFilter: { default: 'all' },
  yearFilter: { default: 'all' },
  monthFilter: { default: 'all', allowed: ['all', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] },
  orderBy: { default: 'updatedAt', allowed: ['name', 'length', 'elevationGain', 'trailType', 'status', 'updatedAt'] },
  order: { default: 'desc', allowed: ['asc', 'desc'] },
  needsReviewOnly: { default: 'false', allowed: ['true', 'false'] },
  includeArchived: { default: 'false', allowed: ['true', 'false'] },
} as const;

export default function TrailsListPage({ onNotify }: { onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void }) {
  const navigate = useNavigate();
  const { values, setValue, setValues, reset: resetUrlFilters } = useUrlFilterState(TRAILS_FILTER_SCHEMA);
  const search = values.search;
  const setSearch = useCallback((v: string) => setValue('search', v), [setValue]);
  const statusFilter = values.statusFilter;
  const typeFilter = values.typeFilter;
  const activityFilter = values.activityFilter;
  const locationFilter = values.locationFilter;
  const yearFilter = values.yearFilter;
  const monthFilter = values.monthFilter;
  const orderBy = values.orderBy;
  const order = values.order as 'asc' | 'desc';
  const needsReviewOnly = values.needsReviewOnly === 'true';
  const includeArchived = values.includeArchived === 'true';
  const setIncludeArchived = useCallback((v: boolean) => setValue('includeArchived', v ? 'true' : 'false'), [setValue]);

  const { trails, setTrails, loading, error, refresh } = useTrails(includeArchived);
  const { tags } = useTags();
  const { locations: allLocations } = useLocations();
  const [selectedTrailMap, setSelectedTrailMap] = useState<Trail | null>(null);
  const [trailToDelete, setTrailToDelete] = useState<{ id: string, name: string, slug?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActioning, setBulkActioning] = useState(false);
  const [showTools, setShowTools] = useState(false);

  useEffect(() => {
    const handler = () => setShowTools(prev => !prev);
    window.addEventListener('admin:toggle-tools', handler);
    return () => window.removeEventListener('admin:toggle-tools', handler);
  }, []);

  const locationOptions = useMemo(() => {
    const names = new Set<string>();
    trails.forEach(t => t.locations?.forEach(l => names.add(l.name)));
    return [...names].sort();
  }, [trails]);

  const yearOptions = useMemo(() => {
    const years = trails
      .map(t => (t.updatedAt ?? t.createdAt)?.slice(0, 4))
      .filter((y): y is string => !!y);
    return [...new Set(years)].sort((a, b) => b.localeCompare(a));
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
        const matchesActivity = activityFilter === 'all' || trail.activityType === activityFilter;
        const matchesLocation = locationFilter === 'all'
          || (locationFilter === 'none' && (!trail.locations || trail.locations.length === 0))
          || trail.locations?.some(l => l.name === locationFilter);
        const matchesYear = yearFilter === 'all' || (trail.updatedAt ?? trail.createdAt ?? '').slice(0, 4) === yearFilter;
        const matchesMonth = monthFilter === 'all' || (trail.updatedAt ?? trail.createdAt ?? '').slice(5, 7) === monthFilter;
        const matchesReview = !needsReviewOnly || trail.needsReview === true;
        return matchesSearch && matchesStatus && matchesType && matchesActivity && matchesLocation && matchesYear && matchesMonth && matchesReview;
      })
      .sort((a, b) => {
        const isAsc = order === 'asc';
        let comparison = 0;

        if (orderBy === 'updatedAt') {
          const aDate = a.updatedAt ?? a.createdAt;
          const bDate = b.updatedAt ?? b.createdAt;
          const aTime = aDate ? new Date(aDate).getTime() : 0;
          const bTime = bDate ? new Date(bDate).getTime() : 0;
          comparison = aTime - bTime;
        } else {
          const aValue = (a as unknown as Record<string, string | number>)[orderBy];
          const bValue = (b as unknown as Record<string, string | number>)[orderBy];
          if (aValue < bValue) comparison = -1;
          if (aValue > bValue) comparison = 1;
        }

        return isAsc ? comparison : -comparison;
      });
  }, [trails, search, statusFilter, typeFilter, activityFilter, locationFilter, yearFilter, monthFilter, orderBy, order, needsReviewOnly]);

  // j/k row focus + Enter/o to open — independent of the checkbox selection above.
  const { focusedIndex: focusedTrailIndex } = useRowFocus(filteredAndSortedTrails, (t) => navigate(`/trails/${t.slug}`));
  const focusedTrailId = filteredAndSortedTrails[focusedTrailIndex]?.id ?? null;

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setValues({ orderBy: property, order: isAsc ? 'desc' : 'asc' });
  };

  const handleResetFilters = () => {
    resetUrlFilters();
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(filteredAndSortedTrails.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

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
      const tag = tags.find(t => t.id === tagId);
      const tagName = tag?.name || 'tag';
      onNotify(`${action === 'add' ? 'Added' : 'Removed'} "${tagName}" ${action === 'add' ? 'to' : 'from'} ${count} trail(s)`);
      const selectedSet = new Set(selectedIds);
      setTrails(prev => prev.map(t => {
        if (!selectedSet.has(t.id)) return t;
        const current = t.tags ?? [];
        if (action === 'add') {
          if (!tag || current.some(ct => ct.slug === tag.slug)) return t;
          return { ...t, tags: [...current, { name: tag.name, slug: tag.slug, color: tag.color }] };
        }
        return { ...t, tags: current.filter(ct => ct.slug !== tag?.slug) };
      }));
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

  const handleRestore = useCallback(async (trail: Trail) => {
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
        onNotify('Trail restored to Hidden');
        setTrails(prev => prev.map(t => t.id === trail.id ? { ...t, status: 'Draft' as const } : t));
    } catch (_err) {
        onNotify('Failed to restore trail', 'error');
    }
  }, [onNotify, setTrails]);

  const handleUpdateStatus = useCallback(async (trailId: string, newStatus: string) => {
    try {
        await apiFetch(`/api/v1/admin/trails/${trailId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStatus),
        });
        onNotify(`Trail status updated to ${newStatus}`);
        setTrails(prev => prev.map(t => t.id === trailId ? { ...t, status: newStatus as Trail['status'] } : t));
    } catch (_err) {
        onNotify('Failed to update trail status', 'error');
    }
  }, [onNotify, setTrails]);

  const handlePatchTrail = useCallback(async (trailId: string, field: string, value: string) => {
    await apiFetch(`/api/v1/admin/trails/${trailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trailId, [field]: value }),
    });
    onNotify(`Updated ${field}`);
    setTrails(prev => prev.map(t => t.id === trailId ? { ...t, [field]: value } : t));
  }, [onNotify, setTrails]);

  const handleAddLocation = useCallback(async (trailId: string, locationId: string, role: string = 'BelongsTo') => {
    try {
      await apiFetch(`/api/v1/admin/trails/${trailId}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, role }),
      });
      const loc = allLocations.find(l => l.id === locationId);
      if (loc) {
        setTrails(prev => prev.map(t => t.id === trailId ? {
          ...t,
          locations: [...(t.locations || []), { id: loc.id, name: loc.name, slug: loc.slug, role }],
        } : t));
      }
      onNotify('Location added');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to add location', 'error');
    }
  }, [allLocations, onNotify, setTrails]);

  const handleRemoveLocation = useCallback(async (trailId: string, locationId: string) => {
    try {
      await apiFetch(`/api/v1/admin/trails/${trailId}/locations/${locationId}`, {
        method: 'DELETE',
      });
      setTrails(prev => prev.map(t => t.id === trailId ? {
        ...t,
        locations: (t.locations || []).filter(l => l.id !== locationId),
      } : t));
      onNotify('Location removed');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to remove location', 'error');
    }
  }, [onNotify, setTrails]);

  const handleAddTag = useCallback(async (trailId: string, tagId: string) => {
    try {
      await apiFetch('/api/v1/admin/trails/bulk-add-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trailIds: [trailId], tagId }),
      });
      const tag = tags.find(t => t.id === tagId);
      if (tag) {
        setTrails(prev => prev.map(t => t.id === trailId ? {
          ...t,
          tags: [...(t.tags || []), { name: tag.name, slug: tag.slug, color: tag.color }],
        } : t));
      }
      onNotify(`Tag "${tag?.name}" added`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to add tag', 'error');
    }
  }, [tags, onNotify, setTrails]);

  const handleRemoveTag = useCallback(async (trailId: string, tagId: string) => {
    try {
      await apiFetch('/api/v1/admin/trails/bulk-remove-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trailIds: [trailId], tagId }),
      });
      const tag = tags.find(t => t.id === tagId);
      setTrails(prev => prev.map(t => t.id === trailId ? {
        ...t,
        tags: (t.tags || []).filter(tg => tg.slug !== tag?.slug),
      } : t));
      onNotify(`Tag "${tag?.name}" removed`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to remove tag', 'error');
    }
  }, [tags, onNotify, setTrails]);


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
          <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setShowBulkUpload(true)}>
            New Trail
          </Button>
        </Stack>
      </Box>

      <TrailToolsPanel
        showTools={showTools}
        selectedIds={selectedIds}
        includeArchived={includeArchived}
        onIncludeArchivedChange={setIncludeArchived}
        onShowBulkUpload={() => setShowBulkUpload(true)}
        bulkActioning={bulkActioning}
        tags={tags}
        onBulkAction={handleBulkAction}
        onBulkTag={handleBulkTag}
      />

      <TrailFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={(s) => {
          // The API omits archived trails unless asked for them, so filtering by Archived
          // without this returns an empty table no matter how many archived trails exist.
          setValues(s === 'Archived' ? { statusFilter: s, includeArchived: 'true' } : { statusFilter: s });
        }}
        typeFilter={typeFilter}
        onTypeFilterChange={(v) => setValue('typeFilter', v)}
        activityFilter={activityFilter}
        onActivityFilterChange={(v) => setValue('activityFilter', v)}
        locationFilter={locationFilter}
        onLocationFilterChange={(v) => setValue('locationFilter', v)}
        locationOptions={locationOptions}
        yearFilter={yearFilter}
        onYearFilterChange={(y) => setValues({ yearFilter: y, monthFilter: 'all' })}
        monthFilter={monthFilter}
        onMonthFilterChange={(v) => setValue('monthFilter', v)}
        yearOptions={yearOptions}
        months={MONTHS}
        includeArchived={includeArchived}
        needsReviewOnly={needsReviewOnly}
        onNeedsReviewOnlyChange={(v) => setValue('needsReviewOnly', v ? 'true' : 'false')}
        onResetFilters={handleResetFilters}
      />

      <TrailTable
        trails={filteredAndSortedTrails}
        selectedIds={selectedIds}
        focusedId={focusedTrailId}
        orderBy={orderBy}
        order={order}
        onRequestSort={handleRequestSort}
        onSelectAll={handleSelectAll}
        onSelectOne={handleSelectOne}
        onViewMap={(t) => setSelectedTrailMap(trails.find(x => x.id === t.id) ?? null)}
        onRowClick={(t) => navigate(`/trails/${t.slug}`)}
        onRestore={handleRestore}
        onPatchTrail={handlePatchTrail}
        allLocations={allLocations}
        onAddLocation={handleAddLocation}
        onRemoveLocation={handleRemoveLocation}
        allTags={tags}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
      />

      <TrailMapDialog trail={selectedTrailMap} onClose={() => setSelectedTrailMap(null)} />

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
