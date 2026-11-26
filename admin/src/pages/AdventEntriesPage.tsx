import { useEffect, useState, useCallback } from 'react';
import {
    Box, Typography, Paper, Grid, CircularProgress, Alert, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
    Button, Pagination, useTheme,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import PeopleIcon from '@mui/icons-material/People';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { apiFetch } from '../hooks/api';
import { supabase } from '../hooks/supabase';
import StatCard from '../components/StatCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const PAGE_SIZE = 25;
const ADVENT_DAYS = 24;

interface AdventEntrySummaryDto {
    email: string;
    ticketCount: number;
    lastDay: number;
    lastAnsweredAt: string;
}

interface AdventEntrySummariesResult {
    items: AdventEntrySummaryDto[];
    total: number;
}

// Mirrors backend/Application/Advent/Queries/GetAdventStatsQuery.cs's AdventDailyStatDto/AdventStatsDto.
interface AdventDailyStatDto {
    day: number;
    participantCount: number;
    ticketCount: number;
}

interface AdventStatsDto {
    totalParticipants: number;
    totalTickets: number;
    totalAnswers: number;
    totalShares: number;
    dailyStats: AdventDailyStatDto[];
}

type SortBy = 'email' | 'lastDay' | 'ticketCount';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('is-IS', { dateStyle: 'short', timeStyle: 'short' });
}

// dailyStats is sparse (days with zero entries are never materialized server-side, see
// GetAdventStatsQuery.cs) — build the full 1-24 range here so the chart never shows a gap in
// the axis, same technique as AnalyticsPage.tsx's filledHourlyViews.
export function fillDailyStats(dailyStats: AdventDailyStatDto[]): AdventDailyStatDto[] {
    return Array.from({ length: ADVENT_DAYS }, (_, i) => {
        const day = i + 1;
        const found = dailyStats.find(d => d.day === day);
        return found ?? { day, participantCount: 0, ticketCount: 0 };
    });
}

