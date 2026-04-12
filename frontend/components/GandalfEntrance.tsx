import { Dialog, DialogContent, Typography, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

interface GandalfEntranceProps {
    quote: { is: string; en: string } | null;
    onClose: () => void;
}

export default function GandalfEntrance({ quote, onClose }: GandalfEntranceProps) {
    const { i18n } = useTranslation();
    if (!quote) return null;

    const text = i18n.language === 'is' ? quote.is : quote.en;

    return (
        <Dialog
            open
            onClose={onClose}
            PaperProps={{
                sx: {
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                    color: '#e0e0e0',
                    borderRadius: 3,
                    maxWidth: 400,
                    mx: 'auto',
                    border: '1px solid rgba(255,215,0,0.3)',
                    boxShadow: '0 0 40px rgba(255,215,0,0.15)',
                },
            }}
        >
            <IconButton
                onClick={onClose}
                sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.5)' }}
                size="small"
            >
                <CloseIcon fontSize="small" />
            </IconButton>
            <DialogContent sx={{ textAlign: 'center', py: 4 }}>
                <Typography sx={{ fontSize: '4rem', lineHeight: 1, mb: 1 }}>
                    🧙‍♂️
                </Typography>
                <Typography
                    variant="h6"
                    sx={{
                        fontStyle: 'italic',
                        color: '#ffd700',
                        mb: 2,
                        fontFamily: '"Georgia", serif',
                        lineHeight: 1.5,
                    }}
                >
                    &ldquo;{text}&rdquo;
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, opacity: 0.6 }}>
                    <Typography variant="caption">✨</Typography>
                    <Typography variant="caption" sx={{ letterSpacing: 2, textTransform: 'uppercase' }}>
                        Admin Mode Activated
                    </Typography>
                    <Typography variant="caption">✨</Typography>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
