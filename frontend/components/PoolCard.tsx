import { Box, Typography, Chip, Link, IconButton, Tooltip } from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';
import type { Pool } from '../data/pools';
import { googleMapsDirectionsUrl } from '../data/pools';

const TYPE_ICON: Record<string, string> = {
    municipal: '🏊',
    spa: '🧖',
    natural: '🌿',
};

interface Props {
    pool: Pool;
    distanceKm?: number;
}

export default function PoolCard({ pool, distanceKm }: Props) {
    const { t } = useTranslation();

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75 }}>
            <Typography sx={{ fontSize: 20, flexShrink: 0 }}>{TYPE_ICON[pool.type]}</Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Link
                        href={pool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="body2"
                        fontWeight={600}
                        underline="hover"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                    >
                        {pool.name}
                        <OpenInNewIcon sx={{ fontSize: 12 }} />
                    </Link>
                    {distanceKm !== undefined && (
                        <Typography variant="caption" color="text.secondary">
                            {distanceKm < 1
                                ? `${Math.round(distanceKm * 1000)} m`
                                : `${distanceKm.toFixed(1)} km`}
                        </Typography>
                    )}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25, flexWrap: 'wrap' }}>
                    <Chip label={t(`pools.type.${pool.type}`)} size="small" variant="outlined" sx={{ height: 18, fontSize: 11 }} />
                    {pool.access.is_paid === false && (
                        <Chip label={t('pools.free')} size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: 11 }} />
                    )}
                    {pool.access.requires_hiking && (
                        <Chip label={t('pools.hiking')} size="small" variant="outlined" sx={{ height: 18, fontSize: 11 }} />
                    )}
                    {pool.access.requires_4wd && (
                        <Chip label={t('pools.fourwd')} size="small" variant="outlined" sx={{ height: 18, fontSize: 11 }} />
                    )}
                </Box>
            </Box>
            <Tooltip title={t('pools.directions')}>
                <IconButton
                    size="small"
                    component="a"
                    href={googleMapsDirectionsUrl(pool)}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ flexShrink: 0 }}
                >
                    <DirectionsCarIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}
