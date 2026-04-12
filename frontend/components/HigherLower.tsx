import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Button, Stack, Paper, Chip, Fade, useTheme
} from '@mui/material';
import {
    ArrowUpward as HigherIcon,
    ArrowDownward as LowerIcon,
    Replay as ReplayIcon,
    EmojiEvents as TrophyIcon,
    DragHandle as SameIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import type { Trail } from '../hooks/useTrails';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type StatKey = 'distance' | 'elevation' | 'elevationLoss';
type GamePhase = 'loading' | 'playing' | 'revealing' | 'gameover';

interface StatDef {
    key: StatKey;
    icon: string;
    getValue: (t: Trail) => number;
    format: (v: number) => string;
}

const STATS: StatDef[] = [
    {
        key: 'distance',
        icon: '📏',
        getValue: (t) => t.length / 1000,
        format: (v) => `${v.toFixed(1)} km`,
    },
    {
        key: 'elevation',
        icon: '⛰️',
        getValue: (t) => t.elevationGain,
        format: (v) => `${Math.round(v)} m`,
    },
    {
        key: 'elevationLoss',
        icon: '⬇️',
        getValue: (t) => t.elevationLoss,
        format: (v) => `${Math.round(v)} m`,
    },
];

const HIGH_SCORE_KEY = 'utanvega-hl-highscore';
const SAME_THRESHOLD = 0.02; // values within 2% count as "same"
const REVEAL_DELAY = 1500;

function getHighScore(): number {
    try { return parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10); }
    catch { return 0; }
}
function setHighScore(score: number) {
    try { localStorage.setItem(HIGH_SCORE_KEY, String(score)); }
    catch { /* ignore */ }
}

