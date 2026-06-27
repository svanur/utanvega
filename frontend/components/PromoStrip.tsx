import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

export default function PromoStrip() {
    const { t } = useTranslation();
    const { isEnabled } = useFeatureFlags();

    const showChallenge = isEnabled('promo_challenge_2026');
    const showTrip = isEnabled('promo_running_trip_2026');

    if (!showChallenge && !showTrip) return null;

    return (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
            {showChallenge && (
                <Box
                    component={RouterLink}
                    to="/challenge/2026"
                    sx={{
                        flex: 1,
                        borderRadius: 2,
                        overflow: 'hidden',
                        display: 'block',
                        '&:hover img': { transform: 'scale(1.02)' },
                    }}
                >
                    <Box
                        component="img"
                        src="/sponsors/challenge-2026.avif"
                        alt="Útivistaáskorun 2026"
                        sx={{ width: '100%', height: 180, objectFit: 'cover', display: 'block', transition: 'transform 0.3s ease' }}
                    />
                </Box>
            )}

            {showTrip && (
                <Box
                    sx={{
                        flex: 1,
                        borderRadius: 2,
                        overflow: 'hidden',
                        position: 'relative',
                        height: 180,
                    }}
                >
                    <Box
                        component="img"
                        src="/sponsors/running-trip-2026.avif"
                        alt={t('promos.runningTrip.title')}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {/* Dark gradient overlay */}
                    <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
                    {/* Text + button */}
                    <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#fff', lineHeight: 1.3, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                            {t('promos.runningTrip.title')}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', display: 'block', mb: 1 }}>
                            {t('promos.runningTrip.dates')}
                        </Typography>
                        <Button
                            component={RouterLink}
                            to="/shop/hlaupaferd"
                            variant="contained"
                            size="small"
                            sx={{ fontWeight: 700, borderRadius: 5, px: 2 }}
                        >
                            {t('promos.runningTrip.cta')}
                        </Button>
                    </Box>
                </Box>
            )}
        </Stack>
    );
}
