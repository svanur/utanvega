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
    useTheme,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import AirIcon from '@mui/icons-material/Air';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import type { EventClimate } from '../hooks/useTrails';
import { formatDecimal } from '../utils/formatDecimal';

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

// #1448: subtle background wash per getClimateIcon's own bucket — reuses that classification
// rather than re-deriving it, so the two never drift apart. Each pair fades from a low-alpha
// tint (left) to fully transparent (right), so the Paper's own theme.palette.background.paper
// still shows through — a wash, not a banner — and text/stat contrast is unaffected since
// nothing opaque sits behind it. Dark variants use a lower alpha than light ones, since the
// same alpha reads more strongly against a dark background.
function getClimateBackground(climate: EventClimate): { light: string; dark: string } {
    if (climate.averageLow <= 0 && climate.precipitationChance >= 0.3) {
        // snow — pale blue
        return {
            light: 'linear-gradient(135deg, rgba(187, 222, 251, 0.45) 0%, rgba(187, 222, 251, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(100, 181, 246, 0.16) 0%, rgba(100, 181, 246, 0) 100%)',
        };
    }
    if (climate.precipitationChance >= 0.5) {
        // heavy rain — slate blue
        return {
            light: 'linear-gradient(135deg, rgba(144, 164, 174, 0.4) 0%, rgba(144, 164, 174, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(120, 144, 156, 0.18) 0%, rgba(120, 144, 156, 0) 100%)',
        };
    }
    if (climate.precipitationChance >= 0.2) {
        // showers — light blue
        return {
            light: 'linear-gradient(135deg, rgba(179, 229, 252, 0.4) 0%, rgba(179, 229, 252, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(79, 195, 247, 0.14) 0%, rgba(79, 195, 247, 0) 100%)',
        };
    }
    if (climate.averageHigh >= 15) {
        // sunny — warm yellow
        return {
            light: 'linear-gradient(135deg, rgba(255, 224, 130, 0.4) 0%, rgba(255, 224, 130, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(255, 183, 77, 0.14) 0%, rgba(255, 183, 77, 0) 100%)',
        };
    }
    // cloudy — neutral grey
    return {
        light: 'linear-gradient(135deg, rgba(207, 216, 220, 0.4) 0%, rgba(207, 216, 220, 0) 100%)',
        dark: 'linear-gradient(135deg, rgba(144, 164, 174, 0.14) 0%, rgba(144, 164, 174, 0) 100%)',
    };
}

// #1446: short qualitative reads for the precipitation-chance and sunshine stats, so a visitor
// isn't left to interpret "42%" or "6.3 h" on their own — bands mirror getClimateIcon's own
// precipitationChance thresholds (0.5/0.2) above, for the same "rainy" cutoffs throughout the
// card. Sunshine bands (8h/4h) are independent, since there's no existing icon threshold for it.
function getPrecipitationLabelKey(precipitationChance: number): string {
    if (precipitationChance >= 0.5) return 'climate.rainHeavy';
    if (precipitationChance >= 0.2) return 'climate.rainModerate';
    return 'climate.rainLight';
}

function getSunshineLabelKey(averageSunshineHours: number): string {
    if (averageSunshineHours >= 8) return 'climate.sunshineHigh';
    if (averageSunshineHours >= 4) return 'climate.sunshineModerate';
    return 'climate.sunshineLow';
}

