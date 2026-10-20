import { useEffect, useState } from 'react';
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
    ToggleButton,
    ToggleButtonGroup,
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
    // #1416: only populated for a qualifying PointToPoint event (see
    // GetEventClimateQueryHandler's ResolvePointToPointEndpointsAsync). #1430: rather than
    // instantiating a second ClimateCard for it, this now drives a Start/Finish tab within the
    // single card — climate stays the "Start" data, finish is the "Finish" data shown when the
    // tab is switched. Left undefined/null for the ordinary single-point case, which keeps
    // today's unchanged header, layout, and no-tab-control behavior.
    finish?: EventClimate | null;
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
export default function ClimateCard({ climate, loading, error, locationName, finish }: ClimateCardProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    // #1430: which point's stats are showing — only switchable when finish is non-null (the
    // start/finish split case). Defaults to 'start', matching the pre-#1430 single-card data.
    const [activeTab, setActiveTab] = useState<'start' | 'finish'>('start');

    // #1435: today's only call site remounts ClimateCard between events, so activeTab never
    // needs resetting in practice — but nothing guarantees that stays true (e.g. a future
    // client-side transition that reuses the mounted component across events). Reset on prop
    // *identity* change (not deep-equality) so a visitor who switched to "Finish" for event A
    // doesn't see that selection silently carried over onto event B's climate data.
    useEffect(() => {
        setActiveTab('start');
    }, [climate, finish]);

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

    // #1430: finish only ever selectable when it actually exists; otherwise always 'start' (the
    // single-point case has no tab control to switch away from it in the first place).
    const activeClimate = activeTab === 'finish' && finish ? finish : climate;
    const hasFinish = !!finish;

    const precipitationChancePct = Math.round(activeClimate.precipitationChance * 100);
    const icon = getClimateIcon(activeClimate);
    // Climate normals have no year of their own (averaged across ~15 past years), so this is
    // deliberately "15. júlí", not a dated "15. júlí 2027" — reusing the same months array other
    // pages already pull from the races namespace rather than duplicating it under climate.
    const months = t('races.months', { returnObjects: true }) as unknown as string[];
    const targetDateLabel = `${activeClimate.targetDay}. ${months[activeClimate.targetMonth - 1]}`;

    // locationName only ever names the start coordinate (CompetitionDetailPage never resolves a
    // name for the finish point) — tied to *this* card's own active coordinate, never copied
    // across the start/finish pair (#1416 review fix, kept under #1430's single-card tabs): the
    // fallback below is what gives the finish tab (which has no reverse-geocoded name of its own)
    // a location string distinct from the start's, instead of silently inheriting the start's name.
    const activeLocationName = activeTab === 'start' ? locationName : null;
    const resolvedLocationLabel = activeLocationName || formatCoordinate(activeClimate.lat, activeClimate.lon);

    // #1430: header is always the plain "Climate Normals" title now — the "At the start"/"At the
    // finish" wording moved out of the title and down into the location row below, where it
    // labels whichever tab is currently active instead of permanently splitting the header.
    const title = t('climate.title');

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
                                {Math.round(activeClimate.averageHigh)}° / {Math.round(activeClimate.averageLow)}°C
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.3}>
                                <AirIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                    {activeClimate.averageMaxWind.toFixed(0)} m/s
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

            {/* #1430: Start/Finish segmented control — only rendered for the start/finish split
                case (finish non-null), always visible (not nested in the Collapse below) so a
                visitor can switch points without first expanding the card. Each ToggleButton is
                forced to 44px min height to meet the mobile touch-target minimum regardless of
                MUI's default small-size padding; flex: 1 on both keeps the pair from wrapping at
                the 375px mobile viewport since they always share the row width evenly. */}
            {hasFinish && (
                <ToggleButtonGroup
                    value={activeTab}
                    exclusive
                    fullWidth
                    size="small"
                    onChange={(_event, value: 'start' | 'finish' | null) => value && setActiveTab(value)}
                    sx={{ mt: 1.5 }}
                >
                    <ToggleButton value="start" sx={{ flex: 1, minHeight: 44 }}>
                        {t('climate.atStart')}
                    </ToggleButton>
                    <ToggleButton value="finish" sx={{ flex: 1, minHeight: 44 }}>
                        {t('climate.atFinish')}
                    </ToggleButton>
                </ToggleButtonGroup>
            )}

            {/* Collapsible content */}
            <Collapse in={expanded}>
                <Box sx={{ mt: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <Typography sx={{ fontSize: '2.5rem', lineHeight: 1 }}>{icon}</Typography>
                        <Box>
                            <Typography variant="h5" fontWeight="bold" sx={{ lineHeight: 1.1 }}>
                                {Math.round(activeClimate.averageHigh)}° / {Math.round(activeClimate.averageLow)}°C
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
                                    {activeClimate.averagePrecipitation.toFixed(1)} mm
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
                                    {activeClimate.averageMaxWind.toFixed(1)} m/s
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('climate.avgWind')}
                                </Typography>
                            </Box>
                        </Stack>
                        {/* Name takes priority when both exist. Falls back to the resolved
                            coordinate rather than disappearing when the event has a GPS point
                            but no linked Location to name it (#1411). Uses the same
                            resolvedLocationLabel as the header above (#1416) — always tied to
                            this card's own active coordinate, never a copy of the other tab's
                            name. #1430: when finish exists, the bold line is prefixed with
                            "At the start"/"At the finish" (climate.atStart/atFinish) — wording
                            moved down from the old split-card title, now labeling whichever tab
                            is active instead. */}
                        {/* #1413: typeof check, not a bare `&&` truthy test — `0 && 0` is falsy
                            under the old check, hiding this tile for a resolved (0, 0)
                            coordinate exactly like the bug #1411 fixed. Not reachable with real
                            Iceland data (lat/lon never cross either axis here), but kept
                            explicit so this class of bug can't resurface. */}
                        {(activeLocationName || (typeof activeClimate.lat === 'number' && typeof activeClimate.lon === 'number')) && (
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                                <LocationOnIcon fontSize="small" color="action" />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight="bold" noWrap>
                                        {hasFinish
                                            ? `${t(activeTab === 'start' ? 'climate.atStart' : 'climate.atFinish')} — ${resolvedLocationLabel}`
                                            : resolvedLocationLabel}
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
                                    {activeClimate.isApproximate ? (
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontStyle: 'italic' }}>
                                            {t('climate.approximateLocation')}
                                        </Typography>
                                    ) : activeClimate.isStartPoint ? (
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
                        {t('climate.basedOnYears', { years: activeClimate.yearsOfData })}
                    </Typography>
                </Box>
            </Collapse>
        </Paper>
    );
}
