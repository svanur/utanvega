import { useState } from 'react';
import { Box, TextField, Typography, Paper, Chip, Table, TableBody, TableRow, TableCell, TableHead, InputAdornment, IconButton } from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
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

// Riegel's formula: T2 = T1 * (D2/D1)^1.06
function predictTime(knownTime: number, knownDist: number, targetDist: number): number {
    return knownTime * Math.pow(targetDist / knownDist, 1.06);
}

interface RaceDistance {
    key: string;
    km: number;
}

const DISTANCES: RaceDistance[] = [
    { key: '1k', km: 1 },
    { key: '5k', km: 5 },
    { key: '10k', km: 10 },
    { key: 'half', km: 21.0975 },
    { key: 'marathon', km: 42.195 },
    { key: '50k', km: 50 },
    { key: '100k', km: 100 },
];

export default function RacePredictor() {
    const { t } = useTranslation();

    const [selectedDist, setSelectedDist] = useState<RaceDistance>(DISTANCES[1]); // 5K default
    const [timeStr, setTimeStr] = useState('');

    const knownTime = parseTime(timeStr);

    const stepTime = (direction: 1 | -1) => {
        const current = knownTime ?? 25;
        const stepped = Math.max(1, current + direction);
        setTimeStr(formatTime(stepped));
    };

    // Compute predictions for all distances except the known one
    const predictions = knownTime && knownTime > 0
        ? DISTANCES.filter(d => d.key !== selectedDist.key).map(d => {
            const predicted = predictTime(knownTime, selectedDist.km, d.km);
            const pace = predicted / d.km;
            return {
                key: d.key,
                km: d.km,
                time: formatTime(predicted),
                pace: formatPace(pace),
            };
        })
        : [];

    return (
        <Box sx={{ maxWidth: 480, mx: 'auto' }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('tools.racePredictor.subtitle')}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Distance selection */}
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                            {t('tools.racePredictor.knownDistance')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {DISTANCES.map(d => (
                                <Chip
                                    key={d.key}
                                    label={t(`tools.racePredictor.distances.${d.key}`)}
                                    size="small"
                                    variant={selectedDist.key === d.key ? 'filled' : 'outlined'}
                                    color={selectedDist.key === d.key ? 'primary' : 'default'}
                                    onClick={() => setSelectedDist(d)}
                                    sx={{ cursor: 'pointer' }}
                                />
                            ))}
                        </Box>
                    </Box>

                    {/* Time input */}
                    <TextField
                        label={t('tools.racePredictor.yourTime', { race: t(`tools.racePredictor.distances.${selectedDist.key}`) })}
                        placeholder={selectedDist.km <= 5 ? '22:00' : selectedDist.km <= 10 ? '46:00' : '1:45:00'}
                        value={timeStr}
                        onChange={(e) => setTimeStr(e.target.value)}
                        helperText={t('tools.racePredictor.timeHelp')}
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
                        min={Math.round(selectedDist.km * 2.5 * 60)}
                        max={Math.round(selectedDist.km * 12 * 60)}
                        step={selectedDist.km <= 10 ? 5 : 15}
                        parseTime={parseTime}
                    />
                </Box>
            </Paper>

            {/* Predictions table */}
            {predictions.length > 0 && (
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        {t('tools.racePredictor.predictions')}
                    </Typography>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, py: 0.5 }}>
                                    {t('tools.racePredictor.race')}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, py: 0.5 }}>
                                    {t('tools.racePredictor.predictedTime')}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, py: 0.5 }}>
                                    {t('tools.racePredictor.predictedPace')}
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {predictions.map(p => (
                                <TableRow key={p.key} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                                    <TableCell sx={{ py: 0.75 }}>
                                        <Typography variant="body2">
                                            {t(`tools.racePredictor.distances.${p.key}`)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ py: 0.75 }}>
                                        <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                                            {p.time}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ py: 0.75 }}>
                                        <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                                            {p.pace}/km
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {t('tools.racePredictor.formula')}
                    </Typography>
                </Paper>
            )}
        </Box>
    );
}
