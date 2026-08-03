import { type ReactNode, useState } from 'react';
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
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import GroupIcon from '@mui/icons-material/Group';
import { useOrganizers, type OrganizerDto } from '../hooks/useOrganizers';
import { trimToUndefined } from '../utils/strings';
import BilingualTextField from '../components/BilingualTextField';
import { useTranslate } from '../hooks/useTranslate';
import TranslateIcon from '@mui/icons-material/Translate';

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
    const { organizers, loading, error, createOrganizer, updateOrganizer, deleteOrganizer } = useOrganizers();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<OrganizerDto | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<OrganizerDto | null>(null);
    const [deleting, setDeleting] = useState(false);
    const { translate, translating } = useTranslate(msg => onNotify(msg, 'error'));

    const setField = (field: keyof FormState, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const openCreate = () => {
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEdit = (org: OrganizerDto) => {
        setEditTarget(org);
        setForm({
            name: org.name,
            kennitala: org.kennitala ?? '',
            phone: org.phone ?? '',
            email: org.email ?? '',
            website: org.website ?? '',
            description: org.description ?? '',
            descriptionEn: org.descriptionEn ?? '',
            contactName: org.contactName ?? '',
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            const input = {
                name: form.name.trim(),
                kennitala: trimToUndefined(form.kennitala),
                phone: trimToUndefined(form.phone),
                email: trimToUndefined(form.email),
                website: trimToUndefined(form.website),
                description: trimToUndefined(form.description),
                descriptionEn: trimToUndefined(form.descriptionEn),
                contactName: trimToUndefined(form.contactName),
            };
            if (editTarget) {
                await updateOrganizer({ ...input, id: editTarget.id });
                onNotify(`Organizer '${input.name}' updated`);
            } else {
                await createOrganizer(input);
                onNotify(`Organizer '${input.name}' created`);
            }
            setDialogOpen(false);
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Failed to save organizer', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        setDeleting(true);
        try {
            await deleteOrganizer(deleteConfirm.id);
            onNotify(`Organizer '${deleteConfirm.name}' deleted`);
            setDeleteConfirm(null);
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Failed to delete organizer', 'error');
        } finally {
            setDeleting(false);
        }
    };

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
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Manage event organizers. Organizers can be linked to events via the event form.
            </Typography>

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
                                <TableCell>Name</TableCell>
                                <TableCell>Contact</TableCell>
                                <TableCell>Kennitala</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Website</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {organizers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                        <Typography color="text.secondary">No organizers yet. Click "New Organizer" to add one.</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                            {organizers.map(org => (
                                <TableRow key={org.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{org.name}</Typography>
                                        {org.description && (
                                            <Typography variant="caption" color="text.secondary" display="block" sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {org.description}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{org.contactName ?? '—'}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{org.kennitala ?? '—'}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{org.phone ?? '—'}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{org.email ?? '—'}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        {org.website
                                            ? <Typography variant="body2" component="a" href={org.website} target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main' }}>{org.website.replace(/^https?:\/\//, '')}</Typography>
                                            : <Typography variant="body2" color="text.secondary">—</Typography>
                                        }
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => openEdit(org)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={() => setDeleteConfirm(org)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Create / Edit dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editTarget ? 'Edit Organizer' : 'New Organizer'}</DialogTitle>
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
                            onClick={handleSave}
                            disabled={saving || !form.name.trim()}
                        >
                            {saving ? <CircularProgress size={20} /> : (editTarget ? 'Save' : 'Create')}
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>

            {/* Delete confirm dialog */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
                <DialogTitle>Delete Organizer</DialogTitle>
                <DialogContent>
                    <Typography>
                        Delete <strong>{deleteConfirm?.name}</strong>? Events linked to this organizer will have their organizer reference cleared.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
                        {deleting ? <CircularProgress size={20} /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
