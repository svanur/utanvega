import { Dialog, DialogTitle, DialogContent, Typography, Box, Chip, IconButton, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import ArchiveIcon from '@mui/icons-material/Archive';

interface StatusEntry {
    value: string;
    label: string;
    color: 'success' | 'warning' | 'info' | 'default';
    summary: string;
    details: string;
}

// Descriptions reflect what the code actually does today — see GetTrailsQuery (list),
// GetTrailBySlugQuery (detail) and DeleteTrailCommand (soft delete) in the backend.
const statuses: StatusEntry[] = [
    {
        value: 'Draft',
        label: 'Hidden',
        color: 'default',
        summary: 'Not public — work in progress.',
        details: 'Hidden from the public site entirely: not in the trails list, search suggestions or trail map, and the public trail page returns "not found". Visible in admin only. (Stored as "Draft" in the database and in change history.)',
    },
    {
        value: 'Published',
        label: 'Published',
        color: 'success',
        summary: 'Fully public.',
        details: 'Appears in the public trails list, search suggestions and the trail map, and its page is open to everyone.',
    },
    {
        value: 'EventOnly',
        label: 'Event Only',
        color: 'info',
        summary: 'Unlisted — reachable by direct link only.',
        details: 'Kept out of the trails list, search and map, but the trail page still opens for anyone following a link to it (typically from an event\'s race). Use it for courses that only exist as part of an event and should not show up as a route people can go run on their own.',
    },
    {
        value: 'Archived',
        label: 'Archived',
        color: 'default',
        summary: 'Out of circulation — reached via Archive or Delete.',
        details: 'Not public, and hidden from the admin list unless "Show Archived" is on. Also excluded from analytics, check-ins and duplicate detection. Restorable either way — but Archive and Delete differ in what happens to the URL (see below).',
    },
];

export default function TrailStatusLegendDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                Trail statuses &amp; actions
                <IconButton aria-label="close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                {statuses.map((s, i) => (
                    <Box key={s.value} sx={{ mb: i < statuses.length - 1 ? 2 : 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Chip label={s.label} size="small" color={s.color} />
                            <Typography variant="body2" fontWeight={600}>{s.summary}</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">{s.details}</Typography>
                        {i < statuses.length - 1 && <Divider sx={{ mt: 2 }} />}
                    </Box>
                ))}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <ArchiveIcon color="warning" fontSize="small" />
                    <Typography variant="body2" fontWeight={600}>Archive vs Delete</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" component="div">
                    Both put the trail into <strong>Archived</strong> and neither erases it — the
                    difference is the URL:
                    <Box component="ul" sx={{ pl: 2.5, my: 1 }}>
                        <li>
                            <strong>Archive</strong> keeps the trail's web address, so restoring it brings
                            the original link back intact. Use this to take a trail out of circulation
                            temporarily.
                        </li>
                        <li>
                            <strong>Delete</strong> also moves the trail to a new address
                            (<code>/my-trail</code> → <code>/my-trail-deleted-1a2b3c4d</code>), freeing{' '}
                            <code>/my-trail</code> for another trail to use. Restoring brings the trail
                            back on the new address; you can set it back to the original by editing the
                            trail, as long as nothing else has claimed it meanwhile.
                        </li>
                        <li>
                            Either way the trail's <em>name</em> is unchanged — only its web address moves.
                        </li>
                    </Box>
                    Neither unlinks the trail from any event races that use it — those races keep
                    their name and distance, but their "View trail" link disappears from the public
                    event page while the trail is not publicly visible.
                </Typography>

                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <BookmarkIcon color="warning" fontSize="small" />
                    <Typography variant="body2" fontWeight={600}>Marked for review</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Separate from status — an admin-only bookmark meaning "come back to this".
                    It never changes what the public site shows, so you can mark a trail in any
                    status. Toggle it from the bookmark icon next to the trail name, and filter
                    for marked trails with the "Needs review" chip on the trails list.
                </Typography>
            </DialogContent>
        </Dialog>
    );
}