export default function AdventEntriesPage({ onNotify }: { onNotify: (msg: string, severity?: 'success' | 'error') => void }) {
    const theme = useTheme();
    const [items, setItems] = useState<AdventEntrySummaryDto[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    // Backend default is ticketCount desc (GetAdventEntrySummariesQueryHandler) — matched here so
    // the initial render doesn't flash one order and then re-sort to another.
    const [sortBy, setSortBy] = useState<SortBy>('ticketCount');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [downloading, setDownloading] = useState(false);

    // Independent of the table's load()/items state below — the KPI/chart section must be able
    // to fail (e.g. the stats endpoint erroring) without blocking the per-email table from
    // rendering, per #1895's acceptance criteria.
    const [stats, setStats] = useState<AdventStatsDto | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState(false);

    useEffect(() => {
        apiFetch<AdventStatsDto>('/api/v1/admin/advent/stats')
            .then(data => { setStats(data); setStatsError(false); })
            .catch(() => setStatsError(true))
            .finally(() => setStatsLoading(false));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sortBy, sortDir });
            const data = await apiFetch<AdventEntrySummariesResult>(`/api/v1/admin/advent/entries?${params}`);
            setItems(data.items);
            setTotal(data.total);
        } catch {
            onNotify('Failed to load advent entries', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, sortBy, sortDir, onNotify]);

    useEffect(() => { void load(); }, [load]);

    function handleSort(col: SortBy) {
        if (col === sortBy) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(col);
            setSortDir('desc');
        }
        setPage(1);
    }

    // Builds the manual-draw ticket list from the rows currently on screen, in the sort order
    // shown — not a re-fetch of all pages, since the draw is run page by page against this table.
    function handleCopyTicketList() {
        const lines = items.map(i => `${i.email}  ${i.ticketCount}`);
        void navigator.clipboard.writeText(lines.join('\n'));
        onNotify('Ticket list copied to clipboard', 'success');
    }

    // The export endpoint is [Authorize(Policy = "AdminOnly")] and admin auth here is
    // bearer-token-only (no cookie scheme) — a bare <a href download> sends no Authorization
    // header and 401s, so the file is fetched with the token and downloaded via a blob + object
    // URL instead, same end result for the user but actually authenticated.
    async function handleDownload() {
        setDownloading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(`${API_URL}/api/v1/admin/advent/entries/export`, {
                headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
            });
            if (!response.ok) throw new Error(response.statusText);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'advent-entries.txt';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            onNotify('Failed to download participant list', 'error');
        } finally {
            setDownloading(false);
        }
    }

    const pageCount = Math.ceil(total / PAGE_SIZE);

    const sortProps = (col: SortBy) => ({
        active: sortBy === col,
        direction: sortBy === col ? sortDir : 'desc' as SortDir,
        onClick: () => handleSort(col),
    });

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h5" fontWeight={700}>Jólaleikur Entries</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ContentCopyIcon />}
                        onClick={handleCopyTicketList}
                        disabled={items.length === 0}
                        sx={{ textTransform: 'none' }}
                    >
                        Copy ticket list
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => void handleDownload()}
                        disabled={downloading}
                        startIcon={<DownloadIcon />}
                        sx={{ textTransform: 'none' }}
                    >
                        Download participant list (.txt)
                    </Button>
                    <Typography variant="body2" color="text.secondary">{total} emails</Typography>
                </Box>
            </Box>

            {/* KPI row + daily chart — independent of the table below: a failed /stats fetch
                shows an inline alert here but never blocks the per-email table from rendering. */}
            {statsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
            ) : statsError || !stats ? (
                <Alert severity="warning" sx={{ mb: 2 }}>Failed to load advent stats.</Alert>
            ) : (
                <>
                    {/* Below the sm breakpoint (<600px, i.e. phones) tiles stack one-per-row
                        (xs=10) — at 375px two xs=5 tiles were only ~155px of content width each,
                        too tight for "Answers vs Shares" plus its "Answer entries / share
                        entries" subtitle without crowding. sm=5 keeps the familiar two-per-row
                        for tablets, md=2 (five-per-row, matching AnalyticsPage.tsx) is unchanged.
                        See #1900. */}
                    <Grid container spacing={2} columns={10} mb={3}>
                        {/* #1976d2 was MUI's default primary blue, but this app's theme
                            overrides primary.main to forest green (App.tsx) — mapping to
                            primary.main here would silently turn this tile green. info.main
                            is the closest semantic blue left at MUI default. See #1899. */}
                        <Grid item xs={10} sm={5} md={2}>
                            <StatCard
                                title="Total Participants"
                                value={stats.totalParticipants.toLocaleString()}
                                subtitle="Distinct emails"
                                icon={<PeopleIcon />}
                                color={theme.palette.info.main}
                            />
                        </Grid>
                        <Grid item xs={10} sm={5} md={2}>
                            <StatCard
                                title="Total Tickets"
                                value={stats.totalTickets.toLocaleString()}
                                subtitle="Entries earned"
                                icon={<ConfirmationNumberIcon />}
                                color={theme.palette.success.main}
                            />
                        </Grid>
                        <Grid item xs={10} sm={5} md={2}>
                            <StatCard
                                title="Answers vs Shares"
                                value={`${stats.totalAnswers.toLocaleString()} / ${stats.totalShares.toLocaleString()}`}
                                subtitle="Answer entries / share entries"
                                icon={<QuestionAnswerIcon />}
                                color={theme.palette.warning.main}
                            />
                        </Grid>
                    </Grid>

                    <Paper elevation={2} sx={{ p: 2.5, mb: 3 }}>
                        <Typography variant="h6" fontWeight="bold" mb={2}>
                            Tickets by Day
                        </Typography>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={fillDailyStats(stats.dailyStats)}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="day" fontSize={12} />
                                <YAxis fontSize={12} allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="ticketCount" name="Tickets" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="participantCount" name="Participants" fill="#1976d2" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : items.length === 0 ? (
                <Alert severity="info">No advent calendar entries yet.</Alert>
            ) : (
                <>
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>
                                        <TableSortLabel {...sortProps('email')}>Email</TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel {...sortProps('ticketCount')}>Tickets</TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel {...sortProps('lastDay')}>Last Day</TableSortLabel>
                                    </TableCell>
                                    <TableCell>Last Answered</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {items.map(item => (
                                    <TableRow key={item.email} hover>
                                        <TableCell sx={{ wordBreak: 'break-all' }}>
                                            <Typography variant="body2">{item.email}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">{item.ticketCount}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">{item.lastDay}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            <Typography variant="caption">{formatDate(item.lastAnsweredAt)}</Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {pageCount > 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Pagination
                                count={pageCount}
                                page={page}
                                onChange={(_, v) => setPage(v)}
                                size="small"
                                color="primary"
                            />
                        </Box>
                    )}
                </>
            )}

            <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    "Copy ticket list" copies the rows on this page only, for a manual weighted draw.
                    "Download participant list" hands the full deduplicated email list to Sportís as plain text.
                </Typography>
            </Box>
        </Box>
    );
}
