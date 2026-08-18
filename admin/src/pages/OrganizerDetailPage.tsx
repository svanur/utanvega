import { useState, useMemo, type ReactNode } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/is';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
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
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LanguageIcon from '@mui/icons-material/Language';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PhoneIcon from '@mui/icons-material/Phone';
import SaveIcon from '@mui/icons-material/Save';

import { useQueryClient } from '@tanstack/react-query';
import { useOrganizers, type OrganizerDto } from '../hooks/useOrganizers';
import { useEvents, type EventSummaryDto } from '../hooks/useEvents';
import { usePageShortcuts } from '../hooks/usePageShortcuts';
import { trimToUndefined } from '../utils/strings';
import BilingualTextField from '../components/BilingualTextField';
import { useTranslate } from '../hooks/useTranslate';
import TranslateIcon from '@mui/icons-material/Translate';

function cap(s: string): string {
    return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function fmtDate(date: string): string {
    return cap(dayjs(date).locale('is').format('dddd, D. MMMM YYYY'));
}

function fmtDateRange(start: string, end: string | null): string {
    if (!end || end === start) return fmtDate(start);
    const s = dayjs(start).locale('is');
    const e = dayjs(end).locale('is');
    const weekday = cap(s.format('dddd'));
    if (s.month() === e.month() && s.year() === e.year()) {
        // "Sunnudagur, 15. - 16. ágúst 2027"
        return `${weekday}, ${s.format('D.')} - ${e.format('D. MMMM YYYY')}`;
    }
    if (s.year() === e.year()) {
        // "Sunnudagur, 31. desember - 1. janúar 2027"
        return `${weekday}, ${s.format('D. MMMM')} - ${e.format('D. MMMM YYYY')}`;
    }
    // "Sunnudagur, 31. desember 2026 - Föstudagur, 1. janúar 2027"
    return `${fmtDate(start)} - ${fmtDate(end)}`;
}

const SITE_URL = import.meta.env.VITE_SITE_URL?.trim() || 'https://hlaupadagskra.is';

interface Props {
    onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
}

interface FormState {
    name: string;
    slug: string;
    kennitala: string;
    phone: string;
    email: string;
    website: string;
    description: string;
    descriptionEn: string;
    contactName: string;
}

function getEventStatusColor(status: EventSummaryDto['status']): 'default' | 'success' | 'error' | 'warning' {
    if (status === 'Confirmed') return 'success';
    if (status === 'Cancelled') return 'error';
    if (status === 'Unconfirmed') return 'warning';
    return 'default';
}

export default function OrganizerDetailPage({ onNotify }: Props) {
    const { slug = '' } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { organizers, loading, updateOrganizer, deleteOrganizer } = useOrganizers();
    const { events, loading: eventsLoading } = useEvents();

    const organizer = organizers.find(o => o.slug === slug) ?? null;

    const [editing, setEditing] = useState(false);
    const [slugUnlocked, setSlugUnlocked] = useState(false);
    const [form, setForm] = useState<FormState>({
        name: '', slug: '', kennitala: '', phone: '', email: '',
        website: '', description: '', descriptionEn: '', contactName: '',
    });
    const [saving, setSaving] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));

    const organizerEvents = useMemo(() =>
        events
            .filter(e => e.organizerId === organizer?.id)
            .sort((a, b) => {
                if (!a.nextEditionDate && !b.nextEditionDate) return 0;
                if (!a.nextEditionDate) return 1;
                if (!b.nextEditionDate) return -1;
                return a.nextEditionDate.localeCompare(b.nextEditionDate);
            }),
        [events, organizer],
    );

    const openEdit = () => {
        if (!organizer) return;
        setForm({
            name: organizer.name,
            slug: organizer.slug,
            kennitala: organizer.kennitala ?? '',
            phone: organizer.phone ?? '',
            email: organizer.email ?? '',
            website: organizer.website ?? '',
            description: organizer.description ?? '',
            descriptionEn: organizer.descriptionEn ?? '',
            contactName: organizer.contactName ?? '',
        });
        setSlugUnlocked(false);
        setEditing(true);
    };

    const handleSave = async () => {
        if (!organizer || !form.name.trim()) return;
        setSaving(true);
        try {
            await updateOrganizer({
                id: organizer.id,
                name: form.name.trim(),
                slug: slugUnlocked ? trimToUndefined(form.slug) : undefined,
                kennitala: trimToUndefined(form.kennitala),
                phone: trimToUndefined(form.phone),
                email: trimToUndefined(form.email),
                website: trimToUndefined(form.website),
                description: trimToUndefined(form.description),
                descriptionEn: trimToUndefined(form.descriptionEn),
                contactName: trimToUndefined(form.contactName),
            });
            onNotify(`'${form.name.trim()}' saved`);
            setEditing(false);
            // If slug changed, patch the cache before navigating so the new route
            // finds the organizer immediately without waiting for the refetch.
            if (slugUnlocked && form.slug && form.slug !== slug) {
                queryClient.setQueryData(['admin', 'organizers'], (old: OrganizerDto[] | undefined) =>
                    old?.map(o => o.id === organizer!.id ? { ...o, slug: form.slug } : o) ?? []
                );
                navigate(`/organizers/${form.slug}`, { replace: true });
            }
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!organizer) return;
        setDeleting(true);
        try {
            await deleteOrganizer(organizer.id);
            onNotify(`'${organizer.name}' deleted`);
            navigate('/organizers');
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Failed to delete', 'error');
            setDeleting(false);
            setDeleteDialogOpen(false);
        }
    };

    const set = (field: keyof FormState, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }));

    usePageShortcuts([
        { key: 'u', handler: () => navigate(-1) },
        { key: 'e', handler: () => editing ? setEditing(false) : openEdit() },
        { key: 'v', handler: () => { if (SITE_URL && organizer?.slug) window.open(`${SITE_URL}/organizers/${organizer.slug}`, '_blank'); } },
        { key: 's', handler: () => { if (editing && !saving) void handleSave(); } },
        { key: 's', ctrl: true, allowInInput: true, handler: () => { if (editing && !saving) void handleSave(); } },
        { key: 'Escape', allowInInput: true, handler: () => { if (!saving) setEditing(false); } },
    ]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!organizer) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                Organizer not found.
                <Button size="small" sx={{ ml: 2 }} component={RouterLink} to="/organizers">
                    Back to organizers
                </Button>
            </Alert>
        );
    }

    return (
        <>
        <Box>
            {/* Breadcrumb */}
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
                <IconButton size="small" component={RouterLink} to="/organizers">
                    <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    component={RouterLink}
                    to="/organizers"
                    sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                    Organizers
                </Typography>
                <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Typography variant="body2" fontWeight={500}>{organizer.name}</Typography>
            </Stack>

            {/* Header card */}
            <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mb: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1.5}>
                    <Box>
                        <Typography variant="h5" fontWeight={600} gutterBottom>{organizer.name}</Typography>
                        <Typography
                            variant="caption"
                            sx={{ fontFamily: 'monospace', color: 'text.disabled', display: 'block', mb: 1 }}
                        >
                            {organizer.slug}
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center">
                            <Chip label={`${organizer.eventCount} event${organizer.eventCount !== 1 ? 's' : ''}`} size="small" variant="outlined" />
                            {organizer.website && (
                                <Chip
                                    size="small"
                                    icon={<LanguageIcon />}
                                    label={organizer.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                    variant="outlined"
                                    component="a"
                                    href={organizer.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    clickable
                                />
                            )}
                            {organizer.email && (
                                <Chip
                                    size="small"
                                    icon={<MailOutlineIcon />}
                                    label={organizer.email}
                                    variant="outlined"
                                    component="a"
                                    href={`mailto:${organizer.email}`}
                                    clickable
                                />
                            )}
                            {organizer.phone && (
                                <Tooltip title={organizer.phone}>
                                    <Chip
                                        size="small"
                                        icon={<PhoneIcon />}
                                        label={organizer.phone}
                                        variant="outlined"
                                        component="a"
                                        href={`tel:${organizer.phone}`}
                                        clickable
                                    />
                                </Tooltip>
                            )}
                            {organizer.contactName && (
                                <Chip size="small" label={organizer.contactName} variant="outlined" />
                            )}
                        </Stack>
                        {organizer.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, maxWidth: 600 }}>
                                {organizer.description}
                            </Typography>
                        )}
                    </Box>
                    <Stack direction="row" spacing={1} flexShrink={0}>
                        {SITE_URL && organizer.slug && (
                            <Tooltip title="View on site">
                                <Button size="small" variant="outlined" startIcon={<OpenInNewIcon />}
                                    href={`${SITE_URL}/organizers/${organizer.slug}`} target="_blank" rel="noopener">
                                    View
                                </Button>
                            </Tooltip>
                        )}
                        <Button
                            size="small"
                            variant={editing ? 'contained' : 'outlined'}
                            startIcon={<EditIcon />}
                            onClick={() => editing ? setEditing(false) : openEdit()}
                        >
                            {editing ? 'Close editor' : 'Edit'}
                        </Button>
                        <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<DeleteIcon />}
                            onClick={() => setDeleteDialogOpen(true)}
                        >
                            Delete
                        </Button>
                    </Stack>
                </Stack>
            </Box>

            {/* Inline edit form */}
            {editing && (
                <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main', borderRadius: 2, p: 2.5, mb: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight={600}>Edit organizer</Typography>
                        <Stack direction="row" spacing={1}>
                            <Button size="small" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                            <Button size="small" variant="contained" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />} onClick={() => void handleSave()} disabled={saving || !form.name.trim()}>
                                Save
                            </Button>
                        </Stack>
                    </Stack>
                    <Stack spacing={2}>
                        <TextField
                            label="Name"
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            required
                            fullWidth
                            autoFocus
                        />
                        <TextField
                            label="Slug"
                            value={form.slug}
                            onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
                            fullWidth
                            disabled={!slugUnlocked}
                            helperText={slugUnlocked ? 'Changing the slug breaks existing bookmarks and shared links.' : 'Lowercase letters, numbers and hyphens only'}
                            inputProps={{ style: { fontFamily: 'monospace' } }}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <Tooltip title={slugUnlocked ? 'Lock slug' : 'Changing the slug will break existing bookmarks or shared links. Click to unlock.'}>
                                            <IconButton size="small" onClick={() => setSlugUnlocked(v => !v)} color={slugUnlocked ? 'warning' : 'default'}>
                                                {slugUnlocked ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                                            </IconButton>
                                        </Tooltip>
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <TextField
                            label="Contact Name"
                            value={form.contactName}
                            onChange={e => set('contactName', e.target.value)}
                            fullWidth
                            placeholder="Primary contact person"
                        />
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <TextField
                                label="Kennitala"
                                value={form.kennitala}
                                onChange={e => set('kennitala', e.target.value)}
                                fullWidth
                                placeholder="000000-0000"
                            />
                            <TextField
                                label="Phone"
                                value={form.phone}
                                onChange={e => set('phone', e.target.value)}
                                fullWidth
                            />
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <TextField
                                label="Email"
                                value={form.email}
                                onChange={e => set('email', e.target.value)}
                                type="email"
                                fullWidth
                            />
                            <TextField
                                label="Website"
                                value={form.website}
                                onChange={e => set('website', e.target.value)}
                                placeholder="https://..."
                                fullWidth
                            />
                        </Box>
                        <BilingualTextField
                            label="Description"
                            valueIs={form.description}
                            valueEn={form.descriptionEn}
                            onChangeIs={v => set('description', v)}
                            onChangeEn={v => set('descriptionEn', v)}
                            multiline
                            rows={3}
                            fullWidth
                        />
                        <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
                            Contact name, website and description are shown publicly on the organizer page.
                        </Alert>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Button
                                startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
                                disabled={translating || !form.description.trim()}
                                onClick={async () => {
                                    const [descEn] = await translate([form.description]);
                                    set('descriptionEn', descEn);
                                }}
                            >
                                Translate to EN
                            </Button>
                            <Stack direction="row" spacing={1}>
                                <Button onClick={() => setEditing(false)}>Cancel</Button>
                                <Button
                                    variant="contained"
                                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                                    onClick={() => void handleSave()}
                                    disabled={saving || !form.name.trim()}
                                >
                                    Save
                                </Button>
                            </Stack>
                        </Stack>
                    </Stack>
                </Box>
            )}

            {/* Events */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Typography variant="h6" fontWeight={600}>Events</Typography>
                <Typography component="span" variant="body2" color="text.secondary">
                    {eventsLoading ? '…' : organizerEvents.length}
                </Typography>
            </Stack>

            {eventsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : organizerEvents.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No events linked to this organizer.</Typography>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                                <TableCell>Name</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Next edition</TableCell>
                                <TableCell align="right" />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {organizerEvents.map(event => (
                                <TableRow
                                    key={event.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/events/${event.slug}`)}
                                >
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{event.name}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={event.activityType} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={event.status} size="small" color={getEventStatusColor(event.status)} />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {event.nextEditionDate ? fmtDateRange(event.nextEditionDate, event.endDisplayDate) : '—'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Open event">
                                            <IconButton size="small" component={RouterLink} to={`/events/${event.slug}`} onClick={e => e.stopPropagation()}>
                                                <ChevronRightIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

        </Box>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Delete organizer?</DialogTitle>
            <DialogContent>
                {organizer && organizer.eventCount > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        This organizer is linked to <strong>{organizer.eventCount}</strong> event{organizer.eventCount !== 1 ? 's' : ''}. Deleting will clear the organizer reference from those events.
                    </Alert>
                )}
                <Typography>
                    Are you sure you want to delete <strong>{organizer?.name}</strong>? This action cannot be undone.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                    Cancel
                </Button>
                <Button
                    color="error"
                    variant="contained"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                >
                    {deleting ? 'Deleting…' : 'Delete'}
                </Button>
            </DialogActions>
        </Dialog>
    </>
    );
}
