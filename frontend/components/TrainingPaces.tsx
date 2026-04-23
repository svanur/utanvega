import { useState, useMemo, useEffect } from 'react';
import {
    Box, TextField, Typography, Paper, Chip, Table, TableBody, TableRow, TableCell,
    InputAdornment, IconButton, Tooltip,
} from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown, ContentCopy } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import TimeSlider from './TimeSlider';

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

function formatPace(minutes: number): string {
    if (minutes <= 0 || !isFinite(minutes)) return '—';
    const totalSec = Math.round(minutes * 60);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(minutes: number): string {
    if (minutes <= 0 || !isFinite(minutes)) return '—';
    const totalSec = Math.round(minutes * 60);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// --- Daniels' VDOT formulas ---

// VO2 from velocity (meters/min)
function vo2FromVelocity(v: number): number {
    return -4.60 + 0.182258 * v + 0.000104 * v * v;
}

// %VO2max from race duration (minutes)
function pctVo2maxFromTime(t: number): number {
    return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
}

// Calculate VDOT from race distance (meters) and time (minutes)
function calculateVDOT(distanceMeters: number, timeMinutes: number): number {
    const velocity = distanceMeters / timeMinutes;
    const vo2 = vo2FromVelocity(velocity);
    const pctMax = pctVo2maxFromTime(timeMinutes);
    return vo2 / pctMax;
}

// Get velocity (m/min) from target VO2
function velocityFromVo2(targetVo2: number): number {
    // Solve: -4.60 + 0.182258*v + 0.000104*v² = targetVo2
    const a = 0.000104;
    const b = 0.182258;
    const c = -4.60 - targetVo2;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return 0;
    return (-b + Math.sqrt(discriminant)) / (2 * a);
}

// Get pace (min/km) from VDOT and target %VO2max
function paceFromVdot(vdot: number, pctVo2max: number): number {
    const targetVo2 = vdot * pctVo2max;
    const velocity = velocityFromVo2(targetVo2);
    if (velocity <= 0) return 0;
    return 1000 / velocity; // min per km
}

interface TrainingZone {
    key: string;
    emoji: string;
    pctLow: number;
    pctHigh: number;
}

const ZONES: TrainingZone[] = [
    { key: 'easy', emoji: '🟢', pctLow: 0.59, pctHigh: 0.74 },
    { key: 'marathon', emoji: '🏃', pctLow: 0.75, pctHigh: 0.84 },
    { key: 'threshold', emoji: '🟠', pctLow: 0.83, pctHigh: 0.88 },
    { key: 'interval', emoji: '🔴', pctLow: 0.95, pctHigh: 1.00 },
    { key: 'repetition', emoji: '⚡', pctLow: 1.05, pctHigh: 1.10 },
];

// Returns equivalent race time in minutes for a given VDOT and distance
function equivalentTimeMinutes(vdot: number, meters: number): number {
    let lo = 1, hi = 1440;
    for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        if (calculateVDOT(meters, mid) > vdot) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

interface DistancePreset {
    key: string;
    meters: number;
}

const PRESETS: DistancePreset[] = [
    { key: '1500m', meters: 1500 },
    { key: '3k', meters: 3000 },
    { key: '5k', meters: 5000 },
    { key: '10k', meters: 10000 },
    { key: 'half', meters: 21097.5 },
    { key: 'marathon', meters: 42195 },
];

export default function TrainingPaces() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();

    const [timeStr, setTimeStr] = useState(() => {
        const p = searchParams.get('t');
        return p ? p.replace(/-/g, ':') : '';
    });
    const [selectedPreset, setSelectedPreset] = useState<DistancePreset>(() => {
        const d = searchParams.get('d');
        return PRESETS.find(p => p.key === d) ?? PRESETS[2]; // default 5K
    });
    const [copied, setCopied] = useState(false);
    const [copiedWorkout, setCopiedWorkout] = useState(false);

    // Sync to URL
    useEffect(() => {
        const urlTime = timeStr.replace(/:/g, '-');
        const currentT = searchParams.get('t') || '';
        const currentD = searchParams.get('d') || '';
        const needsUpdate = (timeStr && urlTime !== currentT) || (!timeStr && currentT) ||
            (selectedPreset.key !== currentD);

        if (needsUpdate) {
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                if (timeStr) next.set('t', urlTime); else next.delete('t');
                next.set('d', selectedPreset.key);
                return next;
            }, { replace: true });
        }
    }, [timeStr, selectedPreset, searchParams, setSearchParams]);

    const stepTime = (direction: 1 | -1) => {
        const current = parseTime(timeStr) ?? 25;
        const step = selectedPreset.meters <= 5000 ? 0.25 : 1;
        const stepped = Math.max(1, current + direction * step);
        setTimeStr(formatTime(stepped));
    };

    const result = useMemo(() => {
        const time = parseTime(timeStr);
        if (!time || time <= 0) return null;

        const vdot = calculateVDOT(selectedPreset.meters, time);
        if (!isFinite(vdot) || vdot <= 0 || vdot > 100) return null;

        const zones = ZONES.map(z => ({
            ...z,
            paceLow: formatPace(paceFromVdot(vdot, z.pctHigh)),
            paceHigh: formatPace(paceFromVdot(vdot, z.pctLow)),
        }));

        // Equivalent race times
        const equivalents = PRESETS
            .filter(p => p.key !== selectedPreset.key)
            .map(p => ({ key: p.key, time: formatTime(equivalentTimeMinutes(vdot, p.meters)) }));

        // Road segments run at threshold/tempo pace; track segments at race pace for that distance
        const thresholdZone = zones.find(z => z.key === 'threshold')!;
        const workoutPaces = [
            { key: 'roadTempo', emoji: '🟠', pace: `${thresholdZone.paceLow} – ${thresholdZone.paceHigh}`, isRange: true },
            { key: 'track10k', emoji: '🔵', pace: formatPace(equivalentTimeMinutes(vdot, 10000) / 10), isRange: false },
            { key: 'track5k',  emoji: '🟣', pace: formatPace(equivalentTimeMinutes(vdot, 5000)  / 5),  isRange: false },
            { key: 'track3k',  emoji: '⚡', pace: formatPace(equivalentTimeMinutes(vdot, 3000)  / 3),  isRange: false },
        ];

        return { vdot: Math.round(vdot * 10) / 10, zones, equivalents, workoutPaces };
    }, [timeStr, selectedPreset]);

    const handleCopy = () => {
        if (!result) return;
        const lines = result.zones.map(z =>
            `${t(`tools.trainingPaces.zones.${z.key}`)}: ${z.paceLow} - ${z.paceHigh} /km`
        );
        const text = `VDOT ${result.vdot}\n${lines.join('\n')}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyWorkout = () => {
        if (!result) return;
        const lines = result.workoutPaces.map(p =>
            `${t(`tools.trainingPaces.workout.${p.key}`)}: ${p.pace} /km`
        );
        const text = `${t('tools.trainingPaces.workout.title')} (VDOT ${result.vdot})\n${lines.join('\n')}`;
        navigator.clipboard.writeText(text);
        setCopiedWorkout(true);
        setTimeout(() => setCopiedWorkout(false), 2000);
    };

    return (
        <Box sx={{ maxWidth: 480, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('tools.trainingPaces.subtitle')}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Distance chips */}
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                            {t('tools.trainingPaces.raceDistance')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {PRESETS.map(p => (
                                <Chip
                                    key={p.key}
                                    label={t(`tools.trainingPaces.distances.${p.key}`)}
                                    size="small"
                                    variant={selectedPreset.key === p.key ? 'filled' : 'outlined'}
                                    color={selectedPreset.key === p.key ? 'primary' : 'default'}
                                    onClick={() => setSelectedPreset(p)}
                                    sx={{ cursor: 'pointer' }}
                                />
                            ))}
                        </Box>
                    </Box>

                    {/* Time input */}
                    <TextField
                        label={t('tools.trainingPaces.yourTime', { race: t(`tools.trainingPaces.distances.${selectedPreset.key}`) })}
                        placeholder={selectedPreset.meters <= 5000 ? '22:00' : selectedPreset.meters <= 10000 ? '46:00' : '1:45:00'}
                        value={timeStr}
                        onChange={(e) => setTimeStr(e.target.value)}
                        helperText={t('tools.trainingPaces.timeHelp')}
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
                        onChange={setTimeStr}
                        min={Math.round(selectedPreset.meters / 1000 * 2.5 * 60)}
                        max={Math.round(selectedPreset.meters / 1000 * 12 * 60)}
                        step={selectedPreset.meters <= 5000 ? 5 : 15}
                        parseTime={parseTime}
                    />
                </Box>
            </Paper>

            {/* Training zones */}
            {result && (
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2">
                            {t('tools.trainingPaces.zonesTitle')}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                                label={`VDOT ${result.vdot}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                            />
                            <Tooltip title={copied ? t('tools.trainingPaces.copied') : t('tools.trainingPaces.copy')}>
                                <IconButton size="small" onClick={handleCopy}>
                                    <ContentCopy sx={{ fontSize: 16 }} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {t('tools.trainingPaces.summaryText', {
                            race: t(`tools.trainingPaces.distances.${selectedPreset.key}`),
                            time: timeStr,
                            vdot: result.vdot,
                        })}
                    </Typography>
                    <Table size="small">
                        <TableBody>
                            {result.zones.map(z => (
                                <TableRow key={z.key}>
                                    <TableCell sx={{ py: 0.75, pl: 1, whiteSpace: 'nowrap' }}>
                                        <Typography variant="body2">
                                            {z.emoji} {t(`tools.trainingPaces.zones.${z.key}`)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ py: 0.75, pr: 1 }}>
                                        <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                                            {z.paceLow} – {z.paceHigh}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            /km
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {/* Workout paces */}
            {result && (
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2">
                            🎯 {t('tools.trainingPaces.workout.title')}
                        </Typography>
                        <Tooltip title={copiedWorkout ? t('tools.trainingPaces.copied') : t('tools.trainingPaces.copy')}>
                            <IconButton size="small" onClick={handleCopyWorkout}>
                                <ContentCopy sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {t('tools.trainingPaces.workout.description')}
                    </Typography>
                    <Table size="small">
                        <TableBody>
                            {result.workoutPaces.map(p => (
                                <TableRow key={p.key}>
                                    <TableCell sx={{ py: 0.75, pl: 1 }}>
                                        <Typography variant="body2">
                                            {p.emoji} {t(`tools.trainingPaces.workout.${p.key}`)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ py: 0.75, pr: 1 }}>
                                        <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                                            {p.pace}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            /km
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {/* Equivalent race times */}
            {result && (
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        {t('tools.trainingPaces.equivalents')}
                    </Typography>
                    <Table size="small">
                        <TableBody>
                            {result.equivalents.map(eq => (
                                <TableRow key={eq.key}>
                                    <TableCell sx={{ py: 0.75, pl: 1 }}>
                                        <Typography variant="body2">
                                            {t(`tools.trainingPaces.distances.${eq.key}`)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ py: 0.75, pr: 1 }}>
                                        <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                                            {eq.time}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {t('tools.trainingPaces.method')}
                    </Typography>
                </Paper>
            )}
        </Box>
    );
}
