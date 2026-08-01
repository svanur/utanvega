import { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
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
    const { translate, translating } = useTranslate();

    useEffect(() => {
        if (open) {
            setDraftIs(valueIs);
            setDraftEn(valueEn);
        }
    }, [open, valueIs, valueEn]);

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
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
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
                <Button variant="contained" onClick={handleSave}>
                    Apply
                </Button>
            </DialogActions>
        </Dialog>
    );
}
