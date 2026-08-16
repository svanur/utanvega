import {
    Alert,
    AlertTitle,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from '@mui/material';
import ArchiveIcon from '@mui/icons-material/Archive';
import DeleteIcon from '@mui/icons-material/Delete';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import type { TrailLinkedRace } from '../../hooks/useTrails';

export type TrailAction = 'archive' | 'delete';

interface TrailActionDialogProps {
    action: TrailAction | null;
    trail: { name: string; slug: string } | null;
    linkedRaces: TrailLinkedRace[];
    busy?: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export default function TrailActionDialog({
    action, trail, linkedRaces, busy = false, onClose, onConfirm,
}: TrailActionDialogProps) {
    const isDelete = action === 'delete';
    const events = [...new Set(linkedRaces.map(r => r.eventName))];

    return (
        <Dialog open={Boolean(action && trail)} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isDelete ? <DeleteIcon color="error" /> : <ArchiveIcon color="warning" />}
                {isDelete ? 'Delete trail?' : 'Archive trail?'}
            </DialogTitle>

            <DialogContent dividers>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    {isDelete ? 'Delete' : 'Archive'} <strong>{trail?.name}</strong>?
                </Typography>

                {isDelete ? (
                    <Typography variant="body2" color="text.secondary" component="div">
                        <Box component="ul" sx={{ pl: 2.5, my: 0 }}>
                            <li>
                                The trail is <strong>archived, not erased</strong> — you'll still find it
                                under <strong>Show Archived</strong>.
                            </li>
                            <li>
                                Its web address changes from{' '}
                                <code>/{trail?.slug}</code> to <code>/{trail?.slug}-deleted-1a2b3c4d</code>.
                                The trail's name stays the same.
                            </li>
                            <li>
                                That frees up <code>/{trail?.slug}</code> for another trail to use.
                            </li>
                            <li>
                                Restoring brings the trail back on the new address. To put it back on{' '}
                                <code>/{trail?.slug}</code>, edit the trail and set the address yourself —
                                that works <strong>as long as no other trail has claimed it meanwhile</strong>.
                            </li>
                        </Box>
                    </Typography>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        The trail comes off the public site and out of the admin list (unless{' '}
                        <strong>Show Archived</strong> is on). Its URL{' '}
                        {trail?.slug ? <>(<code>/{trail.slug}</code>)</> : null} is kept, so restoring it later
                        brings the original link back intact.
                    </Typography>
                )}

                {linkedRaces.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        <AlertTitle sx={{ fontSize: '0.875rem' }}>
                            Used by {linkedRaces.length} race{linkedRaces.length === 1 ? '' : 's'} across{' '}
                            {events.length} event{events.length === 1 ? '' : 's'}
                        </AlertTitle>
                        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
                            {events.map(name => (
                                <Chip key={name} size="small" variant="outlined" icon={<EmojiEventsIcon />} label={name} />
                            ))}
                        </Stack>
                        <Box component="span" sx={{ fontSize: '0.8125rem' }}>
                            Those races keep their name and distance, but the “View trail” link will
                            disappear from their event pages.
                        </Box>
                    </Alert>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={busy}>Cancel</Button>
                <Button
                    onClick={onConfirm}
                    variant="contained"
                    color={isDelete ? 'error' : 'warning'}
                    disabled={busy}
                    startIcon={isDelete ? <DeleteIcon /> : <ArchiveIcon />}
                >
                    {busy
                        ? (isDelete ? 'Deleting…' : 'Archiving…')
                        : (isDelete ? 'Delete trail' : 'Archive trail')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
