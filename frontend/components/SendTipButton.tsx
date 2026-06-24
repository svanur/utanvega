import { useState } from 'react';
import { Box, Button, CircularProgress, Collapse, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { SxProps, Theme } from '@mui/material';
import { API_URL } from '../hooks/useTrails';

interface SendTipButtonProps {
    type: 'trail' | 'event';
    sx?: SxProps<Theme>;
}

export default function SendTipButton({ type, sx }: SendTipButtonProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    async function handleSend() {
        if (!message.trim()) return;
        setStatus('sending');
        try {
            const res = await fetch(`${API_URL}/api/v1/tips`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageUrl: window.location.href, message: message.trim() }),
            });
            if (!res.ok) throw new Error();
            setStatus('sent');
            setMessage('');
        } catch {
            setStatus('error');
        }
    }

    function handleClose() {
        setOpen(false);
        setMessage('');
        setStatus('idle');
    }

    return (
        <Box sx={sx}>
            <Tooltip title={t('tip.tooltip')}>
                <Button
                    size="small"
                    variant="text"
                    onClick={() => setOpen(o => !o)}
                    startIcon={<TipsAndUpdatesOutlinedIcon fontSize="small" />}
                    sx={{ textTransform: 'none', color: 'text.secondary' }}
                >
                    {t('tip.button')}
                </Button>
            </Tooltip>

            <Collapse in={open}>
                <Box sx={{ mt: 1, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                    {status === 'sent' ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="success.main">{t('tip.sent')}</Typography>
                            <IconButton size="small" onClick={handleClose}><CloseIcon fontSize="small" /></IconButton>
                        </Box>
                    ) : (
                        <>
                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                maxRows={5}
                                size="small"
                                placeholder={t('tip.placeholder')}
                                value={message}
                                onChange={e => { setMessage(e.target.value); setStatus('idle'); }}
                                disabled={status === 'sending'}
                                inputProps={{ maxLength: 2000 }}
                            />
                            {status === 'error' && (
                                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                                    {t('tip.error')}
                                </Typography>
                            )}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                                <Button size="small" onClick={handleClose} sx={{ textTransform: 'none' }}>
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={handleSend}
                                    disabled={!message.trim() || status === 'sending'}
                                    startIcon={status === 'sending' ? <CircularProgress size={14} /> : undefined}
                                    sx={{ textTransform: 'none' }}
                                >
                                    {t('tip.send')}
                                </Button>
                            </Box>
                        </>
                    )}
                </Box>
            </Collapse>
        </Box>
    );
}
