import { useEffect, useState, useCallback } from 'react';
import {
    Box, Typography, Paper, Chip, CircularProgress, Alert, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider,
    ToggleButton, ToggleButtonGroup, Link, TextField, Select, MenuItem,
    FormControl, InputLabel,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArchiveIcon from '@mui/icons-material/Archive';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FeedbackIcon from '@mui/icons-material/Feedback';
import GitHubIcon from '@mui/icons-material/GitHub';
import { apiFetch } from '../hooks/api';

const GITHUB_ISSUES_URL = 'https://github.com/svanur/utanvega/issues/';

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
    priority: string;
    gitHubIssue: number | null;
    adminComment: string | null;
    createdAt: string;
}

interface FeedbackResult {
    items: FeedbackDto[];
    total: number;
}

const STATUS_CYCLE: Record<string, string> = { new: 'reviewed', reviewed: 'closed', closed: 'new' };
const STATUS_LABELS: Record<string, string> = { new: 'New', reviewed: 'Reviewed', closed: 'Closed' };
const STATUS_COLORS: Record<string, 'warning' | 'info' | 'default'> = {
    new: 'warning', reviewed: 'info', closed: 'default',
};
const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'default'> = {
    high: 'error', medium: 'warning', low: 'default',
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
        const rows: [string, string][] = [
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
                        <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>{value}</Typography>
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

    // Dialog edit state
    const [editIssue, setEditIssue] = useState('');
    const [editComment, setEditComment] = useState('');
    const [editPriority, setEditPriority] = useState('medium');
    const [saving, setSaving] = useState(false);

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

    function openDialog(item: FeedbackDto) {
        setSelected(item);
        setEditIssue(item.gitHubIssue != null ? String(item.gitHubIssue) : '');
        setEditComment(item.adminComment ?? '');
        setEditPriority(item.priority);
    }

    function patchLocal(id: string, patch: Partial<FeedbackDto>) {
        setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
        setSelected(s => s?.id === id ? { ...s, ...patch } : s);
    }

    async function cycleStatus(item: FeedbackDto) {
        const next = STATUS_CYCLE[item.status] ?? 'new';
        setCycling(prev => new Set(prev).add(item.id));
        patchLocal(item.id, { status: next });
        try {
            await apiFetch(`/api/v1/admin/feedback/${item.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: next }),
            });
        } catch {
            patchLocal(item.id, { status: item.status });
            onNotify('Failed to update status', 'error');
        } finally {
            setCycling(prev => { const n = new Set(prev); n.delete(item.id); return n; });
        }
    }

    async function saveAdminFields() {
        if (!selected) return;
        setSaving(true);
        const issueNum = editIssue.trim() ? parseInt(editIssue, 10) : null;
        const clearIssue = editIssue.trim() === '' && selected.gitHubIssue != null;
        const patch = {
            priority: editPriority,
            gitHubIssue: issueNum,
            clearGitHubIssue: clearIssue,
            adminComment: editComment,
        };
        patchLocal(selected.id, {
            priority: editPriority,
            gitHubIssue: issueNum,
            adminComment: editComment || null,
        });
        try {
            await apiFetch(`/api/v1/admin/feedback/${selected.id}`, {
                method: 'PATCH',
                body: JSON.stringify(patch),
            });
            onNotify('Saved', 'success');
        } catch {
            onNotify('Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" fontWeight={700}>Feedback</Typography>
                <Typography variant="body2" color="text.secondary">{total} entries</Typography>
            </Box>

            <ToggleButtonGroup
                value={statusFilter} exclusive size="small"
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
                                <TableCell>Priority</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Issue</TableCell>
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
                                    <TableCell sx={{ maxWidth: 260 }}>
                                        <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.message}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="caption" color="text.secondary">
                                            {item.name ?? (item.email ? '' : 'Anon')}
                                            {item.email && <><br />{item.email}</>}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 140 }}>
                                        <Tooltip title={item.pageUrl}>
                                            <Link href={item.pageUrl} target="_blank" rel="noopener" variant="caption"
                                                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 140 }}>
                                                {item.pageUrl.replace(/^https?:\/\/[^/]+/, '')}
                                            </Link>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell>
                                        <Chip size="small" label={item.priority}
                                            color={PRIORITY_COLORS[item.priority] ?? 'default'}
                                            sx={{ fontSize: '0.7rem', textTransform: 'capitalize' }} />
                                    </TableCell>
                                    <TableCell>
                                        <Chip size="small"
                                            label={STATUS_LABELS[item.status] ?? item.status}
                                            color={STATUS_COLORS[item.status] ?? 'default'}
                                            onClick={() => void cycleStatus(item)}
                                            disabled={cycling.has(item.id)}
                                            sx={{ cursor: 'pointer', fontSize: '0.7rem' }} />
                                    </TableCell>
                                    <TableCell>
                                        {item.gitHubIssue != null ? (
                                            <Tooltip title={`GitHub #${item.gitHubIssue}`}>
                                                <Link href={`${GITHUB_ISSUES_URL}${item.gitHubIssue}`}
                                                    target="_blank" rel="noopener" variant="caption"
                                                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <GitHubIcon sx={{ fontSize: 14 }} />#{item.gitHubIssue}
                                                </Link>
                                            </Tooltip>
                                        ) : '—'}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="View / edit">
                                            <IconButton size="small" onClick={() => openDialog(item)}>
                                                <VisibilityIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        {item.status === 'new' && (
                                            <Tooltip title="Mark reviewed">
                                                <IconButton size="small" onClick={() => void cycleStatus(item)}>
                                                    <CheckCircleIcon fontSize="small" color="success" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {item.status !== 'closed' && (
                                            <Tooltip title="Close">
                                                <IconButton size="small" onClick={() => void cycleStatus({ ...item, status: 'reviewed' })}>
                                                    <ArchiveIcon fontSize="small" />
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

            {/* Detail / edit dialog */}
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
                                {/* User content */}
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
                                            <Box component="img" src={selected.screenshotUrl} alt="screenshot"
                                                sx={{ width: '100%', borderRadius: 1, border: 1, borderColor: 'divider', mt: 1 }} />
                                        </Box>
                                    </>
                                )}

                                {/* Admin fields */}
                                <Divider />
                                <Typography variant="overline" color="text.secondary">Admin</Typography>

                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                                    <FormControl size="small">
                                        <InputLabel>Priority</InputLabel>
                                        <Select value={editPriority} label="Priority"
                                            onChange={e => setEditPriority(e.target.value)}>
                                            <MenuItem value="high">High</MenuItem>
                                            <MenuItem value="medium">Medium</MenuItem>
                                            <MenuItem value="low">Low</MenuItem>
                                        </Select>
                                    </FormControl>

                                    <TextField
                                        size="small" label="GitHub Issue #" type="number"
                                        value={editIssue}
                                        onChange={e => setEditIssue(e.target.value)}
                                        inputProps={{ min: 1 }}
                                        InputProps={{
                                            endAdornment: editIssue.trim() ? (
                                                <Tooltip title={`Open #${editIssue}`}>
                                                    <Link href={`${GITHUB_ISSUES_URL}${editIssue}`}
                                                        target="_blank" rel="noopener"
                                                        sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
                                                        <GitHubIcon sx={{ fontSize: 16 }} />
                                                    </Link>
                                                </Tooltip>
                                            ) : undefined,
                                        }}
                                    />

                                    {/* spacer */}
                                    <Box />
                                </Box>

                                <TextField
                                    size="small" label="Admin comment" multiline minRows={2} maxRows={6}
                                    value={editComment}
                                    onChange={e => setEditComment(e.target.value)}
                                    placeholder="Notes on resolution, workaround, follow-up..."
                                    inputProps={{ maxLength: 2000 }}
                                />
                            </Box>
                        </DialogContent>

                        <DialogActions>
                            <Button onClick={() => setSelected(null)} sx={{ textTransform: 'none' }}>Close</Button>
                            <Button variant="outlined"
                                onClick={() => void cycleStatus(selected)}
                                disabled={cycling.has(selected.id)}
                                sx={{ textTransform: 'none' }}>
                                Mark as {STATUS_LABELS[STATUS_CYCLE[selected.status] ?? 'new']}
                            </Button>
                            <Button variant="contained" onClick={() => void saveAdminFields()}
                                disabled={saving} sx={{ textTransform: 'none' }}>
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </Box>
    );
}
