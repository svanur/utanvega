import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { PROMO_SLOTS, isExternalHref, type PromoSlot } from '../data/sponsors';

// Slots sharing a rotationGroup occupy one physical slot — pick exactly one at random
// per render (re-rolled on every page load/navigation, never persisted). Slots without a
// rotationGroup pass through untouched. No memoization: `active` is a fresh array every
// render anyway, so there is nothing stable to cache — this just picks directly.
// Math.random is intentionally impure here — the whole point is a fresh pick per
// render, not a memoized/stable one.
function pickRotation(active: PromoSlot[]): PromoSlot[] {
    const picked: PromoSlot[] = [];
    const seenGroups = new Set<string>();
    for (const slot of active) {
        if (!slot.rotationGroup) {
            picked.push(slot);
            continue;
        }
        if (seenGroups.has(slot.rotationGroup)) continue;
        seenGroups.add(slot.rotationGroup);
        const group = active.filter(s => s.rotationGroup === slot.rotationGroup);
        picked.push(group[Math.floor(Math.random() * group.length)]);
    }
    return picked;
}

export default function PromoStrip({ position }: { position: 'top' | 'bottom' }) {
    const { t } = useTranslation();
    const { isEnabled } = useFeatureFlags();

    const active = PROMO_SLOTS.filter(slot => slot.position === position && isEnabled(slot.flag, slot.defaultEnabled ?? true));
    const rotated = pickRotation(active);

    if (rotated.length === 0) return null;

    const wideSlots = rotated.filter(slot => slot.shape === 'wide');
    const cardSlots = rotated.filter(slot => slot.shape !== 'wide');

    return (
        <Stack data-promo-strip spacing={1.5} sx={{ mt: position === 'bottom' ? 4 : 0, mb: 3 }}>
            {wideSlots.map(slot => (
                <Box
                    key={slot.flag}
                    component={RouterLink}
                    to={slot.href}
                    {...(isExternalHref(slot.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    sx={{ display: 'block' }}
                >
                    <Box
                        component="img"
                        src={slot.img}
                        alt={slot.alt}
                        sx={{ width: '100%', height: 'auto', display: 'block', borderRadius: 2 }}
                    />
                </Box>
            ))}

            {cardSlots.length > 0 && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {cardSlots.map(slot => (
                <Box
                    key={slot.flag}
                    component={RouterLink}
                    to={slot.href}
                    {...(isExternalHref(slot.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
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
            )}
        </Stack>
    );
}
