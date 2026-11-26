import { useEffect, useState, useCallback } from 'react';
import {
    Box, Typography, Paper, CircularProgress, Alert, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
    Button, Pagination,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import { apiFetch } from '../hooks/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const PAGE_SIZE = 25;

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

type SortBy = 'email' | 'lastDay' | 'ticketCount';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('is-IS', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdventEntriesPage({ onNotify }: { onNotify: (msg: string, severity?: 'success' | 'error') => void }) {
    const [items, setItems] = useState<AdventEntrySummaryDto[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    // Backend default is ticketCount desc (GetAdventEntrySummariesQueryHandler) — matched here so
    // the initial render doesn't flash one order and then re-sort to another.
    const [sortBy, setSortBy] = useState<SortBy>('ticketCount');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

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
                        component="a"
                        href={`${API_URL}/api/v1/admin/advent/entries/export`}
                        download="advent-entries.txt"
                        startIcon={<DownloadIcon />}
                        sx={{ textTransform: 'none' }}
                    >
                        Download participant list (.txt)
                    </Button>
                    <Typography variant="body2" color="text.secondary">{total} emails</Typography>
                </Box>
            </Box>

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
