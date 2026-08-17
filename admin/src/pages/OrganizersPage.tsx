import { type ReactNode, useState } from 'react';
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
import GroupIcon from '@mui/icons-material/Group';
import LanguageIcon from '@mui/icons-material/Language';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PhoneIcon from '@mui/icons-material/Phone';
import SearchIcon from '@mui/icons-material/Search';
import TranslateIcon from '@mui/icons-material/Translate';
import { useOrganizers, type OrganizerDto } from '../hooks/useOrganizers';
import { trimToUndefined } from '../utils/strings';
import BilingualTextField from '../components/BilingualTextField';
import { useTranslate } from '../hooks/useTranslate';

const SITE_URL = import.meta.env.VITE_SITE_URL?.trim() || 'https://hlaupadagskra.is';

interface Props {
    onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
}

const EMPTY_FORM = {
    name: '',
    kennitala: '',
    phone: '',
    email: '',
    website: '',
    description: '',
    descriptionEn: '',
    contactName: '',
};

type FormState = typeof EMPTY_FORM;

export default function OrganizersPage({ onNotify }: Props) {
    const navigate = useNavigate();
    const { organizers, loading, error, createOrganizer } = useOrganizers();
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<keyof OrganizerDto>('name');
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
            const { slug } = await createOrganizer({
                name: form.name.trim(),
                kennitala: trimToUndefined(form.kennitala),
                phone: trimToUndefined(form.phone),
                email: trimToUndefined(form.email),
                website: trimToUndefined(form.website),
                description: trimToUndefined(form.description),
                descriptionEn: trimToUndefined(form.descriptionEn),
                contactName: trimToUndefined(form.contactName),
            });
            onNotify(`Organizer '${form.name.trim()}' created`);
            setDialogOpen(false);
            navigate(`/organizers/${slug}`);
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Failed to create organizer', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSort = (col: keyof OrganizerDto) => {
        if (sortBy === col) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(col);
            setSortDir('asc');
        }
    };

    const filtered = organizers
        .filter(org => !search.trim() || org.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const av = (a[sortBy] ?? '') as string | number;
            const bv = (b[sortBy] ?? '') as string | number;
            const cmp = typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv));
            return sortDir === 'asc' ? cmp : -cmp;
        });

    return (
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <GroupIcon color="primary" />
                <Typography variant="h5" fontWeight={700}>Organizers</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                    New Organizer
                </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Manage event organizers. Click a row to view or edit.
            </Typography>
            <TextField
                size="small"
                placeholder="Search organizers…"
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
                inputProps={{ 'aria-label': 'Search organizers' }}
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
                                {(['name', 'contactName', 'eventCount'] as const).map((col, i) => (
                                    <TableCell key={col}>
                                        <TableSortLabel
                                            active={sortBy === col}
                                            direction={sortBy === col ? sortDir : 'asc'}
                                            onClick={() => handleSort(col)}
                                        >
                                            {['Name', 'Contact', 'Events'][i]}
                                        </TableSortLabel>
                                    </TableCell>
                                ))}
                                <TableCell align="center">Links</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                                        <Typography color="text.secondary">
                                            {search.trim() ? 'No organizers match your search.' : 'No organizers yet. Click "New Organizer" to add one.'}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                            {filtered.map(org => (
                                <TableRow
                                    key={org.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/organizers/${org.slug}`)}
                                >
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{org.name}</Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{ fontFamily: 'monospace', color: 'text.disabled', display: 'block' }}
                                        >
                                            {org.slug || '—'}
                                        </Typography>
                                        {org.description && (
                                            <Typography variant="caption" color="text.secondary" display="block" sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {org.description}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{org.contactName ?? '—'}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{org.eventCount}</Typography>
                                    </TableCell>
                                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                            {org.website && (
                                                <Tooltip title={org.website}>
                                                    <IconButton size="small" component="a" href={org.website} target="_blank" rel="noopener noreferrer">
                                                        <LanguageIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {org.email && (
                                                <Tooltip title={org.email}>
                                                    <IconButton size="small" component="a" href={`mailto:${org.email}`}>
                                                        <MailOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {org.phone && (
                                                <Tooltip title={org.phone}>
                                                    <IconButton size="small" component="a" href={`tel:${org.phone}`}>
                                                        <PhoneIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {org.slug && (
                                                <Tooltip title="View on site">
                                                    <IconButton size="small" component="a" href={`${SITE_URL}/organizers/${org.slug}`} target="_blank" rel="noopener noreferrer">
                                                        <OpenInNewIcon fontSize="small" />
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
                <DialogTitle>New Organizer</DialogTitle>
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
                        <TextField
                            label="Contact Name"
                            value={form.contactName}
                            onChange={e => setField('contactName', e.target.value)}
                            fullWidth
                            placeholder="Primary contact person"
                        />
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <TextField
                                label="Kennitala"
                                value={form.kennitala}
                                onChange={e => setField('kennitala', e.target.value)}
                                fullWidth
                                placeholder="000000-0000"
                            />
                            <TextField
                                label="Phone"
                                value={form.phone}
                                onChange={e => setField('phone', e.target.value)}
                                fullWidth
                            />
                        </Box>
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
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                Shown publicly on the organizer page.
                            </Typography>
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
