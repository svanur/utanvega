import React, { useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Button, TextField, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  MenuItem, Select, FormControl, InputLabel, Tooltip, Collapse,
  List, ListItem, ListItemText, ListItemSecondaryAction, Divider,
  Autocomplete, Alert,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import { useCompetitions, type CompetitionDto, type ScheduleRule, type RaceDto, type CompetitionDetailDto } from '../hooks/useCompetitions';
import { useLocations } from '../hooks/useLocations';
import { useTrails } from '../hooks/useTrails';

interface CompetitionListProps {
  onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ACTIVITY_ICONS: Record<string, string> = {
  TrailRunning: '🏃‍♂️',
  Running: '🏃',
  Hiking: '🥾',
  Cycling: '🚴',
};

function formatSchedule(rule: ScheduleRule | null): string {
  if (!rule) return '—';
  if (rule.type === 'Fixed') return rule.date ?? '—';
  if (rule.type === 'Yearly') {
    const week = rule.weekOfMonth === -1 ? 'Last' : `${rule.weekOfMonth}${ordinal(rule.weekOfMonth!)}`;
    return `${week} ${rule.dayOfWeek} in ${MONTHS[rule.month!]}`;
  }
  if (rule.type === 'Seasonal') {
    const weekPart = rule.weekOfMonth != null
      ? `${rule.weekOfMonth === -1 ? 'Last' : `${rule.weekOfMonth}${ordinal(rule.weekOfMonth)}`} `
      : 'Every ';
    return `${weekPart}${rule.dayOfWeek}, ${MONTHS[rule.monthStart!]}–${MONTHS[rule.monthEnd!]}`;
  }
  return '—';
}

function ordinal(n: number): string {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

export default function CompetitionList({ onNotify }: CompetitionListProps) {
  const {
    competitions, loading, createCompetition, updateCompetition,
    deleteCompetition, getCompetition, createRace, updateRace, deleteRace,
  } = useCompetitions();
  const { locations } = useLocations();
  const { trails } = useTrails();

  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<CompetitionDetailDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [organizerWebsite, setOrganizerWebsite] = useState('');
  const [registrationUrl, setRegistrationUrl] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<string>('info');
  const [locationId, setLocationId] = useState<string>('');
  const [status, setStatus] = useState('Active');
  const [scheduleType, setScheduleType] = useState<ScheduleRule['type']>('Yearly');
  const [scheduleMonth, setScheduleMonth] = useState(7);
  const [scheduleWeek, setScheduleWeek] = useState(2);
  const [scheduleDay, setScheduleDay] = useState('Saturday');
  const [scheduleMonthStart, setScheduleMonthStart] = useState(10);
  const [scheduleMonthEnd, setScheduleMonthEnd] = useState(3);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleSeasonalWeek, setScheduleSeasonalWeek] = useState<number | null>(null);

  // Race form state
  const [showRaceDialog, setShowRaceDialog] = useState(false);
  const [editRaceId, setEditRaceId] = useState<string | null>(null);
  const [raceName, setRaceName] = useState('');
  const [raceDistanceLabel, setRaceDistanceLabel] = useState('');
  const [raceCutoffMinutes, setRaceCutoffMinutes] = useState('');
  const [raceDescription, setRaceDescription] = useState('');
  const [raceTrailId, setRaceTrailId] = useState<string>('');
  const [raceSortOrder, setRaceSortOrder] = useState(0);
  const [raceStatus, setRaceStatus] = useState('Active');

  const resetForm = () => {
    setName(''); setSlug(''); setDescription('');
    setOrganizerName(''); setOrganizerWebsite(''); setRegistrationUrl('');
    setAlertMessage(''); setAlertSeverity('info');
    setLocationId(''); setStatus('Active');
    setScheduleType('Yearly'); setScheduleMonth(7); setScheduleWeek(2);
    setScheduleDay('Saturday'); setScheduleMonthStart(10); setScheduleMonthEnd(3);
    setScheduleDate(''); setScheduleSeasonalWeek(null);
  };

  const resetRaceForm = () => {
    setRaceName(''); setRaceDistanceLabel(''); setRaceCutoffMinutes('');
    setRaceDescription(''); setRaceTrailId('');
    setRaceSortOrder(expandedDetail?.races.length ?? 0); setRaceStatus('Active');
  };

  const buildScheduleRule = (): ScheduleRule | null => {
    if (scheduleType === 'Yearly') {
      return { type: 'Yearly', month: scheduleMonth, weekOfMonth: scheduleWeek, dayOfWeek: scheduleDay };
    }
    if (scheduleType === 'Seasonal') {
      const rule: ScheduleRule = { type: 'Seasonal', monthStart: scheduleMonthStart, monthEnd: scheduleMonthEnd, dayOfWeek: scheduleDay };
      if (scheduleSeasonalWeek !== null) rule.weekOfMonth = scheduleSeasonalWeek;
      return rule;
    }
    if (scheduleType === 'Fixed' && scheduleDate) {
      return { type: 'Fixed', date: scheduleDate };
    }
    return null;
  };

  const openCreate = () => { resetForm(); setEditId(null); setShowDialog(true); };

  const openEdit = (comp: CompetitionDto) => {
    setEditId(comp.id);
    setName(comp.name);
    setSlug(comp.slug);
    setDescription(comp.description ?? '');
    setOrganizerName(comp.organizerName ?? '');
    setOrganizerWebsite(comp.organizerWebsite ?? '');
    setRegistrationUrl(comp.registrationUrl ?? '');
    setAlertMessage(comp.alertMessage ?? '');
    setAlertSeverity(comp.alertSeverity ?? 'info');
    setLocationId(comp.locationId ?? '');
    setStatus(comp.status);
    if (comp.scheduleRule) {
      setScheduleType(comp.scheduleRule.type);
      setScheduleMonth(comp.scheduleRule.month ?? 7);
      setScheduleWeek(comp.scheduleRule.weekOfMonth ?? 2);
      setScheduleDay(comp.scheduleRule.dayOfWeek ?? 'Saturday');
      setScheduleMonthStart(comp.scheduleRule.monthStart ?? 10);
      setScheduleMonthEnd(comp.scheduleRule.monthEnd ?? 3);
      setScheduleDate(comp.scheduleRule.date ?? '');
      setScheduleSeasonalWeek(comp.scheduleRule.type === 'Seasonal' ? (comp.scheduleRule.weekOfMonth ?? null) : null);
    } else {
      setScheduleType('Yearly'); setScheduleMonth(7); setScheduleWeek(2); setScheduleDay('Saturday');
      setScheduleSeasonalWeek(null);
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        organizerName: organizerName.trim() || undefined,
        organizerWebsite: organizerWebsite.trim() || undefined,
        registrationUrl: registrationUrl.trim() || undefined,
        alertMessage: alertMessage.trim() || undefined,
        alertSeverity: alertMessage.trim() ? alertSeverity : undefined,
        locationId: locationId || null,
        status,
        scheduleRule: buildScheduleRule(),
      };
      if (editId) {
        await updateCompetition(editId, input);
        onNotify(`"${name}" updated`);
      } else {
        await createCompetition(input);
        onNotify(`"${name}" created`);
      }
      setShowDialog(false);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, compName: string) => {
    if (!confirm(`Delete "${compName}" and all its races?`)) return;
    try {
      await deleteCompetition(id);
      onNotify(`"${compName}" deleted`);
      if (expandedId === id) { setExpandedId(null); setExpandedDetail(null); }
    } catch {
      onNotify('Failed to delete', 'error');
    }
  };

  const toggleExpand = async (comp: CompetitionDto) => {
    if (expandedId === comp.id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(comp.id);
    setLoadingDetail(true);
    try {
      const detail = await getCompetition(comp.slug);
      setExpandedDetail(detail);
    } catch {
      onNotify('Failed to load races', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const openCreateRace = () => {
    resetRaceForm();
    setEditRaceId(null);
    setShowRaceDialog(true);
  };

  const openEditRace = (race: RaceDto) => {
    setEditRaceId(race.id);
    setRaceName(race.name);
    setRaceDistanceLabel(race.distanceLabel ?? '');
    setRaceCutoffMinutes(race.cutoffMinutes?.toString() ?? '');
    setRaceDescription(race.description ?? '');
    setRaceTrailId(race.trailId ?? '');
    setRaceSortOrder(race.sortOrder);
    setRaceStatus(race.status ?? 'Active');
    setShowRaceDialog(true);
  };

  const handleSaveRace = async () => {
    if (!raceName.trim() || !expandedId) return;
    setSaving(true);
    try {
      if (editRaceId) {
        await updateRace(editRaceId, {
          id: editRaceId,
          name: raceName.trim(),
          trailId: raceTrailId || null,
          distanceLabel: raceDistanceLabel.trim() || undefined,
          cutoffMinutes: raceCutoffMinutes ? parseInt(raceCutoffMinutes) : null,
          description: raceDescription.trim() || undefined,
          status: raceStatus,
          sortOrder: raceSortOrder,
        });
        onNotify(`Race "${raceName}" updated`);
      } else {
        await createRace({
          competitionId: expandedId,
          name: raceName.trim(),
          trailId: raceTrailId || null,
          distanceLabel: raceDistanceLabel.trim() || undefined,
          cutoffMinutes: raceCutoffMinutes ? parseInt(raceCutoffMinutes) : null,
          description: raceDescription.trim() || undefined,
          status: raceStatus,
          sortOrder: raceSortOrder,
        });
        onNotify(`Race "${raceName}" added`);
      }
      setShowRaceDialog(false);
      // Refresh expanded detail
      const comp = competitions.find(c => c.id === expandedId);
      if (comp) {
        const detail = await getCompetition(comp.slug);
        setExpandedDetail(detail);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save race', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRace = async (raceId: string, rName: string) => {
    if (!confirm(`Delete race "${rName}"?`)) return;
    try {
      await deleteRace(raceId);
      onNotify(`Race "${rName}" deleted`);
      if (expandedDetail) {
        setExpandedDetail({ ...expandedDetail, races: expandedDetail.races.filter(r => r.id !== raceId) });
      }
    } catch {
      onNotify('Failed to delete race', 'error');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrophyIcon color="primary" />
          <Typography variant="h5">Competitions</Typography>
          <Chip label={competitions.length} size="small" color="primary" />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New Competition
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={40} />
              <TableCell>Name</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Next Date</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Races</TableCell>
              <TableCell>Location</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {competitions.map(comp => (
              <React.Fragment key={comp.id}>
                <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => toggleExpand(comp)}>
                  <TableCell>
                    <IconButton size="small">
                      {expandedId === comp.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{comp.name}</Typography>
                    <Typography variant="caption" color="text.secondary" fontFamily="monospace">{comp.slug}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatSchedule(comp.scheduleRule)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {comp.nextDate ? (
                      <Box>
                        <Typography variant="body2">{comp.nextDate}</Typography>
                        {comp.daysUntil !== null && (
                          <Chip
                            label={comp.daysUntil === 0 ? 'Today!' : comp.daysUntil === 1 ? 'Tomorrow' : `in ${comp.daysUntil} days`}
                            size="small"
                            color={comp.daysUntil <= 7 ? 'error' : comp.daysUntil <= 30 ? 'warning' : 'default'}
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={comp.status}
                      size="small"
                      color={comp.status === 'Active' ? 'success' : comp.status === 'Cancelled' ? 'error' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={comp.raceCount} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {comp.locationName ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(comp)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(comp.id, comp.name)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 0, borderBottom: expandedId === comp.id ? undefined : 'none' }}>
                    <Collapse in={expandedId === comp.id} timeout="auto" unmountOnExit>
                      <Box sx={{ py: 2, px: 2 }}>
                        {loadingDetail ? (
                          <CircularProgress size={24} />
                        ) : expandedDetail ? (
                          <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography variant="subtitle2" color="text.secondary">
                                Races ({expandedDetail.races.length})
                              </Typography>
                              <Button size="small" startIcon={<AddIcon />} onClick={openCreateRace}>
                                Add Race
                              </Button>
                            </Box>
                            {expandedDetail.races.length === 0 ? (
                              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                No races yet. Click "Add Race" to create one.
                              </Typography>
                            ) : (
                              <List dense>
                                {expandedDetail.races.map((race, i) => (
                                  <React.Fragment key={race.id}>
                                    {i > 0 && <Divider />}
                                    <ListItem>
                                      <ListItemText
                                        primary={
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body2" fontWeight="bold">{race.name}</Typography>
                                            {race.distanceLabel && (
                                              <Chip label={race.distanceLabel} size="small" variant="outlined" />
                                            )}
                                            {race.cutoffMinutes && (
                                              <Chip
                                                label={`${Math.floor(race.cutoffMinutes / 60)}h ${race.cutoffMinutes % 60}m cutoff`}
                                                size="small"
                                                variant="outlined"
                                                color="warning"
                                              />
                                            )}
                                            <Chip
                                              label={race.status ?? 'Active'}
                                              size="small"
                                              color={race.status === 'Active' ? 'success' : race.status === 'Retired' ? 'default' : 'info'}
                                            />
                                          </Box>
                                        }
                                        secondary={
                                          <Box component="span" sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                                            {race.trailName && (
                                              <Typography variant="caption" color="primary" component="span">
                                                {ACTIVITY_ICONS[trails.find(t => t.id === race.trailId)?.activityType ?? ''] ?? '🏃‍♂️'} {race.trailName}
                                                {race.trailLength && ` (${(race.trailLength / 1000).toFixed(1)} km)`}
                                              </Typography>
                                            )}
                                          </Box>
                                        }
                                        secondaryTypographyProps={{ component: 'div' }}
                                      />
                                      <ListItemSecondaryAction>
                                        <IconButton size="small" onClick={() => openEditRace(race)}>
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDeleteRace(race.id, race.name)}>
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </ListItemSecondaryAction>
                                    </ListItem>
                                  </React.Fragment>
                                ))}
                              </List>
                            )}
                            {expandedDetail.organizerName && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Organized by: {expandedDetail.organizerName}
                                {expandedDetail.organizerWebsite && (
                                  <> — <a href={expandedDetail.organizerWebsite} target="_blank" rel="noopener">{expandedDetail.organizerWebsite}</a></>
                                )}
                              </Typography>
                            )}
                          </Box>
                        ) : null}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
            {competitions.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    No competitions yet. Click "New Competition" to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Competition Create/Edit Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Competition' : 'New Competition'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            margin="normal"
            autoFocus
            required
          />
          <TextField
            label="Slug"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            fullWidth
            margin="normal"
            placeholder="Auto-generated from name if empty"
            helperText="Lowercase, hyphens only"
            disabled={!!editId}
          />
          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            margin="normal"
            multiline
            rows={3}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Organizer Name"
              value={organizerName}
              onChange={e => setOrganizerName(e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Organizer Website"
              value={organizerWebsite}
              onChange={e => setOrganizerWebsite(e.target.value)}
              fullWidth
              margin="normal"
              placeholder="https://..."
            />
          </Box>
          <TextField
            label="Registration URL"
            value={registrationUrl}
            onChange={e => setRegistrationUrl(e.target.value)}
            fullWidth
            margin="normal"
            placeholder="https://..."
          />

          {/* Alert Banner */}
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>Alert Banner</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <TextField
              label="Alert Message"
              value={alertMessage}
              onChange={e => setAlertMessage(e.target.value)}
              fullWidth
              margin="dense"
              placeholder="e.g. Registration closes May 1st!"
              helperText="Leave empty for no alert"
            />
            <FormControl margin="dense" sx={{ minWidth: 140 }}>
              <InputLabel>Severity</InputLabel>
              <Select value={alertSeverity} onChange={e => setAlertSeverity(e.target.value)} label="Severity">
                <MenuItem value="info">ℹ️ Info</MenuItem>
                <MenuItem value="success">✅ Success</MenuItem>
                <MenuItem value="warning">⚠️ Warning</MenuItem>
                <MenuItem value="error">🚨 Error</MenuItem>
              </Select>
            </FormControl>
          </Box>
          {alertMessage.trim() && (
            <Alert severity={alertSeverity as 'info' | 'success' | 'warning' | 'error'} sx={{ mt: 1 }}>
              {alertMessage}
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Autocomplete
              options={[...locations].sort((a, b) => a.name.localeCompare(b.name))}
              getOptionLabel={(loc) => loc.name}
              value={locations.find(l => l.id === locationId) ?? null}
              onChange={(_, val) => setLocationId(val?.id ?? '')}
              renderInput={(params) => <TextField {...params} label="Location" margin="normal" />}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              sx={{ flex: 1 }}
            />
            <FormControl margin="normal" sx={{ flex: 1 }}>
              <InputLabel>Status</InputLabel>
              <Select value={status} onChange={e => setStatus(e.target.value)} label="Status">
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Cancelled">Cancelled</MenuItem>
                <MenuItem value="Retired">Retired</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Schedule Rule Builder */}
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Schedule</Typography>
          <FormControl fullWidth margin="dense">
            <InputLabel>Schedule Type</InputLabel>
            <Select value={scheduleType} onChange={e => setScheduleType(e.target.value as ScheduleRule['type'])} label="Schedule Type">
              <MenuItem value="Yearly">Yearly (e.g. "2nd Saturday in July")</MenuItem>
              <MenuItem value="Seasonal">Seasonal series (e.g. "Every Thu, Oct–Mar")</MenuItem>
              <MenuItem value="Fixed">Fixed date</MenuItem>
            </Select>
          </FormControl>

          {scheduleType === 'Yearly' && (
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <FormControl sx={{ minWidth: 100 }}>
                <InputLabel>Week</InputLabel>
                <Select value={scheduleWeek} onChange={e => setScheduleWeek(Number(e.target.value))} label="Week">
                  <MenuItem value={1}>1st</MenuItem>
                  <MenuItem value={2}>2nd</MenuItem>
                  <MenuItem value={3}>3rd</MenuItem>
                  <MenuItem value={4}>4th</MenuItem>
                  <MenuItem value={-1}>Last</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel>Day</InputLabel>
                <Select value={scheduleDay} onChange={e => setScheduleDay(e.target.value)} label="Day">
                  {DAYS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel>Month</InputLabel>
                <Select value={scheduleMonth} onChange={e => setScheduleMonth(Number(e.target.value))} label="Month">
                  {MONTHS.slice(1).map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          )}

          {scheduleType === 'Seasonal' && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <FormControl sx={{ minWidth: 100 }} size="small">
                <InputLabel>Week</InputLabel>
                <Select value={scheduleSeasonalWeek ?? ''} onChange={e => setScheduleSeasonalWeek(e.target.value === '' ? null : Number(e.target.value))} label="Week">
                  <MenuItem value="">Every</MenuItem>
                  <MenuItem value={1}>1st</MenuItem>
                  <MenuItem value={2}>2nd</MenuItem>
                  <MenuItem value={3}>3rd</MenuItem>
                  <MenuItem value={4}>4th</MenuItem>
                  <MenuItem value={-1}>Last</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 110 }} size="small">
                <InputLabel>Day</InputLabel>
                <Select value={scheduleDay} onChange={e => setScheduleDay(e.target.value)} label="Day">
                  {DAYS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 90 }} size="small">
                <InputLabel>From</InputLabel>
                <Select value={scheduleMonthStart} onChange={e => setScheduleMonthStart(Number(e.target.value))} label="From">
                  {MONTHS_SHORT.slice(1).map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 90 }} size="small">
                <InputLabel>To</InputLabel>
                <Select value={scheduleMonthEnd} onChange={e => setScheduleMonthEnd(Number(e.target.value))} label="To">
                  {MONTHS_SHORT.slice(1).map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          )}

          {scheduleType === 'Fixed' && (
            <TextField
              label="Date"
              type="date"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? <CircularProgress size={20} /> : editId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Race Create/Edit Dialog */}
      <Dialog open={showRaceDialog} onClose={() => setShowRaceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editRaceId ? 'Edit Race' : 'Add Race'}</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={[...trails].sort((a, b) => a.name.localeCompare(b.name))}
            getOptionLabel={(t) => `${t.name} (${(t.length / 1000).toFixed(1)} km)`}
            value={trails.find(t => t.id === raceTrailId) ?? null}
            onChange={(_, val) => setRaceTrailId(val?.id ?? '')}
            renderInput={(params) => <TextField {...params} label="Linked Trail" margin="normal" autoFocus />}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            fullWidth
          />
          <TextField
            label="Race Name"
            value={raceName}
            onChange={e => setRaceName(e.target.value)}
            fullWidth
            margin="normal"
            required
            placeholder='e.g. "55K Ultra", "10K Fun Run"'
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Distance Label"
              value={raceDistanceLabel}
              onChange={e => setRaceDistanceLabel(e.target.value)}
              margin="normal"
              placeholder="e.g. 55 km"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Cutoff (minutes)"
              value={raceCutoffMinutes}
              onChange={e => setRaceCutoffMinutes(e.target.value)}
              margin="normal"
              type="number"
              placeholder="e.g. 720"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Sort Order"
              value={raceSortOrder}
              onChange={e => setRaceSortOrder(parseInt(e.target.value) || 0)}
              margin="normal"
              type="number"
              sx={{ flex: 0.5 }}
            />
          </Box>
          <FormControl fullWidth margin="normal">
            <InputLabel>Race Status</InputLabel>
            <Select value={raceStatus} onChange={e => setRaceStatus(e.target.value)} label="Race Status">
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
              <MenuItem value="Retired">Retired</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Description"
            value={raceDescription}
            onChange={e => setRaceDescription(e.target.value)}
            fullWidth
            margin="normal"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRaceDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveRace} disabled={!raceName.trim() || saving}>
            {saving ? <CircularProgress size={20} /> : editRaceId ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
