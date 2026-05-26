import { useMemo } from 'react';
import { Box, LinearProgress, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface RaceProgressBarProps {
    startTime: string; // "HH:MM" or "HH:MM:SS"
    dateOfRace: string; // "YYYY-MM-DD"
    cutoffMinutes: number;
    now: Date;
}

function formatElapsed(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function RaceProgressBar({ startTime, dateOfRace, cutoffMinutes, now }: RaceProgressBarProps) {
    const { t } = useTranslation();
    const theme = useTheme();

    const { startDate, endDate, elapsed, total, progress, phase } = useMemo(() => {
        const parts = startTime.split(':').map(Number);
        const [h, m, s = 0] = parts;
        const start = new Date(dateOfRace + 'T00:00:00');
        start.setHours(h, m, s, 0);
        const end = new Date(start.getTime() + cutoffMinutes * 60 * 1000);
        const totalMs = cutoffMinutes * 60 * 1000;
        const elapsedMs = Math.max(0, now.getTime() - start.getTime());
        const pct = Math.min(100, (elapsedMs / totalMs) * 100);

        let p: 'waiting' | 'early' | 'mid' | 'late' | 'final' | 'done';
        if (elapsedMs <= 0) p = 'waiting';
        else if (pct <= 25) p = 'early';
        else if (pct <= 50) p = 'mid';
        else if (pct <= 80) p = 'late';
        else if (pct < 100) p = 'final';
        else p = 'done';

        return { startDate: start, endDate: end, elapsed: elapsedMs, total: totalMs, progress: pct, phase: p };
    }, [startTime, dateOfRace, cutoffMinutes, now]);

    const progressColor = useMemo(() => {
        if (phase === 'waiting') return theme.palette.grey[400];
        if (phase === 'early') return theme.palette.success.main;
        if (phase === 'mid') return theme.palette.success.light;
        if (phase === 'late') return theme.palette.warning.main;
        if (phase === 'final') return theme.palette.error.main;
        return theme.palette.grey[500];
    }, [phase, theme]);

    const remaining = Math.max(0, total - elapsed);

    return (
        <Box sx={{ mt: 1.5, mb: 1 }}>
            {/* Time labels */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    🟢 {formatTime(startDate)}
                </Typography>
                {phase !== 'waiting' && phase !== 'done' && (
                    <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{
                            color: progressColor,
                            animation: phase === 'final' ? 'pulse 1.5s ease-in-out infinite' : undefined,
                            '@keyframes pulse': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0.6 },
                            },
                        }}
                    >
                        ⏱️ {formatElapsed(elapsed)}
                    </Typography>
                )}
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    🏁 {formatTime(endDate)}
                </Typography>
            </Box>

            {/* Progress bar */}
            <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    '& .MuiLinearProgress-bar': {
                        borderRadius: 5,
                        bgcolor: progressColor,
                        transition: 'transform 0.5s ease, background-color 1s ease',
                        ...(phase === 'final' && {
                            animation: 'pulse-bar 1.5s ease-in-out infinite',
                            '@keyframes pulse-bar': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0.75 },
                            },
                        }),
                    },
                }}
            />

            {/* Milestone markers */}
            <Box sx={{ position: 'relative', height: 12, mt: -1.2 }}>
                {[25, 50, 75].map(pct => (
                    <Box
                        key={pct}
                        sx={{
                            position: 'absolute',
                            left: `${pct}%`,
                            top: 0,
                            transform: 'translateX(-50%)',
                            width: 2,
                            height: 10,
                            bgcolor: theme.palette.divider,
                            borderRadius: 1,
                        }}
                    />
                ))}
            </Box>

            {/* Status text */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                {phase === 'waiting' ? (
                    <Typography variant="caption" color="text.secondary">
                        {t('races.progressBar.waiting', { defaultValue: 'Waiting for start...' })}
                    </Typography>
                ) : phase === 'done' ? (
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {t('races.progressBar.cutoffReached', { defaultValue: 'Cutoff time reached' })}
                    </Typography>
                ) : (
                    <>
                        <Typography variant="caption" color="text.secondary">
                            {Math.round(progress)}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {t('races.progressBar.remaining', {
                                time: formatElapsed(remaining),
                                defaultValue: `${formatElapsed(remaining)} remaining`,
                            })}
                        </Typography>
                    </>
                )}
            </Box>
        </Box>
    );
}
