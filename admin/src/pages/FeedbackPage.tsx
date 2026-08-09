import { useEffect, useState, useCallback } from 'react';
import {
    Box, Typography, Paper, Chip, CircularProgress, Alert, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider,
    ToggleButton, ToggleButtonGroup, Link,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArchiveIcon from '@mui/icons-material/Archive';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FeedbackIcon from '@mui/icons-material/Feedback';
import { apiFetch } from '../hooks/api';

interface FeedbackDto {
    id: string;
    pageUrl: string;
    message: string;
    category: string | null;
    name: string | null;
    email: string | null;
    stepsToReproduce: string | null;
    browserInfo: string | null;
    screenshotUrl: string | null;
    status: string;
    createdAt: string;
}

interface FeedbackResult {
    items: FeedbackDto[];
    total: number;
}

const STATUS_COLORS: Record<string, 'warning' | 'info' | 'default'> = {
    new: 'warning',
    reviewed: 'info',
    closed: 'default',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    bug: <BugReportIcon fontSize="small" color="error" />,
    suggestion: <LightbulbIcon fontSize="small" color="warning" />,
    question: <HelpOutlineIcon fontSize="small" color="info" />,
    other: <FeedbackIcon fontSize="small" color="action" />,
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('is-IS', { dateStyle: 'short', timeStyle: 'short' });
}

function BrowserInfoPanel({ raw }: { raw: string }) {
    try {
        const info = JSON.parse(raw);
        const rows = [
            ['Browser / OS', info.userAgent],
            ['Screen', `${info.screenW}×${info.screenH} (${info.devicePixelRatio}x)`],
            ['Viewport', `${info.viewportW}×${info.viewportH}`],
            ['Mobile', info.isMobile ? 'Yes' : 'No'],
            ['Language', info.language],
            ['Timezone', info.timezone],
            ['Connection', info.connection ?? '—'],
            ['Online', info.online ? 'Yes' : 'No'],
            ['Page title', info.pageTitle],
        ];
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {rows.map(([label, value]) => (
                    <Box key={label} sx={{ display: 'flex', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90, flexShrink: 0 }}>{label}</Typography>
                        <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>{String(value)}</Typography>
                    </Box>
                ))}
            </Box>
        );
    } catch {
        return <Typography variant="caption" color="text.secondary">{raw}</Typography>;
    }
}

