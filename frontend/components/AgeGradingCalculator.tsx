import { useState } from 'react';
import {
    Box, TextField, Typography, Paper, ToggleButton, ToggleButtonGroup,
    MenuItem, Select, FormControl, InputLabel, Divider, Alert, Tooltip,
    IconButton, InputAdornment,
} from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown, RestartAlt } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import TimeSlider from './TimeSlider';
import {
    AG_DISTANCES, calculateAgeGrade, formatSeconds, parseTimeToSeconds,
} from '../data/ageGrading';
import type { Gender } from '../data/ageGrading';

export default function AgeGradingCalculator() {
    const { t } = useTranslation();

    const [gender, setGender] = useState<Gender>('male');
    const [age, setAge] = useState('');
    const [distanceKey, setDistanceKey] = useState('5K');
    const [timeStr, setTimeStr] = useState('');

    const stepTime = (direction: 1 | -1) => {
        const current = parseTimeToSeconds(timeStr) ?? Math.round(distance.km * 5 * 60);
        const step = distance.km <= 10 ? 5 : 15;
        const next = Math.max(step, current + direction * step);
        const h = Math.floor(next / 3600);
        const m = Math.floor((next % 3600) / 60);
        const s = next % 60;
        const formatted = h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`;
        setTimeStr(formatted);
    };

    const ageNum = parseInt(age, 10);
    const runnerSeconds = parseTimeToSeconds(timeStr);
    const distance = AG_DISTANCES.find(d => d.label === distanceKey) ?? AG_DISTANCES[0];
    const result = (runnerSeconds && !isNaN(ageNum) && ageNum >= 5 && ageNum <= 100)
        ? calculateAgeGrade(gender, ageNum, distance.km, runnerSeconds)
        : null;

    const handleReset = () => {
        setGender('male');
        setAge('');
        setDistanceKey('5K');
        setTimeStr('');
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    {t('tools.ageGrading.subtitle')}
                </Typography>
                <IconButton
                    size="small"
                    onClick={handleReset}
                    title={t('common.reset')}
                    disabled={!age && !timeStr && gender === 'male' && distanceKey === '5K'}
                >
                    <RestartAlt fontSize="small" />
                </IconButton>
            </Box>

            {/* Gender */}
            <ToggleButtonGroup
                value={gender}
                exclusive
                onChange={(_, v) => { if (v) setGender(v); }}
                size="small"
            >
                <ToggleButton value="male">{t('tools.ageGrading.male')}</ToggleButton>
                <ToggleButton value="female">{t('tools.ageGrading.female')}</ToggleButton>
            </ToggleButtonGroup>

            {/* Age + Distance */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                    label={t('tools.ageGrading.age')}
                    type="number"
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    inputProps={{ min: 5, max: 100 }}
                    size="small"
                />
                <FormControl size="small">
                    <InputLabel>{t('tools.ageGrading.distance')}</InputLabel>
                    <Select
                        value={distanceKey}
                        label={t('tools.ageGrading.distance')}
                        onChange={e => setDistanceKey(e.target.value)}
                    >
                        {AG_DISTANCES.map(d => (
                            <MenuItem key={d.label} value={d.label}>{d.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            {/* Time */}
            <TextField
                label={t('tools.ageGrading.yourTime')}
                value={timeStr}
                onChange={e => setTimeStr(e.target.value)}
                placeholder={t('tools.ageGrading.timeHelp')}
                size="small"
                helperText={t('tools.ageGrading.timeHelp')}
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
                min={Math.round(distance.km * 2.5 * 60)}
                max={Math.round(distance.km * 15 * 60)}
                step={distance.km <= 10 ? 5 : 15}
                parseTime={val => { const s = parseTimeToSeconds(val); return s != null ? s / 60 : null; }}
            />

            {/* Result */}
            {result && (
                <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Percentage + tier */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                        <Box>
                            <Typography variant="h3" fontWeight={700} sx={{ color: result.tierColor, lineHeight: 1 }}>
                                {result.percentage.toFixed(1)}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {t('tools.ageGrading.ageGradedPct')}
                            </Typography>
                        </Box>
                        <Paper
                            sx={{
                                px: 2, py: 0.75, bgcolor: result.tierColor + '22',
                                border: `1px solid ${result.tierColor}`,
                                borderRadius: 2,
                            }}
                        >
                            <Typography variant="subtitle2" fontWeight={700} sx={{ color: result.tierColor }}>
                                {t(`tools.ageGrading.tierNames.${result.tier}`)}
                            </Typography>
                        </Paper>
                    </Box>

                    {/* Progress bar with tier ticks */}
                    <Box>
                        <Box sx={{ position: 'relative', height: 8 }}>
                            {/* Track */}
                            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'action.hover', borderRadius: 4 }} />
                            {/* Fill */}
                            <Box sx={{
                                position: 'absolute', top: 0, left: 0, bottom: 0,
                                width: `${Math.min(100, result.percentage)}%`,
                                bgcolor: result.tierColor, borderRadius: 4,
                                transition: 'width 0.3s ease',
                            }} />
                            {/* Tier ticks at 60, 70, 80, 90% */}
                            {[60, 70, 80, 90].map(pct => (
                                <Tooltip key={pct} title={`${pct}%`} placement="top" arrow>
                                    <Box sx={{
                                        position: 'absolute', top: -3, bottom: -3,
                                        left: `${pct}%`, width: 2,
                                        bgcolor: 'background.paper',
                                        borderRadius: 1, cursor: 'default',
                                        zIndex: 1,
                                    }} />
                                </Tooltip>
                            ))}
                        </Box>
                        <Box sx={{ position: 'relative', mt: 0.75, height: 16 }}>
                            <Typography variant="caption" color="text.disabled" sx={{ position: 'absolute', left: 0 }}>0%</Typography>
                            {[60, 70, 80, 90].map(pct => (
                                <Typography key={pct} variant="caption" color="text.disabled"
                                    sx={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)' }}>
                                    {pct}
                                </Typography>
                            ))}
                            <Typography variant="caption" color="text.disabled" sx={{ position: 'absolute', right: 0 }}>100%</Typography>
                        </Box>
                    </Box>

                    <Divider />

                    {/* Age-graded time */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                        <Box>
                            <Typography variant="body2" color="text.secondary">
                                {t('tools.ageGrading.ageGradedTime')}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                                {t('tools.ageGrading.ageGradedTimeDesc')}
                            </Typography>
                        </Box>
                        <Typography variant="h6" fontWeight={700} sx={{ flexShrink: 0 }}>
                            {formatSeconds(result.ageGradedSeconds)}
                        </Typography>
                    </Box>

                    {/* Next tier */}
                    <Divider />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {result.nextTier ? (
                            <>
                                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>🎯</Typography>
                                <Typography variant="body2">
                                    {t('tools.ageGrading.nextTier', {
                                        time: formatSeconds(result.nextTier.improveBySeconds),
                                        tier: t(`tools.ageGrading.tierNames.${result.nextTier.key}`),
                                    })}
                                </Typography>
                                <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto', flexShrink: 0 }}>
                                    {result.nextTier.threshold}%
                                </Typography>
                            </>
                        ) : (
                            <Typography variant="body2" sx={{ color: '#f59e0b', fontWeight: 600 }}>
                                🏆 {t('tools.ageGrading.worldClass')}
                            </Typography>
                        )}
                    </Box>

                    {/* Tier thresholds legend */}
                    <Divider />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                            {t('tools.ageGrading.tiers')}
                        </Typography>
                        {[
                            { key: 'worldClass',    range: '90%+',      color: '#f59e0b' },
                            { key: 'nationalClass', range: '80–89.9%',  color: '#6366f1' },
                            { key: 'regionalClass', range: '70–79.9%',  color: '#22c55e' },
                            { key: 'localClass',    range: '60–69.9%',  color: '#3b82f6' },
                            { key: 'recreational',  range: 'Under 60%', color: '#94a3b8' },
                        ].map(tier => (
                            <Box key={tier.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: tier.color, flexShrink: 0 }} />
                                <Typography variant="caption">
                                    <strong>{t(`tools.ageGrading.tierNames.${tier.key}`)}</strong> — {tier.range}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Paper>
            )}

            {!result && age && timeStr && (
                <Alert severity="warning" variant="outlined">
                    {t('tools.ageGrading.invalidInput')}
                </Alert>
            )}

            <Typography variant="caption" color="text.disabled">
                {t('tools.ageGrading.source')}
            </Typography>
        </Box>
    );
}
