import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, Chip, LinearProgress, Card,
  CardContent, Stack, Tooltip, IconButton, TextField, InputAdornment,
  Collapse, Alert, AlertTitle, List, ListItem, ListItemText, ListItemIcon,
  Button, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CalculateIcon from '@mui/icons-material/Calculate';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../hooks/api';
import { useTrails, trailsQueryKey, type Trail } from '../hooks/useTrails';


interface HealthCheck {
  label: string;
  passed: boolean;
  tooltip: string;
}

interface DuplicatePair {
  trailAId: string;
  trailAName: string;
  trailBId: string;
  trailBName: string;
  matchPercentage: number;
}

function getHealthChecks(trail: Trail): HealthCheck[] {
  return [
    {
      label: 'Description',
      passed: !!trail.description && trail.description.trim().length > 0,
      tooltip: trail.description ? `${trail.description.length} chars` : 'No description',
    },
    {
      label: 'GPX Data',
      passed: trail.startLatitude != null && trail.startLongitude != null,
      tooltip: trail.startLatitude != null ? `Start: ${trail.startLatitude.toFixed(4)}, ${trail.startLongitude?.toFixed(4)}` : 'No GPX geometry',
    },
    {
      label: 'Elevation',
      passed: trail.elevationGain > 0 || trail.elevationLoss > 0,
      tooltip: trail.elevationGain > 0 ? `↑${Math.round(trail.elevationGain)}m ↓${Math.round(trail.elevationLoss)}m` : 'No elevation data',
    },
    {
      label: 'Location',
      passed: trail.locations.length > 0,
      tooltip: trail.locations.length > 0 ? trail.locations.map(l => l.name).join(', ') : 'No location linked',
    },
    {
      label: 'Distance',
      passed: trail.length > 0,
      tooltip: trail.length > 0 ? `${(trail.length / 1000).toFixed(1)} km` : 'No distance',
    },
    {
      label: 'Published',
      passed: trail.status === 'Published',
      tooltip: `Status: ${trail.status}`,
    },
    {
      label: 'Terrain',
      passed: trail.startLatitude == null ? true : trail.terrainType != null,
      tooltip: trail.startLatitude == null
        ? 'N/A — no GPX data'
        : trail.terrainType
          ? `Terrain type: ${trail.terrainType}`
          : 'Terrain type not set',
    },
  ];
}

function getHealthScore(trail: Trail): number {
  const checks = getHealthChecks(trail);
  return Math.round((checks.filter(c => c.passed).length / checks.length) * 100);
}

function scoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 100) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

function scoreBgColor(score: number): string {
  if (score >= 100) return '#e8f5e9';
  if (score >= 50) return '#fff8e1';
  return '#fce4ec';
}

type SortField = 'name' | 'score' | 'status' | 'activityType';

interface TrailHealthProps {
  onEditTrail?: (trailId: string) => void;
  onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void;
}

