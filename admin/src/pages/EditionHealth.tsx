import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, Chip, LinearProgress, Card,
  CardContent, Stack, Tooltip, IconButton, TextField, InputAdornment,
  Collapse, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { apiFetch } from '../hooks/api';
import type { EventDetailDto, EventEditionDto, RaceDto } from '../hooks/useEvents';

interface HealthCheck {
  label: string;
  passed: boolean;
  tooltip: string;
}

const today = new Date();
today.setHours(0, 0, 0, 0);

function isPast(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < today;
}

function getEditionChecks(edition: EventEditionDto, eventName: string): HealthCheck[] {
  const hasPastDate = isPast(edition.endDate ?? edition.date);
  const allRacesHaveTrail = edition.races.length > 0 && edition.races.every(r => r.trailId != null);

  return [
    {
      label: 'Date',
      passed: edition.date != null,
      tooltip: edition.date ?? 'No date set',
    },
    {
      label: 'Year',
      passed: edition.year != null,
      tooltip: edition.year != null ? `Year: ${edition.year}` : 'No year set',
    },
    {
      label: 'Races',
      passed: edition.races.length > 0,
      tooltip: edition.races.length > 0 ? `${edition.races.length} race(s)` : 'No races',
    },
    {
      label: 'Trail',
      passed: edition.trailId != null || allRacesHaveTrail,
      tooltip: edition.trailId != null
        ? `Edition trail: ${edition.trailName}`
        : allRacesHaveTrail
          ? 'Each race has a trail'
          : 'No trail linked (edition or races)',
    },
    {
      label: 'Reg. URL',
      passed: !!edition.registrationUrl,
      tooltip: edition.registrationUrl ?? 'No registration URL',
    },
    {
      label: 'Results URL',
      passed: hasPastDate ? !!edition.resultsUrl : true,
      tooltip: hasPastDate
        ? (edition.resultsUrl ?? 'Past edition — results URL missing')
        : 'Future edition — not required yet',
    },
    {
      label: 'Reg. Status',
      passed: hasPastDate ? edition.registrationStatus === 'Closed' : true,
      tooltip: hasPastDate
        ? (edition.registrationStatus === 'Closed'
            ? 'Closed (correct for past edition)'
            : `Registration is "${edition.registrationStatus}" but edition is in the past`)
        : `Status: ${edition.registrationStatus}`,
    },
  ];
}

function getRaceChecks(race: RaceDto): HealthCheck[] {
  return [
    {
      label: 'Date',
      passed: race.dateOfRace != null,
      tooltip: race.dateOfRace != null ? String(race.dateOfRace) : 'No race date',
    },
    {
      label: 'Trail',
      passed: race.trailId != null,
      tooltip: race.trailId != null ? (race.trailName ?? 'Trail linked') : 'No trail linked',
    },
    {
      label: 'Distance',
      passed: !!race.distanceLabel,
      tooltip: race.distanceLabel ?? 'No distance label',
    },
    {
      label: 'Start Time',
      passed: race.startTime != null,
      tooltip: race.startTime != null ? String(race.startTime) : 'No start time',
    },
  ];
}

function scoreFromChecks(checks: HealthCheck[]): number {
  if (checks.length === 0) return 100;
  return Math.round((checks.filter(c => c.passed).length / checks.length) * 100);
}

function scoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 100) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

interface ScoredEdition {
  event: EventDetailDto;
  edition: EventEditionDto;
  score: number;
  editionChecks: HealthCheck[];
  raceRows: { race: RaceDto; checks: HealthCheck[]; score: number }[];
  // Pre-computed flags — avoids brittle label-string lookups in filter/count logic
  hasTrail: boolean;
  hasResults: boolean;
  hasGoodStatus: boolean;
}

type SortField = 'event' | 'year' | 'score';
type QuickFilter = 'critical' | 'no-date' | 'no-races' | 'no-trail' | 'no-results' | 'bad-status';

interface EditionHealthProps {
  onEditEvent?: (eventId: string) => void;
  onNotify: (message: React.ReactNode, severity?: 'success' | 'error') => void;
}

