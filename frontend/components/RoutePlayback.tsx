import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Box, IconButton, ToggleButtonGroup, ToggleButton, Typography, LinearProgress, Stack } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import { useTranslation } from 'react-i18next';
import { haversineKm } from '../utils/geo';

interface CumulativeStats {
    distance: number; // km
    elevation: number; // m
    gain: number; // m
    loss: number; // m
    highPoint: number; // m — highest elevation seen so far
    lowPoint: number; // m — lowest elevation seen so far
}



interface RoutePlaybackProps {
    /** GeoJSON coordinates [lon, lat, ele] */
    coordinates: number[][];
    /** Called on each animation frame with the current point (or null on stop) */
    onPointChange: (point: { lat: number; lng: number } | null) => void;
    /** Called with the current playback index (for chart sync) */
    onIndexChange?: (index: number | null) => void;
}

// Points advanced per second at each speed setting
const SPEEDS = [
    { label: 'hægt', pps: 15 },
    { label: 'miðlungs', pps: 80 },
    { label: 'hratt', pps: 400 },
];

export default function RoutePlayback({ coordinates, onPointChange, onIndexChange }: RoutePlaybackProps) {
    const { t } = useTranslation();
    const [playing, setPlaying] = useState(false);
    const [finished, setFinished] = useState(false);
    const [speedIndex, setSpeedIndex] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const rafRef = useRef<number | null>(null);
    const indexRef = useRef(0);
    // Fractional accumulator so sub-frame advances don't lose remainder
    const posRef = useRef(0);
    const lastTimeRef = useRef<number | null>(null);
    const speedIndexRef = useRef(speedIndex);
    const total = coordinates.length;

    const cumulativeStats = useMemo<CumulativeStats[]>(() => {
        const stats: CumulativeStats[] = [];
        let dist = 0, gain = 0, loss = 0;
        let highPoint = -Infinity, lowPoint = Infinity;
        for (let i = 0; i < coordinates.length; i++) {
            const [lon, lat, ele] = coordinates[i];
            const elev = ele ?? 0;
            if (i > 0) {
                const [pLon, pLat, pEle] = coordinates[i - 1];
                dist += haversineKm(pLat, pLon, lat, lon);
                const dEle = elev - (pEle ?? 0);
                if (dEle > 0) gain += dEle;
                else loss += Math.abs(dEle);
            }
            if (elev > highPoint) highPoint = elev;
            if (elev < lowPoint) lowPoint = elev;
            stats.push({ distance: dist, elevation: elev, gain, loss, highPoint, lowPoint });
        }
        return stats;
    }, [coordinates]);

    // Keep speedIndexRef in sync so the rAF loop always reads the latest speed
    useEffect(() => { speedIndexRef.current = speedIndex; }, [speedIndex]);

    const cancelRaf = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    const emitPoint = useCallback((idx: number) => {
        const coord = coordinates[idx];
        if (coord) {
            onPointChange({ lat: coord[1], lng: coord[0] });
            onIndexChange?.(idx);
        }
    }, [coordinates, onPointChange, onIndexChange]);

    const startRaf = useCallback((fromIndex: number) => {
        cancelRaf();
        posRef.current = fromIndex;
        indexRef.current = fromIndex;
        lastTimeRef.current = null;

        const tick = (now: number) => {
            if (lastTimeRef.current === null) lastTimeRef.current = now;
            const elapsed = now - lastTimeRef.current;
            lastTimeRef.current = now;

            const pps = SPEEDS[speedIndexRef.current].pps;
            posRef.current += (elapsed / 1000) * pps;
            const next = Math.min(Math.floor(posRef.current), total - 1);

            if (next !== indexRef.current) {
                indexRef.current = next;
                setCurrentIndex(next);
                emitPoint(next);
            }

            if (next >= total - 1) {
                setPlaying(false);
                setFinished(true);
                return;
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
    }, [total, emitPoint]);

    const stop = useCallback(() => {
        cancelRaf();
        setPlaying(false);
        setFinished(false);
        setCurrentIndex(0);
        indexRef.current = 0;
        posRef.current = 0;
        onPointChange(null);
        onIndexChange?.(null);
    }, [onPointChange, onIndexChange]);

    const play = useCallback(() => {
        const startFrom = indexRef.current >= total - 1 ? 0 : indexRef.current;
        posRef.current = startFrom;
        setCurrentIndex(startFrom);
        indexRef.current = startFrom;
        emitPoint(startFrom);
        setPlaying(true);
        setFinished(false);
        startRaf(startFrom);
    }, [total, emitPoint, startRaf]);

    const pause = useCallback(() => {
        cancelRaf();
        setPlaying(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => { cancelRaf(); };
    }, []);

    const showStats = playing || currentIndex > 0 || finished;
    const stats = cumulativeStats[currentIndex];
    const progress = total > 1 ? (currentIndex / (total - 1)) * 100 : 0;

    const statPills = stats ? [
        { key: 'distance', icon: '📍', value: `${stats.distance.toFixed(1)} km` },
        { key: 'elevation', icon: '📶', value: `${Math.round(stats.elevation)} m` },
        { key: 'gain', icon: '↑', value: `${Math.round(stats.gain)} m` },
        { key: 'loss', icon: '↓', value: `${Math.round(stats.loss)} m` },
        { key: 'highPoint', icon: '⛰', value: `${Math.round(stats.highPoint)} m` },
        { key: 'lowPoint', icon: '🏖', value: `${Math.round(stats.lowPoint)} m` },
    ] : [];

    return (
        <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                {!playing ? (
                    <IconButton onClick={play} color="primary" size="small" title={t('playback.play')}>
                        <PlayArrowIcon />
                    </IconButton>
                ) : (
                    <IconButton onClick={pause} color="primary" size="small" title={t('playback.pause')}>
                        <PauseIcon />
                    </IconButton>
                )}
                <IconButton
                    onClick={stop}
                    size="small"
                    disabled={currentIndex === 0 && !playing && !finished}
                    title={t('playback.stop')}
                >
                    <StopIcon />
                </IconButton>

                <ToggleButtonGroup
                    value={speedIndex}
                    exclusive
                    onChange={(_, val) => { if (val !== null) setSpeedIndex(val); }}
                    size="small"
                >
                    {SPEEDS.map((s, i) => (
                        <ToggleButton key={s.label} value={i} sx={{ px: 1.2, py: 0.3, fontSize: '0.75rem' }}>
                            {s.label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>

                {showStats && statPills.map(p => (
                    <Box key={p.key} sx={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        bgcolor: 'action.hover', borderRadius: 2, px: 1.2, py: 0.4, minWidth: 52,
                    }}>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                            {p.icon} {t(`playback.stats.${p.key}`)}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }}>
                            {p.value}
                        </Typography>
                    </Box>
                ))}
            </Stack>

            {showStats && (
                <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ mt: 1, borderRadius: 1, height: 4 }}
                />
            )}
        </Box>
    );
}
