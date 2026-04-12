import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box, Typography, Button, Stack, Chip, Paper, Fade,
    LinearProgress, IconButton, Tooltip, Collapse, useTheme
} from '@mui/material';
import {
    EmojiEvents as TrophyIcon,
    Lightbulb as HintIcon,
    RemoveCircleOutline as EliminateIcon,
    Replay as ReplayIcon,
    NavigateNext as NextIcon
} from '@mui/icons-material';
import { MapContainer, Polyline, useMap } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import 'leaflet/dist/leaflet.css';
import type { Trail } from '../hooks/useTrails';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type GeoJsonGeometry = {
    type: string;
    coordinates: number[][]; // [lon, lat, ele]
};

type GameState = 'loading' | 'cycling' | 'playing' | 'correct' | 'wrong' | 'finished';

interface HintInfo {
    key: string;
    icon: string;
    getText: (trail: Trail, t: (key: string, options?: Record<string, unknown>) => string) => string;
}

const HINTS: HintInfo[] = [
    {
        key: 'location',
        icon: '🗺️',
        getText: (trail, t) => {
            const loc = trail.locations?.[0]?.name || t('game.unknownLocation');
            return t('game.hintLocation', { location: loc });
        },
    },
    {
        key: 'distance',
        icon: '📏',
        getText: (trail, t) => t('game.hintDistance', { distance: (trail.length / 1000).toFixed(1) }),
    },
    {
        key: 'elevation',
        icon: '⛰️',
        getText: (trail, t) => t('game.hintElevation', { gain: Math.round(trail.elevationGain) }),
    },
    {
        key: 'type',
        icon: '🔄',
        getText: (trail, t) => t('game.hintType', { type: trail.trailType }),
    },
    {
        key: 'activity',
        icon: '🏃',
        getText: (trail, t) => t('game.hintActivity', { activity: trail.activityType }),
    },
];

const MAX_SCORE_PER_ROUND = 100;
const HINT_PENALTY = 20;
const TOTAL_ROUNDS = 5;
const OPTIONS_COUNT = 4;
const DECOY_COUNT = 4;
// Slot-machine effect: starts fast, gradually slows down before settling
const CYCLE_DELAYS = [80, 80, 100, 100, 120, 150, 200, 300, 450];

function FitBounds({ positions }: { positions: LatLngTuple[] }) {
    const map = useMap();
    useEffect(() => {
        if (positions.length > 1) {
            const bounds = L.latLngBounds(positions);
            map.fitBounds(bounds, { padding: [30, 30], animate: false });
        }
    }, [map, positions]);
    return null;
}