export default function FeedbackPage({ onNotify }: { onNotify: (msg: string, severity?: 'success' | 'error') => void }) {
    const [items, setItems] = useState<FeedbackDto[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('new');
    const [selected, setSelected] = useState<FeedbackDto | null>(null);
    const [cycling, setCycling] = useState<Set<string>>(new Set());

    const STATUS_CYCLE: Record<string, string> = { new: 'reviewed', reviewed: 'closed', closed: 'new' };
    const STATUS_LABELS: Record<string, string> = { new: 'New', reviewed: 'Reviewed', closed: 'Closed' };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const qs = statusFilter ? `?status=${statusFilter}` : '';
            const data = await apiFetch<FeedbackResult>(`/api/v1/admin/feedback${qs}`);
            setItems(data.items);
            setTotal(data.total);
        } catch {
            onNotify('Failed to load feedback', 'error');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, onNotify]);

    useEffect(() => { void load(); }, [load]);

    async function cycleStatus(item: FeedbackDto) {
        const next = STATUS_CYCLE[item.status] ?? 'new';
        setCycling(prev => new Set(prev).add(item.id));
        // optimistic
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: next } : i));
        if (selected?.id === item.id) setSelected(s => s ? { ...s, status: next } : s);
        try {
            await apiFetch(`/api/v1/admin/feedback/${item.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: next }),
            });
        } catch {
            // rollback
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: item.status } : i));
            if (selected?.id === item.id) setSelected(s => s ? { ...s, status: item.status } : s);
            onNotify('Failed to update status', 'error');
        } finally {
            setCycling(prev => { const n = new Set(prev); n.delete(item.id); return n; });
        }
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" fontWeight={700}>Beta Feedback</Typography>
                <Typography variant="body2" color="text.secondary">{total} entries</Typography>
            </Box>

            <ToggleButtonGroup
                value={statusFilter}
                exclusive
                size="small"
                onChange={(_, v) => { if (v !== null) setStatusFilter(v); }}
                sx={{ mb: 2 }}
            >
                {['new', 'reviewed', 'closed', ''].map(s => (
                    <ToggleButton key={s || 'all'} value={s} sx={{ textTransform: 'none' }}>
                        {s ? STATUS_LABELS[s] : 'All'}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : items.length === 0 ? (
                <Alert severity="info">No feedback in this category.</Alert>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Cat.</TableCell>
                                <TableCell>Message</TableCell>
                                <TableCell>From</TableCell>
                                <TableCell>Page</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {items.map(item => (
                                <TableRow key={item.id} hover>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        <Typography variant="caption">{formatDate(item.createdAt)}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title={item.category ?? '—'}>
                                            <Box>{item.category ? (CATEGORY_ICONS[item.category] ?? null) : '—'}</Box>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 280 }}>
                                        <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.message}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="caption" color="text.secondary">
                                            {item.name ?? (item.email ? '' : 'Anonymous')}
                                            {item.email && <><br />{item.email}</>}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 160 }}>
                                        <Tooltip title={item.pageUrl}>
                                            <Link href={item.pageUrl} target="_blank" rel="noopener" variant="caption"
                                                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 160 }}>
                                                {item.pageUrl.replace(/^https?:\/\/[^/]+/, '')}
                                            </Link>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            label={STATUS_LABELS[item.status] ?? item.status}
                                            color={STATUS_COLORS[item.status] ?? 'default'}
                                            onClick={() => void cycleStatus(item)}
                                            disabled={cycling.has(item.id)}
                                            sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="View details">
                                            <IconButton size="small" onClick={() => setSelected(item)}>
                                                <VisibilityIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        {item.status !== 'closed' && (
                                            <Tooltip title="Close">
                                                <IconButton size="small" onClick={() => void cycleStatus({ ...item, status: 'reviewed' })}>
                                                    <ArchiveIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {item.status === 'new' && (
                                            <Tooltip title="Mark reviewed">
                                                <IconButton size="small" onClick={() => void cycleStatus(item)}>
                                                    <CheckCircleIcon fontSize="small" color="success" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Detail dialog */}
            <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
                {selected && (
                    <>
                        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {selected.category && CATEGORY_ICONS[selected.category]}
                            {selected.category ?? 'Feedback'} — {formatDate(selected.createdAt)}
                            <Chip size="small" label={STATUS_LABELS[selected.status] ?? selected.status}
                                color={STATUS_COLORS[selected.status] ?? 'default'} sx={{ ml: 'auto' }} />
                        </DialogTitle>
                        <DialogContent dividers>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box>
                                    <Typography variant="overline" color="text.secondary">Message</Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selected.message}</Typography>
                                </Box>

                                {selected.stepsToReproduce && (
                                    <Box>
                                        <Typography variant="overline" color="text.secondary">Steps to Reproduce</Typography>
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selected.stepsToReproduce}</Typography>
                                    </Box>
                                )}

                                <Divider />

                                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    <Box>
                                        <Typography variant="overline" color="text.secondary">Reporter</Typography>
                                        <Typography variant="body2">{selected.name ?? 'Anonymous'}</Typography>
                                        {selected.email && <Typography variant="body2" color="text.secondary">{selected.email}</Typography>}
                                    </Box>
                                    <Box>
                                        <Typography variant="overline" color="text.secondary">Page</Typography>
                                        <Link href={selected.pageUrl} target="_blank" rel="noopener" variant="body2"
                                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {selected.pageUrl.replace(/^https?:\/\/[^/]+/, '')}
                                            <OpenInNewIcon sx={{ fontSize: 14 }} />
                                        </Link>
                                    </Box>
                                </Box>

                                {selected.browserInfo && (
                                    <>
                                        <Divider />
                                        <Box>
                                            <Typography variant="overline" color="text.secondary">Browser Info</Typography>
                                            <BrowserInfoPanel raw={selected.browserInfo} />
                                        </Box>
                                    </>
                                )}

                                {selected.screenshotUrl && (
                                    <>
                                        <Divider />
                                        <Box>
                                            <Typography variant="overline" color="text.secondary">Screenshot</Typography>
                                            <Box
                                                component="img"
                                                src={selected.screenshotUrl}
                                                alt="screenshot"
                                                sx={{ width: '100%', borderRadius: 1, border: 1, borderColor: 'divider', mt: 1 }}
                                            />
                                        </Box>
                                    </>
                                )}
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setSelected(null)} sx={{ textTransform: 'none' }}>Close</Button>
                            <Button
                                variant="outlined"
                                onClick={() => void cycleStatus(selected)}
                                disabled={cycling.has(selected.id)}
                                sx={{ textTransform: 'none' }}
                            >
                                Mark as {STATUS_LABELS[STATUS_CYCLE[selected.status] ?? 'new']}
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </Box>
    );
}
