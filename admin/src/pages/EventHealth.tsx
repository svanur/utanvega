import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, Chip, LinearProgress, Card,
  CardContent, Stack, Tooltip, IconButton, TextField, InputAdornment,
  Button, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { apiFetch } from '../hooks/api';
import type { EventSummaryDto } from '../hooks/useEvents';

interface HealthCheck {
  label: string;
  passed: boolean;
  tooltip: string;
  na?: boolean;
}

// Checks that are not meaningful for a given event type are marked na=true
// and excluded from the health score.
function getHealthChecks(event: EventSummaryDto): HealthCheck[] {
  const isAd = event.type === 'Advertisement';
  const isSeries = event.type === 'Series';

  return [
    {
      label: 'Description',
      passed: !!event.description && event.description.trim().length > 10,
      tooltip: event.description ? `${event.description.length} chars` : 'No description',
    },
    {
      label: 'Next Date',
      passed: !!event.nextEditionDate,
      tooltip: event.nextEditionDate ? `Next: ${event.nextEditionDate}` : 'No upcoming date',
      na: isAd,
    },
    {
      label: 'Editions',
      passed: event.editionCount > 0,
      tooltip: event.editionCount > 0 ? `${event.editionCount} edition${event.editionCount > 1 ? 's' : ''}` : 'No editions',
      // Series events surface races directly via seriesRaces, not per-edition
      na: isAd || isSeries,
    },
    {
      label: 'Location',
      passed: !!event.locationId,
      tooltip: event.locationName ?? 'No location linked',
      na: isAd,
    },
    {
      label: 'GPX Pin',
      passed: event.gpxPointLat != null && event.gpxPointLng != null,
      tooltip: event.gpxPointLat != null
        ? `${event.gpxPointLat.toFixed(4)}, ${event.gpxPointLng?.toFixed(4)}`
        : 'No GPX pin set',
      na: isAd,
    },
    {
      label: 'Organizer',
      passed: !!(event.organizerName || event.organizerWebsite),
      tooltip: event.organizerName
        ? `${event.organizerName}${event.organizerWebsite ? ' · ' + event.organizerWebsite : ''}`
        : 'No organizer info',
      na: isAd,
    },
    {
      label: 'Schedule',
      passed: !!event.scheduleRule,
      tooltip: event.scheduleRule ? `Type: ${event.scheduleRule.type}` : 'No schedule rule set',
      na: isAd,
    },
    {
      label: 'Published',
      passed: event.status === 'Confirmed',
      tooltip: `Status: ${event.status}`,
    },
  ];
}

function scoreFromChecks(checks: HealthCheck[]): number {
  const applicable = checks.filter(c => !c.na);
  if (applicable.length === 0) return 100;
  return Math.round((applicable.filter(c => c.passed).length / applicable.length) * 100);
}

function scoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 100) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

type SortField = 'name' | 'score' | 'status' | 'type';
type QuickFilter = 'critical' | 'perfect' | 'no-date' | 'no-location' | 'no-gpx';

interface EventHealthProps {
  onViewEvent?: (eventSlug: string) => void;
  onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void;
}

