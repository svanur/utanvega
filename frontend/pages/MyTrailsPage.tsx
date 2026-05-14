import React, { useState, useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert, Button, CircularProgress, Container, Paper, Stack, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, PaletteMode, Autocomplete, Checkbox, FormControlLabel, ToggleButton, ToggleButtonGroup, TableSortLabel, InputAdornment,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import Layout from '../components/Layout';
import TimePickerInput from '../components/TimePickerInput';
import { useAuth } from '../hooks/useAuth';
import { useTickedTrails } from '../hooks/useTickedTrails';
import { useTrails } from '../hooks/useTrails';
import { useTrailActivities } from '../hooks/useTrailActivities';
import { formatDateWithMonths, formatSeconds, parseTimeString } from '../utils/timeFormat';
import { aggregateTrailActivities } from '../utils/trailActivityAggregator';

type Props = { mode: PaletteMode; onToggleMode: () => void };
type MyTrailsSortKey = 'trail' | 'date' | 'time' | 'distance' | 'elevation';

export default function MyTrailsPage({ mode, onToggleMode }: Props) {
  const { t, i18n } = useTranslation();
  const months = t('races.months', { returnObjects: true }) as unknown as string[];
  const { user } = useAuth();
  const { tickedSlugs, loading } = useTickedTrails();
  const { trails } = useTrails(true);
  const { activities, loading: activitiesLoading, createActivity, updateActivity, deleteActivity } = useTrailActivities();

  const [formOpen, setFormOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'recent' | 'best'>('recent');
  const [sortBy, setSortBy] = useState<MyTrailsSortKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [formTrailSlug, setFormTrailSlug] = useState<string | null>(null);
  const [formTimeStr, setFormTimeStr] = useState('00:00:00');
  const [formDistance, setFormDistance] = useState<number | null>(null);
  const [formElevationGain, setFormElevationGain] = useState<number | null>(null);
  const [formLogDate, setFormLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [formIsPublic, setFormIsPublic] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Map slug to trail name - call before any early returns
  const trailNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    trails.forEach(t => { map[t.slug] = t.name; });
    return map;
  }, [trails]);

  // Get ticked trails with their most recent activity - call before any early returns
  const aggregatedTrails = useMemo(() => {
    return aggregateTrailActivities(tickedSlugs, activities, trailNameMap);
  }, [tickedSlugs, activities, trailNameMap]);

  const sortedAggregatedTrails = useMemo(() => {
    const sorted = [...aggregatedTrails];
    const dir = sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      const activityA = viewMode === 'recent' ? a.mostRecentActivity : a.bestActivity;
      const activityB = viewMode === 'recent' ? b.mostRecentActivity : b.bestActivity;

      switch (sortBy) {
        case 'trail':
          return a.name.localeCompare(b.name) * dir;
        case 'date': {
          const dateA = activityA?.logDate ?? activityA?.createdAt ?? '';
          const dateB = activityB?.logDate ?? activityB?.createdAt ?? '';
          return dateA.localeCompare(dateB) * dir;
        }
        case 'time': {
          const valueA = activityA?.timeInSeconds ?? 0;
          const valueB = activityB?.timeInSeconds ?? 0;
          return (valueA - valueB) * dir;
        }
        case 'distance': {
          const valueA = Number(activityA?.distance ?? 0);
          const valueB = Number(activityB?.distance ?? 0);
          return (valueA - valueB) * dir;
        }
        case 'elevation': {
          const valueA = activityA?.elevationGain ?? 0;
          const valueB = activityB?.elevationGain ?? 0;
          return (valueA - valueB) * dir;
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [aggregatedTrails, sortBy, sortDirection, viewMode]);

  const visibleAggregatedTrails = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedAggregatedTrails;
    return sortedAggregatedTrails.filter(item =>
      item.name.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query)
    );
  }, [sortedAggregatedTrails, searchQuery]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const handleAddResults = (slug: string) => {
    const trail = trails.find(t => t.slug === slug);
    const defaultDistanceKm = typeof trail?.length === 'number' && Number.isFinite(trail.length)
      ? Math.round((trail.length / 1000) * 10) / 10
      : null;
    const defaultElevation = typeof trail?.elevationGain === 'number' && Number.isFinite(trail.elevationGain)
      ? Math.round(trail.elevationGain)
      : null;
    setFormTrailSlug(slug);
    setFormTimeStr('00:00:00');
    setFormDistance(defaultDistanceKm);
    setFormElevationGain(defaultElevation);
    setFormLogDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormIsPublic(false);
    setEditingActivityId(null);
    setFormOpen(true);
  };

  const handleEditActivity = (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
      setFormTrailSlug(activity.trailSlug);
      setFormTimeStr(formatSeconds(activity.timeInSeconds));
      setFormDistance(
        activity.distance != null
          ? Math.round(Number(activity.distance) * 10) / 10
          : null
      );
      setFormElevationGain(activity.elevationGain || null);
      setFormLogDate(activity.logDate || new Date().toISOString().split('T')[0]);
      setFormNotes(activity.notes || '');
      setFormIsPublic(activity.isPublic);
      setEditingActivityId(activityId);
      setFormOpen(true);
    }
  };

  const handleFormSubmit = async () => {
    if (!formTrailSlug || !formTimeStr.trim()) return;
    
    const timeInSeconds = parseTimeString(formTimeStr);
    if (timeInSeconds === 0) {
      setFormError(t('activity.invalidTime') || 'Invalid time format');
      return;
    }

    try {
      setFormError(null);
      // Ensure numeric fields are properly typed
      const distance = formDistance && !isNaN(formDistance) ? Number(formDistance) : null;
      const elevation = formElevationGain !== null && Number.isFinite(formElevationGain)
        ? Math.round(formElevationGain)
        : null;

      if (editingActivityId) {
        // Update existing activity
        await updateActivity(editingActivityId, {
          LogDate: formLogDate,
          TimeInSeconds: timeInSeconds,
          Distance: distance || undefined,
          ElevationGain: elevation || undefined,
          Notes: formNotes,
          IsPublic: formIsPublic,
        });
      } else {
        // Create new activity
        await createActivity({
          TrailSlug: formTrailSlug,
          LogDate: formLogDate,
          TimeInSeconds: timeInSeconds,
          Distance: distance || undefined,
          ElevationGain: elevation || undefined,
          Notes: formNotes,
          IsPublic: formIsPublic,
        });
      }
      handleCloseForm();
    } catch (error) {
      console.error('Failed to save activity:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save activity';
      setFormError(errorMessage);
    }
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingActivityId(null);
    setFormTrailSlug(null);
    setFormTimeStr('00:00:00');
    setFormDistance(null);
    setFormElevationGain(null);
    setFormLogDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormIsPublic(false);
    setFormError(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteActivity(deleteConfirmId);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const selectedTrail = trails.find(t => t.slug === formTrailSlug);

  const handleSort = (key: MyTrailsSortKey) => {
    if (sortBy === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(key);
    setSortDirection(key === 'trail' ? 'asc' : 'desc');
  };

  return (
    <Layout mode={mode} onToggleMode={onToggleMode}>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => window.history.back()} sx={{ mb: 2 }}>
          {t('trail.backToProfile')}
        </Button>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
            {t('profile.myTrails')}
          </Typography>

          {loading || activitiesLoading ? (
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 4 }}>
              <CircularProgress size={20} />
              <Typography color="text.secondary">{t('profile.loadingTicks')}</Typography>
            </Stack>
          ) : aggregatedTrails.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              {t('profile.noTickedTrails')}
            </Typography>
          ) : (
            <>
              <Stack direction="row" spacing={1} sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, newValue) => {
                    if (newValue !== null) setViewMode(newValue);
                  }}
                  size="small"
                >
                  <ToggleButton value="recent">
                    {t('myTrails.mostRecent')}
                  </ToggleButton>
                  <ToggleButton value="best">
                    {t('myTrails.bestResults')}
                  </ToggleButton>
                </ToggleButtonGroup>
                <TextField
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('myTrails.searchPlaceholder', 'Search trails')}
                  InputProps={{
                    endAdornment: searchQuery ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setSearchQuery('')}
                          aria-label={t('common.clear', 'Clear search')}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  }}
                  sx={{ minWidth: 220 }}
                />
              </Stack>
              <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'trail'}
                        direction={sortBy === 'trail' ? sortDirection : 'asc'}
                        onClick={() => handleSort('trail')}
                      >
                        {t('activity.trail')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">
                      <TableSortLabel
                        active={sortBy === 'date'}
                        direction={sortBy === 'date' ? sortDirection : 'asc'}
                        onClick={() => handleSort('date')}
                      >
                        {t('activity.date')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sortBy === 'time'}
                        direction={sortBy === 'time' ? sortDirection : 'asc'}
                        onClick={() => handleSort('time')}
                      >
                        {t('activity.time')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sortBy === 'distance'}
                        direction={sortBy === 'distance' ? sortDirection : 'asc'}
                        onClick={() => handleSort('distance')}
                      >
                        {t('activity.distance')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sortBy === 'elevation'}
                        direction={sortBy === 'elevation' ? sortDirection : 'asc'}
                        onClick={() => handleSort('elevation')}
                      >
                        {t('activity.elevationGain')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">{t('common.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleAggregatedTrails.map((item, idx) => {
                    const displayActivity = viewMode === 'recent' ? item.mostRecentActivity : item.bestActivity;
                    return (
                      <TableRow key={`${item.slug}-${idx}`}>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {item.activityCount > 1 ? (
                            <Link to={`/my/trails/${item.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                              {item.name} <Typography component="span" sx={{ fontSize: '0.8em', color: 'text.secondary' }}>({item.activityCount})</Typography>
                            </Link>
                          ) : (
                            item.name
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {formatDateWithMonths(displayActivity?.logDate, months, i18n.language === 'is')}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                          {displayActivity ? formatSeconds(displayActivity.timeInSeconds) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {displayActivity?.distance ? `${Number(displayActivity.distance).toFixed(1)} km` : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {displayActivity?.elevationGain ? `${displayActivity.elevationGain} m` : '-'}
                        </TableCell>
                        <TableCell align="center">
                          {displayActivity ? (
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Button
                                size="small"
                                variant="outlined"
                                component={Link}
                                to={`/my/trails/${item.slug}`}
                              >
                                {t('common.view')} {t('activity.activities')}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={() => handleAddResults(item.slug)}
                              >
                                {t('common.add')}
                              </Button>
                            </Stack>
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<AddIcon />}
                              onClick={() => handleAddResults(item.slug)}
                            >
                              {t('profile.addResults')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {visibleAggregatedTrails.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        {t('spotlight.noResults')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            </>
          )}
        </Paper>

        {/* Activity Form Dialog */}
        <Dialog open={formOpen} onClose={handleCloseForm} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingActivityId ? t('profile.editResults') : t('profile.addResults')}
          </DialogTitle>
          <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {formError && (
              <Alert severity="error">{formError}</Alert>
            )}
            <Autocomplete
              options={trails}
              getOptionLabel={(option) => option.name}
              value={selectedTrail ?? null}
              onChange={(_, value) => setFormTrailSlug(value?.slug ?? null)}
              renderInput={(params) => (
                <TextField {...params} label={t('activity.selectTrail')} required />
              )}
              disabled={!!editingActivityId}
            />

            <TextField
              label={t('activity.date')}
              type="date"
              value={formLogDate}
              onChange={(e) => setFormLogDate(e.target.value)}
              inputProps={{ lang: i18n.language === 'is' ? 'is-IS' : 'en-GB' }}
              helperText={formatDateWithMonths(formLogDate, months, i18n.language === 'is')}
              InputLabelProps={{ shrink: true }}
            />

            <TimePickerInput
              label={t('activity.time')}
              value={formTimeStr}
              onChange={setFormTimeStr}
              helperText="Use arrow keys ↑↓ to adjust hours/minutes/seconds"
            />

            <TextField
              label={t('activity.distance')}
              type="number"
              inputProps={{ step: '0.1', min: '0' }}
              value={formDistance !== null ? formDistance : ''}
              onChange={(e) => setFormDistance(e.target.value ? parseFloat(e.target.value) : null)}
              helperText={t('activity.distanceUnit')}
            />

            <TextField
              label={t('activity.elevationGain')}
              type="number"
              inputProps={{ step: '1', min: '0' }}
              value={formElevationGain !== null ? formElevationGain : ''}
              onChange={(e) => setFormElevationGain(e.target.value ? parseInt(e.target.value) : null)}
              helperText={t('activity.elevationUnit')}
            />

            <TextField
              label={t('activity.notes')}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              multiline
              rows={3}
              placeholder={t('activity.notesPlaceholder')}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formIsPublic}
                  onChange={(e) => setFormIsPublic(e.target.checked)}
                />
              }
              label={t('activity.makePublic')}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseForm}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleFormSubmit}
              variant="contained"
              disabled={!formTrailSlug || !formTimeStr}
            >
              {t('activity.save')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
          <DialogTitle>{t('profile.deleteResults')}</DialogTitle>
          <DialogContent>
            {t('profile.confirmDelete')}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmId(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleDelete} color="error" variant="contained">
              {t('common.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}
