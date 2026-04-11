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
        title: 'Navigation',
        shortcuts: [
            { keys: ['Alt', '1'], description: 'All Trails' },
            { keys: ['Alt', '2'], description: 'Locations' },
            { keys: ['Alt', '3'], description: 'Trail Health' },
            { keys: ['Alt', '4'], description: 'Trail Map' },
            { keys: ['Alt', '5'], description: 'Tags' },
            { keys: ['Alt', '6'], description: 'Analytics' },
            { keys: ['Alt', '7'], description: 'Features' },
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
