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
import AirIcon from '@mui/icons-material/Air';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import type { EventClimate } from '../hooks/useTrails';

interface ClimateCardProps {
    climate: EventClimate | null;
    loading: boolean;
    error: string | null;
    locationName?: string | null;
}

// Unlike WeatherCard, there's no WMO weatherCode to key off — climate normals are an aggregate
// (average high/low, chance of rain, average wind) over ~15 past years, not one dated forecast.
// This heuristic picks a representative emoji from those aggregates instead, so the card still
// gives a "live" at-a-glance read rather than a fixed icon unrelated to the actual normals —
// reusing the same emoji set WeatherCard's getWeatherIcon draws from, for visual consistency.
function getClimateIcon(climate: EventClimate): string {
    if (climate.averageLow <= 0 && climate.precipitationChance >= 0.3) return '🌨️';
    if (climate.precipitationChance >= 0.5) return '🌧️';
    if (climate.precipitationChance >= 0.2) return '🌦️';
    if (climate.averageHigh >= 15) return '☀️';
    return '⛅';
}

// Historical climate normals card — deliberately visually distinct from WeatherCard (different
// icon, "usually" framing, no condition chip) so a visitor can't mistake a 15-year average for
// today's forecast when both cards render on the same event-detail page (#1335).
export default function ClimateCard({ climate, loading, error, locationName }: ClimateCardProps) {
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
    const icon = getClimateIcon(climate);
    // Climate normals have no year of their own (averaged across ~15 past years), so this is
    // deliberately "15. júlí", not a dated "15. júlí 2027" — reusing the same months array other
    // pages already pull from the races namespace rather than duplicating it under climate.
    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const targetDateLabel = `${climate.targetDay}. ${months[climate.targetMonth - 1]}`;

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
                    {/* Quick summary when collapsed — mirrors WeatherCard's icon + temp + wind pattern */}
                    {!expanded && (
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ ml: 1 }}>
                            <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>{icon}</Typography>
                            <Typography variant="body2" fontWeight="bold">
                                {Math.round(climate.averageHigh)}° / {Math.round(climate.averageLow)}°C
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.3}>
                                <AirIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                    {climate.averageMaxWind.toFixed(0)} m/s
                                </Typography>
                            </Stack>
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
                        <Typography sx={{ fontSize: '2.5rem', lineHeight: 1 }}>{icon}</Typography>
                        <Box>
                            <Typography variant="h5" fontWeight="bold" sx={{ lineHeight: 1.1 }}>
                                {Math.round(climate.averageHigh)}° / {Math.round(climate.averageLow)}°C
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('climate.avgHighLow')}
                            </Typography>
                        </Box>
                    </Stack>

                    <Box
                        sx={{
                            mt: 2,
                            display: 'grid',
                            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                            columnGap: 1.5,
                            rowGap: 1.5,
                        }}
                    >
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
                        {locationName && (
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                                <LocationOnIcon fontSize="small" color="action" />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight="bold" noWrap>
                                        {locationName}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('climate.location')}
                                    </Typography>
                                </Box>
                            </Stack>
                        )}
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <CalendarMonthIcon fontSize="small" color="action" />
                            <Box>
                                <Typography variant="body2" fontWeight="bold">
                                    {targetDateLabel}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('climate.date')}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="caption" color="text.secondary">
                        {t('climate.basedOnYears', { years: climate.yearsOfData })}
                    </Typography>
                </Box>
            </Collapse>
        </Paper>
    );
}
