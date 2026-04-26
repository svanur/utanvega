import { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, TextField, Typography, Paper, ToggleButtonGroup, ToggleButton, Chip, Divider, IconButton, InputAdornment, Table, TableBody, TableRow, TableCell, Collapse, Autocomplete } from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown, Terrain, ExpandMore, RestartAlt } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../hooks/useTrails';
import { estimateDurationMinutes } from '../utils/estimateDuration';
import TimeSlider from './TimeSlider';

type Field = 'pace' | 'distance' | 'time';

// Parse "mm:ss" or "h:mm:ss" or plain minutes to total minutes
function parseTime(val: string): number | null {
    const trimmed = val.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(':').map(Number);
    if (parts.some(isNaN)) return null;

    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    if (parts.length === 1) return parts[0];
    return null;
}

// Format minutes to "h:mm:ss" or "m:ss"
function formatTime(minutes: number): string {
    if (minutes < 0) return '—';
    const totalSeconds = Math.round(minutes * 60);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// Format pace as "m:ss /km" or "/mi"
function formatPace(minPerUnit: number): string {
    if (minPerUnit < 0) return '—';
    const totalSeconds = Math.round(minPerUnit * 60);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// Common race presets
const PRESETS = [
    { key: '5k', km: 5 },
    { key: '10k', km: 10 },
    { key: 'half', km: 21.0975 },
    { key: 'marathon', km: 42.195 },
    { key: '100k', km: 100 },
    { key: '100m', km: 160.934 },
];

const MI_TO_KM = 1.60934;
const FT_TO_M = 0.3048;

type TerrainType = 'road' | 'gravel' | 'trail' | 'technical';

const TERRAIN_FACTORS: Record<TerrainType, number> = {
    road: 1.0,
    gravel: 1.05,
    trail: 1.12,
    technical: 1.22,
};

const TERRAIN_EMOJIS: Record<TerrainType, string> = {
    road: '🛣️',
    gravel: '🪨',
    trail: '🌲',
    technical: '⛰️',
};

// Minutes added per 100m of elevation gain (trail running heuristic)
const CLIMB_FACTOR = 0.5; // ~30 sec per 100m gain

interface TrailOption {
    name: string;
    distance: number; // km
    elevationGain: number; // m
    activityType: string;
}

export default function PaceCalculator() {
    const { t } = useTranslation();

    const [paceStr, setPaceStr] = useState('');
    const [distanceStr, setDistanceStr] = useState('');
    const [timeStr, setTimeStr] = useState('');
    const [unit, setUnit] = useState<'km' | 'mi'>('km');

    // Trail adjustments
    const [trailOpen, setTrailOpen] = useState(false);
    const [elevGainStr, setElevGainStr] = useState('');
    const [terrain, setTerrain] = useState<TerrainType>('trail');

    const [trailInputValue, setTrailInputValue] = useState('');
    const [trailOptions, setTrailOptions] = useState<TrailOption[]>([]);
    const [selectedTrail, setSelectedTrail] = useState<TrailOption | null>(null);

    useEffect(() => {
        fetch(`${API_URL}/api/v1/trails`)
            .then(r => r.json())
            .then((data: { name: string; length: number; elevationGain: number; activityType: string; status: string }[]) => {
                setTrailOptions(
                    data
                        .filter(t => t.status === 'Published')
                        .map(t => ({ name: t.name, distance: t.length / 1000, elevationGain: t.elevationGain, activityType: t.activityType }))
                        .sort((a, b) => a.name.localeCompare(b.name))
                );
            })
            .catch(() => { /* trail picker is optional */ });
    }, []);

    const compute = useCallback((changed: Field, pVal: string, dVal: string, tVal: string) => {
        const pace = parseTime(pVal);
        const dist = parseFloat(dVal) || null;
        const time = parseTime(tVal);

        if (changed === 'time' || changed === 'pace') {
            // Compute the missing one
            if (pace !== null && dist !== null && changed !== 'time') {
                const result = pace * dist;
                setTimeStr(formatTime(result));
            } else if (time !== null && dist !== null && changed !== 'pace') {
                const result = time / dist;
                setPaceStr(formatPace(result));
            } else if (pace !== null && time !== null) {
                const result = time / pace;
                setDistanceStr(result.toFixed(2));
            }
        } else {
            // distance changed
            if (pace !== null && dist !== null) {
                setTimeStr(formatTime(pace * dist));
            } else if (time !== null && dist !== null) {
                setPaceStr(formatPace(time / dist));
            }
        }
    }, []);

    const handlePaceChange = (val: string) => {
        setPaceStr(val);
        compute('pace', val, distanceStr, timeStr);
    };

    const handleDistanceChange = (val: string) => {
        setDistanceStr(val);
        compute('distance', paceStr, val, timeStr);
    };

    const handleTimeChange = (val: string) => {
        setTimeStr(val);
        compute('time', paceStr, distanceStr, val);
    };

    const handleUnitToggle = (_: React.MouseEvent<HTMLElement>, newUnit: 'km' | 'mi' | null) => {
        if (!newUnit) return;
        const pace = parseTime(paceStr);
        const dist = parseFloat(distanceStr) || null;

        if (newUnit === 'mi' && unit === 'km') {
            if (dist) setDistanceStr((dist / MI_TO_KM).toFixed(2));
            if (pace) setPaceStr(formatPace(pace * MI_TO_KM));
        } else if (newUnit === 'km' && unit === 'mi') {
            if (dist) setDistanceStr((dist * MI_TO_KM).toFixed(2));
            if (pace) setPaceStr(formatPace(pace / MI_TO_KM));
        }
        setUnit(newUnit);
    };

    const handlePreset = (km: number) => {
        const d = unit === 'mi' ? km / MI_TO_KM : km;
        const dStr = d % 1 === 0 ? d.toString() : d.toFixed(2);
        setDistanceStr(dStr);
        compute('distance', paceStr, dStr, timeStr);
    };

    const handleTrailSelect = (_: unknown, trail: TrailOption | null) => {
        setSelectedTrail(trail);
        if (!trail) return;

        // Fill distance
        const d = unit === 'mi' ? trail.distance / MI_TO_KM : trail.distance;
        const dStr = d.toFixed(2);
        setDistanceStr(dStr);

        // Fill elevation gain & open trail section
        const gain = unit === 'mi' ? Math.round(trail.elevationGain / FT_TO_M) : trail.elevationGain;
        setElevGainStr(gain > 0 ? Math.round(gain).toString() : '');

        // Map activity type to terrain
        const terrainMap: Record<string, TerrainType> = {
            Running: 'road',
            TrailRunning: 'trail',
            Hiking: 'trail',
            Cycling: 'road',
        };
        setTerrain(terrainMap[trail.activityType] ?? 'trail');

        if (gain > 0) setTrailOpen(true);

        // Estimate time from distance + elevation + activity type
        const estMinutes = estimateDurationMinutes(trail.distance * 1000, trail.elevationGain, trail.activityType);
        const estTime = formatTime(estMinutes);
        setTimeStr(estTime);

        // Compute pace from distance + estimated time
        const estPace = estMinutes / d;
        setPaceStr(formatPace(estPace));
    };

    const stepPace = (direction: 1 | -1) => {
        const current = parseTime(paceStr) ?? 5;
        const stepped = Math.max(0.25, current + direction * (5 / 60)); // step by 5 seconds
        const newPace = formatPace(stepped);
        setPaceStr(newPace);
        compute('pace', newPace, distanceStr, timeStr);
    };

    const stepDistance = (direction: 1 | -1) => {
        const current = parseFloat(distanceStr) || 0;
        const stepped = Math.max(0, current + direction);
        const newDist = stepped % 1 === 0 ? stepped.toString() : stepped.toFixed(2);
        setDistanceStr(newDist);
        compute('distance', paceStr, newDist, timeStr);
    };

    const stepTime = (direction: 1 | -1) => {
        const current = parseTime(timeStr) ?? 30;
        const stepped = Math.max(1, current + direction); // step by 1 minute
        const newTime = formatTime(stepped);
        setTimeStr(newTime);
        compute('time', paceStr, distanceStr, newTime);
    };

    const stepElevation = (direction: 1 | -1) => {
        const current = parseInt(elevGainStr) || 0;
        const step = unit === 'mi' ? Math.round(100 * FT_TO_M) : 100; // 100m or ~100ft
        const stepped = Math.max(0, current + direction * step);
        setElevGainStr(stepped > 0 ? stepped.toString() : '');
    };

    // Trail-adjusted time calculation
    const trailAdjusted = useMemo(() => {
        const flatTime = parseTime(timeStr);
        const dist = parseFloat(distanceStr) || null;
        const elevGain = parseInt(elevGainStr) || 0;
        const elevGainMeters = unit === 'mi' ? elevGain * FT_TO_M : elevGain;

        if (!flatTime || !dist) return null;

        const terrainFactor = TERRAIN_FACTORS[terrain];
        const climbMinutes = (elevGainMeters / 100) * CLIMB_FACTOR;
        const adjustedTime = flatTime * terrainFactor + climbMinutes;
        const adjustedPace = adjustedTime / dist;
        const addedMinutes = adjustedTime - flatTime;

        if (addedMinutes < 0.1) return null;

        return {
            adjustedTime: formatTime(adjustedTime),
            adjustedPace: formatPace(adjustedPace),
            addedMinutes: formatTime(addedMinutes),
            terrainPct: Math.round((terrainFactor - 1) * 100),
            climbMinutes: climbMinutes > 0 ? formatTime(climbMinutes) : null,
        };
    }, [timeStr, distanceStr, elevGainStr, terrain, unit]);

    // Computed splits display
    const pace = parseTime(paceStr);
    const dist = parseFloat(distanceStr) || null;
    const splits: { label: string; time: string }[] = [];
    if (pace && dist && dist > 1) {
        const marathonKm = unit === 'mi' ? 42.195 / MI_TO_KM : 42.195;
        const step = dist > marathonKm ? 5 : 1;
        const fullUnits = Math.floor(dist);
        for (let i = step; i <= Math.min(fullUnits, 500); i += step) {
            splits.push({ label: `${i} ${unit}`, time: formatTime(pace * i) });
        }
        if (dist > fullUnits || fullUnits % step !== 0) {
            splits.push({ label: `${dist} ${unit}`, time: formatTime(pace * dist) });
        }
    }

    const handleReset = () => {
        setPaceStr('');
        setDistanceStr('');
        setTimeStr('');
        setElevGainStr('');
        setTerrain('trail');
        setSelectedTrail(null);
        setTrailInputValue('');
        setTrailOpen(false);
    };

    return (
        <Box sx={{ maxWidth: 480, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                        {t('tools.paceCalc.subtitle')}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton
                            size="small"
                            onClick={handleReset}
                            title={t('common.reset')}
                            disabled={!paceStr && !distanceStr && !timeStr}
                        >
                            <RestartAlt fontSize="small" />
                        </IconButton>
                        <ToggleButtonGroup value={unit} exclusive onChange={handleUnitToggle} size="small">
                            <ToggleButton value="km">km</ToggleButton>
                            <ToggleButton value="mi">mi</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        label={t('tools.paceCalc.pace', { unit: unit === 'km' ? 'km' : 'mi' })}
                        placeholder="5:30"
                        value={paceStr}
                        onChange={(e) => handlePaceChange(e.target.value)}
                        helperText={t('tools.paceCalc.paceHelp')}
                        fullWidth
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                        <IconButton size="small" onClick={() => stepPace(-1)} sx={{ p: 0 }}>
                                            <KeyboardArrowUp sx={{ fontSize: 18 }} />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => stepPace(1)} sx={{ p: 0 }}>
                                            <KeyboardArrowDown sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </Box>
                                </InputAdornment>
                            ),
                        }}
                    />
                    <TimeSlider
                        value={paceStr}
                        onChange={handlePaceChange}
                        min={120}
                        max={540}
                        step={5}
                        parseTime={parseTime}
                    />

                    {trailOptions.length > 0 && (
                        <Autocomplete
                            options={trailOptions}
                            value={selectedTrail}
                            onChange={handleTrailSelect}
                            inputValue={trailInputValue}
                            onInputChange={(_, v) => setTrailInputValue(v)}
                            getOptionLabel={(o) => o.name}
                            renderOption={(props, option) => (
                                <li {...props} key={option.name}>
                                    <Box sx={{ width: '100%' }}>
                                        <Typography variant="body2">{option.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {option.distance.toFixed(1)} km · ↑{Math.round(option.elevationGain)}m
                                        </Typography>
                                    </Box>
                                </li>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t('tools.paceCalc.pickTrail')}
                                    placeholder={t('tools.paceCalc.searchTrail')}
                                    size="small"
                                />
                            )}
                            size="small"
                            clearOnBlur={false}
                        />
                    )}

                    <Box>
                        <TextField
                            label={t('tools.paceCalc.distance', { unit })}
                            placeholder="10"
                            value={distanceStr}
                            onChange={(e) => handleDistanceChange(e.target.value)}
                            fullWidth
                            inputProps={{ inputMode: 'decimal' }}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                            <IconButton size="small" onClick={() => stepDistance(1)} sx={{ p: 0 }}>
                                                <KeyboardArrowUp sx={{ fontSize: 18 }} />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => stepDistance(-1)} sx={{ p: 0 }}>
                                                <KeyboardArrowDown sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </Box>
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'nowrap', overflowX: 'auto', pb: 0.5 }}>
                            {PRESETS.map(p => (
                                <Chip
                                    key={p.key}
                                    label={t(`tools.paceCalc.presets.${p.key}`)}
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handlePreset(p.km)}
                                    sx={{ cursor: 'pointer' }}
                                />
                            ))}
                        </Box>
                    </Box>

                    <TextField
                        label={t('tools.paceCalc.time')}
                        placeholder="55:00"
                        value={timeStr}
                        onChange={(e) => handleTimeChange(e.target.value)}
                        helperText={t('tools.paceCalc.timeHelp')}
                        fullWidth
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                        <IconButton size="small" onClick={() => stepTime(1)} sx={{ p: 0 }}>
                                            <KeyboardArrowUp sx={{ fontSize: 18 }} />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => stepTime(-1)} sx={{ p: 0 }}>
                                            <KeyboardArrowDown sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </Box>
                                </InputAdornment>
                            ),
                        }}
                    />
                    <TimeSlider
                        value={timeStr}
                        onChange={handleTimeChange}
                        min={dist ? Math.max(60, Math.round(dist * 2.5 * 60)) : 300}
                        max={dist ? Math.round(dist * 12 * 60) : 43200}
                        step={dist && dist <= 10 ? 5 : 15}
                        parseTime={parseTime}
                    />
                </Box>
            </Paper>

            {/* Trail Adjustments */}
            <Paper sx={{ mt: 2, overflow: 'hidden' }}>
                <Box
                    onClick={() => setTrailOpen(!trailOpen)}
                    sx={{
                        display: 'flex', alignItems: 'center', gap: 1, p: 2,
                        cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' },
                    }}
                >
                    <Terrain fontSize="small" color="action" />
                    <Typography variant="subtitle2" sx={{ flex: 1 }}>
                        {t('tools.paceCalc.trailAdjust')}
                    </Typography>
                    <ExpandMore sx={{
                        transform: trailOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                        fontSize: 20,
                    }} />
                </Box>
                <Collapse in={trailOpen}>
                    <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            {t('tools.paceCalc.trailAdjustDesc')}
                        </Typography>
                        {/* Terrain type */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                {t('tools.paceCalc.terrain')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {(Object.keys(TERRAIN_FACTORS) as TerrainType[]).map(tt => (
                                    <Chip
                                        key={tt}
                                        label={`${TERRAIN_EMOJIS[tt]} ${t(`tools.paceCalc.terrains.${tt}`)}`}
                                        size="small"
                                        variant={terrain === tt ? 'filled' : 'outlined'}
                                        color={terrain === tt ? 'primary' : 'default'}
                                        onClick={() => setTerrain(tt)}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                ))}
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                {terrain !== 'road' && `+${Math.round((TERRAIN_FACTORS[terrain] - 1) * 100)}%`}
                            </Typography>
                        </Box>

                        {/* Elevation gain */}
                        <TextField
                            label={t('tools.paceCalc.elevGain', { unit: unit === 'mi' ? 'ft' : 'm' })}
                            placeholder={unit === 'mi' ? '1500' : '500'}
                            value={elevGainStr}
                            onChange={(e) => setElevGainStr(e.target.value)}
                            fullWidth
                            inputProps={{ inputMode: 'numeric' }}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                            <IconButton size="small" onClick={() => stepElevation(1)} sx={{ p: 0 }}>
                                                <KeyboardArrowUp sx={{ fontSize: 18 }} />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => stepElevation(-1)} sx={{ p: 0 }}>
                                                <KeyboardArrowDown sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </Box>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {/* Adjusted results */}
                        {trailAdjusted && (
                            <Box sx={{
                                bgcolor: 'action.hover', borderRadius: 1, p: 1.5,
                                display: 'flex', flexDirection: 'column', gap: 0.5,
                            }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                    {selectedTrail
                                        ? t('tools.paceCalc.adjustedSummaryTrail', {
                                            trail: selectedTrail.name,
                                            terrain: t(`tools.paceCalc.terrains.${terrain}`).toLowerCase(),
                                            elevation: elevGainStr || '0',
                                            elevUnit: unit === 'mi' ? 'ft' : 'm',
                                            time: trailAdjusted.adjustedTime,
                                            pace: trailAdjusted.adjustedPace,
                                        })
                                        : t('tools.paceCalc.adjustedSummary', {
                                            terrain: t(`tools.paceCalc.terrains.${terrain}`).toLowerCase(),
                                            elevation: elevGainStr || '0',
                                            elevUnit: unit === 'mi' ? 'ft' : 'm',
                                            time: trailAdjusted.adjustedTime,
                                            pace: trailAdjusted.adjustedPace,
                                        })
                                    }
                                </Typography>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('tools.paceCalc.adjustedTime')}
                                    </Typography>
                                    <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                                        {trailAdjusted.adjustedTime}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('tools.paceCalc.adjustedPace')}
                                    </Typography>
                                    <Typography variant="body2" fontFamily="monospace">
                                        {trailAdjusted.adjustedPace}
                                    </Typography>
                                </Box>
                                <Divider sx={{ my: 0.5 }} />
                                <Typography variant="caption" color="text.secondary">
                                    +{trailAdjusted.addedMinutes}
                                    {trailAdjusted.terrainPct > 0 && ` (${t('tools.paceCalc.terrainLabel')}: +${trailAdjusted.terrainPct}%`}
                                    {trailAdjusted.climbMinutes && `${trailAdjusted.terrainPct > 0 ? ', ' : ' ('}${t('tools.paceCalc.climbLabel')}: +${trailAdjusted.climbMinutes}`}
                                    {(trailAdjusted.terrainPct > 0 || trailAdjusted.climbMinutes) && ')'}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Collapse>
            </Paper>

            {splits.length > 0 && pace && dist && (
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        {t('tools.paceCalc.splits')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {t('tools.paceCalc.summaryText', {
                            pace: paceStr,
                            unit: unit === 'km' ? 'km' : 'mi',
                            distance: distanceStr,
                            time: formatTime(pace * dist),
                        })}
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <Table size="small">
                        <TableBody>
                            {splits.map((s, i) => {
                                const isLast = i === splits.length - 1 && splits.length > 1;
                                return (
                                    <TableRow
                                        key={i}
                                        sx={{
                                            ...(isLast && { bgcolor: 'action.selected', fontWeight: 700 }),
                                            '&:last-child td': { borderBottom: 0 },
                                        }}
                                    >
                                        <TableCell sx={{ py: 0.5, pl: 1, width: 80 }}>
                                            <Typography variant="body2" color="text.secondary" fontWeight={isLast ? 700 : 400}>
                                                {s.label}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ py: 0.5 }} align="right">
                                            <Typography variant="body2" fontFamily="monospace" fontWeight={isLast ? 700 : 400}>
                                                {s.time}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Paper>
            )}
        </Box>
    );
}
