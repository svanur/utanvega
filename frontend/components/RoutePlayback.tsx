import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Box, IconButton, ToggleButtonGroup, ToggleButton, Typography, LinearProgress, Stack } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import { useTranslation } from 'react-i18next';

interface CumulativeStats {
    distance: number; // km
    elevation: number; // m
    gain: number; // m
    loss: number; // m
    highPoint: number; // m — highest elevation seen so far
    lowPoint: number; // m — lowest elevation seen so far
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface RoutePlaybackProps {
    /** GeoJSON coordinates [lon, lat, ele] */
    coordinates: number[][];
    /** Called on each animation frame with the current point (or null on stop) */
    onPointChange: (point: { lat: number; lng: number } | null) => void;
    /** Called with the current playback index (for chart sync) */
    onIndexChange?: (index: number | null) => void;
}

const SPEEDS = [
    { label: '1x', interval: 80, step: 1 },
    { label: '2x', interval: 40, step: 1 },
    { label: '5x', interval: 16, step: 1 },
    { label: '10x', interval: 8, step: 1 },
    { label: '25x', interval: 8, step: 3 },
    { label: '50x', interval: 8, step: 6 },
];

export default function RoutePlayback({ coordinates, onPointChange, onIndexChange }: RoutePlaybackProps) {
    const { t } = useTranslation();
    const [playing, setPlaying] = useState(false);
    const [finished, setFinished] = useState(false);
    const [speedIndex, setSpeedIndex] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const indexRef = useRef(0);
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

    const emitPoint = useCallback((idx: number) => {
        const coord = coordinates[idx];
        if (coord) {
            onPointChange({ lat: coord[1], lng: coord[0] });
            onIndexChange?.(idx);
        }
    }, [coordinates, onPointChange, onIndexChange]);

    const stop = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setPlaying(false);
        setFinished(false);
        setCurrentIndex(0);
        indexRef.current = 0;
        onPointChange(null);
        onIndexChange?.(null);
    }, [onPointChange, onIndexChange]);

    const finish = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setPlaying(false);
        setFinished(true);
    }, []);

    const startInterval = useCallback((fromIndex: number) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        indexRef.current = fromIndex;

        intervalRef.current = setInterval(() => {
            const next = Math.min(indexRef.current + SPEEDS[speedIndex].step, total - 1);
            if (next >= total - 1) {
                indexRef.current = total - 1;
                setCurrentIndex(total - 1);
                emitPoint(total - 1);
                finish();
                return;
            }
            indexRef.current = next;
            setCurrentIndex(next);
            emitPoint(next);
        }, SPEEDS[speedIndex].interval);
    }, [total, speedIndex, emitPoint, finish]);

    const play = useCallback(() => {
        const startFrom = indexRef.current >= total - 1 ? 0 : indexRef.current;
        setCurrentIndex(startFrom);
        indexRef.current = startFrom;
        emitPoint(startFrom);
        setPlaying(true);
        setFinished(false);
        startInterval(startFrom);
    }, [total, emitPoint, startInterval]);

    const pause = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setPlaying(false);
    }, []);

    // Update interval speed when speed changes during playback
    useEffect(() => {
        if (playing) {
            startInterval(indexRef.current);
        }
    }, [speedIndex]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const progress = total > 1 ? (currentIndex / (total - 1)) * 100 : 0;

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

                {(playing || currentIndex > 0 || finished) && (() => {
                    const s = cumulativeStats[currentIndex];
                    return (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }} component="span">
                            {s.distance.toFixed(1)} km &nbsp;·&nbsp; {Math.round(s.elevation)} m &nbsp;·&nbsp;
                            ↑{Math.round(s.gain)} m &nbsp;·&nbsp; ↓{Math.round(s.loss)} m &nbsp;·&nbsp;
                            ⛰{Math.round(s.highPoint)} m &nbsp;·&nbsp; 🏝{Math.round(s.lowPoint)} m
                        </Typography>
                    );
                })()}
            </Stack>

            {(playing || currentIndex > 0 || finished) && (
                <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ mt: 1, borderRadius: 1, height: 4 }}
                />
            )}
        </Box>
    );
}
