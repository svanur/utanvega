import { useState, useMemo, useRef, useEffect } from 'react';
import { Box, TextField, Typography, Paper, InputAdornment, IconButton, useTheme, Slider } from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

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

function formatCompact(minutes: number): string {
    if (minutes < 0) return '—';
    const totalSeconds = Math.round(minutes * 60);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
    return `0:${String(s).padStart(2, '0')}`;
}

const RIEGEL_EXP = 1.06;

interface DistanceCol {
    key: string;
    km: number;
}

const DISTANCES: DistanceCol[] = [
    { key: '200m', km: 0.2 },
    { key: '400m', km: 0.4 },
    { key: '800m', km: 0.8 },
    { key: '1K', km: 1 },
    { key: '1200m', km: 1.2 },
    { key: '1600m', km: 1.6 },
    { key: '5K', km: 5 },
    { key: '10K', km: 10 },
    { key: 'Half', km: 21.0975 },
    { key: 'Marathon', km: 42.195 },
];

// Generate rows based on 1K pace (min/km), from ~2:30 to ~9:00 in 15-sec steps
function generateRows() {
    const rows: { pacePerKm: number }[] = [];
    for (let sec = 150; sec <= 540; sec += 15) {
        rows.push({ pacePerKm: sec / 60 });
    }
    return rows;
}

const ROWS = generateRows();

function predictTime(oneKmTime: number, targetKm: number): number {
    return oneKmTime * Math.pow(targetKm / 1, RIEGEL_EXP);
}

export default function PaceChart() {
    const { t } = useTranslation();
    const theme = useTheme();
    const [searchStr, setSearchStr] = useState('');
    const highlightRef = useRef<HTMLTableRowElement>(null);

    // Find the closest row to the search input
    const highlightIndex = useMemo(() => {
        const searchTime = parseTime(searchStr);
        if (!searchTime || searchTime <= 0) return -1;

        // Try to match against marathon time (most common search)
        let bestIdx = -1;
        let bestDiff = Infinity;

        for (let i = 0; i < ROWS.length; i++) {
            const marathonTime = predictTime(ROWS[i].pacePerKm, 42.195);
            const diff = Math.abs(marathonTime - searchTime);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = i;
            }
        }

        // Also try matching as 1K pace
        for (let i = 0; i < ROWS.length; i++) {
            const diff = Math.abs(ROWS[i].pacePerKm - searchTime);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = i;
            }
        }

        return bestIdx;
    }, [searchStr]);

    useEffect(() => {
        if (highlightRef.current) {
            highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightIndex]);

    const stepSearch = (direction: 1 | -1) => {
        const current = parseTime(searchStr) ?? 180;
        const stepped = Math.max(1, current + direction);
        setSearchStr(formatCompact(stepped));
    };

    const borderColor = theme.palette.divider;
    const bgPaper = theme.palette.background.paper;
    const bgHighlight = theme.palette.action.selected;
    const bgHeader = theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100];
    const textPrimary = theme.palette.text.primary;
    const textSecondary = theme.palette.text.secondary;

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
            <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {t('tools.paceChart.subtitle')}
                </Typography>
                <TextField
                    label={t('tools.paceChart.search')}
                    placeholder="3:30:00"
                    value={searchStr}
                    onChange={(e) => setSearchStr(e.target.value)}
                    helperText={t('tools.paceChart.searchHelp')}
                    fullWidth
                    size="small"
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <IconButton size="small" onClick={() => stepSearch(-1)} sx={{ p: 0 }}>
                                        <KeyboardArrowUp sx={{ fontSize: 18 }} />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => stepSearch(1)} sx={{ p: 0 }}>
                                        <KeyboardArrowDown sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Box>
                            </InputAdornment>
                        ),
                    }}
                />
                <Box sx={{ px: 1, mt: 1 }}>
                    <Slider
                        value={(() => {
                            // Map search to slider: try 1K pace first, then derive from marathon
                            const t = parseTime(searchStr);
                            if (!t) return 330; // ~5:30/km default
                            // If value looks like a 1K pace (< 15 min), use directly
                            if (t < 15) return Math.round(t * 60);
                            // Otherwise, reverse Riegel to get 1K pace from marathon time
                            const oneKm = t / Math.pow(42.195, RIEGEL_EXP);
                            return Math.round(oneKm * 60);
                        })()}
                        onChange={(_, val) => {
                            const secs = val as number;
                            const m = Math.floor(secs / 60);
                            const s = secs % 60;
                            setSearchStr(`${m}:${String(s).padStart(2, '0')}`);
                        }}
                        min={150}
                        max={540}
                        step={5}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => {
                            const m = Math.floor(v / 60);
                            const s = v % 60;
                            return `${m}:${String(s).padStart(2, '0')}/km`;
                        }}
                        marks={[
                            { value: 180, label: '3:00' },
                            { value: 300, label: '5:00' },
                            { value: 420, label: '7:00' },
                            { value: 540, label: '9:00' },
                        ]}
                        sx={{ mt: 0.5 }}
                    />
                </Box>
            </Paper>

            <Paper sx={{ overflow: 'hidden' }}>
                <Box sx={{ overflow: 'auto', maxHeight: '65vh' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.75rem', color: textPrimary }}>
                        <thead>
                            <tr>
                                <th style={{
                                    position: 'sticky', left: 0, top: 0, zIndex: 3,
                                    padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap',
                                    borderBottom: `2px solid ${borderColor}`,
                                    fontWeight: 700, minWidth: 52,
                                    background: bgHeader,
                                }}>
                                    /km
                                </th>
                                {DISTANCES.map(d => (
                                    <th key={d.key} style={{
                                        position: 'sticky', top: 0, zIndex: 2,
                                        padding: '6px 6px', textAlign: 'right', whiteSpace: 'nowrap',
                                        borderBottom: `2px solid ${borderColor}`,
                                        fontWeight: 600, minWidth: 52,
                                        background: bgHeader,
                                    }}>
                                        {d.key}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ROWS.map((row, i) => {
                                const isHighlight = i === highlightIndex;
                                return (
                                    <tr
                                        key={i}
                                        ref={isHighlight ? highlightRef : undefined}
                                        style={{
                                            background: isHighlight ? bgHighlight : 'transparent',
                                        }}
                                    >
                                        <td style={{
                                            position: 'sticky', left: 0, zIndex: 1,
                                            padding: '4px 8px', whiteSpace: 'nowrap',
                                            fontFamily: 'monospace', fontWeight: isHighlight ? 700 : 600,
                                            borderBottom: `1px solid ${borderColor}`,
                                            background: isHighlight ? bgHighlight : bgPaper,
                                            color: isHighlight ? textPrimary : textSecondary,
                                        }}>
                                            {formatCompact(row.pacePerKm)}
                                        </td>
                                        {DISTANCES.map(d => (
                                            <td key={d.key} style={{
                                                padding: '4px 6px', textAlign: 'right',
                                                fontFamily: 'monospace', whiteSpace: 'nowrap',
                                                fontWeight: isHighlight ? 700 : 400,
                                                borderBottom: `1px solid ${borderColor}`,
                                            }}>
                                                {formatCompact(predictTime(row.pacePerKm, d.km))}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Box>
            </Paper>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', px: 1 }}>
                {t('tools.paceChart.note')}
            </Typography>
        </Box>
    );
}
