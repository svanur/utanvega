import { type ReactNode, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/is';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Alert,
    Autocomplete,
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
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LanguageIcon from '@mui/icons-material/Language';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SaveIcon from '@mui/icons-material/Save';
import ShareIcon from '@mui/icons-material/Share';

import { useQueryClient } from '@tanstack/react-query';
import { usePhotographers, type PhotographerDto } from '../hooks/usePhotographers';
import { usePhotoGalleriesByPhotographer, type PhotoGalleryByPhotographerDto } from '../hooks/usePhotoGalleries';
import type { SocialLink } from '../hooks/useEvents';
import { usePageShortcuts } from '../hooks/usePageShortcuts';
import { useRowFocus } from '../hooks/useRowFocus';
import { trimToUndefined } from '../utils/strings';
import BilingualTextField from '../components/BilingualTextField';
import { useTranslate } from '../hooks/useTranslate';
import TranslateIcon from '@mui/icons-material/Translate';

interface Props {
    onNotify: (message: ReactNode, severity?: 'success' | 'error') => void;
}

interface PhotographerRef {
    id: string;
    name: string;
}

function fmtEdition(year: number | null, date: string | null): string {
    if (date) return dayjs(date).locale('is').format('D. MMMM YYYY');
    if (year) return String(year);
    return '—';
}

interface FormState {
    name: string;
    slug: string;
    website: string;
    email: string;
    description: string;
    descriptionEn: string;
    socialLinks: SocialLink[];
}

interface GalleryFormState {
    url: string;
    title: string;
    titleEn: string;
}

export default function PhotographerDetailPage({ onNotify }: Props) {
    const { slug = '' } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { photographers, loading, updatePhotographer, deletePhotographer } = usePhotographers();

    const photographer = photographers.find(p => p.slug === slug) ?? null;
    const { galleries, loading: galleriesLoading, updateGallery } = usePhotoGalleriesByPhotographer(photographer?.id ?? null);

    const [editing, setEditing] = useState(false);
    const [slugUnlocked, setSlugUnlocked] = useState(false);
    const [form, setForm] = useState<FormState>({
        name: '', slug: '', website: '', email: '',
        description: '', descriptionEn: '', socialLinks: [],
    });
    const [saving, setSaving] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [reassignTarget, setReassignTarget] = useState<PhotographerRef | null>(null);
    const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));

    const [editingGallery, setEditingGallery] = useState<PhotoGalleryByPhotographerDto | null>(null);
    const [galleryForm, setGalleryForm] = useState<GalleryFormState>({ url: '', title: '', titleEn: '' });
    const [galleryError, setGalleryError] = useState<string | null>(null);
    const [savingGallery, setSavingGallery] = useState(false);

    const reassignOptions: PhotographerRef[] = photographers
        .filter(p => p.id !== photographer?.id)
        .map(p => ({ id: p.id, name: p.name }));

    const openEdit = () => {
        if (!photographer) return;
        setForm({
            name: photographer.name,
            slug: photographer.slug,
            website: photographer.website ?? '',
            email: photographer.email ?? '',
            description: photographer.description ?? '',
            descriptionEn: photographer.descriptionEn ?? '',
            socialLinks: photographer.socialLinks?.map(l => ({ ...l })) ?? [],
        });
        setSlugUnlocked(false);
        setEditing(true);
    };

    const handleSave = async () => {
        if (!photographer || !form.name.trim()) return;
        setSaving(true);
        try {
            const socialLinks = form.socialLinks.filter(l => l.type.trim() && l.url.trim());
            await updatePhotographer({
                id: photographer.id,
                name: form.name.trim(),
                slug: slugUnlocked ? trimToUndefined(form.slug) : undefined,
                website: trimToUndefined(form.website),
                email: trimToUndefined(form.email),
                description: trimToUndefined(form.description),
                descriptionEn: trimToUndefined(form.descriptionEn),
                socialLinks: socialLinks.length > 0 ? socialLinks : null,
            });
            onNotify(`'${form.name.trim()}' saved`);
            setEditing(false);
            // If slug changed, patch the cache before navigating so the new route
            // finds the photographer immediately without waiting for the refetch.
            if (slugUnlocked && form.slug && form.slug !== slug) {
                queryClient.setQueryData(['admin', 'photographers'], (old: PhotographerDto[] | undefined) =>
                    old?.map(p => p.id === photographer!.id ? { ...p, slug: form.slug } : p) ?? []
                );
                navigate(`/photographers/${form.slug}`, { replace: true });
            }
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (reassignToId?: string) => {
        if (!photographer) return;
        setDeleting(true);
        try {
            await deletePhotographer(photographer.id, reassignToId);
            onNotify(`'${photographer.name}' deleted`);
            navigate('/photographers');
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Failed to delete', 'error');
            setDeleting(false);
            setDeleteDialogOpen(false);
        }
    };

    const openEditGallery = (gallery: PhotoGalleryByPhotographerDto) => {
        setGalleryForm({ url: gallery.url, title: gallery.title ?? '', titleEn: gallery.titleEn ?? '' });
        setGalleryError(null);
        setEditingGallery(gallery);
    };

    const closeEditGallery = () => {
        if (savingGallery) return;
        setEditingGallery(null);
    };

    // photographerId and sortOrder are round-tripped unchanged from the row being edited — this
    // dialog only ever touches url/title/titleEn — since UpdatePhotoGalleryCommand is a full
    // overwrite and omitting either would zero the gallery's position or null its attribution.
    const handleSaveGallery = async () => {
        if (!editingGallery || !photographer) return;
        if (!galleryForm.url.trim()) { setGalleryError('URL is required'); return; }
        setSavingGallery(true);
        try {
            await updateGallery({
                id: editingGallery.id,
                url: galleryForm.url.trim(),
                photographerId: photographer.id,
                title: trimToUndefined(galleryForm.title) ?? null,
                titleEn: trimToUndefined(galleryForm.titleEn) ?? null,
                sortOrder: editingGallery.sortOrder,
            });
            onNotify('Gallery saved');
            setEditingGallery(null);
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Failed to save gallery', 'error');
        } finally {
            setSavingGallery(false);
        }
    };

    const set = (field: keyof Omit<FormState, 'socialLinks'>, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const setSocialLinks = (links: SocialLink[]) =>
        setForm(prev => ({ ...prev, socialLinks: links }));

    // j/k row focus + Enter/o to open the gallery's parent event — scrolled into view
    // whenever it changes, same pattern as OrganizersPage/PhotographersPage.
    const { focusedIndex: focusedGalleryIndex } = useRowFocus(galleries, (gallery) => navigate(`/events/${gallery.eventSlug}`));
    const focusedGalleryRowRef = useRef<HTMLTableRowElement>(null);
    useEffect(() => {
        focusedGalleryRowRef.current?.scrollIntoView({ block: 'nearest' });
    }, [focusedGalleryIndex]);

    // Prefer navigate(-1) so the list's filter/sort/search state (kept in its URL query
    // string) is restored — matches the 'u' shortcut and the browser back button. Falls
    // back to the bare list path when there's no prior in-app history entry to pop to
    // (e.g. this page was opened directly from a bookmark or shared link).
    const handleBackToList = () => {
        const idx = window.history.state?.idx;
        if (typeof idx === 'number' && idx > 0) {
            navigate(-1);
        } else {
            navigate('/photographers');
        }
    };

    usePageShortcuts([
        { key: 'u', handler: () => navigate(-1) },
        { key: 'e', handler: () => editing ? setEditing(false) : openEdit() },
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

    if (!photographer) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                Photographer not found.
                <Button size="small" sx={{ ml: 2 }} component={RouterLink} to="/photographers">
                    Back to photographers
                </Button>
            </Alert>
        );
    }

    return (
        <>
        <Box>
            {/* Breadcrumb */}
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
                <IconButton size="small" onClick={handleBackToList}>
                    <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    component={RouterLink}
                    to="/photographers"
                    onClick={e => {
                        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                        e.preventDefault();
                        handleBackToList();
                    }}
                    sx={{ cursor: 'pointer', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                    Photographers
                </Typography>
                <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Typography variant="body2" fontWeight={500}>{photographer.name}</Typography>
            </Stack>

            {/* Header card */}
            <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mb: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1.5}>
                    <Box>
                        <Typography variant="h5" fontWeight={600} gutterBottom>{photographer.name}</Typography>
                        <Typography
                            variant="caption"
                            sx={{ fontFamily: 'monospace', color: 'text.disabled', display: 'block', mb: 1 }}
                        >
                            {photographer.slug}
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center">
                            {photographer.website && (
                                <Chip
                                    size="small"
                                    icon={<LanguageIcon />}
                                    label={photographer.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                    variant="outlined"
                                    component="a"
                                    href={photographer.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    clickable
                                />
                            )}
                            {photographer.email && (
                                <Chip
                                    size="small"
                                    icon={<MailOutlineIcon />}
                                    label={photographer.email}
                                    variant="outlined"
                                    component="a"
                                    href={`mailto:${photographer.email}`}
                                    clickable
                                />
                            )}
                            {photographer.socialLinks?.map(link => (
                                <Chip
                                    key={`${link.type}-${link.url}`}
                                    size="small"
                                    icon={<ShareIcon />}
                                    label={link.type}
                                    variant="outlined"
                                    component="a"
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    clickable
                                />
                            ))}
                        </Stack>
                        {photographer.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, maxWidth: 600 }}>
                                {photographer.description}
                            </Typography>
                        )}
                    </Box>
                    <Stack direction="row" spacing={1} flexShrink={0}>
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
                            onClick={() => { setReassignTarget(null); setDeleteDialogOpen(true); }}
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
                        <Typography variant="subtitle1" fontWeight={600}>Edit photographer</Typography>
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
                        <Box>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Typography variant="subtitle2">Social links</Typography>
                                <Tooltip title="Add social link">
                                    <IconButton size="small" onClick={() => setSocialLinks([...form.socialLinks, { type: '', url: '' }])}>
                                        <AddIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                            {form.socialLinks.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">No social links.</Typography>
                            ) : (
                                <Stack spacing={1}>
                                    {form.socialLinks.map((link, i) => (
                                        <Stack key={i} direction="row" spacing={1} alignItems="center">
                                            <TextField
                                                size="small" label="Type" value={link.type}
                                                onChange={e => setSocialLinks(form.socialLinks.map((l, j) => j === i ? { ...l, type: e.target.value } : l))}
                                                placeholder="Instagram"
                                                sx={{ width: 130, flexShrink: 0 }}
                                            />
                                            <TextField
                                                size="small" fullWidth label="URL" value={link.url}
                                                onChange={e => setSocialLinks(form.socialLinks.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                                                placeholder="https://…"
                                            />
                                            <IconButton size="small" color="error"
                                                onClick={() => setSocialLinks(form.socialLinks.filter((_, j) => j !== i))}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    ))}
                                </Stack>
                            )}
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

            {/* Galleries */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Typography variant="h6" fontWeight={600}>Galleries</Typography>
                <Typography component="span" variant="body2" color="text.secondary">
                    {galleriesLoading ? '…' : galleries.length}
                </Typography>
            </Stack>

            {galleriesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : galleries.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No galleries linked to this photographer.</Typography>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                                <TableCell>Event</TableCell>
                                <TableCell>Edition</TableCell>
                                <TableCell>URL</TableCell>
                                <TableCell align="right" />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {galleries.map((gallery, idx) => (
                                <TableRow
                                    key={gallery.id}
                                    ref={idx === focusedGalleryIndex ? focusedGalleryRowRef : undefined}
                                    hover
                                    sx={(theme) => ({
                                        cursor: 'pointer',
                                        ...(idx === focusedGalleryIndex && { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 }),
                                    })}
                                    onClick={() => navigate(`/events/${gallery.eventSlug}`)}
                                >
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{gallery.eventName}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {fmtEdition(gallery.editionYear, gallery.editionDate)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell onClick={e => e.stopPropagation()}>
                                        <Tooltip title={gallery.url}>
                                            <IconButton size="small" component="a" href={gallery.url} target="_blank" rel="noopener noreferrer">
                                                <OpenInNewIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Edit gallery">
                                            <IconButton size="small" onClick={e => { e.stopPropagation(); openEditGallery(gallery); }}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Open event">
                                            <IconButton size="small" component={RouterLink} to={`/events/${gallery.eventSlug}`} onClick={e => e.stopPropagation()}>
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
            <DialogTitle>Delete photographer?</DialogTitle>
            <DialogContent>
                {photographer && photographer.galleryCount > 0 ? (
                    <>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            This photographer is credited on <strong>{photographer.galleryCount}</strong> photo galler{photographer.galleryCount !== 1 ? 'ies' : 'y'}.
                            Reassign {photographer.galleryCount !== 1 ? 'them' : 'it'} to another photographer, or delete <strong>{photographer.name}</strong> anyway
                            — this permanently removes the attribution from {photographer.galleryCount !== 1 ? 'those galleries' : 'that gallery'}.
                        </Alert>
                        <Autocomplete<PhotographerRef>
                            size="small"
                            fullWidth
                            options={reassignOptions}
                            value={reassignTarget}
                            disabled={deleting}
                            isOptionEqualToValue={(option, val) => option.id === val.id}
                            getOptionLabel={(option) => option.name}
                            onChange={(_, newValue) => setReassignTarget(newValue)}
                            renderInput={(params) => (
                                <TextField {...params} label="Reassign galleries to (optional)" placeholder="Search photographers…" />
                            )}
                        />
                    </>
                ) : (
                    <Typography>
                        Are you sure you want to delete <strong>{photographer?.name}</strong>? This action cannot be undone.
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                    Cancel
                </Button>
                {photographer && photographer.galleryCount > 0 && (
                    <Button
                        color="error"
                        variant="outlined"
                        onClick={() => void handleDelete()}
                        disabled={deleting}
                    >
                        Delete anyway
                    </Button>
                )}
                <Button
                    color="error"
                    variant="contained"
                    onClick={() => void handleDelete(reassignTarget?.id)}
                    disabled={deleting || (!!photographer && photographer.galleryCount > 0 && !reassignTarget)}
                    startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                >
                    {deleting ? 'Deleting…' : reassignTarget ? 'Reassign & delete' : 'Delete'}
                </Button>
            </DialogActions>
        </Dialog>

        {/* Gallery edit dialog — URL/Title/Title EN only; reassigning the attributed
            photographer or reordering (sortOrder) isn't exposed here, see PhotoGalleryManager. */}
        <Dialog open={!!editingGallery} onClose={closeEditGallery} maxWidth="xs" fullWidth>
            <DialogTitle>Edit gallery</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {galleryError && <Alert severity="error">{galleryError}</Alert>}
                    <TextField
                        label="URL"
                        value={galleryForm.url}
                        onChange={e => setGalleryForm(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://…"
                        required
                        fullWidth
                        autoFocus
                    />
                    <BilingualTextField
                        label="Title (optional)"
                        valueIs={galleryForm.title}
                        valueEn={galleryForm.titleEn}
                        onChangeIs={v => setGalleryForm(prev => ({ ...prev, title: v }))}
                        onChangeEn={v => setGalleryForm(prev => ({ ...prev, titleEn: v }))}
                        fullWidth
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={closeEditGallery} disabled={savingGallery}>Cancel</Button>
                <Button
                    variant="contained"
                    startIcon={savingGallery ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    onClick={() => void handleSaveGallery()}
                    disabled={savingGallery}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    </>
    );
}