export default function GuessTheTrail() {
    const { t } = useTranslation();
    const theme = useTheme();
    const [trails, setTrails] = useState<Trail[]>([]);
    const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
    const [targetTrail, setTargetTrail] = useState<Trail | null>(null);
    const [options, setOptions] = useState<Trail[]>([]);
    const [eliminated, setEliminated] = useState<Set<string>>(new Set());
    const [usedHints, setUsedHints] = useState<HintInfo[]>([]);
    const [availableHintIndex, setAvailableHintIndex] = useState(0);
    const [gameState, setGameState] = useState<GameState>('loading');
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [score, setScore] = useState(0);
    const [round, setRound] = useState(1);
    const [usedTrailIdsRef] = useState<{ current: Set<string> }>({ current: new Set() });
    const [lastProcessedTrigger] = useState<{ current: number }>({ current: -1 });
    const [hasUsedEliminate, setHasUsedEliminate] = useState(false);
    const [streak, setStreak] = useState(0);
    const [roundTrigger, setRoundTrigger] = useState(0);
    const [cycleGeometries, setCycleGeometries] = useState<GeoJsonGeometry[]>([]);

    // Load all trails once
    useEffect(() => {
        fetch(`${API_URL}/api/v1/trails`)
            .then(res => res.json())
            .then((data: Trail[]) => setTrails(data))
            .catch(err => console.error('Failed to load trails:', err));
    }, []);

    // Setup round whenever roundTrigger changes (and trails are loaded)
    useEffect(() => {
        if (trails.length < OPTIONS_COUNT) return;
        if (lastProcessedTrigger.current === roundTrigger) return;
        lastProcessedTrigger.current = roundTrigger;

        let cancelled = false;

        const doSetup = async () => {
            setGameState('loading');
            setSelectedAnswer(null);
            setEliminated(new Set());
            setUsedHints([]);
            setAvailableHintIndex(0);
            setHasUsedEliminate(false);
            setGeometry(null);
            setTargetTrail(null);
            setCycleGeometries([]);

            const available = trails.filter(t => !usedTrailIdsRef.current.has(t.id));
            if (available.length < OPTIONS_COUNT) {
                setGameState('finished');
                return;
            }

            const shuffled = [...available].sort(() => Math.random() - 0.5);
            const target = shuffled[0];
            const wrongOptions = shuffled.slice(1, OPTIONS_COUNT);
            const allOptions = [target, ...wrongOptions].sort(() => Math.random() - 0.5);

            usedTrailIdsRef.current.add(target.id);
            setTargetTrail(target);
            setOptions(allOptions);

            // Fetch target geometry + decoy geometries for cycling animation
            const decoyTrails = trails
                .filter(t => t.id !== target.id)
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
                ...decoyTrails.map(t => fetchGeo(t.slug)),
            ]);
            if (cancelled) return;

            if (!targetGeo) {
                setRoundTrigger(prev => prev + 1);
                return;
            }

            const decoyGeos = decoyResults.filter((g): g is GeoJsonGeometry => g !== null);

            if (decoyGeos.length > 0) {
                // Build cycling sequence: decoys shuffled, ending with target
                const sequence = [...decoyGeos, ...decoyGeos, targetGeo]
                    .slice(0, CYCLE_DELAYS.length);
                // Ensure target is always last
                sequence[sequence.length - 1] = targetGeo;
                setCycleGeometries(sequence);
                setGeometry(sequence[0]);
                setGameState('cycling');
            } else {
                setGeometry(targetGeo);
                setGameState('playing');
            }
        };

        doSetup();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trails, roundTrigger]);

    // Cycling animation — slot machine effect
    useEffect(() => {
        if (gameState !== 'cycling' || cycleGeometries.length === 0) return;

        let frameIndex = 0;
        let timer: ReturnType<typeof setTimeout>;

        const tick = () => {
            frameIndex++;
            if (frameIndex >= cycleGeometries.length) {
                setGeometry(cycleGeometries[cycleGeometries.length - 1]);
                setGameState('playing');
                return;
            }
            setGeometry(cycleGeometries[frameIndex]);
            const delay = CYCLE_DELAYS[Math.min(frameIndex, CYCLE_DELAYS.length - 1)];
            timer = setTimeout(tick, delay);
        };

        timer = setTimeout(tick, CYCLE_DELAYS[0]);
        return () => clearTimeout(timer);
    }, [gameState, cycleGeometries]);

    const polylinePositions: LatLngTuple[] = useMemo(() => {
        if (!geometry?.coordinates) return [];
        return geometry.coordinates.map(c => [c[1], c[0]] as LatLngTuple);
    }, [geometry]);

    const handleAnswer = (trail: Trail) => {
        if (gameState !== 'playing') return;
        setSelectedAnswer(trail.slug);

        const isCorrect = trail.slug === targetTrail?.slug;
        const roundScore = isCorrect
            ? Math.max(MAX_SCORE_PER_ROUND - usedHints.length * HINT_PENALTY - (hasUsedEliminate ? 10 : 0), 10)
            : 0;

        const streakBonus = isCorrect && streak >= 4 ? 2 : isCorrect && streak >= 2 ? 1.5 : 1;
        const finalScore = Math.round(roundScore * streakBonus);

        if (isCorrect) {
            setScore(prev => prev + finalScore);
            setStreak(prev => prev + 1);
            setGameState('correct');
        } else {
            setStreak(0);
            setGameState('wrong');
        }
    };

    const handleHint = () => {
        if (availableHintIndex >= HINTS.length) return;
        setUsedHints(prev => [...prev, HINTS[availableHintIndex]]);
        setAvailableHintIndex(prev => prev + 1);
    };

    const handleEliminate = () => {
        if (hasUsedEliminate || !targetTrail) return;
        setHasUsedEliminate(true);
        const wrongOptions = options.filter(o => o.slug !== targetTrail.slug && !eliminated.has(o.slug));
        if (wrongOptions.length > 0) {
            setEliminated(new Set([wrongOptions[0].slug]));
        }
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
        usedTrailIdsRef.current = new Set();
        setRoundTrigger(prev => prev + 1);
    };

    const fireConfetti = useCallback(() => {
        const duration = 2500;
        const end = Date.now() + duration;
        const colors = ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB'];

        const frame = () => {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.7 },
                colors,
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.7 },
                colors,
            });
            if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
    }, []);

    // Fire confetti on perfect score
    useEffect(() => {
        if (gameState !== 'finished') return;
        const maxPossible = TOTAL_ROUNDS * MAX_SCORE_PER_ROUND;
        const percentage = Math.round((score / maxPossible) * 100);
        if (percentage >= 100) fireConfetti();
    }, [gameState, score, fireConfetti]);

    // Finished screen
    if (gameState === 'finished') {
        const maxPossible = TOTAL_ROUNDS * MAX_SCORE_PER_ROUND;
        const percentage = Math.round((score / maxPossible) * 100);
        const emoji = percentage >= 80 ? '🏆' : percentage >= 60 ? '🎉' : percentage >= 40 ? '👍' : '🤔';

        return (
            <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
                <Typography sx={{ fontSize: '4rem', mb: 1 }}>{emoji}</Typography>
                <Typography variant="h4" gutterBottom fontWeight="bold">
                    {t('game.gameOver')}
                </Typography>
                <Typography variant="h5" color="primary" gutterBottom>
                    {t('game.finalScore', { score, max: maxPossible })}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {percentage >= 80 ? t('game.resultExcellent') :
                     percentage >= 60 ? t('game.resultGood') :
                     percentage >= 40 ? t('game.resultOk') :
                     t('game.resultTryAgain')}
                </Typography>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<ReplayIcon />}
                    onClick={handleRestart}
                    sx={{ borderRadius: 2 }}
                >
                    {t('game.playAgain')}
                </Button>
            </Paper>
        );
    }

    // Loading
    if (gameState === 'loading' || !targetTrail || !geometry) {
        return (
            <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
                <Typography variant="h6" gutterBottom>{t('game.loading')}</Typography>
                <LinearProgress sx={{ borderRadius: 1 }} />
            </Paper>
        );
    }

    const isCycling = gameState === 'cycling';
    const potentialScore = Math.max(MAX_SCORE_PER_ROUND - usedHints.length * HINT_PENALTY - (hasUsedEliminate ? 10 : 0), 10);
    const mapBg = theme.palette.mode === 'dark' ? '#1a1a2e' : '#f5f5f5';

    return (
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, overflow: 'hidden' }}>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                        label={t('game.roundOf', { round, total: TOTAL_ROUNDS })}
                        size="small"
                        color="primary"
                        variant="outlined"
                    />
                    {streak >= 2 && (
                        <Chip
                            label={`🔥 ${streak}`}
                            size="small"
                            color="warning"
                        />
                    )}
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <TrophyIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight="bold">{score}</Typography>
                </Stack>
            </Stack>

            <Typography variant="h6" gutterBottom textAlign="center" sx={{ mb: 1 }}>
                {t('game.guessTitle')}
            </Typography>

            {/* Map with route only (no tiles) */}
            <Box
                sx={{
                    height: { xs: 220, sm: 280 },
                    borderRadius: 2,
                    overflow: 'hidden',
                    mb: 2,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                }}
            >
                {polylinePositions.length > 0 && (
                    <MapContainer
                        key={`round-${round}`}
                        center={polylinePositions[0]}
                        zoom={13}
                        style={{ height: '100%', width: '100%', background: mapBg }}
                        zoomControl={false}
                        attributionControl={false}
                        dragging={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        touchZoom={false}
                    >
                        <FitBounds positions={polylinePositions} />
                        <Polyline
                            positions={polylinePositions}
                            pathOptions={{
                                color: isCycling ? '#90caf9' : '#2196f3',
                                weight: isCycling ? 2 : 3,
                                opacity: isCycling ? 0.6 : 0.9,
                            }}
                        />
                    </MapContainer>
                )}
            </Box>

            {/* Hints displayed */}
            <Collapse in={usedHints.length > 0}>
                <Stack spacing={0.5} sx={{ mb: 2 }}>
                    {usedHints.map((hint) => (
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
                {options.map((option) => {
                    const isEliminated = eliminated.has(option.slug);
                    const isSelected = selectedAnswer === option.slug;
                    const isTarget = option.slug === targetTrail.slug;
                    const isRevealed = gameState === 'correct' || gameState === 'wrong';

                    let color: 'primary' | 'success' | 'error' | 'inherit' = 'primary';
                    let variant: 'outlined' | 'contained' = 'outlined';

                    if (isRevealed && isTarget) {
                        color = 'success';
                        variant = 'contained';
                    } else if (isRevealed && isSelected && !isTarget) {
                        color = 'error';
                        variant = 'contained';
                    }

                    return (
                        <Button
                            key={option.slug}
                            variant={variant}
                            color={color}
                            fullWidth
                            onClick={() => handleAnswer(option)}
                            disabled={gameState !== 'playing' || isEliminated}
                            sx={{
                                borderRadius: 2,
                                py: 1.2,
                                textTransform: 'none',
                                fontSize: '1rem',
                                opacity: isEliminated ? 0.3 : isCycling ? 0.5 : 1,
                                textDecoration: isEliminated ? 'line-through' : 'none',
                                transition: 'opacity 0.3s',
                            }}
                        >
                            {option.name}
                        </Button>
                    );
                })}
            </Stack>

            {/* Power-ups (only during playing) */}
            {gameState === 'playing' && (
                <Stack direction="row" justifyContent="center" spacing={1} sx={{ mb: 1 }}>
                    <Tooltip title={t('game.useHint')} arrow>
                        <span>
                            <IconButton
                                onClick={handleHint}
                                disabled={availableHintIndex >= HINTS.length}
                                color="warning"
                                size="small"
                            >
                                <HintIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={t('game.eliminateOne')} arrow>
                        <span>
                            <IconButton
                                onClick={handleEliminate}
                                disabled={hasUsedEliminate}
                                color="error"
                                size="small"
                            >
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
                        <Typography
                            variant="h6"
                            color={gameState === 'correct' ? 'success.main' : 'error.main'}
                            fontWeight="bold"
                        >
                            {gameState === 'correct' ? `✅ ${t('game.correct')}` : `❌ ${t('game.wrong')}`}
                        </Typography>
                        {gameState === 'correct' && (
                            <Typography variant="body2" color="text.secondary">
                                +{Math.max(MAX_SCORE_PER_ROUND - usedHints.length * HINT_PENALTY - (hasUsedEliminate ? 10 : 0), 10)}
                                {streak >= 2 && ` (×${streak >= 4 ? '2' : '1.5'} 🔥)`}
                            </Typography>
                        )}
                        <Button
                            variant="contained"
                            endIcon={<NextIcon />}
                            onClick={handleNext}
                            sx={{ borderRadius: 2, mt: 1 }}
                        >
                            {round >= TOTAL_ROUNDS ? t('game.seeResults') : t('game.nextRound')}
                        </Button>
                    </Stack>
                </Fade>
            )}
        </Paper>
    );
}