export default function HigherLower() {
    const { t } = useTranslation();
    const theme = useTheme();
    const [trails, setTrails] = useState<Trail[]>([]);
    const [leftTrail, setLeftTrail] = useState<Trail | null>(null);
    const [rightTrail, setRightTrail] = useState<Trail | null>(null);
    const [activeStat, setActiveStat] = useState<StatDef>(STATS[0]);
    const [phase, setPhase] = useState<GamePhase>('loading');
    const [score, setScore] = useState(0);
    const [highScore, setHighScoreState] = useState(getHighScore());
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [usedIds, setUsedIds] = useState<Set<string>>(new Set());

    // Load trails
    useEffect(() => {
        fetch(`${API_URL}/api/v1/trails`)
            .then(res => res.json())
            .then((data: Trail[]) => setTrails(data))
            .catch(err => console.error('Failed to load trails:', err));
    }, []);

    const pickRandom = useCallback((exclude: Set<string>): Trail | null => {
        const available = trails.filter(t => !exclude.has(t.id));
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    }, [trails]);

    const startGame = useCallback(() => {
        if (trails.length < 2) return;
        const stat = STATS[Math.floor(Math.random() * STATS.length)];
        const left = pickRandom(new Set());
        if (!left) return;
        const right = pickRandom(new Set([left.id]));
        if (!right) return;
        setActiveStat(stat);
        setLeftTrail(left);
        setRightTrail(right);
        setUsedIds(new Set([left.id, right.id]));
        setScore(0);
        setIsCorrect(null);
        setPhase('playing');
    }, [trails, pickRandom]);

    // Auto-start when trails load
    useEffect(() => {
        if (trails.length >= 2 && phase === 'loading') startGame();
    }, [trails, phase, startGame]);

    const handleGuess = (guess: 'higher' | 'lower' | 'same') => {
        if (phase !== 'playing' || !leftTrail || !rightTrail) return;

        const leftVal = activeStat.getValue(leftTrail);
        const rightVal = activeStat.getValue(rightTrail);

        const diff = Math.abs(rightVal - leftVal);
        const avg = (rightVal + leftVal) / 2;
        const isSame = avg > 0 ? diff / avg < SAME_THRESHOLD : diff === 0;

        let correct = false;
        if (isSame) {
            correct = guess === 'same';
        } else if (rightVal > leftVal) {
            correct = guess === 'higher';
        } else {
            correct = guess === 'lower';
        }

        setIsCorrect(correct);
        setPhase('revealing');

        if (correct) {
            const newScore = score + 1;
            setScore(newScore);
            if (newScore > highScore) {
                setHighScoreState(newScore);
                setHighScore(newScore);
            }

            // Advance after reveal delay
            setTimeout(() => {
                const newUsed = new Set(usedIds);
                // Pick new stat for variety
                const newStat = STATS[Math.floor(Math.random() * STATS.length)];
                const next = pickRandom(newUsed);
                if (!next) {
                    // Ran out of trails — reset pool keeping current right trail
                    const freshUsed = new Set([rightTrail.id]);
                    const freshNext = pickRandom(freshUsed);
                    if (!freshNext) {
                        setPhase('gameover');
                        return;
                    }
                    freshUsed.add(freshNext.id);
                    setUsedIds(freshUsed);
                    setLeftTrail(rightTrail);
                    setRightTrail(freshNext);
                } else {
                    newUsed.add(next.id);
                    setUsedIds(newUsed);
                    setLeftTrail(rightTrail);
                    setRightTrail(next);
                }
                setActiveStat(newStat);
                setIsCorrect(null);
                setPhase('playing');
            }, REVEAL_DELAY);
        } else {
            // Game over after reveal
            setTimeout(() => {
                if (score >= 10) {
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#FFD700', '#FFA500', '#FF6347'],
                    });
                }
                setPhase('gameover');
            }, REVEAL_DELAY);
        }
    };

    // Game over screen
    if (phase === 'gameover') {
        const emoji = score >= 15 ? '🏆' : score >= 10 ? '🎉' : score >= 5 ? '👍' : '🤔';
        const isNewRecord = score >= highScore && score > 0;

        return (
            <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
                <Typography sx={{ fontSize: '4rem', mb: 1 }}>{emoji}</Typography>
                <Typography variant="h4" gutterBottom fontWeight="bold">
                    {t('higherLower.gameOver')}
                </Typography>
                {isNewRecord && (
                    <Chip
                        label={t('higherLower.newRecord')}
                        color="warning"
                        icon={<TrophyIcon />}
                        sx={{ mb: 2, fontSize: '1rem' }}
                    />
                )}
                <Typography variant="h5" color="primary" gutterBottom>
                    {t('higherLower.streak', { count: score })}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {t('higherLower.bestStreak', { count: highScore })}
                </Typography>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<ReplayIcon />}
                    onClick={startGame}
                    sx={{ borderRadius: 2 }}
                >
                    {t('higherLower.playAgain')}
                </Button>
            </Paper>
        );
    }

    // Loading
    if (phase === 'loading' || !leftTrail || !rightTrail) {
        return (
            <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
                <Typography variant="h6">{t('game.loading')}</Typography>
            </Paper>
        );
    }

    const leftVal = activeStat.getValue(leftTrail);
    const rightVal = activeStat.getValue(rightTrail);
    const isRevealing = phase === 'revealing';
    const statLabel = t(`higherLower.stat.${activeStat.key}`);

    const cardSx = (highlight?: 'success' | 'error') => ({
        p: { xs: 2, sm: 3 },
        borderRadius: 3,
        flex: 1,
        textAlign: 'center' as const,
        border: 2,
        borderColor: highlight === 'success' ? 'success.main' :
                     highlight === 'error' ? 'error.main' : 'divider',
        bgcolor: highlight === 'success' ? 'success.main' :
                 highlight === 'error' ? 'error.main' : 'background.paper',
        color: highlight ? 'common.white' : 'text.primary',
        transition: 'all 0.4s ease',
    });

    return (
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Chip
                    label={`${activeStat.icon} ${statLabel}`}
                    color="primary"
                    variant="outlined"
                    size="small"
                />
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <TrophyIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight="bold">{score}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        / {highScore}
                    </Typography>
                </Stack>
            </Stack>

            <Typography variant="h6" textAlign="center" sx={{ mb: 2 }}>
                {t('higherLower.question', { stat: statLabel.toLowerCase() })}
            </Typography>

            {/* Two trail cards */}
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ mb: 3 }}
            >
                {/* Left card — always revealed */}
                <Paper elevation={2} sx={cardSx()}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {leftTrail.locations?.[0]?.name || ''}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                        {leftTrail.name}
                    </Typography>
                    <Typography
                        variant="h4"
                        fontWeight="bold"
                        color="primary"
                    >
                        {activeStat.format(leftVal)}
                    </Typography>
                </Paper>

                {/* VS divider */}
                <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    px: 1,
                }}>
                    <Typography
                        variant="h5"
                        fontWeight="bold"
                        sx={{
                            bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
                            borderRadius: '50%',
                            width: 48, height: 48,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        VS
                    </Typography>
                </Box>

                {/* Right card — hidden until revealed */}
                <Paper
                    elevation={2}
                    sx={cardSx(
                        isRevealing
                            ? (isCorrect ? 'success' : 'error')
                            : undefined
                    )}
                >
                    <Typography
                        variant="subtitle2"
                        sx={{ mb: 0.5, opacity: 0.7 }}
                    >
                        {rightTrail.locations?.[0]?.name || ''}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                        {rightTrail.name}
                    </Typography>
                    <Fade in={isRevealing} timeout={400}>
                        <Typography
                            variant="h4"
                            fontWeight="bold"
                            sx={{ color: isRevealing ? 'inherit' : 'transparent' }}
                        >
                            {isRevealing ? activeStat.format(rightVal) : '???'}
                        </Typography>
                    </Fade>
                    {!isRevealing && (
                        <Typography variant="h4" fontWeight="bold" color="text.disabled">
                            ???
                        </Typography>
                    )}
                </Paper>
            </Stack>

            {/* Answer buttons */}
            {phase === 'playing' && (
                <Stack direction="row" spacing={1} justifyContent="center">
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<HigherIcon />}
                        onClick={() => handleGuess('higher')}
                        sx={{ borderRadius: 2, flex: 1, maxWidth: 160, textTransform: 'none' }}
                    >
                        {t('higherLower.higher')}
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<SameIcon />}
                        onClick={() => handleGuess('same')}
                        sx={{ borderRadius: 2, textTransform: 'none', minWidth: 80 }}
                    >
                        ≈
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<LowerIcon />}
                        onClick={() => handleGuess('lower')}
                        sx={{ borderRadius: 2, flex: 1, maxWidth: 160, textTransform: 'none' }}
                    >
                        {t('higherLower.lower')}
                    </Button>
                </Stack>
            )}

            {/* Reveal result */}
            {isRevealing && (
                <Fade in>
                    <Typography
                        variant="h6"
                        textAlign="center"
                        fontWeight="bold"
                        color={isCorrect ? 'success.main' : 'error.main'}
                        sx={{ mt: 2 }}
                    >
                        {isCorrect ? `✅ ${t('game.correct')}` : `❌ ${t('game.wrong')}`}
                    </Typography>
                </Fade>
            )}
        </Paper>
    );
}
