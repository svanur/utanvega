import { useEffect, useState, useCallback, useRef } from 'react';
import {
    Box, Typography, Paper, Chip, CircularProgress, Alert, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TableSortLabel, IconButton,
    Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider,
    ToggleButton, ToggleButtonGroup, Link, TextField, Select, MenuItem,
    FormControl, InputLabel, Collapse, Pagination, InputAdornment,
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
import CommentIcon from '@mui/icons-material/Comment';
import ReplyIcon from '@mui/icons-material/Reply';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { apiFetch } from '../hooks/api';

const GITHUB_ISSUES_URL = 'https://github.com/svanur/utanvega/issues/';
const PAGE_SIZE = 25;

interface FeedbackDto {
    id: string;
    feedbackNumber: number;
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
    closedAt: string | null;
}

interface FeedbackCounts {
    total: number;
    new: number;
    reviewed: number;
    closed: number;
    avgResolutionHours: number | null;
}

interface FeedbackResult {
    items: FeedbackDto[];
    total: number;
    counts: FeedbackCounts;
}

type SortBy = 'createdAt' | 'feedbackNumber' | 'priority' | 'status' | 'age';
type SortDir = 'asc' | 'desc';

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

function formatDuration(fromIso: string, toIso: string) {
    const diffMs = new Date(toIso).getTime() - new Date(fromIso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
}

function formatHours(hours: number) {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = Math.floor(hours / 24);
    const rem = Math.round(hours % 24);
    return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
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
    const [counts, setCounts] = useState<FeedbackCounts | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('new');
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState<SortBy>('createdAt');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [selected, setSelected] = useState<FeedbackDto | null>(null);
    const [cycling, setCycling] = useState<Set<string>>(new Set());

    // Dialog edit state
    const [editIssue, setEditIssue] = useState('');
    const [editComment, setEditComment] = useState('');
    const [editPriority, setEditPriority] = useState('medium');
    const [saving, setSaving] = useState(false);
    const [screenshotOpen, setScreenshotOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sortBy, sortDir });
            if (statusFilter) params.set('status', statusFilter);
            if (search) params.set('search', search);
            const data = await apiFetch<FeedbackResult>(`/api/v1/admin/feedback?${params}`);
            setItems(data.items);
            setTotal(data.total);
            setCounts(data.counts);
        } catch {
            onNotify('Failed to load feedback', 'error');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, page, sortBy, sortDir, search, onNotify]);

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

    function handleFilterChange(v: string) {
        setStatusFilter(v);
        setPage(1);
    }

    function handleSearchChange(v: string) {
        setSearchInput(v);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearch(v);
            setPage(1);
        }, 350);
    }

    function clearSearch() {
        setSearchInput('');
        setSearch('');
        setPage(1);
    }

    function openDialog(item: FeedbackDto) {
        setSelected(item);
        setEditIssue(item.gitHubIssue != null ? String(item.gitHubIssue) : '');
        setEditComment(item.adminComment ?? '');
        setEditPriority(item.priority);
        setScreenshotOpen(false);
    }

    function patchLocal(id: string, patch: Partial<FeedbackDto>) {
        setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
        setSelected(s => s?.id === id ? { ...s, ...patch } : s);
    }

    async function cycleStatus(item: FeedbackDto, targetStatus?: string) {
        const next = targetStatus ?? STATUS_CYCLE[item.status] ?? 'new';
        const now = new Date().toISOString();
        setCycling(prev => new Set(prev).add(item.id));
        patchLocal(item.id, {
            status: next,
            closedAt: next === 'closed' ? (item.closedAt ?? now) : null,
        });
        try {
            await apiFetch(`/api/v1/admin/feedback/${item.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: next }),
            });
        } catch {
            patchLocal(item.id, { status: item.status, closedAt: item.closedAt });
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
            setSelected(null);
            onNotify('Saved', 'success');
        } catch {
            onNotify('Failed to save', 'error');
        } finally {
            setSaving(false);
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" fontWeight={700}>Feedback</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                        size="small"
                        placeholder="Search messages, email, page…"
                        value={searchInput}
                        onChange={e => handleSearchChange(e.target.value)}
                        sx={{ width: 280 }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                            endAdornment: searchInput ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={clearSearch} edge="end">
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : undefined,
                        }}
                    />
                    <Typography variant="body2" color="text.secondary">{total} entries</Typography>
                </Box>
            </Box>

            {counts && (
                <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                    <Chip label={`Total: ${counts.total}`} size="small" variant="outlined" />
                    <Chip label={`New: ${counts.new}`} size="small" color="warning" variant={statusFilter === 'new' ? 'filled' : 'outlined'} onClick={() => handleFilterChange('new')} />
                    <Chip label={`Reviewed: ${counts.reviewed}`} size="small" color="info" variant={statusFilter === 'reviewed' ? 'filled' : 'outlined'} onClick={() => handleFilterChange('reviewed')} />
                    <Chip label={`Closed: ${counts.closed}`} size="small" variant={statusFilter === 'closed' ? 'filled' : 'outlined'} onClick={() => handleFilterChange('closed')} />
                    {counts.avgResolutionHours != null && (
                        <Tooltip title="Average time from created to closed">
                            <Chip label={`Avg resolution: ${formatHours(counts.avgResolutionHours)}`} size="small" color="success" variant="outlined" />
                        </Tooltip>
                    )}
                </Box>
            )}

            <ToggleButtonGroup
                value={statusFilter} exclusive size="small"
                onChange={(_, v) => { if (v !== null) handleFilterChange(v); }}
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
                <>
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>
                                        <TableSortLabel {...sortProps('feedbackNumber')}>#</TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel {...sortProps('createdAt')}>Date</TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel {...sortProps('age')}>Age</TableSortLabel>
                                    </TableCell>
                                    <TableCell>Cat.</TableCell>
                                    <TableCell>Message</TableCell>
                                    <TableCell>From</TableCell>
                                    <TableCell>Page</TableCell>
                                    <TableCell>
                                        <TableSortLabel {...sortProps('priority')}>Priority</TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel {...sortProps('status')}>Status</TableSortLabel>
                                    </TableCell>
                                    <TableCell>Issue</TableCell>
                                    <TableCell>Comment</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {items.map(item => (
                                    <TableRow key={item.id} hover>
                                        <TableCell>
                                            <Typography variant="caption" color="text.secondary">#{item.feedbackNumber}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            <Typography variant="caption">{formatDate(item.createdAt)}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            <Typography variant="caption" sx={{ color: item.status === 'closed' ? 'error.main' : 'success.main' }}>
                                                {formatDuration(item.createdAt, item.closedAt ?? new Date().toISOString())}
                                            </Typography>
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
                                        <TableCell>
                                            {item.adminComment && (
                                                <Tooltip title={item.adminComment} arrow placement="left">
                                                    <CommentIcon sx={{ fontSize: 16, color: 'text.secondary', display: 'block' }} />
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                            {item.email && (
                                                <Tooltip title={`Reply to ${item.email}`}>
                                                    <IconButton size="small"
                                                        component="a"
                                                        href={`mailto:${item.email}?subject=Re: your feedback on hlaupadagskra.is&body=%23${item.feedbackNumber}`}
                                                    >
                                                        <ReplyIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
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
                                                    <IconButton size="small" onClick={() => void cycleStatus(item, 'closed')}>
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

            {/* Detail / edit dialog */}
            <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
                {selected && (
                    <>
                        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {selected.category && CATEGORY_ICONS[selected.category]}
                            #{selected.feedbackNumber} — {selected.category ?? 'Feedback'} — {formatDate(selected.createdAt)}
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
                                        <Typography variant="overline" color="text.secondary">Created</Typography>
                                        <Typography variant="body2">{formatDate(selected.createdAt)}</Typography>
                                    </Box>
                                    {selected.closedAt && (
                                        <Box>
                                            <Typography variant="overline" color="text.secondary">Closed</Typography>
                                            <Typography variant="body2">{formatDate(selected.closedAt)}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatDuration(selected.createdAt, selected.closedAt)} to resolve
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>

                                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                    <Box>
                                        <Typography variant="overline" color="text.secondary">Reporter</Typography>
                                        <Typography variant="body2">{selected.name ?? 'Anonymous'}</Typography>
                                        {selected.email && (
                                            <Link href={`mailto:${selected.email}?subject=Re: your feedback on hlaupadagskra.is&body=%23${selected.feedbackNumber}`}
                                                variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <ReplyIcon sx={{ fontSize: 14 }} />{selected.email}
                                            </Link>
                                        )}
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
                                            <Box
                                                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                                                onClick={() => setScreenshotOpen(o => !o)}
                                            >
                                                <Typography variant="overline" color="text.secondary" sx={{ flexGrow: 1 }}>Screenshot</Typography>
                                                <Typography variant="caption" color="text.secondary">{screenshotOpen ? '▲ hide' : '▼ show'}</Typography>
                                            </Box>
                                            <Collapse in={screenshotOpen}>
                                                <Box component="img" src={selected.screenshotUrl} alt="screenshot"
                                                    sx={{ width: '100%', borderRadius: 1, border: 1, borderColor: 'divider', mt: 1 }} />
                                            </Collapse>
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
