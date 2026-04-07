import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Typography,
    Paper,
    Stack,
    Chip,
    Skeleton,
    Divider,
    IconButton,
} from '@mui/material';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import AirIcon from '@mui/icons-material/Air';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import LandscapeIcon from '@mui/icons-material/Landscape';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { TrailWeather, HourlyForecastDto, DailyForecastDto, WeatherPointDto } from '../hooks/useTrails';

interface WeatherCardProps {
    weather: TrailWeather | null;
    loading: boolean;
    error: string | null;
}

function getWeatherIcon(code: number): string {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 55) return '🌦️';
    if (code >= 61 && code <= 65) return '🌧️';
    if (code >= 71 && code <= 77) return '🌨️';
    if (code >= 80 && code <= 82) return '🌧️';
    if (code >= 85 && code <= 86) return '🌨️';
    if (code >= 95) return '⛈️';
    return '🌤️';
}

function getConditionColor(condition: string): 'success' | 'warning' | 'error' {
    if (condition === 'Good') return 'success';
    if (condition === 'Fair') return 'warning';
    return 'error';
}

function getConditionEmoji(condition: string): string {
    if (condition === 'Good') return '🟢';
    if (condition === 'Fair') return '🟡';
    return '🔴';
}

function formatHour(timeStr: string): string {
    try {
        const date = new Date(timeStr);
        return date.getHours().toString().padStart(2, '0') + ':00';
    } catch {
        return timeStr;
    }
}

function formatDay(dateStr: string, t: (key: string) => string): string {
    try {
        const date = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.getTime() === today.getTime()) return t('weather.now');
        if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

        return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

function CurrentWeather({ point, label, t }: { point: WeatherPointDto; label: string; t: (key: string, opts?: Record<string, unknown>) => string }) {
    const weatherCode = point.weatherCode;
    const icon = getWeatherIcon(weatherCode);
    const codeKey = `weather.codes.${weatherCode}`;
    const description = t(codeKey) !== codeKey ? t(codeKey) : '';

    return (
        <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {label} · {t('weather.elevation', { elevation: Math.round(point.elevation) })}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 0.5 }}>
                <Typography sx={{ fontSize: '2.5rem', lineHeight: 1 }}>{icon}</Typography>
                <Box>
                    <Typography variant="h4" fontWeight="bold" sx={{ lineHeight: 1.1, fontSize: { xs: '1.8rem', sm: '2.125rem' } }}>
                        {Math.round(point.temperature)}°C
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('weather.feelsLike')} {Math.round(point.apparentTemperature)}°C
                        {description && ` · ${description}`}
                    </Typography>
                </Box>
            </Stack>
            <Stack direction="row" spacing={3} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                    <AirIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                        {point.windSpeed.toFixed(1)} m/s
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        ({t('weather.gusts')} {point.windGusts.toFixed(1)})
                    </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                    <WaterDropIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                        {point.precipitation.toFixed(1)} mm
                    </Typography>
                </Stack>
            </Stack>
        </Box>
    );
}

function HourlyStrip({ hourly, t }: { hourly: HourlyForecastDto[]; t: (key: string) => string }) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const amount = direction === 'left' ? -200 : 200;
            scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };

    return (
        <Box>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                {t('weather.hourly')}
            </Typography>
            <Box sx={{ position: 'relative' }}>
                <IconButton
                    size="small"
                    onClick={() => scroll('left')}
                    sx={{
                        position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
                        zIndex: 1, bgcolor: 'background.paper', boxShadow: 1,
                        display: { xs: 'none', sm: 'flex' },
                        '&:hover': { bgcolor: 'action.hover' },
                    }}
                >
                    <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <Box
                    ref={scrollRef}
                    sx={{
                        display: 'flex',
                        gap: 1,
                        overflowX: 'auto',
                        scrollbarWidth: 'none',
                        '&::-webkit-scrollbar': { display: 'none' },
                        py: 0.5,
                        px: 0.5,
                    }}
                >
                    {hourly.map((h, i) => (
                        <Box
                            key={i}
                            sx={{
                                minWidth: 64,
                                textAlign: 'center',
                                p: 1,
                                borderRadius: 1,
                                bgcolor: i === 0 ? 'action.selected' : 'transparent',
                                flexShrink: 0,
                            }}
                        >
                            <Typography variant="caption" color="text.secondary">
                                {i === 0 ? t('weather.now') : formatHour(h.time)}
                            </Typography>
                            <Typography sx={{ fontSize: '1.2rem', my: 0.3 }}>
                                {getWeatherIcon(h.weatherCode)}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                                {Math.round(h.temperature)}°
                            </Typography>
                            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.3}>
                                <AirIcon sx={{ fontSize: 10, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                    {Math.round(h.windSpeed)}
                                </Typography>
                            </Stack>
                        </Box>
                    ))}
                </Box>
                <IconButton
                    size="small"
                    onClick={() => scroll('right')}
                    sx={{
                        position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
                        zIndex: 1, bgcolor: 'background.paper', boxShadow: 1,
                        display: { xs: 'none', sm: 'flex' },
                        '&:hover': { bgcolor: 'action.hover' },
                    }}
                >
                    <ChevronRightIcon fontSize="small" />
                </IconButton>
            </Box>
        </Box>
    );
}

