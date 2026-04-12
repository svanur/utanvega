import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box, Typography, Button, Stack, Chip, Paper, Fade,
    LinearProgress, IconButton, Tooltip, Collapse, useTheme,
} from '@mui/material';
import {
    EmojiEvents as TrophyIcon,
    Lightbulb as HintIcon,
    RemoveCircleOutline as EliminateIcon,
    Replay as ReplayIcon,
    NavigateNext as NextIcon,
} from '@mui/icons-material';
import {
    AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import type { Trail } from '../hooks/useTrails';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type GeoJsonGeometry = { type: string; coordinates: number[][] };
type GameState = 'loading' | 'cycling' | 'playing' | 'correct' | 'wrong' | 'finished';
type ChartPoint = { distance: number; elevation: number };

const MAX_SCORE = 100;
const HINT_PENALTY = 20;
const TOTAL_ROUNDS = 5;
const OPTIONS_COUNT = 4;
const DECOY_COUNT = 4;
const MIN_ELEV_GAIN = 50; // minimum elevation gain to be eligible
const CYCLE_DELAYS = [80, 80, 100, 100, 120, 150, 200, 300, 450];

interface HintInfo {
    key: string;
    icon: string;
    getText: (trail: Trail, t: (k: string, o?: Record<string, unknown>) => string) => string;
}

const HINTS: HintInfo[] = [
    { key: 'location', icon: '🗺️', getText: (tr, t) => t('game.hintLocation', { location: tr.locations?.[0]?.name || t('game.unknownLocation') }) },
    { key: 'distance', icon: '📏', getText: (tr, t) => t('game.hintDistance', { distance: (tr.length / 1000).toFixed(1) }) },
    { key: 'type', icon: '🔄', getText: (tr, t) => t('game.hintType', { type: tr.trailType }) },
    { key: 'activity', icon: '🏃', getText: (tr, t) => t('game.hintActivity', { activity: tr.activityType }) },
];

// Build chart data from GeoJSON coordinates
function toChartData(coords: number[][]): ChartPoint[] {
    let totalDist = 0;
    const data: ChartPoint[] = [];
    for (let i = 0; i < coords.length; i++) {
        if (i > 0) {
            const [lon1, lat1] = coords[i - 1];
            const [lon2, lat2] = coords[i];
            totalDist += haversineDist(lat1, lon1, lat2, lon2);
        }
        data.push({
            distance: totalDist / 1000,
            elevation: coords[i].length > 2 ? coords[i][2] : 0,
        });
    }
    return data;
}

function haversineDist(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function GuessByElevation() {
    const { t } = useTranslation();
    const theme = useTheme();
    const [trails, setTrails] = useState<Trail[]>([]);
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const [targetTrail, setTargetTrail] = useState<Trail | null>(null);
    const [options, setOptions] = useState<Trail[]>([]);
    const [eliminated, setEliminated] = useState<Set<string>>(new Set());
    const [usedHints, setUsedHints] = useState<HintInfo[]>([]);
    const [hintIndex, setHintIndex] = useState(0);
    const [gameState, setGameState] = useState<GameState>('loading');
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [score, setScore] = useState(0);
    const [round, setRound] = useState(1);
    const [streak, setStreak] = useState(0);
    const [hasUsedEliminate, setHasUsedEliminate] = useState(false);
    const [usedIds] = useState<{ current: Set<string> }>({ current: new Set() });
    const [lastTrigger] = useState<{ current: number }>({ current: -1 });
    const [roundTrigger, setRoundTrigger] = useState(0);
    const [cycleCharts, setCycleCharts] = useState<ChartPoint[][]>([]);

    // Load trails with meaningful elevation
    useEffect(() => {
        fetch(`${API_URL}/api/v1/trails`)
            .then(res => res.json())
            .then((data: Trail[]) =>
                setTrails(data.filter(tr => tr.elevationGain >= MIN_ELEV_GAIN))
            )
            .catch(err => console.error('Failed to load trails:', err));
    }, []);

    // Setup round
    useEffect(() => {
        if (trails.length < OPTIONS_COUNT) return;
        if (lastTrigger.current === roundTrigger) return;
        lastTrigger.current = roundTrigger;

        let cancelled = false;

        const setup = async () => {
            setGameState('loading');
            setSelectedAnswer(null);
            setEliminated(new Set());
            setUsedHints([]);
            setHintIndex(0);
            setHasUsedEliminate(false);
            setChartData([]);
            setTargetTrail(null);
            setCycleCharts([]);

            const available = trails.filter(tr => !usedIds.current.has(tr.id));
            if (available.length < OPTIONS_COUNT) {
                setGameState('finished');
                return;
            }

            const shuffled = [...available].sort(() => Math.random() - 0.5);
            const target = shuffled[0];
            const wrong = shuffled.slice(1, OPTIONS_COUNT);
            const allOpts = [target, ...wrong].sort(() => Math.random() - 0.5);

            usedIds.current.add(target.id);
            setTargetTrail(target);
            setOptions(allOpts);

            const decoyTrails = trails
                .filter(tr => tr.id !== target.id)
                .sort(() => Math.random() - 0.5)
                .slice(0, DECOY_COUNT);

            const fetchGeo = async (slug: string): Promise<GeoJsonGeometry | null> => {
                try {
                    const res = await fetch(`${API_URL}/api/v1/trails/${slug}/geometry`);
                    if (!res.ok) return null;
                    return await res.json();
                } catch { return null; }
            };

            const [targetGeo, ...decoyResults] = await Promise.all([
                fetchGeo(target.slug),
                ...decoyTrails.map(tr => fetchGeo(tr.slug)),
            ]);
            if (cancelled) return;

            if (!targetGeo?.coordinates?.length) {
                setRoundTrigger(prev => prev + 1);
                return;
            }

            const targetChart = toChartData(targetGeo.coordinates);
            const decoyCharts = decoyResults
                .filter((g): g is GeoJsonGeometry => !!g?.coordinates?.length)
                .map(g => toChartData(g.coordinates));

            if (decoyCharts.length > 0) {
                const sequence = [...decoyCharts, ...decoyCharts, targetChart].slice(0, CYCLE_DELAYS.length);
                sequence[sequence.length - 1] = targetChart;
                setCycleCharts(sequence);
                setChartData(sequence[0]);
                setGameState('cycling');
            } else {
                setChartData(targetChart);
                setGameState('playing');
            }
        };

        setup();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trails, roundTrigger]);

    // Cycling animation
    useEffect(() => {
        if (gameState !== 'cycling' || cycleCharts.length === 0) return;

        let idx = 0;
        let timer: ReturnType<typeof setTimeout>;
        const tick = () => {
            idx++;
            if (idx >= cycleCharts.length) {
                setChartData(cycleCharts[cycleCharts.length - 1]);
                setGameState('playing');
                return;
            }
            setChartData(cycleCharts[idx]);
            timer = setTimeout(tick, CYCLE_DELAYS[Math.min(idx, CYCLE_DELAYS.length - 1)]);
        };
        timer = setTimeout(tick, CYCLE_DELAYS[0]);
        return () => clearTimeout(timer);
    }, [gameState, cycleCharts]);

    // Elevation range for display
    const elevRange = useMemo(() => {
        if (chartData.length === 0) return { min: 0, max: 0, gain: 0 };
        let min = Infinity, max = -Infinity;
        for (const p of chartData) {
            if (p.elevation < min) min = p.elevation;
            if (p.elevation > max) max = p.elevation;
        }
        return { min: Math.round(min), max: Math.round(max), gain: Math.round(max - min) };
    }, [chartData]);

    const handleAnswer = (trail: Trail) => {
        if (gameState !== 'playing') return;
        setSelectedAnswer(trail.slug);

        const isCorrect = trail.slug === targetTrail?.slug;
        const base = isCorrect
            ? Math.max(MAX_SCORE - usedHints.length * HINT_PENALTY - (hasUsedEliminate ? 10 : 0), 10)
            : 0;
        const bonus = isCorrect && streak >= 4 ? 2 : isCorrect && streak >= 2 ? 1.5 : 1;
        const final = Math.round(base * bonus);

        if (isCorrect) {
            setScore(prev => prev + final);
            setStreak(prev => prev + 1);
            setGameState('correct');
        } else {
            setStreak(0);
            setGameState('wrong');
        }
    };

    const handleHint = () => {
        if (hintIndex >= HINTS.length) return;
        setUsedHints(prev => [...prev, HINTS[hintIndex]]);
        setHintIndex(prev => prev + 1);
    };

    const handleEliminate = () => {
        if (hasUsedEliminate || !targetTrail) return;
        setHasUsedEliminate(true);
        const wrong = options.filter(o => o.slug !== targetTrail.slug && !eliminated.has(o.slug));
        if (wrong.length > 0) setEliminated(new Set([wrong[0].slug]));
    };

    const handleNext = () => {
        if (round >= TOTAL_ROUNDS) {
            setGameState('finished');
        } else {
            setRound(prev => prev + 1);
            setRoundTrigger(prev => prev + 1);
        }
    };

    const handleRestart = () => {
        setScore(0);
        setRound(1);
        setStreak(0);
        usedIds.current = new Set();
        setRoundTrigger(prev => prev + 1);
    };

    const fireConfetti = useCallback(() => {
        const end = Date.now() + 2500;
        const colors = ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB'];
        const frame = () => {
            confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
            confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
            if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
    }, []);

    useEffect(() => {
        if (gameState !== 'finished') return;
        const pct = Math.round((score / (TOTAL_ROUNDS * MAX_SCORE)) * 100);
        if (pct >= 100) fireConfetti();
    }, [gameState, score, fireConfetti]);

    // Finished screen
    if (gameState === 'finished') {
        const maxPossible = TOTAL_ROUNDS * MAX_SCORE;
        const pct = Math.round((score / maxPossible) * 100);
        const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '🎉' : pct >= 40 ? '👍' : '🤔';

        return (
            <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
                <Typography sx={{ fontSize: '4rem', mb: 1 }}>{emoji}</Typography>
                <Typography variant="h4" gutterBottom fontWeight="bold">{t('game.gameOver')}</Typography>
                <Typography variant="h5" color="primary" gutterBottom>
                    {t('game.finalScore', { score, max: maxPossible })}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {pct >= 80 ? t('game.resultExcellent') :
                     pct >= 60 ? t('game.resultGood') :
                     pct >= 40 ? t('game.resultOk') :
                     t('game.resultTryAgain')}
                </Typography>
                <Button variant="contained" size="large" startIcon={<ReplayIcon />}
                    onClick={handleRestart} sx={{ borderRadius: 2 }}>
                    {t('game.playAgain')}
                </Button>
            </Paper>
        );
    }

    // Loading
    if (gameState === 'loading' || !targetTrail || chartData.length === 0) {
        return (
            <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
                <Typography variant="h6" gutterBottom>{t('game.loading')}</Typography>
                <LinearProgress sx={{ borderRadius: 1 }} />
            </Paper>
        );
    }

    const isCycling = gameState === 'cycling';
    const potentialScore = Math.max(MAX_SCORE - usedHints.length * HINT_PENALTY - (hasUsedEliminate ? 10 : 0), 10);

    return (
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, overflow: 'hidden' }}>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label={t('game.roundOf', { round, total: TOTAL_ROUNDS })} size="small" color="primary" variant="outlined" />
                    {streak >= 2 && <Chip label={`🔥 ${streak}`} size="small" color="warning" />}
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <TrophyIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight="bold">{score}</Typography>
                </Stack>
            </Stack>

            <Typography variant="h6" gutterBottom textAlign="center" sx={{ mb: 1 }}>
                📈 {t('elevationGame.guessTitle')}
            </Typography>

            {/* Elevation chart */}
            <Box sx={{
                height: { xs: 200, sm: 250 },
                borderRadius: 2, overflow: 'hidden', mb: 1,
                border: 1, borderColor: 'divider',
                bgcolor: theme.palette.mode === 'dark' ? '#1a1a2e' : '#f8f9fa',
                px: 1, pt: 1,
            }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={isCycling ? '#90caf9' : theme.palette.primary.main} stopOpacity={0.6} />
                                <stop offset="95%" stopColor={isCycling ? '#90caf9' : theme.palette.primary.main} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="distance" type="number" domain={['dataMin', 'dataMax']}
                            tickFormatter={(v: number) => `${v.toFixed(1)}`} fontSize={11}
                            stroke={theme.palette.text.secondary} tick={{ fill: theme.palette.text.secondary }} />
                        <YAxis dataKey="elevation" domain={['auto', 'auto']}
                            tickFormatter={(v: number) => `${v}`} fontSize={11}
                            stroke={theme.palette.text.secondary} tick={{ fill: theme.palette.text.secondary }} />
                        <Area type="monotone" dataKey="elevation"
                            stroke={isCycling ? '#90caf9' : theme.palette.primary.main}
                            strokeWidth={isCycling ? 1.5 : 2.5}
                            fillOpacity={1} fill="url(#elevFill)" isAnimationActive={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </Box>

            {/* Elevation stats */}
            <Stack direction="row" justifyContent="center" spacing={1} sx={{ mb: 2 }}>
                <Chip label={`▼ ${elevRange.min} m`} size="small" variant="outlined" />
                <Chip label={`▲ ${elevRange.max} m`} size="small" variant="outlined" />
                <Chip label={`↕ ${elevRange.gain} m`} size="small" variant="outlined" />
            </Stack>

            {/* Hints */}
            <Collapse in={usedHints.length > 0}>
                <Stack spacing={0.5} sx={{ mb: 2 }}>
                    {usedHints.map(hint => (
                        <Fade in key={hint.key}>
                            <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                                {hint.icon} {hint.getText(targetTrail, t)}
                            </Typography>
                        </Fade>
                    ))}
                </Stack>
            </Collapse>

            {/* Answer options */}
            <Stack spacing={1} sx={{ mb: 2 }}>
                {options.map(option => {
                    const isElim = eliminated.has(option.slug);
                    const isSel = selectedAnswer === option.slug;
                    const isTarget = option.slug === targetTrail.slug;
                    const isRevealed = gameState === 'correct' || gameState === 'wrong';

                    let color: 'primary' | 'success' | 'error' | 'inherit' = 'primary';
                    let variant: 'outlined' | 'contained' = 'outlined';

                    if (isRevealed && isTarget) { color = 'success'; variant = 'contained'; }
                    else if (isRevealed && isSel && !isTarget) { color = 'error'; variant = 'contained'; }

                    return (
                        <Button key={option.slug} variant={variant} color={color} fullWidth
                            onClick={() => handleAnswer(option)}
                            disabled={gameState !== 'playing' || isElim}
                            sx={{
                                borderRadius: 2, py: 1.2, textTransform: 'none', fontSize: '1rem',
                                opacity: isElim ? 0.3 : isCycling ? 0.5 : 1,
                                textDecoration: isElim ? 'line-through' : 'none',
                                transition: 'opacity 0.3s',
                            }}>
                            {option.name}
                        </Button>
                    );
                })}
            </Stack>

            {/* Power-ups */}
            {gameState === 'playing' && (
                <Stack direction="row" justifyContent="center" spacing={1} sx={{ mb: 1 }}>
                    <Tooltip title={t('game.useHint')} arrow>
                        <span>
                            <IconButton onClick={handleHint} disabled={hintIndex >= HINTS.length} color="warning" size="small">
                                <HintIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={t('game.eliminateOne')} arrow>
                        <span>
                            <IconButton onClick={handleEliminate} disabled={hasUsedEliminate} color="error" size="small">
                                <EliminateIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                        {t('game.potentialScore', { points: potentialScore })}
                    </Typography>
                </Stack>
            )}

            {/* Result + Next */}
            {(gameState === 'correct' || gameState === 'wrong') && (
                <Fade in>
                    <Stack alignItems="center" spacing={1}>
                        <Typography variant="h6" fontWeight="bold"
                            color={gameState === 'correct' ? 'success.main' : 'error.main'}>
                            {gameState === 'correct' ? `✅ ${t('game.correct')}` : `❌ ${t('game.wrong')}`}
                        </Typography>
                        {gameState === 'correct' && (
                            <Typography variant="body2" color="text.secondary">
                                +{Math.max(MAX_SCORE - usedHints.length * HINT_PENALTY - (hasUsedEliminate ? 10 : 0), 10)}
                                {streak >= 2 && ` (×${streak >= 4 ? '2' : '1.5'} 🔥)`}
                            </Typography>
                        )}
                        <Button variant="contained" endIcon={<NextIcon />} onClick={handleNext}
                            sx={{ borderRadius: 2, mt: 1 }}>
                            {round >= TOTAL_ROUNDS ? t('game.seeResults') : t('game.nextRound')}
                        </Button>
                    </Stack>
                </Fade>
            )}
        </Paper>
    );
}
