import { useState, useCallback } from 'react';
import { Box, TextField, Typography, Paper, ToggleButtonGroup, ToggleButton, Chip, Divider, IconButton, InputAdornment, Table, TableBody, TableRow, TableCell } from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

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
];

export default function PaceCalculator() {
    const { t } = useTranslation();

    const [paceStr, setPaceStr] = useState('');
    const [distanceStr, setDistanceStr] = useState('');
    const [timeStr, setTimeStr] = useState('');
    const [unit, setUnit] = useState<'km' | 'mi'>('km');

    const MI_TO_KM = 1.60934;

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

    // Computed splits display
    const pace = parseTime(paceStr);
    const dist = parseFloat(distanceStr) || null;
    const splits: { label: string; time: string }[] = [];
    if (pace && dist && dist > 1) {
        const fullUnits = Math.floor(dist);
        for (let i = 1; i <= Math.min(fullUnits, 100); i++) {
            splits.push({ label: `${i} ${unit}`, time: formatTime(pace * i) });
        }
        if (dist > fullUnits) {
            splits.push({ label: `${dist} ${unit}`, time: formatTime(pace * dist) });
        }
    }

    return (
        <Box sx={{ maxWidth: 480, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                        {t('tools.paceCalc.subtitle')}
                    </Typography>
                    <ToggleButtonGroup value={unit} exclusive onChange={handleUnitToggle} size="small">
                        <ToggleButton value="km">km</ToggleButton>
                        <ToggleButton value="mi">mi</ToggleButton>
                    </ToggleButtonGroup>
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
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
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
                </Box>
            </Paper>

            {splits.length > 0 && (
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        {t('tools.paceCalc.splits')}
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
