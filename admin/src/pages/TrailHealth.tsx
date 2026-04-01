import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, Chip, LinearProgress, Card,
  CardContent, Stack, Tooltip, IconButton, TextField, InputAdornment,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import { apiFetch } from '../hooks/api';

interface LocationInfo {
  name: string;
  slug: string;
  order: number;
}

interface TrailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  length: number;
  elevationGain: number;
  elevationLoss: number;
  status: string;
  activityType: string;
  trailType: string;
  difficulty: string;
  startLatitude: number | null;
  startLongitude: number | null;
  locations: LocationInfo[];
}

interface HealthCheck {
  label: string;
  passed: boolean;
  tooltip: string;
}

function getHealthChecks(trail: TrailDto): HealthCheck[] {
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
  ];
}

function getHealthScore(trail: TrailDto): number {
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
  const [trails, setTrails] = useState<TrailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<TrailDto[]>('/api/v1/admin/trails?includeDeleted=false');
        setTrails(data);
      } catch (err) {
        onNotify('Failed to load trails', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      <Typography variant="h5" gutterBottom fontWeight="bold">Trail Health Dashboard</Typography>

      {/* Summary Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <SummaryCard title="Total Trails" value={trails.length} color="#1976d2" />
        <SummaryCard title="Avg Health" value={`${avgScore}%`} color={avgScore >= 80 ? '#2e7d32' : avgScore >= 50 ? '#ed6c02' : '#d32f2f'} />
        <SummaryCard title="Perfect (100%)" value={perfectCount} color="#2e7d32" />
        <SummaryCard title="Critical (<50%)" value={criticalCount} color="#d32f2f" />
        <SummaryCard title="Published" value={`${publishedCount}/${trails.length}`} color="#7b1fa2" />
      </Stack>

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
