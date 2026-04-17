import { useState, useEffect, useMemo } from 'react';
import { Box, TextField, Typography, Paper, Autocomplete, InputAdornment, IconButton, Divider, Table, TableBody, TableRow, TableCell, Alert } from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown, CompareArrows } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../hooks/useTrails';

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

function formatTime(minutes: number): string {
    if (minutes < 0) return '—';
    const totalSeconds = Math.round(minutes * 60);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPace(minPerKm: number): string {
    const totalSeconds = Math.round(minPerKm * 60);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

interface TrailOption {
    name: string;
    distance: number; // km
    elevationGain: number; // m
}

// Minutes added per 100m of elevation gain
const CLIMB_FACTOR = 0.5;

// Riegel's fatigue exponent
const RIEGEL_EXP = 1.06;

export default function TrailRacePredictor({ prefilledTrailSlug }: { prefilledTrailSlug?: string }) {
    const { t } = useTranslation();

    const [trails, setTrails] = useState<TrailOption[]>([]);
    const [trailsError, setTrailsError] = useState(false);
    const [trailA, setTrailA] = useState<TrailOption | null>(null);
    const [trailB, setTrailB] = useState<TrailOption | null>(null);
    const [timeStr, setTimeStr] = useState('');

    useEffect(() => {
        fetch(`${API_URL}/api/v1/trails`)
            .then(r => r.json())
            .then((data: { name: string; length: number; elevationGain: number; status: string }[]) => {
                const mapped = data
                    .filter(t => t.status === 'Published')
                    .map(t => ({ name: t.name, distance: t.length / 1000, elevationGain: t.elevationGain }))
                    .sort((a, b) => a.name.localeCompare(b.name));
                setTrails(mapped);
                setTrailsError(false);
            })
            .catch(() => setTrailsError(true));
    }, []);

    // Auto-select Trail B when prefilledTrailSlug matches
    useEffect(() => {
        if (!prefilledTrailSlug || trails.length === 0) return;
        // Match by slug-like name comparison (trails don't have slug, match by name)
        fetch(`${API_URL}/api/v1/trails/${encodeURIComponent(prefilledTrailSlug)}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                const match = trails.find(t => t.name === data.name);
                if (match && !trailB) setTrailB(match);
            })
            .catch(() => {});
    }, [prefilledTrailSlug, trails]); // eslint-disable-line react-hooks/exhaustive-deps

    const stepTime = (direction: 1 | -1) => {
        const current = parseTime(timeStr) ?? 60;
        const stepped = Math.max(1, current + direction);
        setTimeStr(formatTime(stepped));
    };

    const prediction = useMemo(() => {
        const knownTime = parseTime(timeStr);
        if (!trailA || !trailB || !knownTime || knownTime <= 0) return null;

        // Step 1: Strip elevation from known time → flat equivalent time
        const climbTimeA = (trailA.elevationGain / 100) * CLIMB_FACTOR;
        const flatTimeA = Math.max(knownTime - climbTimeA, knownTime * 0.5); // cap at 50% min

        // Step 2: Apply Riegel's formula for distance difference
        const flatTimeB = flatTimeA * Math.pow(trailB.distance / trailA.distance, RIEGEL_EXP);

        // Step 3: Add elevation penalty for Trail B
        const climbTimeB = (trailB.elevationGain / 100) * CLIMB_FACTOR;
        const predictedTime = flatTimeB + climbTimeB;

        const flatPaceA = flatTimeA / trailA.distance;
        const predictedPace = predictedTime / trailB.distance;
        const timeDiff = predictedTime - knownTime;

        return {
            predictedTime: formatTime(predictedTime),
            predictedPace: formatPace(predictedPace),
            flatPace: formatPace(flatPaceA),
            climbPenaltyA: formatTime(climbTimeA),
            climbPenaltyB: formatTime(climbTimeB),
            timeDiff: `${timeDiff >= 0 ? '+' : ''}${formatTime(Math.abs(timeDiff))}`,
            isSlower: timeDiff >= 0,
            distDiff: trailB.distance - trailA.distance,
            gainDiff: trailB.elevationGain - trailA.elevationGain,
        };
    }, [trailA, trailB, timeStr]);

    const renderTrailLabel = (option: TrailOption) => option.name;

    return (
        <Box sx={{ maxWidth: 480, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
                {trailsError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {t('tools.trailPredictor.loadError')}
                    </Alert>
                )}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('tools.trailPredictor.subtitle')}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Trail A */}
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {t('tools.trailPredictor.knownRace')}
                    </Typography>
                    <Autocomplete
                        options={trails}
                        value={trailA}
                        onChange={(_, v) => setTrailA(v)}
                        getOptionLabel={renderTrailLabel}
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
                            <TextField {...params} label={t('tools.trailPredictor.selectTrailA')} size="small" />
                        )}
                        size="small"
                    />

                    {trailA && (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="text.secondary">
                                📏 {trailA.distance.toFixed(1)} km
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                ⛰️ ↑{Math.round(trailA.elevationGain)}m
                            </Typography>
                        </Box>
                    )}

                    <TextField
                        label={t('tools.trailPredictor.yourTime')}
                        placeholder="1:30:00"
                        value={timeStr}
                        onChange={(e) => setTimeStr(e.target.value)}
                        helperText={t('tools.trailPredictor.timeHelp')}
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

                    <Divider>
                        <CompareArrows color="action" />
                    </Divider>

                    {/* Trail B */}
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {t('tools.trailPredictor.targetRace')}
                    </Typography>
                    <Autocomplete
                        options={trails}
                        value={trailB}
                        onChange={(_, v) => setTrailB(v)}
                        getOptionLabel={renderTrailLabel}
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
                            <TextField {...params} label={t('tools.trailPredictor.selectTrailB')} size="small" />
                        )}
                        size="small"
                    />

                    {trailB && (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="text.secondary">
                                📏 {trailB.distance.toFixed(1)} km
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                ⛰️ ↑{Math.round(trailB.elevationGain)}m
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Paper>

            {/* Prediction results */}
            {prediction && (
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        {t('tools.trailPredictor.prediction')}
                    </Typography>
                    <Table size="small">
                        <TableBody>
                            <TableRow>
                                <TableCell sx={{ py: 0.75, fontWeight: 600 }}>
                                    {t('tools.trailPredictor.predictedTime')}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.75 }}>
                                    <Typography variant="h6" fontFamily="monospace" fontWeight={700}>
                                        {prediction.predictedTime}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell sx={{ py: 0.75 }}>
                                    {t('tools.trailPredictor.predictedPace')}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.75 }}>
                                    <Typography variant="body2" fontFamily="monospace">
                                        {prediction.predictedPace}/km
                                    </Typography>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell sx={{ py: 0.75 }}>
                                    {t('tools.trailPredictor.difference')}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.75 }}>
                                    <Typography
                                        variant="body2"
                                        fontFamily="monospace"
                                        color={prediction.isSlower ? 'error.main' : 'success.main'}
                                    >
                                        {prediction.timeDiff}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                            <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                                <TableCell sx={{ py: 0.75 }}>
                                    {t('tools.trailPredictor.flatPace')}
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.75 }}>
                                    <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                                        {prediction.flatPace}/km
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>

                    {/* Trail comparison */}
                    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                            {t('tools.trailPredictor.comparison')}: {' '}
                            {prediction.distDiff >= 0 ? '+' : ''}{prediction.distDiff.toFixed(1)} km, {' '}
                            {prediction.gainDiff >= 0 ? '+' : ''}{Math.round(prediction.gainDiff)}m ↑
                        </Typography>
                    </Box>

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {t('tools.trailPredictor.method')}
                    </Typography>
                </Paper>
            )}
        </Box>
    );
}
