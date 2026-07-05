import { useState, useEffect, useMemo } from 'react';
import { Box, TextField, Typography, Paper, Autocomplete, InputAdornment, IconButton, Divider, Table, TableBody, TableRow, TableCell, Alert, Tooltip, Button, Chip } from '@mui/material';
import { KeyboardArrowUp, KeyboardArrowDown, CompareArrows, ContentCopy, Check, ImageOutlined, RestartAlt } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { API_URL } from '../hooks/useTrails';
import TimeSlider from './TimeSlider';
import PredictionShareCard from './PredictionShareCard';

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
    slug: string;
    name: string;
    distance: number; // km
    elevationGain: number; // m
    elevationLoss: number; // m
}

// Minutes added per 100m of elevation gain (Naismith-derived, trail running adjusted)
const CLIMB_FACTOR = 1.0;

// Minutes added per 100m of elevation loss (technical trail descent)
const DESCENT_FACTOR = 0.1;

// Riegel's fatigue exponent
const RIEGEL_EXP = 1.06;

export default function TrailRacePredictor({ prefilledTrailSlug, prefilledFromSlug, prefilledTime }: { prefilledTrailSlug?: string; prefilledFromSlug?: string; prefilledTime?: string }) {
    const { t } = useTranslation();

    const [searchParams, setSearchParams] = useSearchParams();

    const [trails, setTrails] = useState<TrailOption[]>([]);
    const [trailsError, setTrailsError] = useState(false);
    const [trailA, setTrailA] = useState<TrailOption | null>(null);
    const [trailB, setTrailB] = useState<TrailOption | null>(null);
    const [timeStr, setTimeStr] = useState(() => {
        const p = searchParams.get('t') ?? prefilledTime;
        return p ? p.replace(/-/g, ':') : '';
    });
    const [copied, setCopied] = useState(false);
    const [shareCardOpen, setShareCardOpen] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/api/v1/trails`)
            .then(r => r.json())
            .then((data: { slug: string; name: string; length: number; elevationGain: number; elevationLoss: number; status: string }[]) => {
                const mapped = data
                    .filter(t => t.status === 'Published')
                    .map(t => ({ slug: t.slug, name: t.name, distance: t.length / 1000, elevationGain: t.elevationGain, elevationLoss: t.elevationLoss }))
                    .sort((a, b) => a.name.localeCompare(b.name));
                setTrails(mapped);
                setTrailsError(false);
            })
            .catch(() => setTrailsError(true));
    }, []);

    // Resolve trail A: URL param takes priority over prefill prop
    useEffect(() => {
        if (trails.length === 0) return;
        const slug = searchParams.get('from') ?? prefilledFromSlug;
        if (slug) { const match = trails.find(t => t.slug === slug); if (match && !trailA) setTrailA(match); }
    }, [prefilledFromSlug, trails]); // eslint-disable-line react-hooks/exhaustive-deps

    // Resolve trail B: URL param takes priority over prefill prop
    useEffect(() => {
        if (trails.length === 0) return;
        const slug = searchParams.get('to') ?? prefilledTrailSlug;
        if (slug) { const match = trails.find(t => t.slug === slug); if (match && !trailB) setTrailB(match); }
    }, [prefilledTrailSlug, trails]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync selections to URL
    useEffect(() => {
        const urlTime = timeStr.replace(/:/g, '-');
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (trailA) next.set('from', trailA.slug); else next.delete('from');
            if (trailB) next.set('to', trailB.slug); else next.delete('to');
            if (timeStr) next.set('t', urlTime); else next.delete('t');
            return next;
        }, { replace: true });
    }, [trailA, trailB, timeStr]); // eslint-disable-line react-hooks/exhaustive-deps

    const stepTime = (direction: 1 | -1) => {
        const current = parseTime(timeStr) ?? 60;
        const stepped = Math.max(1, current + direction);
        setTimeStr(formatTime(stepped));
    };

    const prediction = useMemo(() => {
        const knownTime = parseTime(timeStr);
        if (!trailA || !trailB || !knownTime || knownTime <= 0) return null;

        // Step 1: Strip elevation cost from known time → flat equivalent time
        const climbTimeA = (trailA.elevationGain / 100) * CLIMB_FACTOR;
        const descentTimeA = (trailA.elevationLoss / 100) * DESCENT_FACTOR;
        const flatTimeA = Math.max(knownTime - climbTimeA - descentTimeA, knownTime * 0.3);

        // Step 2: Apply Riegel's formula for distance difference
        const flatTimeB = flatTimeA * Math.pow(trailB.distance / trailA.distance, RIEGEL_EXP);

        // Step 3: Add elevation and descent penalty for Trail B
        const climbTimeB = (trailB.elevationGain / 100) * CLIMB_FACTOR;
        const descentTimeB = (trailB.elevationLoss / 100) * DESCENT_FACTOR;
        const predictedTime = flatTimeB + climbTimeB + descentTimeB;

        const flatPaceA = flatTimeA / trailA.distance;
        const predictedPace = predictedTime / trailB.distance;
        const timeDiff = predictedTime - knownTime;

        return {
            predictedTime: formatTime(predictedTime),
            predictedPace: formatPace(predictedPace),
            flatPace: formatPace(flatPaceA),
            climbPenaltyB: formatTime(climbTimeB),
            descentPenaltyB: formatTime(descentTimeB),
            timeDiff: `${timeDiff >= 0 ? '+' : ''}${formatTime(Math.abs(timeDiff))}`,
            isSlower: timeDiff >= 0,
            distDiff: trailB.distance - trailA.distance,
            gainDiff: trailB.elevationGain - trailA.elevationGain,
            lossDiff: trailB.elevationLoss - trailA.elevationLoss,
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                        {t('tools.trailPredictor.subtitle')}
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={() => { setTrailA(null); setTrailB(null); setTimeStr(''); setSearchParams({}); }}
                        title={t('common.reset')}
                        disabled={!trailA && !trailB && !timeStr}
                    >
                        <RestartAlt fontSize="small" />
                    </IconButton>
                </Box>

                {/* Example scenarios */}
                {trails.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                        {[
                            { label: t('tools.trailPredictor.examples.hengillVsLaugavegur'), from: 'hengill-ultra-52', to: 'laugavegur-ultra' },
                            { label: t('tools.trailPredictor.examples.puffinVsEsja'),        from: 'the-puffin-run',  to: 'mt-esja-ultra-halfmarathon' },
                        ].map(ex => {
                            const fromTrail = trails.find(t => t.slug === ex.from);
                            const toTrail   = trails.find(t => t.slug === ex.to);
                            if (!fromTrail || !toTrail) return null;
                            return (
                                <Chip
                                    key={ex.label}
                                    label={ex.label}
                                    size="small"
                                    variant="outlined"
                                    onClick={() => { setTrailA(fromTrail); setTrailB(toTrail); }}
                                    sx={{ cursor: 'pointer' }}
                                />
                            );
                        })}
                    </Box>
                )}

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
                            <Typography variant="caption" color="text.secondary">📏 {trailA.distance.toFixed(1)} km</Typography>
                            <Typography variant="caption" color="text.secondary">↑{Math.round(trailA.elevationGain)}m</Typography>
                            <Typography variant="caption" color="text.secondary">↓{Math.round(trailA.elevationLoss)}m</Typography>
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
                    <TimeSlider
                        value={timeStr}
                        onChange={setTimeStr}
                        min={trailA ? Math.round(trailA.distance * 2.5 * 60) : 600}
                        max={trailA ? Math.round(trailA.distance * 12 * 60) : 43200}
                        step={trailA && trailA.distance <= 10 ? 5 : 15}
                        parseTime={parseTime}
                    />

                    <Divider>
                        <Tooltip title={t('tools.trailPredictor.swap')}>
                            <IconButton
                                size="small"
                                onClick={() => { setTrailA(trailB); setTrailB(trailA); }}
                                disabled={!trailA && !trailB}
                            >
                                <CompareArrows fontSize="small" />
                            </IconButton>
                        </Tooltip>
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
                            <Typography variant="caption" color="text.secondary">📏 {trailB.distance.toFixed(1)} km</Typography>
                            <Typography variant="caption" color="text.secondary">↑{Math.round(trailB.elevationGain)}m</Typography>
                            <Typography variant="caption" color="text.secondary">↓{Math.round(trailB.elevationLoss)}m</Typography>
                        </Box>
                    )}
                </Box>
            </Paper>

            {/* Prediction results */}
            {prediction && trailA && trailB && (
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2">
                            {t('tools.trailPredictor.prediction')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title={copied ? t('qr.linkCopied') : t('qr.copyLink')} arrow>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
                                    color={copied ? 'success' : 'primary'}
                                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                    onClick={() => {
                                        const url = new URL(`${window.location.origin}/tools/trail-predictor`);
                                        url.searchParams.set('from', trailA.slug);
                                        url.searchParams.set('trail', trailB.slug);
                                        url.searchParams.set('time', timeStr);
                                        navigator.clipboard.writeText(url.toString()).catch(() => {});
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                >
                                    {copied ? t('qr.linkCopied') : t('tools.trailPredictor.copyUrl')}
                                </Button>
                            </Tooltip>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ImageOutlined fontSize="small" />}
                                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                onClick={() => setShareCardOpen(true)}
                            >
                                {t('tools.trailPredictor.shareImage')}
                            </Button>
                        </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('tools.trailPredictor.summaryText', {
                            knownTrail: trailA.name,
                            yourTime: timeStr,
                            targetTrail: trailB.name,
                            predictedTime: prediction.predictedTime,
                        })}
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
                            {prediction.distDiff >= 0 ? '+' : ''}{prediction.distDiff.toFixed(1)} km·{' '}
                            {prediction.gainDiff >= 0 ? '+' : ''}{Math.round(prediction.gainDiff)}m ↑·{' '}
                            {prediction.lossDiff >= 0 ? '+' : ''}{Math.round(prediction.lossDiff)}m ↓
                        </Typography>
                    </Box>

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {t('tools.trailPredictor.method')}
                    </Typography>
                </Paper>
            )}

            {prediction && trailA && trailB && (
                <PredictionShareCard
                    open={shareCardOpen}
                    onClose={() => setShareCardOpen(false)}
                    trailAName={trailA.name}
                    trailBName={trailB.name}
                    knownTime={timeStr}
                    predictedTime={prediction.predictedTime}
                    predictedPace={prediction.predictedPace}
                    distanceKm={trailB.distance}
                    elevationGain={trailB.elevationGain}
                    elevationLoss={trailB.elevationLoss}
                />
            )}
        </Box>
    );
}
