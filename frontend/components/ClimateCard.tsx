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
    // #1416: set only when this card is one of a start/finish pair (a qualifying PointToPoint
    // event — see GetEventClimateQueryHandler's ResolvePointToPointEndpointsAsync) — replaces the
    // generic "Climate normals" header with "At the start"/"At the finish" so the two sections
    // read as clearly distinct rather than two identical-looking cards. Left undefined for the
    // ordinary single-card case, which keeps today's unchanged header and behavior.
    sectionLabel?: 'start' | 'finish';
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

// Fallback for events with a GPS point but no linked Location to name (#1411) — e.g. "64.15°N,
// 21.94°W". Rounded to 2 decimals, which is ~1km of precision, plenty for a "where roughly is
// this" read; no i18n key needed since the format (degree symbol + N/S/E/W) isn't language text.
function formatCoordinate(lat: number, lon: number): string {
    const latHemisphere = lat >= 0 ? 'N' : 'S';
    const lonHemisphere = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(2)}°${latHemisphere}, ${Math.abs(lon).toFixed(2)}°${lonHemisphere}`;
}

// Historical climate normals card — deliberately visually distinct from WeatherCard (different
// icon, "usually" framing, no condition chip) so a visitor can't mistake a 15-year average for
// today's forecast when both cards render on the same event-detail page (#1335).
export default function ClimateCard({ climate, loading, error, locationName, sectionLabel }: ClimateCardProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    // #1416: "At the start — <location>" / "At the finish — <location>" when part of a start/finish
    // pair; the plain "Climate normals" title otherwise — see the sectionLabel prop doc above.
    const title = sectionLabel
        ? `${t(sectionLabel === 'start' ? 'climate.atStart' : 'climate.atFinish')}${locationName ? ` — ${locationName}` : ''}`
        : t('climate.title');

    if (loading) {
        return (
            <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
                <Skeleton variant="text" width={180} height={32} />
                <Skeleton variant="rectangular" height={60} sx={{ mt: 1, borderRadius: 1 }} />
            </Paper>
        );
    }

    if (error) {
        return null;
    }

    // Backend returns null (not an error) when the event has no usable coordinate or no years
    // of archive data to average — distinct from a fetch failure, so it gets its own message
    // instead of silently vanishing like the error case above.
    if (!climate) {
        return (
            <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <HistoryIcon color="secondary" />
                    <Typography variant="body2" color="text.secondary">
                        {t('climate.unavailable')}
                    </Typography>
                </Stack>
            </Paper>
        );
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
                        {title}
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
                {/* IconButton is decorative — the click handler lives on the header Stack above.
                    Width/height forced to 44px so the icon's own hit area still meets the
                    WCAG 2.5.5 / mobile touch-target minimum on top of the row-level click area. */}
                <IconButton size="small" sx={{ width: 44, height: 44 }}>
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
                        {/* Name takes priority when both exist. Falls back to the resolved
                            coordinate rather than disappearing when the event has a GPS point
                            but no linked Location to name it (#1411). */}
                        {(locationName || (climate.lat && climate.lon)) && (
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                                <LocationOnIcon fontSize="small" color="action" />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight="bold" noWrap>
                                        {locationName || formatCoordinate(climate.lat, climate.lon)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('climate.location')}
                                    </Typography>
                                    {/* #1414: the resolved coordinate came from a broad Location
                                        (Country/Area/Region) — signal that the numbers above are
                                        an estimate, not tied to this event's exact spot.
                                        #1415: the resolved coordinate is the event's own GPX pin —
                                        signal it's only the start, not the whole route. The DTO's
                                        resolution logic makes these mutually exclusive, so render
                                        them as alternatives, not both at once. */}
                                    {climate.isApproximate ? (
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontStyle: 'italic' }}>
                                            {t('climate.approximateLocation')}
                                        </Typography>
                                    ) : climate.isStartPoint ? (
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontStyle: 'italic' }}>
                                            {t('climate.startPointLocation')}
                                        </Typography>
                                    ) : null}
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
