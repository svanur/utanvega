import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Button, Container, Paper, Stack, Typography, Dialog, DialogTitle,
  DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, PaletteMode,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import Layout from '../components/Layout';
import ActivityForm from '../components/ActivityForm';
import { useAuth } from '../hooks/useAuth';
import { useTrailActivities } from '../hooks/useTrailActivities';
import { useTrails } from '../hooks/useTrails';
import { formatSeconds } from '../utils/timeFormat';

type Props = { mode: PaletteMode; onToggleMode: () => void };

export default function ActivitiesPage({ mode, onToggleMode }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activities, createActivity, updateActivity, deleteActivity } = useTrailActivities();
  const { trails } = useTrails(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const trailNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    trails.forEach(t => { map[t.slug] = t.name; });
    return map;
  }, [trails]);

  if (!user) {
    navigate('/');
    return null;
  }

  const editingActivity = editingId ? activities.find(a => a.Id === editingId) : null;

  const handleCreateSubmit = async (data: { trailSlug: string; time: number; notes: string; isPublic: boolean }) => {
    setFormLoading(true);
    setFormError(null);
    try {
      await createActivity({
        TrailSlug: data.trailSlug,
        TimeInSeconds: data.time,
        Notes: data.notes,
        IsPublic: data.isPublic,
      });
      setFormOpen(false);
      setEditingId(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save activity');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditSubmit = async (data: { trailSlug: string; time: number; notes: string; isPublic: boolean }) => {
    if (!editingId) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await updateActivity(editingId, {
        TimeInSeconds: data.time,
        Notes: data.notes,
        IsPublic: data.isPublic,
      });
      setFormOpen(false);
      setEditingId(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update activity');
    } finally {
      setFormLoading(false);
    }
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

  const handleTogglePublic = async (activity: typeof activities[0]) => {
    try {
      await updateActivity(activity.Id, { IsPublic: !activity.IsPublic });
    } catch (error) {
      console.error('Toggle public error:', error);
    }
  };

  return (
    <Layout mode={mode} onToggleMode={onToggleMode}>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/profile')} sx={{ mb: 2 }}>
          {t('trail.backToProfile')}
        </Button>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">
              {t('activities.title')}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingId(null);
                setFormOpen(true);
              }}
            >
              {t('activity.logActivity')}
            </Button>
          </Stack>

          {activities.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              {t('activities.noActivities')}
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>{t('activity.trail')}</TableCell>
                    <TableCell align="right">{t('activity.time')}</TableCell>
                    <TableCell>{t('activity.notes')}</TableCell>
                    <TableCell align="center">{t('activity.visibility')}</TableCell>
                    <TableCell align="center">{t('common.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activities.map(activity => (
                    <TableRow key={activity.Id}>
                      <TableCell>{trailNameMap[activity.TrailSlug] || activity.TrailSlug}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                        {formatSeconds(activity.TimeInSeconds)}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {activity.Notes || '-'}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={activity.IsPublic ? <VisibilityIcon /> : <VisibilityOffIcon />}
                          label={activity.IsPublic ? t('activity.public') : t('activity.private')}
                          size="small"
                          variant={activity.IsPublic ? 'filled' : 'outlined'}
                          onClick={() => handleTogglePublic(activity)}
                          clickable
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingId(activity.Id);
                            setFormOpen(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteConfirmId(activity.Id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Container>

      <ActivityForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
          setFormError(null);
        }}
        onSubmit={editingId ? handleEditSubmit : handleCreateSubmit}
        initialTrailSlug={editingActivity?.TrailSlug}
        initialTime={editingActivity?.TimeInSeconds}
        initialNotes={editingActivity?.Notes}
        initialIsPublic={editingActivity?.IsPublic}
        isLoading={formLoading}
        error={formError ?? undefined}
      />

      <Dialog open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>{t('activity.confirmDelete')}</DialogTitle>
        <DialogContent>
          <Typography>{t('activity.deleteWarning')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
