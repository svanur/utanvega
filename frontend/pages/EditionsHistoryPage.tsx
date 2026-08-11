import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Container, Typography, Box, Stack, TextField, InputAdornment, IconButton,
    Select, MenuItem, FormControlLabel, Checkbox, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TableSortLabel, Paper, Chip, Tooltip,
    CircularProgress, useTheme, type SelectChangeEvent,
    ToggleButtonGroup, ToggleButton, Card, CardActionArea, CardContent, Button,
} from '@mui/material';
import type { PaletteMode } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ListIcon from '@mui/icons-material/List';
import TableChartIcon from '@mui/icons-material/TableChart';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Layout from '../components/Layout';
import { useEditionsHistory, useEditionsHistoryYears } from '../hooks/useEvents';
import { ActivityIcons } from '../utils/activityIcon';
import { groupDistances } from '../utils/ticketStatus';
import { formatNextDate, formatDateRange } from '../utils/eventUtils';
import { useLocalize } from '../utils/localize';

type SortField = 'date' | 'name' | 'distances';
type SortDir = 'asc' | 'desc';
type ViewMode = 'list' | 'table';

type EditionsHistoryPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function EditionsHistoryPage({ mode, onToggleMode }: EditionsHistoryPageProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const loc = useLocalize();
    const { year: yearParam } = useParams<{ year?: string }>();
    const theme = useTheme();

    const { years } = useEditionsHistoryYears();
    const parsedYearParam = yearParam ? Number(yearParam) : undefined;
    const activeYear = (parsedYearParam && !Number.isNaN(parsedYearParam)) ? parsedYearParam : years[0];

    const handleYearChange = (year: number) => {
        navigate(`/editions/history/${year}`);
    };

    // years is sorted newest-first, so a lower index is a newer year.
    const currentYearIndex = activeYear != null ? years.indexOf(activeYear) : -1;
    const newerYear = currentYearIndex > 0 ? years[currentYearIndex - 1] : null;
    const olderYear = currentYearIndex >= 0 && currentYearIndex < years.length - 1 ? years[currentYearIndex + 1] : null;

    const [searchParams, setSearchParams] = useSearchParams();
    const viewModeFromUrl = searchParams.get('view');
    const viewMode: ViewMode = (viewModeFromUrl === 'list' || viewModeFromUrl === 'table')
        ? viewModeFromUrl
        : (() => { try { const s = localStorage.getItem('utanvega-editions-history-view-mode'); return (s === 'list' || s === 'table') ? s : 'list'; } catch { return 'list'; } })();
    const setViewMode = (v: ViewMode) => {
        setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('view', v); return next; }, { replace: true });
        try { localStorage.setItem('utanvega-editions-history-view-mode', v); } catch { /* */ }
    };

    const [search, setSearch] = useState('');
    const [showCancelled, setShowCancelled] = useState(true);
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const { rows, loading } = useEditionsHistory(activeYear, showCancelled);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const filteredSorted = useMemo(() => {
        const q = search.toLowerCase().trim();
        const result = q
            ? rows.filter(r => r.eventName.toLowerCase().includes(q) || r.locationName?.toLowerCase().includes(q))
            : rows;

        return [...result].sort((a, b) => {
            let cmp = 0;
            if (sortField === 'date') cmp = a.rowDate.localeCompare(b.rowDate);
            else if (sortField === 'name') cmp = a.eventName.localeCompare(b.eventName, 'is');
            else if (sortField === 'distances') cmp = (a.distances[0]?.label ?? '').localeCompare(b.distances[0]?.label ?? '');
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [rows, search, sortField, sortDir]);

    return (
        <Layout mode={mode} onToggleMode={onToggleMode} maxWidth={viewMode === 'table' ? 'lg' : 'md'}>
            <Container maxWidth={viewMode === 'table' ? 'lg' : 'md'} sx={{ py: 3 }}>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" fontWeight={800} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HistoryIcon sx={{ fontSize: 32, color: theme.palette.primary.main }} />
                        {t('races.editionsHistory.title', 'Past events')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('races.editionsHistory.subtitle', 'Browse results and details from races that have already happened.')}
                    </Typography>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2 }}>
                    <Select
                        size="small"
                        value={activeYear ?? ''}
                        onChange={(e: SelectChangeEvent<number>) => handleYearChange(Number(e.target.value))}
                        sx={{ minWidth: 100 }}
                        disabled={years.length === 0}
                    >
                        {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </Select>
                    <TextField
                        placeholder={t('races.editionsHistory.searchPlaceholder', 'Search past events...')}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        size="small"
                        fullWidth
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                            endAdornment: search ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setSearch('')}><CloseIcon fontSize="small" /></IconButton>
                                </InputAdornment>
                            ) : null,
                        }}
                    />
                    <FormControlLabel
                        control={<Checkbox size="small" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} />}
                        label={t('races.editionsHistory.showCancelled', 'Show cancelled')}
                        sx={{ whiteSpace: 'nowrap' }}
                    />
                </Stack>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {!loading && t('races.editionCount', { count: filteredSorted.length })}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Stack direction="row" spacing={0.5}>
                            <IconButton
                                size="small"
                                disabled={!olderYear}
                                onClick={() => olderYear && handleYearChange(olderYear)}
                                aria-label={t('races.history.older', { defaultValue: 'Older' })}
                            >
                                <NavigateBeforeIcon />
                            </IconButton>
                            <IconButton
                                size="small"
                                disabled={!newerYear}
                                onClick={() => newerYear && handleYearChange(newerYear)}
                                aria-label={t('races.history.newer', { defaultValue: 'Newer' })}
                            >
                                <NavigateNextIcon />
                            </IconButton>
                        </Stack>
                        <ToggleButtonGroup
                            value={viewMode}
                            exclusive
                            onChange={(_, value) => { if (value) setViewMode(value as ViewMode); }}
                            size="small"
                            aria-label={t('home.viewMode')}
                        >
                            <Tooltip title={t('home.listView')}>
                                <ToggleButton value="list" aria-label={t('home.listView')}>
                                    <ListIcon fontSize="small" />
                                </ToggleButton>
                            </Tooltip>
                            <Tooltip title={t('home.tableView')}>
                                <ToggleButton value="table" aria-label={t('home.tableView')}>
                                    <TableChartIcon fontSize="small" />
                                </ToggleButton>
                            </Tooltip>
                        </ToggleButtonGroup>
                    </Stack>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
                ) : filteredSorted.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
                        {t('races.editionsHistory.noResults', 'No past events found.')}
                    </Typography>
                ) : viewMode === 'list' ? (
                    <Stack spacing={1.5}>
                        {filteredSorted.map(row => {
                            const cancelled = row.effectiveCancelled;
                            return (
                                <Card
                                    key={`${row.editionId}-${row.rowDate}`}
                                    variant="outlined"
                                    sx={{
                                        '@media (hover: hover)': { transition: 'transform 0.15s, box-shadow 0.15s', '&:hover': { transform: 'translateY(-2px)', boxShadow: theme.shadows[4] } },
                                        ...(cancelled && { opacity: 0.65 }),
                                    }}
                                >
                                    <CardActionArea onClick={() => navigate(`/events/${row.eventSlug}/history/${row.editionYear ?? row.editionId}`)}>
                                        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                                            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-start' }} gap={0.5}>
                                                <Stack direction="row" alignItems="flex-start" gap={1} sx={{ minWidth: 0, width: '100%' }}>
                                                    <ActivityIcons activityTypes={row.activityTypes} activityType={row.activityTypes?.[0] ?? row.eventActivityType} />
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
                                                            <Typography
                                                                variant="subtitle1"
                                                                fontWeight={700}
                                                                sx={{ ...(cancelled && { textDecoration: 'line-through' }), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: { xs: 'normal', sm: 'nowrap' } }}
                                                            >
                                                                {row.eventName}
                                                            </Typography>
                                                            {cancelled && (
                                                                <Chip label={t('races.statusCancelled')} size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
                                                            )}
                                                        </Stack>
                                                        {row.raceName && (
                                                            <Typography variant="body2" color="text.secondary" noWrap>
                                                                {loc(row.raceName, row.raceNameEn)}
                                                            </Typography>
                                                        )}
                                                        {row.locationName && (
                                                            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.25 }}>
                                                                <LocationOnIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                                                                <Typography variant="body2" color="text.secondary" noWrap>{row.locationName}</Typography>
                                                            </Stack>
                                                        )}
                                                    </Box>
                                                </Stack>
                                                <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }}>
                                                    <CalendarTodayIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                                                    <Typography variant="body2" color="text.secondary" noWrap>
                                                        {row.rowEndDate ? formatDateRange(row.rowDate, row.rowEndDate, t) : formatNextDate(row.rowDate, t)}
                                                    </Typography>
                                                </Stack>
                                            </Stack>

                                            {row.distances.length > 0 && (
                                                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>
                                                    {groupDistances(row.distances).map((d, i) => (
                                                        <Chip key={i} label={d.count > 1 ? `${d.count} × ${d.label}` : d.label} size="small" variant="outlined" />
                                                    ))}
                                                </Stack>
                                            )}

                                            {row.resultsUrl && (
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    href={row.resultsUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                                                    onClick={e => e.stopPropagation()}
                                                    sx={{ mt: 0.75, textTransform: 'none', fontSize: '0.8rem' }}
                                                >
                                                    {t('races.editionsHistory.resultsLink', 'Results')}
                                                </Button>
                                            )}
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            );
                        })}
                    </Stack>
                ) : (
                    <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2, overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ width: 32, p: 0.5 }} />
                                    <TableCell>
                                        <TableSortLabel active={sortField === 'date'} direction={sortField === 'date' ? sortDir : 'asc'} onClick={() => handleSort('date')}>
                                            {t('races.table.date', 'Date')}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel active={sortField === 'name'} direction={sortField === 'name' ? sortDir : 'asc'} onClick={() => handleSort('name')}>
                                            {t('races.table.name', 'Name')}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel active={sortField === 'distances'} direction={sortField === 'distances' ? sortDir : 'asc'} onClick={() => handleSort('distances')}>
                                            {t('races.table.distances', 'Distances')}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="center">{t('races.editionsHistory.resultsLink', 'Results')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredSorted.map(row => {
                                    const cancelled = row.effectiveCancelled;
                                    return (
                                        <TableRow
                                            key={`${row.editionId}-${row.rowDate}`}
                                            hover
                                            sx={{ cursor: 'pointer', ...(cancelled && { opacity: 0.6 }) }}
                                            onClick={() => navigate(`/events/${row.eventSlug}/history/${row.editionYear ?? row.editionId}`)}
                                        >
                                            <TableCell sx={{ p: 0.5 }}>
                                                <ActivityIcons activityTypes={row.activityTypes} activityType={row.activityTypes?.[0] ?? row.eventActivityType} />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" noWrap>
                                                    {row.rowEndDate ? formatDateRange(row.rowDate, row.rowEndDate, t) : formatNextDate(row.rowDate, t)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={600} noWrap sx={{ ...(cancelled && { textDecoration: 'line-through' }) }}>
                                                    {row.eventName}
                                                </Typography>
                                                {row.raceName && (
                                                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                                                        {loc(row.raceName, row.raceNameEn)}
                                                    </Typography>
                                                )}
                                                {cancelled && (
                                                    <Chip label={t('races.statusCancelled')} size="small" color="error" sx={{ height: 18, fontSize: '0.65rem', mt: 0.25 }} />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {row.distances.length > 0 ? (
                                                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                                                        {groupDistances(row.distances).map((d, i) => (
                                                            <Chip key={i} label={d.count > 1 ? `${d.count} × ${d.label}` : d.label} size="small" variant="outlined" />
                                                        ))}
                                                    </Stack>
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary">—</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell align="center" onClick={e => e.stopPropagation()}>
                                                {row.resultsUrl ? (
                                                    <Tooltip title={t('races.editionsHistory.resultsLink', 'Results')}>
                                                        <IconButton size="small" component="a" href={row.resultsUrl} target="_blank" rel="noopener noreferrer">
                                                            <OpenInNewIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary">—</Typography>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Container>
        </Layout>
    );
}