export default function EditionHealth({ onEditEvent, onNotify }: EditionHealthProps) {
  const theme = useTheme();
  const [events, setEvents] = useState<EventDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(null);
  const [expandedEditions, setExpandedEditions] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<EventDetailDto[]>('/api/v1/admin/events/details');
        setEvents(data);
      } catch {
        onNotify('Failed to load edition data', 'error');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scored = useMemo<ScoredEdition[]>(() => {
    const result: ScoredEdition[] = [];
    for (const event of events) {
      if (event.status === 'Cancelled') continue;
      for (const edition of event.editions) {
        const editionChecks = getEditionChecks(edition, event.name);
        const raceRows = edition.races.map(r => {
          const checks = getRaceChecks(r);
          return { race: r, checks, score: scoreFromChecks(checks) };
        });
        const allChecks = [
          ...editionChecks,
          ...raceRows.flatMap(rr => rr.checks),
        ];
        const hasTrail = editionChecks.find(c => c.label === 'Trail')!.passed;
        const hasResults = editionChecks.find(c => c.label === 'Results URL')!.passed;
        const hasGoodStatus = editionChecks.find(c => c.label === 'Reg. Status')!.passed;
        result.push({
          event,
          edition,
          score: scoreFromChecks(allChecks),
          editionChecks,
          raceRows,
          hasTrail,
          hasResults,
          hasGoodStatus,
        });
      }
    }
    return result;
  }, [events]);

  const scoreBgColor = (score: number) => {
    if (score >= 100) return alpha(theme.palette.success.main, 0.07);
    if (score >= 50) return alpha(theme.palette.warning.main, 0.1);
    return alpha(theme.palette.error.main, 0.1);
  };

  const filtered = useMemo(() => {
    let result = scored;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.event.name.toLowerCase().includes(q) ||
        s.event.slug.toLowerCase().includes(q)
      );
    }
    switch (activeFilter) {
      case 'critical':    result = result.filter(s => s.score < 50); break;
      case 'no-date':     result = result.filter(s => !s.edition.date); break;
      case 'no-races':    result = result.filter(s => s.edition.races.length === 0); break;
      case 'no-trail':    result = result.filter(s => !s.hasTrail); break;
      case 'no-results':  result = result.filter(s => !s.hasResults); break;
      case 'bad-status':  result = result.filter(s => !s.hasGoodStatus); break;
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'event': cmp = a.event.name.localeCompare(b.event.name); break;
        case 'year':  cmp = (a.edition.year ?? 0) - (b.edition.year ?? 0); break;
        case 'score': cmp = a.score - b.score; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [scored, search, activeFilter, sortField, sortDir]);

  const totalEditions = scored.length;
  const perfectCount = scored.filter(s => s.score === 100).length;
  const criticalCount = scored.filter(s => s.score < 50).length;
  const noDateCount = scored.filter(s => !s.edition.date).length;
  const noRacesCount = scored.filter(s => s.edition.races.length === 0).length;
  const noTrailCount = scored.filter(s => !s.hasTrail).length;
  const noResultsCount = scored.filter(s => !s.hasResults).length;
  const badStatusCount = scored.filter(s => !s.hasGoodStatus).length;
  const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, e) => s + e.score, 0) / scored.length) : 0;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleExpand = (id: string) => {
    setExpandedEditions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) {
    return <Box sx={{ p: 3 }}><LinearProgress /><Typography sx={{ mt: 1 }}>Loading edition data...</Typography></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Edition Health Dashboard</Typography>
      </Box>

      <Stack direction="row" spacing={2} sx={{ mb: activeFilter ? 1.5 : 3 }} flexWrap="wrap" useFlexGap>
        <SummaryCard title="Total Editions" value={totalEditions} color="#1976d2" />
        <SummaryCard title="Avg Health" value={`${avgScore}%`} color={avgScore >= 80 ? '#2e7d32' : avgScore >= 50 ? '#ed6c02' : '#d32f2f'} />
        <SummaryCard title="Perfect (100%)" value={perfectCount} color="#2e7d32" />
        <SummaryCard title="Critical (<50%)" value={criticalCount} color="#d32f2f"
          filter="critical" activeFilter={activeFilter} onFilter={setActiveFilter} />
        <SummaryCard title="No Date" value={noDateCount} color={noDateCount > 0 ? '#ed6c02' : '#2e7d32'}
          filter="no-date" activeFilter={activeFilter} onFilter={setActiveFilter} />
        <SummaryCard title="No Races" value={noRacesCount} color={noRacesCount > 0 ? '#ed6c02' : '#2e7d32'}
          filter="no-races" activeFilter={activeFilter} onFilter={setActiveFilter} />
        <SummaryCard title="No Trail" value={noTrailCount} color={noTrailCount > 0 ? '#ed6c02' : '#2e7d32'}
          filter="no-trail" activeFilter={activeFilter} onFilter={setActiveFilter} />
        <SummaryCard title="No Results URL" value={noResultsCount} color={noResultsCount > 0 ? '#ed6c02' : '#2e7d32'}
          filter="no-results" activeFilter={activeFilter} onFilter={setActiveFilter} />
        <SummaryCard title="Open (past)" value={badStatusCount} color={badStatusCount > 0 ? '#d32f2f' : '#2e7d32'}
          filter="bad-status" activeFilter={activeFilter} onFilter={setActiveFilter} />
      </Stack>

      {activeFilter && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`Filtered: ${activeFilter.replace(/-/g, ' ')}`}
            size="small"
            color="primary"
            onDelete={() => setActiveFilter(null)}
          />
          <Typography variant="caption" color="text.secondary">
            {filtered.length} edition{filtered.length !== 1 ? 's' : ''}
          </Typography>
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
              <IconButton size="small" onClick={() => setSearch('')} edge="end">
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
              <TableCell width={32} />
              <TableCell>
                <TableSortLabel active={sortField === 'event'} direction={sortField === 'event' ? sortDir : 'asc'} onClick={() => handleSort('event')}>
                  Event
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel active={sortField === 'year'} direction={sortField === 'year' ? sortDir : 'asc'} onClick={() => handleSort('year')}>
                  Year
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel active={sortField === 'score'} direction={sortField === 'score' ? sortDir : 'asc'} onClick={() => handleSort('score')}>
                  Health
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Edition Checks</TableCell>
              <TableCell align="center" width={48} />
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(({ event, edition, score, editionChecks, raceRows }) => {
              const expanded = expandedEditions.has(edition.id);
              return (
                <React.Fragment key={edition.id}>
                  <TableRow sx={{ backgroundColor: scoreBgColor(score), '&:hover': { opacity: 0.9 }, cursor: raceRows.length > 0 ? 'pointer' : undefined }}
                    onClick={() => raceRows.length > 0 && toggleExpand(edition.id)}
                  >
                    <TableCell padding="none" align="center">
                      {raceRows.length > 0 && (
                        <IconButton size="small">
                          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">{event.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {edition.date ?? 'No date'}{edition.title ? ` · ${edition.title}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={edition.year ?? '—'} size="small" variant="outlined" />
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
                      <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap>
                        {editionChecks.map(check => (
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
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      {onEditEvent && (
                        <IconButton size="small" onClick={() => onEditEvent(event.id)} title="Edit event">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>

                  {raceRows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ p: 0, borderBottom: expanded ? undefined : 'none' }}>
                        <Collapse in={expanded} unmountOnExit>
                          <Box sx={{ bgcolor: alpha(theme.palette.action.hover, 0.5), px: 4, py: 1 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', fontSize: '0.72rem' }}>Race</TableCell>
                                  <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '0.72rem' }}>Health</TableCell>
                                  <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '0.72rem' }}>Checks</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {raceRows.map(({ race, checks, score: rScore }) => (
                                  <TableRow key={race.id} sx={{ backgroundColor: scoreBgColor(rScore) }}>
                                    <TableCell>
                                      <Typography variant="body2">{race.name}</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {race.distanceLabel ?? 'No distance'}{race.dateOfRace ? ` · ${race.dateOfRace}` : ''}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                                        <LinearProgress
                                          variant="determinate"
                                          value={rScore}
                                          color={scoreColor(rScore)}
                                          sx={{ width: 50, height: 6, borderRadius: 1 }}
                                        />
                                        <Typography variant="caption" fontWeight="bold" color={`${scoreColor(rScore)}.main`}>
                                          {rScore}%
                                        </Typography>
                                      </Box>
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
                                              sx={{ fontSize: '0.65rem', height: 22, '& .MuiChip-icon': { fontSize: 12 } }}
                                            />
                                          </Tooltip>
                                        ))}
                                      </Stack>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {filtered.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          {activeFilter ? 'No editions match this filter.' : search ? 'No editions match your search.' : 'No editions found.'}
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
        minWidth: 120,
        flex: '1 1 120px',
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
