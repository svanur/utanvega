import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { PROMO_SLOTS } from '../data/sponsors';

export default function PromoStrip({ position }: { position: 'top' | 'bottom' }) {
    const { t } = useTranslation();
    const { isEnabled } = useFeatureFlags();

    const active = PROMO_SLOTS.filter(slot => slot.position === position && isEnabled(slot.flag));
    if (active.length === 0) return null;

    return (
        <Stack data-promo-strip direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
            {active.map(slot => (
                <Box
                    key={slot.flag}
                    component={RouterLink}
                    to={slot.href}
                    sx={{
                        flex: 1,
                        borderRadius: 2,
                        overflow: 'hidden',
                        position: 'relative',
                        height: 180,
                        display: 'block',
                        '&:hover img': { transform: 'scale(1.02)' },
                    }}
                >
                    <Box
                        component="img"
                        src={slot.img}
                        alt={slot.alt}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s ease' }}
                    />

                    {slot.textOverlay && (
                        <>
                            <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
                            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 2 }}>
                                <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#fff', lineHeight: 1.3, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                                    {t(`${slot.textOverlay.i18nPrefix}.title`)}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', display: 'block', mb: 1 }}>
                                    {t(`${slot.textOverlay.i18nPrefix}.dates`)}
                                </Typography>
                                <Button
                                    component="span"
                                    variant="contained"
                                    size="small"
                                    sx={{ fontWeight: 700, borderRadius: 5, px: 2 }}
                                >
                                    {t(`${slot.textOverlay.i18nPrefix}.cta`)}
                                </Button>
                            </Box>
                        </>
                    )}
                </Box>
            ))}
        </Stack>
    );
}
