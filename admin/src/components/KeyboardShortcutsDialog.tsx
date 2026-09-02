import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    Box,
    Chip,
    IconButton,
    Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface ShortcutEntry {
    keys: string[];
    description: string;
}

interface ShortcutGroup {
    title: string;
    shortcuts: ShortcutEntry[];
}

const shortcutGroups: ShortcutGroup[] = [
    {
        title: 'Navigation  (press g, then the letter)',
        shortcuts: [
            { keys: ['g', 'h'], description: 'Home' },
            { keys: ['g', 'e'], description: 'Events' },
            { keys: ['g', 't'], description: 'Trails' },
            { keys: ['g', 'c'], description: 'Race Manager' },
            { keys: ['g', 'l'], description: 'Locations' },
            { keys: ['g', 'o'], description: 'Organizers' },
            { keys: ['g', 's'], description: 'Tags' },
            { keys: ['g', 'f'], description: 'Features' },
            { keys: ['g', 'r'], description: 'Trail Health' },
            { keys: ['g', 'v'], description: 'Event Health' },
            { keys: ['g', 'd'], description: 'Edition Health' },
            { keys: ['g', 'i'], description: 'Translations' },
            { keys: ['g', 'b'], description: 'Feedback' },
            { keys: ['g', 'm'], description: 'Trail Map' },
            { keys: ['g', 'a'], description: 'Analytics' },
            { keys: ['g', 'n'], description: 'Sponsors' },
            { keys: ['g', 'p'], description: 'Photographers' },
            { keys: ['j'], description: 'Next row (list pages, and editions/races on event detail page)' },
            { keys: ['k'], description: 'Previous row (list pages, and editions/races on event detail page)' },
            { keys: ['Enter / o'], description: 'Open focused row (list pages, and editions/races on event detail page)' },
            { keys: ['Space'], description: 'Expand/collapse focused edition (event detail page)' },
            { keys: ['Esc'], description: 'Unfocus search (list pages)' },
        ],
    },
    {
        title: 'Search',
        shortcuts: [
            { keys: ['Ctrl', 'K'], description: 'Spotlight search' },
            { keys: ['/'], description: 'Focus search input' },
        ],
    },
    {
        title: 'Race Manager',
        shortcuts: [
            { keys: ['s'], description: 'Switch to Setup mode' },
            { keys: ['w'], description: 'Switch to Wrap-up mode' },
        ],
    },
    {
        title: 'Actions',
        shortcuts: [
            { keys: ['Alt', 'N'], description: 'New trail (upload GPX)' },
            { keys: ['Alt', 'R'], description: 'Refresh trail list' },
            { keys: ['Alt', 'T'], description: 'Toggle tools panel' },
            { keys: ['Alt', 'S'], description: 'Toggle sidebar' },
        ],
    },
    {
        title: 'Detail pages (trail / event / organizer)',
        shortcuts: [
            { keys: ['u'], description: 'Go back to list' },
            { keys: ['e'], description: 'Toggle edit form open / closed' },
            { keys: ['v'], description: 'View on public site' },
            { keys: ['s'], description: 'Save (when not typing in a field)' },
            { keys: ['Ctrl', 'S'], description: 'Save (works anywhere, even in fields)' },
            { keys: ['Esc'], description: 'Cancel / close edit form' },
        ],
    },
    {
        title: 'General',
        shortcuts: [
            { keys: ['Ctrl', '?'], description: 'Show this help' },
            { keys: ['Esc'], description: 'Close dialog / panel' },
        ],
    },
];

function KeyChip({ label }: { label: string }) {
    return (
        <Chip
            label={label}
            size="small"
            variant="outlined"
            sx={{
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 24,
                minWidth: 28,
                borderRadius: 1,
            }}
        />
    );
}

interface KeyboardShortcutsDialogProps {
    open: boolean;
    onClose: () => void;
}

export default function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    position: 'fixed',
                    top: '10%',
                    m: 0,
                    maxHeight: '75vh',
                    borderRadius: 2,
                },
            }}
            slotProps={{
                backdrop: { sx: { backdropFilter: 'blur(4px)' } },
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
                <Typography variant="h6" component="span">⌨️ Keyboard Shortcuts</Typography>
                <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
                {shortcutGroups.map((group, gi) => (
                    <Box key={group.title}>
                        {gi > 0 && <Divider sx={{ my: 1.5 }} />}
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: gi === 0 ? 0 : 0.5 }}>
                            {group.title}
                        </Typography>
                        {group.shortcuts.map((shortcut) => (
                            <Box
                                key={shortcut.description}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    py: 0.5,
                                    px: 1,
                                    borderRadius: 1,
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                <Typography variant="body2">{shortcut.description}</Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                    {shortcut.keys.map((key, ki) => (
                                        <Box key={ki} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {ki > 0 && (
                                                <Typography variant="caption" color="text.secondary">+</Typography>
                                            )}
                                            <KeyChip label={key} />
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                ))}
            </DialogContent>
        </Dialog>
    );
}
