import type { PaletteMode } from '@mui/material';
import { Box, Typography, Chip, Divider, Button, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

export default function ScratchCardPage({ mode, onToggleMode }: { mode: PaletteMode; onToggleMode: () => void }) {
    const { t } = useTranslation();
    return (
        <Layout mode={mode} onToggleMode={onToggleMode} maxWidth="sm">
            <Box sx={{ py: 2 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    {t('scratchCard.title')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {t('scratchCard.subtitle')}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
                    <Chip label="A2 — 420 × 594 mm" variant="outlined" />
                    <Chip label="42 hlaup" color="primary" variant="outlined" />
                    <Chip label={t('scratchCard.madeInIceland')} color="success" variant="outlined" />
                </Stack>

                <Typography variant="body1" sx={{ mb: 2 }}>
                    {t('scratchCard.description')}
                </Typography>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" fontWeight={600} gutterBottom>
                    {t('scratchCard.details')}
                </Typography>
                <Stack spacing={1} sx={{ mb: 3 }}>
                    <Typography variant="body2">📐 {t('scratchCard.size')}: A2 (420 × 594 mm)</Typography>
                    <Typography variant="body2">🏔️ {t('scratchCard.events')}: 42 {t('scratchCard.trailEvents')}</Typography>
                    <Typography variant="body2">🎨 {t('scratchCard.design')}: ARRA Design Studio</Typography>
                    <Typography variant="body2">💰 {t('scratchCard.price')}: 8.990 kr.</Typography>
                    <Typography variant="body2">📦 {t('scratchCard.shipping')}: 990 kr. (Dropp)</Typography>
                </Stack>

                <Button
                    variant="contained"
                    size="large"
                    href="mailto:info@hlaupadagskra.is?subject=Skafkort pöntun"
                    sx={{ textTransform: 'none' }}
                >
                    {t('scratchCard.order')}
                </Button>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    info@hlaupadagskra.is
                </Typography>
            </Box>
        </Layout>
    );
}
