import React, { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, Container, Paper, Stack, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, PaletteMode, Divider, Autocomplete, Checkbox, FormControlLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useTickedTrails } from '../hooks/useTickedTrails';
import { useTrails } from '../hooks/useTrails';
import { useTrailActivities } from '../hooks/useTrailActivities';
import { formatSeconds, parseTimeString } from '../utils/timeFormat';

type Props = { mode: PaletteMode; onToggleMode: () => void };

export default function MyTrailsPage({ mode, onToggleMode }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tickedSlugs } = useTickedTrails();
  const { trails } = useTrails(true);
  const { activities, createActivity, updateActivity, deleteActivity } = useTrailActivities();

  const [formOpen, setFormOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form state
  const [formTrailSlug, setFormTrailSlug] = useState<string | null>(null);
  const [formTimeStr, setFormTimeStr] = useState('00:00:00');
  const [formDistance, setFormDistance] = useState<number | null>(null);
  const [formElevationGain, setFormElevationGain] = useState<number | null>(null);
  const [formLogDate, setFormLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [formIsPublic, setFormIsPublic] = useState(false);

  // Map slug to trail name - call before any early returns
  const trailNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    trails.forEach(t => { map[t.slug] = t.name; });
    return map;
  }, [trails]);

  // Get ticked trails with their activities - call before any early returns
  const tickedTrailsWithActivities = useMemo(() => {
    return Array.from(tickedSlugs).map(slug => ({
      slug,
      name: trailNameMap[slug] || slug,
      activity: activities.find(a => a.TrailSlug === slug),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tickedSlugs, trailNameMap, activities]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const handleAddResults = (slug: string) => {
    const trail = trails.find(t => t.slug === slug);
    setFormTrailSlug(slug);
    setFormTimeStr('00:00:00');
    setFormDistance(trail?.length || null);
    setFormElevationGain(trail?.elevationGain || null);
    setFormLogDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormIsPublic(false);
    setEditingActivityId(null);
    setFormOpen(true);
  };

  const handleEditActivity = (activityId: string) => {
    const activity = activities.find(a => a.Id === activityId);
    if (activity) {
      setFormTrailSlug(activity.TrailSlug);
      setFormTimeStr(formatSeconds(activity.Time));
      setFormDistance(activity.Distance || null);
      setFormElevationGain(activity.ElevationGain || null);
      setFormLogDate(activity.LogDate || new Date().toISOString().split('T')[0]);
      setFormNotes(activity.Notes || '');
      setFormIsPublic(activity.IsPublic);
      setEditingActivityId(activityId);
      setFormOpen(true);
    }
  };

  const handleFormSubmit = async () => {
    if (!formTrailSlug || !formTimeStr.trim()) return;
    
    const time = parseTimeString(formTimeStr);
    if (time === 0) {
      alert(t('activity.invalidTime') || 'Invalid time format');
      return;
    }

    try {
      if (editingActivityId) {
        // Update existing activity
        await updateActivity(editingActivityId, {
          Time: time,
          Distance: formDistance || undefined,
          ElevationGain: formElevationGain || undefined,
          LogDate: formLogDate,
          Notes: formNotes,
          IsPublic: formIsPublic,
        });
      } else {
        // Create new activity
        await createActivity({
          TrailSlug: formTrailSlug,
          Time: time,
          Distance: formDistance || undefined,
          ElevationGain: formElevationGain || undefined,
          LogDate: formLogDate,
          Notes: formNotes,
          IsPublic: formIsPublic,
        });
      }
      handleCloseForm();
    } catch (error) {
      console.error('Failed to save activity:', error);
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

          {tickedTrailsWithActivities.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              {t('profile.noTickedTrails')}
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>{t('activity.trail')}</TableCell>
                    <TableCell align="right">{t('activity.time')}</TableCell>
                    <TableCell>{t('activity.notes')}</TableCell>
                    <TableCell align="center">{t('common.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tickedTrailsWithActivities.map(item => (
                    <TableRow key={item.slug}>
                      <TableCell sx={{ fontWeight: 500 }}>{item.name}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                        {item.activity ? formatSeconds(item.activity.Time) : '-'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.activity?.Notes || '-'}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          {item.activity ? (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => handleEditActivity(item.activity!.Id)}
                                title={t('common.edit')}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteConfirmId(item.activity!.Id)}
                                title={t('common.delete')}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </>
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
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* Activity Form Dialog */}
        <Dialog open={formOpen} onClose={handleCloseForm} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingActivityId ? t('profile.editResults') : t('profile.addResults')}
          </DialogTitle>
          <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
              label={t('activity.time')}
              value={formTimeStr}
              onChange={(e) => setFormTimeStr(e.target.value)}
              placeholder="HH:MM:SS"
              helperText="Format: HH:MM:SS or MM:SS"
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
              label={t('activity.date')}
              type="date"
              value={formLogDate}
              onChange={(e) => setFormLogDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
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