function DailyForecast({ daily, t }: { daily: DailyForecastDto[]; t: (key: string) => string }) {
    return (
        <Box>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                {t('weather.daily')}
            </Typography>
            <Stack spacing={0.5}>
                {daily.map((d, i) => (
                    <Stack
                        key={i}
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{ py: 0.5, flexWrap: 'wrap' }}
                    >
                        <Typography variant="body2" sx={{ minWidth: { xs: 60, sm: 70 } }}>
                            {formatDay(d.date, t)}
                        </Typography>
                        <Typography sx={{ fontSize: '1.1rem', minWidth: 28, textAlign: 'center' }}>
                            {getWeatherIcon(d.weatherCode)}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: { xs: 65, sm: 80 } }}>
                            <Typography variant="body2" fontWeight="bold">
                                {Math.round(d.temperatureMax)}°
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                / {Math.round(d.temperatureMin)}°
                            </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.3}>
                            <AirIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                                {Math.round(d.windSpeedMax)} m/s
                            </Typography>
                        </Stack>
                        {d.precipitationSum > 0 && (
                            <Stack direction="row" alignItems="center" spacing={0.3}>
                                <WaterDropIcon sx={{ fontSize: 14, color: 'info.main' }} />
                                <Typography variant="caption" color="text.secondary">
                                    {d.precipitationSum.toFixed(1)}mm
                                </Typography>
                            </Stack>
                        )}
                    </Stack>
                ))}
            </Stack>
        </Box>
    );
}

export default function WeatherCard({ weather, loading, error }: WeatherCardProps) {
    const { t } = useTranslation();

    if (loading) {
        return (
            <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
                <Skeleton variant="text" width={180} height={32} />
                <Skeleton variant="rectangular" height={120} sx={{ mt: 1, borderRadius: 1 }} />
                <Skeleton variant="rectangular" height={80} sx={{ mt: 2, borderRadius: 1 }} />
            </Paper>
        );
    }

    if (error || !weather) {
        return null; // Silently hide if weather unavailable
    }

    const conditionKey = `condition${weather.condition}` as const;
    const conditionDescKey = `condition${weather.condition}Desc` as const;

    return (
        <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
            {/* Header with condition chip */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <ThermostatIcon color="primary" />
                    <Typography variant="h6" fontWeight="bold">
                        {t('weather.title')}
                    </Typography>
                </Stack>
                <Chip
                    label={`${getConditionEmoji(weather.condition)} ${t(`weather.${conditionKey}`)}`}
                    color={getConditionColor(weather.condition)}
                    size="small"
                    variant="outlined"
                    title={t(`weather.${conditionDescKey}`)}
                />
            </Stack>

            {/* Current conditions at start */}
            <CurrentWeather point={weather.current} label={t('weather.atStart')} t={t} />

            {/* Summit conditions if available */}
            {weather.summit && (
                <>
                    <Divider sx={{ my: 2 }} />
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                        <LandscapeIcon fontSize="small" color="warning" />
                        <Typography variant="caption" color="warning.main" fontWeight="bold">
                            {t('weather.atSummit')}
                        </Typography>
                    </Stack>
                    <CurrentWeather point={weather.summit} label={t('weather.atSummit')} t={t} />
                </>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Hourly strip */}
            <HourlyStrip hourly={weather.hourly} t={t} />

            <Divider sx={{ my: 2 }} />

            {/* Daily forecast */}
            <DailyForecast daily={weather.daily} t={t} />
        </Paper>
    );
}