export default function TrailHealth({ onEditTrail, onNotify }: TrailHealthProps) {
  const queryClient = useQueryClient();
  const { trails, loading } = useTrails(false);
  const { data: duplicates = [], isLoading: dupsLoading } = useQuery({
    queryKey: ['admin', 'trail-duplicates'],
    queryFn: () => apiFetch<DuplicatePair[]>('/api/v1/admin/trails/duplicates?threshold=90'),
    staleTime: 5 * 60_000,
  });

  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [dupsExpanded, setDupsExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectingLocations, setDetectingLocations] = useState(false);
  const [detectingTerrain, setDetectingTerrain] = useState(false);
  const [backfillingProfiles, setBackfillingProfiles] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [locationsDialogOpen, setLocationsDialogOpen] = useState(false);
  const [terrainDialogOpen, setTerrainDialogOpen] = useState(false);
  const [typesDialogOpen, setTypesDialogOpen] = useState(false);
  const [elevationDialogOpen, setElevationDialogOpen] = useState(false);
  const [recalcDialogOpen, setRecalcDialogOpen] = useState(false);

  const invalidateTrails = () => queryClient.invalidateQueries({ queryKey: trailsQueryKey(false) });

  const handleDeleteDuplicate = async (trailId: string, trailName: string) => {
    if (!confirm(`Delete "${trailName}"? This will soft-delete the trail.`)) return;
    try {
      setDeletingId(trailId);
      await apiFetch(`/api/v1/admin/trails/${trailId}`, { method: 'DELETE' });
      queryClient.setQueryData<DuplicatePair[]>(['admin', 'trail-duplicates'], prev =>
        prev ? prev.filter(d => d.trailAId !== trailId && d.trailBId !== trailId) : prev
      );
      invalidateTrails();
      onNotify(`"${trailName}" deleted`);
    } catch (_err) {
      onNotify('Failed to delete trail', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDetectTypes = async () => {
    setDetecting(true);
    try {
      const result = await apiFetch<{ total: number; updated: number }>('/api/v1/admin/trails/detect-types', { method: 'POST' });
      onNotify(`Trail types re-detected: ${result.updated} of ${result.total} trails updated`);
      invalidateTrails();
    } catch (_err) {
      onNotify('Failed to detect trail types', 'error');
    } finally {
      setDetecting(false);
    }
  };

  const handleBackfillElevationProfiles = async () => {
    setBackfillingProfiles(true);
    try {
      const result = await apiFetch<{ updated: number }>('/api/v1/admin/trails/backfill-elevation-profiles', { method: 'POST' });
      onNotify(`Elevation profiles backfilled: ${result.updated} trails updated`);
    } catch (_err) {
      onNotify('Failed to backfill elevation profiles', 'error');
    } finally {
      setBackfillingProfiles(false);
    }
  };

  const handleDetectTerrainTypes = async () => {
    setDetectingTerrain(true);
    try {
      const result = await apiFetch<{ total: number; updated: number; skipped: number }>('/api/v1/admin/trails/detect-terrain-types', { method: 'POST' });
      onNotify(`Terrain types detected: ${result.updated} of ${result.total} trails updated (${result.skipped} skipped)`);
      invalidateTrails();
    } catch (_err) {
      onNotify('Failed to detect terrain types', 'error');
    } finally {
      setDetectingTerrain(false);
    }
  };

  const handleRecalculateDifficulties = async () => {
    setRecalculating(true);
    try {
      const data = await apiFetch<{ count: number }>('/api/v1/admin/trails/recalculate-all-difficulties', { method: 'POST' });
      onNotify(`Recalculated difficulty for ${data.count} trails`);
      invalidateTrails();
    } catch (_err) {
      onNotify('Failed to recalculate difficulties', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  const handleDetectLocations = async () => {
    setDetectingLocations(true);
    try {
      const result = await apiFetch<{ total: number; updated: number }>('/api/v1/admin/trails/detect-locations', { method: 'POST' });
      onNotify(`Locations re-detected: ${result.updated} of ${result.total} trails updated`);
      invalidateTrails();
    } catch (_err) {
      onNotify('Failed to detect locations', 'error');
    } finally {
      setDetectingLocations(false);
    }
  };


  const scored = useMemo(() =>
    trails.map(t => ({ trail: t, score: getHealthScore(t), checks: getHealthChecks(t) })),
    [trails]
  );

  const filtered = useMemo(() => {
    let result = scored;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.trail.name.toLowerCase().includes(q) || s.trail.slug.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.trail.name.localeCompare(b.trail.name); break;
        case 'score': cmp = a.score - b.score; break;
        case 'status': cmp = a.trail.status.localeCompare(b.trail.status); break;
        case 'activityType': cmp = a.trail.activityType.localeCompare(b.trail.activityType); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [scored, search, sortField, sortDir]);

  const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, t) => s + t.score, 0) / scored.length) : 0;
  const perfectCount = scored.filter(s => s.score === 100).length;
  const criticalCount = scored.filter(s => s.score < 50).length;
  const publishedCount = scored.filter(s => s.trail.status === 'Published').length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'score' ? 'asc' : 'asc');
    }
  };

  if (loading) {
    return <Box sx={{ p: 3 }}><LinearProgress /><Typography sx={{ mt: 1 }}>Loading trail data...</Typography></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Trail Health Dashboard</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={detectingLocations ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
            disabled={detectingLocations || detecting || detectingTerrain || backfillingProfiles || recalculating}
            onClick={() => setLocationsDialogOpen(true)}
          >
            {detectingLocations ? 'Detecting...' : 'Re-detect Locations'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={detectingTerrain ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
            disabled={detecting || detectingLocations || detectingTerrain || backfillingProfiles || recalculating}
            onClick={() => setTerrainDialogOpen(true)}
          >
            {detectingTerrain ? 'Detecting...' : 'Re-detect Terrain Types'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={detecting ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
            disabled={detecting || detectingLocations || detectingTerrain || backfillingProfiles || recalculating}
            onClick={() => setTypesDialogOpen(true)}
          >
            {detecting ? 'Detecting...' : 'Re-detect Trail Types'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={backfillingProfiles ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
            disabled={detecting || detectingLocations || detectingTerrain || backfillingProfiles || recalculating}
            onClick={() => setElevationDialogOpen(true)}
          >
            {backfillingProfiles ? 'Backfilling...' : 'Backfill Elevation Profiles'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={recalculating ? <CircularProgress size={16} /> : <CalculateIcon />}
            disabled={detecting || detectingLocations || detectingTerrain || backfillingProfiles || recalculating}
            onClick={() => setRecalcDialogOpen(true)}
          >
            {recalculating ? 'Recalculating...' : 'Recalculate Difficulties'}
          </Button>
        </Stack>

        <Dialog open={locationsDialogOpen} onClose={() => { if (!detectingLocations) setLocationsDialogOpen(false); }} maxWidth="sm" fullWidth>
          <DialogTitle>Re-detect Locations</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will scan all trails and automatically assign a <strong>location</strong> based on the trail's GPS coordinates — matching against the known regions and areas in the database.
            </DialogContentText>
            <DialogContentText sx={{ mt: 1.5 }}>
              Trails that already have a location assigned will be <strong>updated</strong> if a better match is found. Trails with no GPS data will be skipped.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLocationsDialogOpen(false)} disabled={detectingLocations}>Cancel</Button>
            <Button variant="contained" startIcon={<AutoFixHighIcon />} onClick={() => { setLocationsDialogOpen(false); handleDetectLocations(); }}>
              Run detection
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={terrainDialogOpen} onClose={() => { if (!detectingTerrain) setTerrainDialogOpen(false); }} maxWidth="sm" fullWidth>
          <DialogTitle>Re-detect Terrain Types</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will classify each trail as <strong>Flat</strong>, <strong>Hilly</strong>, or <strong>Mountainous</strong> based on its elevation profile and elevation-gain-per-km ratio.
            </DialogContentText>
            <DialogContentText sx={{ mt: 1.5 }}>
              Existing terrain type values will be <strong>overwritten</strong>. Trails without GPX data will be skipped.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTerrainDialogOpen(false)} disabled={detectingTerrain}>Cancel</Button>
            <Button variant="contained" startIcon={<AutoFixHighIcon />} onClick={() => { setTerrainDialogOpen(false); handleDetectTerrainTypes(); }}>
              Run detection
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={typesDialogOpen} onClose={() => { if (!detecting) setTypesDialogOpen(false); }} maxWidth="sm" fullWidth>
          <DialogTitle>Re-detect Trail Types</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will classify each trail as <strong>Loop</strong>, <strong>Out & Back</strong>, or <strong>Point to Point</strong> by analysing the shape of the GPS track — comparing start and end coordinates and route geometry.
            </DialogContentText>
            <DialogContentText sx={{ mt: 1.5 }}>
              Existing trail type values will be <strong>overwritten</strong>. Trails without GPX data will be skipped.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTypesDialogOpen(false)} disabled={detecting}>Cancel</Button>
            <Button variant="contained" startIcon={<AutoFixHighIcon />} onClick={() => { setTypesDialogOpen(false); handleDetectTypes(); }}>
              Run detection
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={elevationDialogOpen} onClose={() => { if (!backfillingProfiles) setElevationDialogOpen(false); }} maxWidth="sm" fullWidth>
          <DialogTitle>Backfill Elevation Profiles</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will generate a <strong>sampled elevation profile</strong> for any trail that is missing one, by extracting elevation data points along its GPS track at regular intervals.
            </DialogContentText>
            <DialogContentText sx={{ mt: 1.5 }}>
              Only trails <strong>without</strong> an existing elevation profile are updated — already-backfilled trails are left untouched. Trails without GPX data will be skipped.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setElevationDialogOpen(false)} disabled={backfillingProfiles}>Cancel</Button>
            <Button variant="contained" startIcon={<AutoFixHighIcon />} onClick={() => { setElevationDialogOpen(false); handleBackfillElevationProfiles(); }}>
              Run backfill
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={recalcDialogOpen} onClose={() => { if (!recalculating) setRecalcDialogOpen(false); }} maxWidth="sm" fullWidth>
          <DialogTitle>Recalculate Difficulties</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will recalculate the difficulty rating for <strong>all trails</strong> based on their distance, elevation gain, and activity type using the standard effort-distance formula.
            </DialogContentText>
            <DialogContentText sx={{ mt: 1.5 }}>
              Any manually-set difficulty values will be <strong>overwritten</strong>. Trails without GPX data will be skipped.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRecalcDialogOpen(false)} disabled={recalculating}>Cancel</Button>
            <Button variant="contained" startIcon={<CalculateIcon />} onClick={() => { setRecalcDialogOpen(false); handleRecalculateDifficulties(); }}>
              Recalculate
            </Button>
          </DialogActions>
        </Dialog>
      </Box>

      {/* Summary Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <SummaryCard title="Total Trails" value={trails.length} color="#1976d2" />
        <SummaryCard title="Avg Health" value={`${avgScore}%`} color={avgScore >= 80 ? '#2e7d32' : avgScore >= 50 ? '#ed6c02' : '#d32f2f'} />
        <SummaryCard title="Perfect (100%)" value={perfectCount} color="#2e7d32" />
        <SummaryCard title="Critical (<50%)" value={criticalCount} color="#d32f2f" />
        <SummaryCard title="Published" value={`${publishedCount}/${trails.length}`} color="#7b1fa2" />
        <SummaryCard
          title="Duplicates"
          value={dupsLoading ? '...' : duplicates.length}
          color={duplicates.length > 0 ? '#d32f2f' : '#2e7d32'}
        />
      </Stack>

      {/* Duplicates Section */}
      {dupsLoading && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<ContentCopyIcon />}>
          <AlertTitle>Scanning for duplicates...</AlertTitle>
          Comparing {trails.length > 0 ? `${trails.length} trails` : 'trails'} — this may take a moment.
          <LinearProgress sx={{ mt: 1 }} />
        </Alert>
      )}
      {!dupsLoading && duplicates.length > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 2, cursor: 'pointer' }}
          icon={<ContentCopyIcon />}
          action={
            <IconButton size="small" onClick={() => setDupsExpanded(!dupsExpanded)}>
              {dupsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          }
          onClick={() => setDupsExpanded(!dupsExpanded)}
        >
          <AlertTitle>
            {duplicates.length} potential duplicate{duplicates.length !== 1 ? 's' : ''} found (≥90% overlap)
          </AlertTitle>
          <Collapse in={dupsExpanded}>
            <List dense disablePadding>
              {duplicates.map((d, i) => (
                <ListItem key={i} disableGutters>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Chip label={`${d.matchPercentage}%`} size="small" color="error" variant="outlined" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`"${d.trailAName}" ↔ "${d.trailBName}"`}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                  <Stack direction="row" spacing={0.5}>
                    {onEditTrail && (
                      <>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditTrail(d.trailAId); }} title={`Edit ${d.trailAName}`}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditTrail(d.trailBId); }} title={`Edit ${d.trailBName}`}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                    <Tooltip title={`Delete "${d.trailAName}"`} arrow>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={deletingId === d.trailAId}
                        onClick={(e) => { e.stopPropagation(); handleDeleteDuplicate(d.trailAId, d.trailAName); }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={`Delete "${d.trailBName}"`} arrow>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={deletingId === d.trailBId}
                        onClick={(e) => { e.stopPropagation(); handleDeleteDuplicate(d.trailBId, d.trailBName); }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Alert>
      )}

      {/* Search */}
      <TextField
        size="small"
        placeholder="Search trails..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{ mb: 2, width: 300 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={sortField === 'name'} direction={sortField === 'name' ? sortDir : 'asc'} onClick={() => handleSort('name')}>
                  Trail
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel active={sortField === 'score'} direction={sortField === 'score' ? sortDir : 'asc'} onClick={() => handleSort('score')}>
                  Health
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel active={sortField === 'status'} direction={sortField === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Checks</TableCell>
              <TableCell align="center" width={48}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(({ trail, score, checks }) => (
              <TableRow key={trail.id} sx={{ backgroundColor: scoreBgColor(score), '&:hover': { opacity: 0.9 } }}>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">{trail.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{trail.activityType} · {trail.trailType}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                    <LinearProgress
                      variant="determinate"
                      value={score}
                      color={scoreColor(score)}
                      sx={{ width: 60, height: 8, borderRadius: 1 }}
                    />
                    <Typography variant="body2" fontWeight="bold" color={`${scoreColor(score)}.main`}>
                      {score}%
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={trail.status}
                    size="small"
                    color={trail.status === 'Published' ? 'success' : trail.status === 'Draft' ? 'default' : 'warning'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap>
                    {checks.map(check => (
                      <Tooltip key={check.label} title={`${check.label}: ${check.tooltip}`} arrow>
                        <Chip
                          icon={check.passed ? <CheckCircleIcon /> : <CancelIcon />}
                          label={check.label}
                          size="small"
                          color={check.passed ? 'success' : 'error'}
                          variant={check.passed ? 'outlined' : 'filled'}
                          sx={{ fontSize: '0.65rem', height: 24, '& .MuiChip-icon': { fontSize: 14 } }}
                        />
                      </Tooltip>
                    ))}
                  </Stack>
                </TableCell>
                <TableCell align="center">
                  {onEditTrail && (
                    <IconButton size="small" onClick={() => onEditTrail(trail.id)} title="Edit trail">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filtered.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          {search ? 'No trails match your search.' : 'No trails found.'}
        </Typography>
      )}
    </Box>
  );
}

function SummaryCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 140, flex: '1 1 140px' }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">{title}</Typography>
        <Typography variant="h5" fontWeight="bold" sx={{ color }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}
