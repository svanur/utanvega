import { useState, useMemo, useRef, useEffect } from 'react';
import { Box, TextField, Typography, Paper, InputAdornment, IconButton, useTheme, Slider, Button, Dialog, AppBar, Toolbar } from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown, PrintOutlined, FullscreenOutlined, CloseOutlined } from '@mui/icons-material';
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

// Generate rows based on 1K pace (min/km), from ~2:00 to ~9:00 in 15-sec steps
function generateRows() {
    const rows: { pacePerKm: number }[] = [];
    for (let sec = 120; sec <= 540; sec += 15) {
        rows.push({ pacePerKm: sec / 60 });
    }
    return rows;
}

const ROWS = generateRows();

function predictTime(oneKmTime: number, targetKm: number): number {
    return oneKmTime * targetKm;
}

export default function PaceChart() {
    const { t } = useTranslation();
    const theme = useTheme();
    const [searchStr, setSearchStr] = useState('');
    const [fullscreen, setFullscreen] = useState(false);
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

    const tableRef = useRef<HTMLTableElement>(null);

    const handlePrint = () => {
        if (!tableRef.current) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head><title>Pace Chart — Utanvega</title>
<style>body{font-family:system-ui,sans-serif;margin:20px}
table{border-collapse:collapse;width:100%;font-size:11px}
th,td{padding:4px 6px;border:1px solid #ccc;text-align:right;font-family:monospace}
th{background:#f0f0f0;font-weight:700}
td:first-child,th:first-child{text-align:left;font-weight:600}
h2{margin:0 0 12px;font-size:16px}</style></head><body>
<h2>🏃 Pace Chart — Utanvega</h2>${tableRef.current.outerHTML}</body></html>`);
        win.document.close();
        win.print();
    };

    const borderColor = theme.palette.divider;
    const bgPaper = theme.palette.background.paper;
    const bgHighlight = theme.palette.action.selected;
    const bgHeader = theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100];
    const textPrimary = theme.palette.text.primary;
    const textSecondary = theme.palette.text.secondary;

    const sliderValue = useMemo(() => {
        const t = parseTime(searchStr);
        if (!t) return 330;
        if (t < 15) return Math.round(t * 60);
        const oneKm = t / 42.195;
        return Math.round(oneKm * 60);
    }, [searchStr]);

    const handleSliderChange = (_: unknown, val: number | number[]) => {
        const secs = val as number;
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        setSearchStr(`${m}:${String(s).padStart(2, '0')}`);
    };

    const formatSliderLabel = (v: number) => {
        const m = Math.floor(v / 60);
        const s = v % 60;
        return `${m}:${String(s).padStart(2, '0')}/km`;
    };

    const sliderMarks = [
        { value: 120, label: '2:00' },
        { value: 240, label: '4:00' },
        { value: 360, label: '6:00' },
        { value: 480, label: '8:00' },
    ];

    return (
        <Box sx={{ maxWidth: { xs: '100%', md: 900 }, mx: 'auto' }}>
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
                        value={sliderValue}
                        onChange={handleSliderChange}
                        min={120}
                        max={540}
                        step={5}
                        valueLabelDisplay="auto"
                        valueLabelFormat={formatSliderLabel}
                        marks={sliderMarks}
                        sx={{ mt: 0.5 }}
                    />
                </Box>
            </Paper>

            <Paper sx={{ overflow: 'hidden' }}>
                <Box sx={{ overflow: 'auto', maxHeight: '65vh' }}>
                    <table ref={tableRef} style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.75rem', color: textPrimary }}>
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

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1.5 }}>
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PrintOutlined />}
                    onClick={handlePrint}
                >
                    {t('tools.paceChart.print')}
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FullscreenOutlined />}
                    onClick={() => setFullscreen(true)}
                    sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                >
                    {t('tools.paceChart.fullscreen')}
                </Button>
            </Box>

            {/* Fullscreen dialog */}
            <Dialog fullScreen open={fullscreen} onClose={() => setFullscreen(false)}>
                <AppBar sx={{ position: 'relative' }} color="default" elevation={1}>
                    <Toolbar variant="dense">
                        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
                            🏃 {t('tools.paceChart.title')}
                        </Typography>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PrintOutlined />}
                            onClick={handlePrint}
                            sx={{ mr: 1 }}
                        >
                            {t('tools.paceChart.print')}
                        </Button>
                        <IconButton edge="end" onClick={() => setFullscreen(false)} aria-label="close">
                            <CloseOutlined />
                        </IconButton>
                    </Toolbar>
                </AppBar>
                <Box sx={{ p: 2, pt: 5, overflow: 'auto', flex: 1 }}>
                    <Box sx={{ maxWidth: 1200, mx: 'auto', mb: 2, display: 'flex', alignItems: 'flex-end', gap: 3, flexWrap: 'wrap' }}>
                        <TextField
                            label={t('tools.paceChart.search')}
                            placeholder="3:30:00"
                            value={searchStr}
                            onChange={(e) => setSearchStr(e.target.value)}
                            helperText={t('tools.paceChart.searchHelp')}
                            size="small"
                            sx={{ maxWidth: 400 }}
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
                        <Box sx={{ flex: 1, minWidth: 200, maxWidth: 500, pb: 2 }}>
                            <Slider
                                value={sliderValue}
                                onChange={handleSliderChange}
                                min={120}
                                max={540}
                                step={5}
                                valueLabelDisplay="auto"
                                valueLabelFormat={formatSliderLabel}
                                marks={sliderMarks}
                            />
                        </Box>
                    </Box>
                    <Box sx={{ maxWidth: 1200, mx: 'auto', overflow: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem', color: textPrimary }}>
                            <thead>
                                <tr>
                                    <th style={{
                                        position: 'sticky', left: 0, top: 0, zIndex: 3,
                                        padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap',
                                        borderBottom: `2px solid ${borderColor}`,
                                        fontWeight: 700, minWidth: 60,
                                        background: bgHeader,
                                    }}>
                                        /km
                                    </th>
                                    {DISTANCES.map(d => (
                                        <th key={d.key} style={{
                                            position: 'sticky', top: 0, zIndex: 2,
                                            padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap',
                                            borderBottom: `2px solid ${borderColor}`,
                                            fontWeight: 600, minWidth: 70,
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
                                        <tr key={i} style={{ background: isHighlight ? bgHighlight : 'transparent' }}>
                                            <td style={{
                                                position: 'sticky', left: 0, zIndex: 1,
                                                padding: '6px 12px', whiteSpace: 'nowrap',
                                                fontFamily: 'monospace', fontWeight: isHighlight ? 700 : 600,
                                                borderBottom: `1px solid ${borderColor}`,
                                                background: isHighlight ? bgHighlight : bgPaper,
                                                color: isHighlight ? textPrimary : textSecondary,
                                            }}>
                                                {formatCompact(row.pacePerKm)}
                                            </td>
                                            {DISTANCES.map(d => (
                                                <td key={d.key} style={{
                                                    padding: '6px 10px', textAlign: 'right',
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
                </Box>
            </Dialog>
        </Box>
    );
}
