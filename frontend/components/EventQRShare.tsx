import { useState } from 'react';
import {
    Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';

interface EventQRShareProps {
    slug: string;
    eventName: string;
    open: boolean;
    onClose: () => void;
}

export default function EventQRShare({ slug, eventName, open, onClose }: EventQRShareProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const eventUrl = `${window.location.origin}/events/${slug}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(eventUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard unavailable — silently ignore
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
                {eventName}
            </DialogTitle>
            <DialogContent>
                <Box display="flex" flexDirection="column" alignItems="center" py={2}>
                    <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2 }}>
                        <QRCodeSVG value={eventUrl} size={200} level="H" includeMargin />
                    </Box>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
                        {t('qr.scanEvent')}
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                        color={copied ? 'success' : 'primary'}
                        onClick={handleCopy}
                        sx={{ mt: 2, textTransform: 'none' }}
                    >
                        {copied ? t('qr.linkCopied') : t('qr.copyLink')}
                    </Button>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('qr.close')}</Button>
            </DialogActions>
        </Dialog>
    );
}
