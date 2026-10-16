import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Typography,
    Paper,
    Stack,
    Skeleton,
    Divider,
    IconButton,
    Collapse,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import AirIcon from '@mui/icons-material/Air';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import type { TrailClimate } from '../hooks/useTrails';

interface ClimateCardProps {
    climate: TrailClimate | null;
    loading: boolean;
    error: string | null;
}

// Historical climate normals card — deliberately visually distinct from WeatherCard (different
// icon, "usually" framing, no condition chip) so a visitor can't mistake a 15-year average for
// today's forecast when both cards render on the same event-detail page (#1335).
export default function ClimateCard({ climate, loading, error }: ClimateCardProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    if (loading) {
        return (
            <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
                <Skeleton variant="text" width={180} height={32} />
                <Skeleton variant="rectangular" height={60} sx={{ mt: 1, borderRadius: 1 }} />
            </Paper>
        );
    }

    if (error || !climate) {
        return null;
    }

    const precipitationChancePct = Math.round(climate.precipitationChance * 100);

    return (
        <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
            {/* Clickable header — always visible */}
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                onClick={() => setExpanded(prev => !prev)}
                sx={{ cursor: 'pointer', userSelect: 'none' }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    <HistoryIcon color="secondary" />
                    <Typography variant="h6" fontWeight="bold">
                        {t('climate.title')}
                    </Typography>
                    {/* Quick summary when collapsed */}
                    {!expanded && (
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ ml: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                                {Math.round(climate.averageHigh)}° / {Math.round(climate.averageLow)}°C
                            </Typography>
                        </Stack>
                    )}
                </Stack>
                <IconButton size="small">
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
            </Stack>

            {/* Collapsible content */}
            <Collapse in={expanded}>
                <Box sx={{ mt: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <ThermostatIcon color="action" />
                        <Box>
                            <Typography variant="h5" fontWeight="bold" sx={{ lineHeight: 1.1 }}>
                                {Math.round(climate.averageHigh)}° / {Math.round(climate.averageLow)}°C
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('climate.avgHighLow')}
                            </Typography>
                        </Box>
                    </Stack>

                    <Stack direction="row" spacing={3} sx={{ mt: 2, flexWrap: 'wrap', gap: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <WaterDropIcon fontSize="small" color="action" />
                            <Box>
                                <Typography variant="body2" fontWeight="bold">
                                    {climate.averagePrecipitation.toFixed(1)} mm
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('climate.avgPrecipitation')}
                                </Typography>
                            </Box>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <WaterDropIcon fontSize="small" color="info" />
                            <Box>
                                <Typography variant="body2" fontWeight="bold">
                                    {precipitationChancePct}%
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('climate.chanceOfRain')}
                                </Typography>
                            </Box>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <AirIcon fontSize="small" color="action" />
                            <Box>
                                <Typography variant="body2" fontWeight="bold">
                                    {climate.averageMaxWind.toFixed(1)} m/s
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('climate.avgWind')}
                                </Typography>
                            </Box>
                        </Stack>
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="caption" color="text.secondary">
                        {t('climate.basedOnYears', { years: climate.yearsOfData })}
                    </Typography>
                </Box>
            </Collapse>
        </Paper>
    );
}
