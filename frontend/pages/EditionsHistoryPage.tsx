import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Container, Typography, Box, Stack, TextField, InputAdornment, IconButton,
    Select, MenuItem, FormControlLabel, Checkbox, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TableSortLabel, Paper, Chip, Tooltip,
    CircularProgress, useTheme, type SelectChangeEvent,
} from '@mui/material';
import type { PaletteMode } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Layout from '../components/Layout';
import { useEditionsHistory, useEditionsHistoryYears } from '../hooks/useEvents';
import { ActivityIcons } from '../utils/activityIcon';
import { groupDistances } from '../utils/ticketStatus';
import { formatNextDate, formatDateRange } from '../utils/eventUtils';

type SortField = 'date' | 'name' | 'distances';
type SortDir = 'asc' | 'desc';

type EditionsHistoryPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function EditionsHistoryPage({ mode, onToggleMode }: EditionsHistoryPageProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { year: yearParam } = useParams<{ year?: string }>();
    const theme = useTheme();

    const { years } = useEditionsHistoryYears();
    const parsedYearParam = yearParam ? Number(yearParam) : undefined;
    const activeYear = (parsedYearParam && !Number.isNaN(parsedYearParam)) ? parsedYearParam : years[0];

    const handleYearChange = (year: number) => {
        navigate(`/editions/history/${year}`);
    };

    const [search, setSearch] = useState('');
    const [showCancelled, setShowCancelled] = useState(true);
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const { rows, loading } = useEditionsHistory(activeYear, showCancelled);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir(field === 'date' ? 'desc' : 'asc');
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
        <Layout mode={mode} onToggleMode={onToggleMode} maxWidth="lg">
            <Container maxWidth="lg" sx={{ py: 3 }}>
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

                {!loading && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {t('races.editionCount', { count: filteredSorted.length })}
                    </Typography>
                )}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
                ) : filteredSorted.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
                        {t('races.editionsHistory.noResults', 'No past events found.')}
                    </Typography>
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