export default function EventHealth({ onViewEvent, onNotify }: EventHealthProps) {
  const theme = useTheme();
  const [events, setEvents] = useState<EventSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [detectingGpx, setDetectingGpx] = useState(false);
  const [gpxDialogOpen, setGpxDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<EventSummaryDto[]>('/api/v1/admin/events');
        setEvents(data);
      } catch (_err) {
        onNotify('Failed to load events', 'error');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onNotify callback reference changes on every render
  }, []);

  const handleDetectGpx = async () => {
    setDetectingGpx(true);
    try {
      const result = await apiFetch<{ total: number; updated: number; skipped: number }>('/api/v1/admin/events/detect-gpx', { method: 'POST' });
      const msg = result.updated > 0
        ? `GPX detected: ${result.updated} event${result.updated !== 1 ? 's' : ''} updated${result.skipped > 0 ? `, ${result.skipped} had no linked trail with GPX data` : ''}`
        : result.skipped > 0
          ? `No GPX found — ${result.skipped} event${result.skipped !== 1 ? 's' : ''} had no linked trail with GPX data`
          : 'All events already have a GPX pin';
      onNotify(msg);
      const data = await apiFetch<EventSummaryDto[]>('/api/v1/admin/events');
      setEvents(data);
    } catch (_err) {
      onNotify('Failed to detect GPX points', 'error');
    } finally {
      setDetectingGpx(false);
    }
  };

  const scored = useMemo(
    () => events.map(e => {
      const checks = getHealthChecks(e);
      return { event: e, score: scoreFromChecks(checks), checks };
    }),
    [events],
  );

  const scoreBgColor = (score: number) => {
    if (score >= 100) return alpha(theme.palette.success.main, 0.1);
    if (score >= 50) return alpha(theme.palette.warning.main, 0.1);
    return alpha(theme.palette.error.main, 0.1);
  };

  const filtered = useMemo(() => {
    let result = scored;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.event.name.toLowerCase().includes(q) || s.event.slug.toLowerCase().includes(q));
    }
    switch (activeFilter) {
      case 'critical':     result = result.filter(s => s.score < 50); break;
      case 'perfect':      result = result.filter(s => s.score === 100); break;
      case 'no-date':      result = result.filter(s => !s.checks.find(c => c.label === 'Next Date')?.na && !s.event.nextEditionDate); break;
      case 'no-location':  result = result.filter(s => !s.checks.find(c => c.label === 'Location')?.na && !s.event.locationId); break;
      case 'no-gpx':       result = result.filter(s => !s.checks.find(c => c.label === 'GPX Pin')?.na && s.event.gpxPointLat == null); break;
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.event.name.localeCompare(b.event.name); break;
        case 'score': cmp = a.score - b.score; break;
        case 'status': cmp = a.event.status.localeCompare(b.event.status); break;
        case 'type': cmp = a.event.type.localeCompare(b.event.type); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [scored, search, activeFilter, sortField, sortDir]);

  const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, e) => s + e.score, 0) / scored.length) : 0;
  const perfectCount = scored.filter(s => s.score === 100).length;
  const criticalCount = scored.filter(s => s.score < 50).length;
  const confirmedCount = scored.filter(s => s.event.status === 'Confirmed').length;
  // Only count events where the check is applicable (not N/A for their type)
  const noDateCount = scored.filter(s => !s.checks.find(c => c.label === 'Next Date')?.na && !s.event.nextEditionDate).length;
  const noLocationCount = scored.filter(s => !s.checks.find(c => c.label === 'Location')?.na && !s.event.locationId).length;
  const noGpxCount = scored.filter(s => !s.checks.find(c => c.label === 'GPX Pin')?.na && s.event.gpxPointLat == null).length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  if (loading) {
    return <Box sx={{ p: 3 }}><LinearProgress /><Typography sx={{ mt: 1 }}>Loading event data...</Typography></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Event Health Dashboard</Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={detectingGpx ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
          disabled={detectingGpx}
          onClick={() => setGpxDialogOpen(true)}
        >
          {detectingGpx ? 'Detecting...' : 'Re-detect GPX'}
        </Button>

        <Dialog open={gpxDialogOpen} onClose={() => { if (!detectingGpx) setGpxDialogOpen(false); }} maxWidth="sm" fullWidth>
          <DialogTitle>Re-detect GPX points</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will scan all events that <strong>don't already have a GPX pin</strong> and
              automatically set one from the trail linked to their editions or races.
            </DialogContentText>
            <DialogContentText sx={{ mt: 1.5 }}>
              Events that already have a manually-set GPX pin are left untouched. Events with
              no linked trail, or whose trail has no GPX data, will be skipped.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGpxDialogOpen(false)} disabled={detectingGpx}>Cancel</Button>
            <Button
              variant="contained"
              startIcon={<AutoFixHighIcon />}
              onClick={() => { setGpxDialogOpen(false); handleDetectGpx(); }}
            >
              Run detection
            </Button>
          </DialogActions>
        </Dialog>
      </Box>

      <Stack direction="row" spacing={2} sx={{ mb: activeFilter ? 1.5 : 3 }} flexWrap="wrap" useFlexGap>
        <SummaryCard title="Total Events" value={events.length} color="#1976d2" />
        <SummaryCard title="Avg Health" value={`${avgScore}%`} color={avgScore >= 80 ? '#2e7d32' : avgScore >= 50 ? '#ed6c02' : '#d32f2f'} />
        <SummaryCard title="Perfect (100%)" value={perfectCount} color="#2e7d32"
          filter="perfect" activeFilter={activeFilter} onFilter={setActiveFilter} />
        <SummaryCard title="Critical (<50%)" value={criticalCount} color="#d32f2f"
          filter="critical" activeFilter={activeFilter} onFilter={setActiveFilter} />
        <SummaryCard title="Confirmed" value={`${confirmedCount}/${events.length}`} color="#7b1fa2" />
        <SummaryCard title="No Date" value={noDateCount} color={noDateCount > 0 ? '#ed6c02' : '#2e7d32'}
          filter="no-date" activeFilter={activeFilter} onFilter={setActiveFilter} />
        <SummaryCard title="No Location" value={noLocationCount} color={noLocationCount > 0 ? '#ed6c02' : '#2e7d32'}
          filter="no-location" activeFilter={activeFilter} onFilter={setActiveFilter} />
        <SummaryCard title="No GPX Pin" value={noGpxCount} color={noGpxCount > 0 ? '#ed6c02' : '#2e7d32'}
          filter="no-gpx" activeFilter={activeFilter} onFilter={setActiveFilter} />
      </Stack>

      {activeFilter && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`Filtered: ${activeFilter.replace('-', ' ')}`}
            size="small"
            color="primary"
            onDelete={() => setActiveFilter(null)}
          />
          <Typography variant="caption" color="text.secondary">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</Typography>
        </Box>
      )}

      <TextField
        size="small"
        placeholder="Search events..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{ mb: 2, width: 300 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch('')} edge="end" aria-label="clear search">
                <CancelIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={sortField === 'name'} direction={sortField === 'name' ? sortDir : 'asc'} onClick={() => handleSort('name')}>
                  Event
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
            {filtered.map(({ event, score, checks }) => (
              <TableRow key={event.id} sx={{ backgroundColor: scoreBgColor(score), '&:hover': { opacity: 0.9 } }}>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">{event.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {event.type} · {event.activityType}
                    {event.locationName ? ` · ${event.locationName}` : ''}
                  </Typography>
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
                    label={event.status}
                    size="small"
                    color={event.status === 'Confirmed' ? 'success' : event.status === 'Cancelled' ? 'error' : event.status === 'Hidden' || event.status === 'Unlisted' ? 'default' : 'warning'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap>
                    {checks.filter(c => !c.na).map(check => (
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
                  {onViewEvent && (
                    <IconButton size="small" onClick={() => onViewEvent(event.slug)} title="View event">
                      <VisibilityIcon fontSize="small" />
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
          {activeFilter ? 'No events match this filter.' : search ? 'No events match your search.' : 'No events found.'}
        </Typography>
      )}
    </Box>
  );
}

function SummaryCard({
  title, value, color, filter, activeFilter, onFilter,
}: {
  title: string;
  value: string | number;
  color: string;
  filter?: QuickFilter;
  activeFilter?: QuickFilter | null;
  onFilter?: (f: QuickFilter | null) => void;
}) {
  const isActive = filter != null && activeFilter === filter;
  const isClickable = filter != null && onFilter != null;
  return (
    <Card
      variant="outlined"
      onClick={isClickable ? () => onFilter(isActive ? null : filter) : undefined}
      sx={{
        minWidth: 130,
        flex: '1 1 130px',
        ...(isClickable && {
          cursor: 'pointer',
          transition: 'box-shadow 0.15s, border-color 0.15s',
          '&:hover': { boxShadow: 3, borderColor: color },
        }),
        ...(isActive && { borderColor: color, borderWidth: 2, boxShadow: 3 }),
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color={isActive ? color : 'text.secondary'} fontWeight={isActive ? 700 : 400}>
          {title}
        </Typography>
        <Typography variant="h5" fontWeight="bold" sx={{ color }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}