// Fallback for events with a resolved coordinate but no linked Location to name (#1411) — e.g.
// "64.15°N, 21.94°W". Rounded to 2 decimals, which is ~1km of precision, plenty for a "where
// roughly is this" read; no i18n key needed since the format (degree symbol + N/S/E/W) isn't
// language text.
function formatCoordinate(lat: number, lon: number): string {
    const latHemisphere = lat >= 0 ? 'N' : 'S';
    const lonHemisphere = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(2)}°${latHemisphere}, ${Math.abs(lon).toFixed(2)}°${lonHemisphere}`;
}

// Historical climate normals card — deliberately visually distinct from WeatherCard (different
// icon, "usually" framing, no condition chip) so a visitor can't mistake a 15-year average for
// today's forecast when both cards render on the same event-detail page (#1335).
export default function ClimateCard({ climate, loading, error, locationName }: ClimateCardProps) {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [expanded, setExpanded] = useState(false);

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
    const background = getClimateBackground(climate);
    const precipitationLabelKey = getPrecipitationLabelKey(climate.precipitationChance);
    const sunshineLabelKey = getSunshineLabelKey(climate.averageSunshineHours);
    // Climate normals have no year of their own (averaged across ~15 past years), so this is
    // deliberately "15. júlí", not a dated "15. júlí 2027" — reusing the same months array other
    // pages already pull from the races namespace rather than duplicating it under climate.
    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const targetDateLabel = `${climate.targetDay}. ${months[climate.targetMonth - 1]}`;

    const resolvedLocationLabel = locationName || formatCoordinate(climate.lat, climate.lon);

    const title = t('climate.title');

    return (
        <Paper
            elevation={1}
            sx={{
                p: { xs: 2, sm: 3 },
                mb: 3,
                borderRadius: 2,
                // #1448: only this "real data" Paper gets the tint — the loading/unavailable
                // Papers above keep their plain background unchanged.
                backgroundImage: isDark ? background.dark : background.light,
            }}
        >
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
                                {Math.round(climate.averageLow)} - {Math.round(climate.averageHigh)} °C
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.3}>
                                <AirIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                    {formatDecimal(climate.averageMaxWind, i18n.language, 0)} m/s
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
                                {Math.round(climate.averageLow)} - {Math.round(climate.averageHigh)} °C
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
                        {/* #1446: sunshine tile positioned before the rain tiles below — a
                            positive counterbalance stat shouldn't be buried last, where a
                            visitor skimming the grid would see only rain numbers first. */}
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                            <WbSunnyIcon fontSize="small" sx={{ color: 'warning.main' }} />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight="bold">
                                    {formatDecimal(climate.averageSunshineHours, i18n.language)} {t('climate.sunshineUnit')} · {t(sunshineLabelKey)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('climate.avgSunshine')}
                                </Typography>
                            </Box>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <WaterDropIcon fontSize="small" color="action" />
                            <Box>
                                <Typography variant="body2" fontWeight="bold">
                                    {formatDecimal(climate.averagePrecipitation, i18n.language)} mm
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('climate.avgPrecipitation')}
                                </Typography>
                            </Box>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                            <WaterDropIcon fontSize="small" color="info" />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight="bold">
                                    {precipitationChancePct}% · {t(precipitationLabelKey)}
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
                                    {formatDecimal(climate.averageMaxWind, i18n.language)} m/s
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('climate.avgWind')}
                                </Typography>
                            </Box>
                        </Stack>
                        {/* Name takes priority when it exists. Falls back to the resolved
                            coordinate rather than disappearing when the event has a resolved
                            coordinate but no linked Location to name it (#1411).
                            #1413: typeof check, not a bare `&&` truthy test — `0 && 0` is falsy
                            under the old check, hiding this tile for a resolved (0, 0)
                            coordinate exactly like the bug #1411 fixed. Not reachable with real
                            Iceland data (lat/lon never cross either axis here), but kept
                            explicit so this class of bug can't resurface. */}
                        {(locationName || (typeof climate.lat === 'number' && typeof climate.lon === 'number')) && (
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                                <LocationOnIcon fontSize="small" color="action" />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight="bold" noWrap>
                                        {resolvedLocationLabel}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('climate.location')}
                                    </Typography>
                                    {/* #1414: the resolved coordinate came from a broad Location
                                        (Country/Area/Region) — signal that the numbers above are
                                        an estimate, not tied to this event's exact spot.
                                        #1418: no noWrap here — this caption is long enough in
                                        Icelandic to clip at a 375px tile width with no tooltip to
                                        recover the text, so it's left to wrap to a second line
                                        instead of truncating. */}
                                    {climate.isApproximate && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                                            {t('climate.approximateLocation')}
                                        </Typography>
                                    )}
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
