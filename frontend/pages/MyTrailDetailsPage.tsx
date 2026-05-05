import React, { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, PaletteMode, Autocomplete,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useTrails } from '../hooks/useTrails';
import { useTrailActivities } from '../hooks/useTrailActivities';
import { formatSeconds, parseTimeString } from '../utils/timeFormat';

type Props = { mode: PaletteMode; onToggleMode: () => void };

export default function MyTrailDetailsPage({ mode, onToggleMode }: Props) {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { trails, loading: trailsLoading } = useTrails(true);
  const { activities, loading: activitiesLoading, updateActivity, deleteActivity } = useTrailActivities();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingActivityId, setEditingActivityId] = React.useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  
  // Form state
  const [formTimeStr, setFormTimeStr] = React.useState('00:00:00');
  const [formDistance, setFormDistance] = React.useState<number | null>(null);
  const [formElevationGain, setFormElevationGain] = React.useState<number | null>(null);
  const [formLogDate, setFormLogDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = React.useState('');
  const [formIsPublic, setFormIsPublic] = React.useState(false);

  // Get trail info and activities
  const trail = useMemo(() => trails.find(t => t.slug === slug), [trails, slug]);
  const trailActivities = useMemo(
    () => activities
      .filter(a => a.trailSlug === slug)
      .sort((a, b) => {
        const dateA = a.logDate ? new Date(a.logDate).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.logDate ? new Date(b.logDate).getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      }),
    [activities, slug]
  );

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Wait for data to load
  if (trailsLoading || activitiesLoading) {
    return (
      <Layout mode={mode} onToggleMode={onToggleMode}>
        <Container maxWidth="md" sx={{ py: 3, textAlign: 'center' }}>
          <CircularProgress />
        </Container>
      </Layout>
    );
  }

  // Only redirect if data has loaded and trail/activities don't exist
  if (!trail || trailActivities.length === 0) {
    return <Navigate to="/my/trails" replace />;
  }

  const handleEditActivity = (activityId: string) => {
    const activity = trailActivities.find(a => a.id === activityId);
    if (activity) {
      setFormTimeStr(formatSeconds(activity.timeInSeconds));
      setFormDistance(activity.distance || null);
      setFormElevationGain(activity.elevationGain || null);
      setFormLogDate(activity.logDate || new Date().toISOString().split('T')[0]);
      setFormNotes(activity.notes || '');
      setFormIsPublic(activity.isPublic);
      setEditingActivityId(activityId);
      setFormOpen(true);
    }
  };

  const handleFormSubmit = async () => {
    if (!formTimeStr.trim() || !editingActivityId) return;
    
    const time = parseTimeString(formTimeStr);
    if (time === 0) {
      setFormError(t('activity.invalidTime') || 'Invalid time format');
      return;
    }

    setFormError(null);
    try {
      await updateActivity(editingActivityId, {
        TimeInSeconds: time,
        Distance: formDistance || undefined,
        ElevationGain: formElevationGain || undefined,
        LogDate: formLogDate,
        Notes: formNotes,
        IsPublic: formIsPublic,
      });
      setFormOpen(false);
      setEditingActivityId(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update activity');
    }
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingActivityId(null);
    setFormError(null);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId) {
      try {
        await deleteActivity(deleteConfirmId);
        setDeleteConfirmId(null);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete activity';
        setFormError(errorMessage);
      }
    }
  };

  return (
    <Layout mode={mode} onToggleMode={onToggleMode}>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => window.history.back()} sx={{ mb: 2 }}>
          {t('trail.backToProfile')}
        </Button>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
            {trail.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {trailActivities.length} {trailActivities.length === 1 ? 'activity' : 'activities'} logged
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell align="center">{t('activity.date')}</TableCell>
                  <TableCell align="right">{t('activity.time')}</TableCell>
                  <TableCell align="right">{t('activity.distance')}</TableCell>
                  <TableCell align="right">{t('activity.elevationGain')}</TableCell>
                  <TableCell>{t('activity.notes')}</TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trailActivities.map(activity => (
                  <TableRow key={activity.id}>
                    <TableCell align="center">{activity.logDate || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                      {formatSeconds(activity.timeInSeconds)}
                    </TableCell>
                    <TableCell align="right">
                      {activity.distance ? `${Number(activity.distance).toFixed(1)} km` : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {activity.elevationGain ? `${activity.elevationGain} m` : '-'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activity.notes || '-'}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <IconButton
                          size="small"
                          onClick={() => handleEditActivity(activity.id)}
                          title={t('common.edit')}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteConfirmId(activity.id)}
                          title={t('common.delete')}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Edit Activity Dialog */}
        <Dialog open={formOpen} onClose={handleCloseForm} maxWidth="sm" fullWidth>
          <DialogTitle>{t('profile.editResults')}</DialogTitle>
          <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {formError && (
              <Alert severity="error">{formError}</Alert>
            )}
            <TextField
              label={t('activity.date')}
              type="date"
              value={formLogDate}
              onChange={(e) => setFormLogDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label={t('activity.time')}
              value={formTimeStr}
              onChange={(e) => setFormTimeStr(e.target.value)}
              placeholder="HH:MM:SS"
              helperText="Format: HH:MM:SS or MM:SS"
              fullWidth
            />

            <TextField
              label={t('activity.distance')}
              type="number"
              inputProps={{ step: '0.1', min: '0' }}
              value={formDistance !== null ? formDistance : ''}
              onChange={(e) => setFormDistance(e.target.value ? parseFloat(e.target.value) : null)}
              helperText={t('activity.distanceUnit')}
              fullWidth
            />

            <TextField
              label={t('activity.elevationGain')}
              type="number"
              inputProps={{ step: '1', min: '0' }}
              value={formElevationGain !== null ? formElevationGain : ''}
              onChange={(e) => setFormElevationGain(e.target.value ? parseInt(e.target.value) : null)}
              helperText={t('activity.elevationUnit')}
              fullWidth
            />

            <TextField
              label={t('activity.notes')}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder={t('activity.notesPlaceholder')}
              multiline
              rows={3}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseForm}>{t('common.cancel')}</Button>
            <Button onClick={handleFormSubmit} variant="contained">
              {t('activity.save')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
          <DialogTitle>{t('activity.confirmDelete')}</DialogTitle>
          <DialogContent>
            <Typography>{t('activity.deleteWarning')}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              {t('common.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}
