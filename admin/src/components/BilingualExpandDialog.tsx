import { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent,
    Button, TextField, Box, Typography, CircularProgress,
    IconButton, Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TranslateIcon from '@mui/icons-material/Translate';
import { useTranslate } from '../hooks/useTranslate';

interface BilingualExpandDialogProps {
    open: boolean;
    onClose: () => void;
    label: string;
    valueIs: string;
    valueEn: string;
    onSave: (is: string, en: string) => void;
}

export default function BilingualExpandDialog({
    open,
    onClose,
    label,
    valueIs,
    valueEn,
    onSave,
}: BilingualExpandDialogProps) {
    const [draftIs, setDraftIs] = useState('');
    const [draftEn, setDraftEn] = useState('');
    const [wasOpen, setWasOpen] = useState(open);
    const { translate, translating } = useTranslate();

    // Reset the draft from the latest saved values on the open transition. Adjusting state
    // directly during render (rather than in an effect) avoids the extra commit-then-render
    // pass an effect would cost, and is the pattern React itself recommends for "reset state
    // when a prop changes" — see https://react.dev/learn/you-might-not-need-an-effect.
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setDraftIs(valueIs);
            setDraftEn(valueEn);
        }
    }

    const handleSave = () => {
        onSave(draftIs, draftEn);
        onClose();
    };

    const handleTranslate = async () => {
        const [result] = await translate([draftIs]);
        if (result) setDraftEn(result);
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">{label}</Typography>
                    <IconButton size="small" onClick={onClose}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                            Íslenska
                        </Typography>
                        <TextField
                            value={draftIs}
                            onChange={(e) => setDraftIs(e.target.value)}
                            multiline
                            minRows={12}
                            fullWidth
                            placeholder="Íslenskur texti…"
                        />
                    </Box>
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                            English
                        </Typography>
                        <TextField
                            value={draftEn}
                            onChange={(e) => setDraftEn(e.target.value)}
                            multiline
                            minRows={12}
                            fullWidth
                            placeholder="English text…"
                            sx={{
                                '& .MuiOutlinedInput-root fieldset': {
                                    borderColor: 'primary.main',
                                    borderStyle: 'dashed',
                                },
                            }}
                        />
                    </Box>
                </Box>
            </DialogContent>
            <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 1.5, gap: 1, borderTop: 1, borderColor: 'divider' }}>
                <Tooltip title="Translate IS → EN using DeepL">
                    <span>
                        <Button
                            startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
                            disabled={translating || !draftIs.trim()}
                            onClick={handleTranslate}
                        >
                            Translate to EN
                        </Button>
                    </span>
                </Tooltip>
                <Box sx={{ flexGrow: 1 }} />
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSave}>Apply</Button>
            </Box>
        </Dialog>
    );
}
