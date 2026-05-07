import React, { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  TextField, PaletteMode, Autocomplete,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Layout from '../components/Layout';
import TimePickerInput from '../components/TimePickerInput';
import { useAuth } from '../hooks/useAuth';
import { useTrails } from '../hooks/useTrails';
import { useTrailActivities } from '../hooks/useTrailActivities';
import { formatDateWithMonths, formatSeconds, parseTimeString } from '../utils/timeFormat';

type Props = { mode: PaletteMode; onToggleMode: () => void };

export default function MyTrailDetailsPage({ mode, onToggleMode }: Props) {
  const { t, i18n } = useTranslation();
  const months = t('races.months', { returnObjects: true }) as unknown as string[];
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { trails, loading: trailsLoading } = useTrails(true);
  const { activities, loading: activitiesLoading, createActivity, updateActivity, deleteActivity } = useTrailActivities();

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

  // Chart legend visibility state
  const [visibleMetrics, setVisibleMetrics] = React.useState({
    time: true,
    distance: true,
    elevation: true,
  });

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

  // Prepare chart data - sort by date ascending for display
  const chartData = useMemo(
    () => trailActivities
      .map(a => ({
        dateIso: a.logDate || a.createdAt.split('T')[0],
        dateLabel: formatDateWithMonths(a.logDate || a.createdAt.split('T')[0], months, i18n.language === 'is'),
        time: a.timeInSeconds,
        distance: a.distance ? Number(a.distance) : 0, // Already in km from database
        elevation: a.elevationGain || 0,
      }))
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
    [trailActivities, i18n.language, months]
  );

  // Calculate statistics
  const statistics = useMemo(() => {
    if (trailActivities.length === 0) {
      return {
        averageTime: 0,
        bestTime: 0,
        worstTime: 0,
        fasterThanFirstDelta: 0,
      };
    }

    const times = trailActivities.map(a => a.timeInSeconds);
    const firstAttemptTime = trailActivities[trailActivities.length - 1]?.timeInSeconds ?? times[0];
    const bestTime = Math.min(...times);

    return {
      averageTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      bestTime,
      worstTime: Math.max(...times),
      fasterThanFirstDelta: bestTime - firstAttemptTime,
    };
  }, [trailActivities]);

  const formatSignedTimeDelta = (seconds: number) => {
    if (seconds === 0) return formatSeconds(0);
    const sign = seconds < 0 ? '-' : '+';
    return `${sign}${formatSeconds(Math.abs(seconds))}`;
  };

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
    if (!formTimeStr.trim()) return;
    
    const time = parseTimeString(formTimeStr);
    if (time === 0) {
      setFormError(t('activity.invalidTime') || 'Invalid time format');
      return;
    }

    setFormError(null);
    try {
      if (editingActivityId) {
        // Update existing activity
        await updateActivity(editingActivityId, {
          TimeInSeconds: time,
          Distance: formDistance || undefined,
          ElevationGain: formElevationGain || undefined,
          LogDate: formLogDate,
          Notes: formNotes,
          IsPublic: formIsPublic,
        });
      } else {
        // Create new activity
        await createActivity({
          TrailSlug: slug || '',
          TimeInSeconds: time,
          Distance: formDistance || undefined,
          ElevationGain: formElevationGain || undefined,
          LogDate: formLogDate,
          Notes: formNotes,
          IsPublic: formIsPublic,
        });
      }
      setFormOpen(false);
      setEditingActivityId(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : editingActivityId ? 'Failed to update activity' : 'Failed to create activity');
    }
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingActivityId(null);
    setFormError(null);
  };

  const handleOpenNewActivityForm = () => {
    setEditingActivityId(null);
    setFormTimeStr('00:00:00');
    setFormDistance(null);
    setFormElevationGain(null);
    setFormLogDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormIsPublic(false);
    setFormError(null);
    setFormOpen(true);
  };

  const handleLegendClick = (e: any) => {
    const dataKey = e.dataKey as keyof typeof visibleMetrics;
    // Prevent hiding all lines - keep at least one visible
    const newState = {
      ...visibleMetrics,
      [dataKey]: !visibleMetrics[dataKey],
    };
    const hasAtLeastOne = Object.values(newState).some(v => v === true);
    if (hasAtLeastOne) {
      setVisibleMetrics(newState);
    }
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

          {/* KPI Statistics */}
          {chartData.length > 1 && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {t('myTrails.bestTime', 'Best Time')}
                  </Typography>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {formatSeconds(statistics.bestTime)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {t('myTrails.averageTime', 'Average Time')}
                  </Typography>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {formatSeconds(statistics.averageTime)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {t('myTrails.worstTime', 'Worst Time')}
                  </Typography>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {formatSeconds(statistics.worstTime)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {t('myTrails.fasterThanFirst', 'Best vs First')}
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 'bold',
                      color:
                        statistics.fasterThanFirstDelta < 0
                          ? 'success.main'
                          : statistics.fasterThanFirstDelta > 0
                            ? 'error.main'
                            : 'text.primary',
                    }}
                  >
                    {formatSignedTimeDelta(statistics.fasterThanFirstDelta)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* Time Results Chart */}
          {chartData.length > 1 && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                {t('myTrails.timeProgress')}
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" label={{ value: t('activity.dates'), position: 'insideBottomRight', offset: -5 }} />
                  <YAxis 
                    tickFormatter={(value) => {
                      // Format based on the metric - time values are in seconds, others in raw units
                      if (typeof value === 'number') {
                        // Check if this looks like a time value (typically > 60 for meaningful time)
                        // If we have time line visible, format as HH:MM:SS; otherwise as number
                        return visibleMetrics.time ? formatSeconds(value) : value.toFixed(0);
                      }
                      return '';
                    }}
                  />
                  <Tooltip 
                    formatter={(value, name, props) => {
                      const numValue = value as number;
                      const dataKey = props?.dataKey;
                      if (dataKey === 'time') {
                        return formatSeconds(numValue);
                      } else if (dataKey === 'distance') {
                        return `${numValue.toFixed(1)} km`;
                      } else if (dataKey === 'elevation') {
                        return `${Math.round(numValue)} m`;
                      }
                      return numValue;
                    }}
                    labelFormatter={(label) => `${t('activity.date')}: ${label}`}
                  />
                  <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer' }} />
                  <Line 
                    type="monotone" 
                    dataKey="time" 
                    stroke="#1976d2" 
                    dot={visibleMetrics.time
                      ? (dotProps: any) => {
                          const isBestPoint = dotProps?.payload?.time === statistics.bestTime;
                          return (
                            <circle
                              cx={dotProps.cx}
                              cy={dotProps.cy}
                              r={isBestPoint ? 8 : 5}
                              fill={isBestPoint ? '#2e7d32' : '#1976d2'}
                              stroke={isBestPoint ? '#ffffff' : 'none'}
                              strokeWidth={isBestPoint ? 2 : 0}
                            />
                          );
                        }
                      : false}
                    activeDot={visibleMetrics.time ? { r: 6 } : false}
                    strokeOpacity={visibleMetrics.time ? 1 : 0}
                    name={t('activity.time')}
                    isAnimationActive
                  />
                  <Line 
                    type="monotone" 
                    dataKey="distance" 
                    stroke="#388e3c" 
                    dot={visibleMetrics.distance ? { fill: '#388e3c', r: 4 } : false}
                    activeDot={visibleMetrics.distance ? { r: 6 } : false}
                    strokeOpacity={visibleMetrics.distance ? 1 : 0}
                    name={t('activity.distance')}
                    isAnimationActive
                  />
                  <Line 
                    type="monotone" 
                    dataKey="elevation" 
                    stroke="#f57c00" 
                    dot={visibleMetrics.elevation ? { fill: '#f57c00', r: 4 } : false}
                    activeDot={visibleMetrics.elevation ? { r: 6 } : false}
                    strokeOpacity={visibleMetrics.elevation ? 1 : 0}
                    name={t('activity.elevationGain')}
                    isAnimationActive
                  />
                </LineChart>
              </ResponsiveContainer>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {t('common.tip', 'Tip')}: {t('myTrails.clickLegendToggle', 'Click legend items to show/hide metrics')}
              </Typography>
            </Box>
          )}

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
                    <TableCell align="center">
                      {formatDateWithMonths(activity.logDate, months, i18n.language === 'is')}
                    </TableCell>
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

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Button 
              variant="contained" 
              onClick={handleOpenNewActivityForm}
            >
              {t('common.add')} {t('activity.activities')}
            </Button>
          </Box>
        </Paper>

        {/* Edit/Create Activity Dialog */}
        <Dialog open={formOpen} onClose={handleCloseForm} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingActivityId ? t('profile.editResults') : t('activity.logActivity')}
          </DialogTitle>
          <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {formError && (
              <Alert severity="error">{formError}</Alert>
            )}
            <TextField
              label={t('activity.date')}
              type="date"
              value={formLogDate}
              onChange={(e) => setFormLogDate(e.target.value)}
              inputProps={{ lang: i18n.language === 'is' ? 'is-IS' : 'en-GB' }}
              helperText={formatDateWithMonths(formLogDate, months, i18n.language === 'is')}
              InputLabelProps={{ shrink: true }}
              fullWidth
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
