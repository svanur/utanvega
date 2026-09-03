import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LanguageIcon from '@mui/icons-material/Language';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import SearchIcon from '@mui/icons-material/Search';
import TranslateIcon from '@mui/icons-material/Translate';
import { usePhotographers, type PhotographerDto } from '../hooks/usePhotographers';
import { useRowFocus } from '../hooks/useRowFocus';
import { usePageShortcuts, isDialogOpen } from '../hooks/usePageShortcuts';
import { trimToUndefined } from '../utils/strings';
import BilingualTextField from '../components/BilingualTextField';
import { useTranslate } from '../hooks/useTranslate';

interface Props {
    onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
}

const EMPTY_FORM = {
    name: '',
    website: '',
    email: '',
    description: '',
    descriptionEn: '',
};

type FormState = typeof EMPTY_FORM;

export default function PhotographersPage({ onNotify }: Props) {
    const navigate = useNavigate();
    const { photographers, loading, error, createPhotographer } = usePhotographers();
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<keyof PhotographerDto>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));

    const setField = (field: keyof FormState, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const openCreate = () => {
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const handleCreate = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            const { slug } = await createPhotographer({
                name: form.name.trim(),
                website: trimToUndefined(form.website),
                email: trimToUndefined(form.email),
                description: trimToUndefined(form.description),
                descriptionEn: trimToUndefined(form.descriptionEn),
            });
            onNotify(`Photographer '${form.name.trim()}' created`);
            setDialogOpen(false);
            navigate(`/photographers/${slug}`);
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Failed to create photographer', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSort = (col: keyof PhotographerDto) => {
        if (sortBy === col) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(col);
            setSortDir('asc');
        }
    };

    const filtered = photographers
        .filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const av = (a[sortBy] ?? '') as string | number;
            const bv = (b[sortBy] ?? '') as string | number;
            const cmp = typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv));
            return sortDir === 'asc' ? cmp : -cmp;
        });

    // j/k row focus + Enter/o to open — scrolled into view whenever it changes.
    const { focusedIndex: focusedPhotographerIndex } = useRowFocus(filtered, (p) => navigate(`/photographers/${p.slug}`));
    const focusedPhotographerRowRef = useRef<HTMLTableRowElement>(null);
    useEffect(() => {
        focusedPhotographerRowRef.current?.scrollIntoView({ block: 'nearest' });
    }, [focusedPhotographerIndex]);

    usePageShortcuts([
        { key: 'n', alt: true, skip: isDialogOpen, handler: openCreate },
    ]);

    return (
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <CameraAltIcon color="primary" />
                <Typography variant="h5" fontWeight={700}>Photographers</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                    New Photographer
                </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Manage photo gallery photographers. Click a row to view or edit.
            </Typography>
            <TextField
                size="small"
                placeholder="Search photographers…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                sx={{ width: 280, mb: 3 }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                        </InputAdornment>
                    ),
                }}
                inputProps={{ 'aria-label': 'Search photographers' }}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                                <TableCell>
                                    <TableSortLabel
                                        active={sortBy === 'name'}
                                        direction={sortBy === 'name' ? sortDir : 'asc'}
                                        onClick={() => handleSort('name')}
                                    >
                                        Name
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell align="center">Links</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={2} align="center" sx={{ py: 4 }}>
                                        <Typography color="text.secondary">
                                            {search.trim() ? 'No photographers match your search.' : 'No photographers yet. Click "New Photographer" to add one.'}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                            {filtered.map((p, idx) => (
                                <TableRow
                                    key={p.id}
                                    ref={idx === focusedPhotographerIndex ? focusedPhotographerRowRef : undefined}
                                    hover
                                    sx={(theme) => ({
                                        cursor: 'pointer',
                                        ...(idx === focusedPhotographerIndex && { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 }),
                                    })}
                                    onClick={() => navigate(`/photographers/${p.slug}`)}
                                >
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{ fontFamily: 'monospace', color: 'text.disabled', display: 'block' }}
                                        >
                                            {p.slug || '—'}
                                        </Typography>
                                        {p.description && (
                                            <Typography variant="caption" color="text.secondary" display="block" sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {p.description}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                            {p.website && (
                                                <Tooltip title={p.website}>
                                                    <IconButton size="small" component="a" href={p.website} target="_blank" rel="noopener noreferrer">
                                                        <LanguageIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {p.email && (
                                                <Tooltip title={p.email}>
                                                    <IconButton size="small" component="a" href={`mailto:${p.email}`}>
                                                        <MailOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Create dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>New Photographer</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Name"
                            value={form.name}
                            onChange={e => setField('name', e.target.value)}
                            required
                            fullWidth
                            autoFocus
                        />
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <TextField
                                label="Email"
                                value={form.email}
                                onChange={e => setField('email', e.target.value)}
                                type="email"
                                fullWidth
                            />
                            <TextField
                                label="Website"
                                value={form.website}
                                onChange={e => setField('website', e.target.value)}
                                placeholder="https://..."
                                fullWidth
                            />
                        </Box>
                        <Box>
                            <BilingualTextField
                                label="Description"
                                valueIs={form.description}
                                valueEn={form.descriptionEn}
                                onChangeIs={v => setField('description', v)}
                                onChangeEn={v => setField('descriptionEn', v)}
                                multiline
                                rows={3}
                                fullWidth
                            />
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'space-between', borderTop: 1, borderColor: 'divider' }}>
                    <Button
                        startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
                        disabled={translating || !form.description.trim()}
                        onClick={async () => {
                            const [descEn] = await translate([form.description]);
                            setField('descriptionEn', descEn);
                        }}
                    >
                        Translate to EN
                    </Button>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={() => void handleCreate()}
                            disabled={saving || !form.name.trim()}
                        >
                            {saving ? <CircularProgress size={20} /> : 'Create'}
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
