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
            { keys: ['g', 'e'], description: 'Events' },
            { keys: ['g', 't'], description: 'Trails' },
            { keys: ['g', 'l'], description: 'Locations' },
            { keys: ['g', 'o'], description: 'Organizers' },
            { keys: ['g', 'h'], description: 'Trail Health' },
            { keys: ['g', 'v'], description: 'Event Health' },
            { keys: ['g', 'd'], description: 'Edition Health' },
            { keys: ['g', 'm'], description: 'Trail Map' },
            { keys: ['g', 's'], description: 'Tags' },
            { keys: ['g', 'a'], description: 'Analytics' },
            { keys: ['g', 'f'], description: 'Features' },
            { keys: ['g', 'r'], description: 'Hero Themes' },
            { keys: ['g', 'n'], description: 'Sponsors' },
            { keys: ['g', 'p'], description: 'Pools' },
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
        title: 'Actions',
        shortcuts: [
            { keys: ['Alt', 'N'], description: 'New trail (upload GPX)' },
            { keys: ['Alt', 'R'], description: 'Refresh trail list' },
            { keys: ['Alt', 'T'], description: 'Toggle tools panel' },
            { keys: ['Alt', 'S'], description: 'Toggle sidebar' },
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
