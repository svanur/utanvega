import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Typography, Button, Stack, Paper, Chip, Fade, LinearProgress, useTheme,
} from '@mui/material';
import {
    Replay as ReplayIcon,
    EmojiEvents as TrophyIcon,
    NavigateNext as NextIcon,
    MyLocation as PinIcon,
    Lightbulb as HintIcon,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents } from 'react-leaflet';
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

type GamePhase = 'loading' | 'viewing' | 'guessing' | 'result' | 'finished';

const TOTAL_ROUNDS = 5;
// Iceland center for overview map
const ICELAND_CENTER: LatLngTuple = [64.963, -19.021];
const ICELAND_ZOOM = 6;

// Score based on distance (km)
function calcScore(distKm: number): number {
    if (distKm <= 2) return 100;
    if (distKm <= 5) return 90;
    if (distKm <= 10) return 75;
    if (distKm <= 25) return 60;
    if (distKm <= 50) return 40;
    if (distKm <= 100) return 20;
    return 5;
}

function haversineKm(a: LatLngTuple, b: LatLngTuple): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);
    const h = sinLat * sinLat + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * sinLon * sinLon;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Custom pin icons
const guessIcon = L.divIcon({
    html: '📍',
    className: 'geoguesser-pin',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
});
const actualIcon = L.divIcon({
    html: '🎯',
    className: 'geoguesser-pin',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
});

// Fit map to positions
function FitBounds({ positions }: { positions: LatLngTuple[] }) {
    const map = useMap();
    useEffect(() => {
        if (positions.length > 1) {
            map.invalidateSize();
            const bounds = L.latLngBounds(positions);
            map.fitBounds(bounds, { padding: [30, 30], animate: false });
        }
    }, [map, positions]);
    return null;
}

// Click handler for overview map
function MapClickHandler({ onClick }: { onClick: (pos: LatLngTuple) => void }) {
    useMapEvents({
        click(e) {
            onClick([e.latlng.lat, e.latlng.lng]);
        },
    });
    return null;
}

interface RoundResult {
    trailName: string;
    distKm: number;
    points: number;
}

export default function TrailGeoGuesser() {
    const { t } = useTranslation();
    const theme = useTheme();
    const [trails, setTrails] = useState<Trail[]>([]);
    const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
    const [targetTrail, setTargetTrail] = useState<Trail | null>(null);
    const [phase, setPhase] = useState<GamePhase>('loading');
    const [round, setRound] = useState(1);
    const [score, setScore] = useState(0);
    const [guessPos, setGuessPos] = useState<LatLngTuple | null>(null);
    const [roundDistance, setRoundDistance] = useState(0);
    const [roundPoints, setRoundPoints] = useState(0);
    const [results, setResults] = useState<RoundResult[]>([]);
    const [hintUsed, setHintUsed] = useState(false);
    const [usedTrailIdsRef] = useState<{ current: Set<string> }>({ current: new Set() });
    const [lastTrigger] = useState<{ current: number }>({ current: -1 });
    const [roundTrigger, setRoundTrigger] = useState(0);

    // Load trails (only those with coordinates)
    useEffect(() => {
        fetch(`${API_URL}/api/v1/trails`)
            .then(res => res.json())
            .then((data: Trail[]) =>
                setTrails(data.filter(t => t.startLatitude && t.startLongitude))
            )
            .catch(err => console.error('Failed to load trails:', err));
    }, []);

    // Setup round
    useEffect(() => {
        if (trails.length < TOTAL_ROUNDS) return;
        if (lastTrigger.current === roundTrigger) return;
        lastTrigger.current = roundTrigger;

        let cancelled = false;

        const setup = async () => {
            setPhase('loading');
            setGeometry(null);
            setTargetTrail(null);
            setGuessPos(null);
            setHintUsed(false);

            const available = trails.filter(tr => !usedTrailIdsRef.current.has(tr.id));
            if (available.length === 0) {
                setPhase('finished');
                return;
            }

            const target = available[Math.floor(Math.random() * available.length)];
            usedTrailIdsRef.current.add(target.id);
            setTargetTrail(target);

            try {
                const res = await fetch(`${API_URL}/api/v1/trails/${target.slug}/geometry`);
                if (cancelled) return;
                if (!res.ok) throw new Error('Geometry fetch failed');
                const data: GeoJsonGeometry = await res.json();
                if (cancelled) return;
                if (!data?.coordinates?.length) throw new Error('Empty geometry');
                setGeometry(data);
                setPhase('viewing');
            } catch {
                if (cancelled) return;
                // Skip trail, try another
                setRoundTrigger(prev => prev + 1);
            }
        };

        setup();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trails, roundTrigger]);

    const polylinePositions: LatLngTuple[] = useMemo(() => {
        if (!geometry?.coordinates) return [];
        return geometry.coordinates.map(c => [c[1], c[0]] as LatLngTuple);
    }, [geometry]);

    // Actual trail center position
    const actualPos: LatLngTuple | null = useMemo(() => {
        if (!targetTrail?.startLatitude || !targetTrail?.startLongitude) return null;
        return [targetTrail.startLatitude, targetTrail.startLongitude];
    }, [targetTrail]);

    const handleSwitchToGuessing = useCallback(() => {
        setPhase('guessing');
    }, []);

    const handleMapClick = useCallback((pos: LatLngTuple) => {
        if (phase !== 'guessing') return;
        setGuessPos(pos);
    }, [phase]);

    const handleConfirmGuess = useCallback(() => {
        if (!guessPos || !actualPos || !targetTrail) return;

        const dist = haversineKm(guessPos, actualPos);
        const basePts = calcScore(dist);
        const pts = hintUsed ? Math.round(basePts * 0.5) : basePts;

        setRoundDistance(dist);
        setRoundPoints(pts);
        setScore(prev => prev + pts);
        setResults(prev => [...prev, {
            trailName: targetTrail.name,
            distKm: dist,
            points: pts,
        }]);
        setPhase('result');
    }, [guessPos, actualPos, targetTrail]);

    const handleNext = useCallback(() => {
        if (round >= TOTAL_ROUNDS) {
            setPhase('finished');
        } else {
            setRound(prev => prev + 1);
            setRoundTrigger(prev => prev + 1);
        }
    }, [round]);

    const handleRestart = useCallback(() => {
        setScore(0);
        setRound(1);
        setResults([]);
        usedTrailIdsRef.current = new Set();
        setRoundTrigger(prev => prev + 1);
    }, [usedTrailIdsRef]);

    // Confetti on excellent finish
    useEffect(() => {
        if (phase !== 'finished') return;
        const maxPossible = TOTAL_ROUNDS * 100;
        const pct = Math.round((score / maxPossible) * 100);
        if (pct >= 80) {
            confetti({
                particleCount: 120,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#FFD700', '#00CED1', '#FF6347', '#9370DB'],
            });
        }
    }, [phase, score]);

    const tileUrl = theme.palette.mode === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    // Finished screen
    if (phase === 'finished') {
        const maxPossible = TOTAL_ROUNDS * 100;
        const pct = Math.round((score / maxPossible) * 100);
        const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '🗺️' : pct >= 40 ? '🧭' : '😵‍💫';

        return (
            <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Typography sx={{ fontSize: '4rem', mb: 1 }}>{emoji}</Typography>
                    <Typography variant="h4" fontWeight="bold" gutterBottom>
                        {t('geoGuesser.gameOver')}
                    </Typography>
                    <Typography variant="h5" color="primary" gutterBottom>
                        {t('geoGuesser.finalScore', { score, max: maxPossible })}
                    </Typography>
                </Box>

                {/* Results table */}
                <Stack spacing={1} sx={{ mb: 3 }}>
                    {results.map((r, i) => (
                        <Stack
                            key={i}
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{
                                px: 2, py: 1, borderRadius: 2,
                                bgcolor: r.points >= 75 ? 'success.main' :
                                         r.points >= 40 ? 'warning.main' : 'error.main',
                                color: 'common.white',
                                opacity: 0.9,
                            }}
                        >
                            <Typography variant="body2" fontWeight="bold">
                                {r.trailName}
                            </Typography>
                            <Typography variant="body2">
                                {r.distKm.toFixed(1)} km → {r.points} {t('geoGuesser.pts')}
                            </Typography>
                        </Stack>
                    ))}
                </Stack>

                <Box sx={{ textAlign: 'center' }}>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<ReplayIcon />}
                        onClick={handleRestart}
                        sx={{ borderRadius: 2 }}
                    >
                        {t('geoGuesser.playAgain')}
                    </Button>
                </Box>
            </Paper>
        );
    }

    // Loading
    if (phase === 'loading' || !targetTrail || !geometry || polylinePositions.length === 0) {
        return (
            <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
                <Typography variant="h6" gutterBottom>{t('game.loading')}</Typography>
                <LinearProgress sx={{ borderRadius: 1 }} />
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, overflow: 'hidden' }}>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Chip
                    label={t('game.roundOf', { round, total: TOTAL_ROUNDS })}
                    size="small"
                    color="primary"
                    variant="outlined"
                />
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <TrophyIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight="bold">{score}</Typography>
                </Stack>
            </Stack>

            {/* Phase: Viewing — see trail shape only (no tiles = no location hint) */}
            {phase === 'viewing' && (
                <>
                    <Typography variant="h6" textAlign="center" sx={{ mb: 1 }}>
                        🔍 {t('geoGuesser.studyTrail')}
                    </Typography>
                    <Box sx={{
                        height: { xs: 280, sm: 350 },
                        borderRadius: 2, overflow: 'hidden', mb: 2,
                        border: 1, borderColor: 'divider',
                        bgcolor: theme.palette.mode === 'dark' ? '#1a1a2e' : '#f0f4f8',
                    }}>
                        <MapContainer
                            key={`view-${round}`}
                            center={polylinePositions[0]}
                            zoom={14}
                            style={{ height: '100%', width: '100%', background: theme.palette.mode === 'dark' ? '#1a1a2e' : '#f0f4f8' }}
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
                                pathOptions={{ color: theme.palette.mode === 'dark' ? '#64b5f6' : '#f44336', weight: 4, opacity: 0.9 }}
                            />
                        </MapContainer>
                    </Box>

                    {/* Hint: reveal stats (halves score for this round) */}
                    {hintUsed && targetTrail && (
                        <Fade in>
                            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 1 }}>
                                <Chip label={`📏 ${(targetTrail.length / 1000).toFixed(1)} km`} size="small" />
                                <Chip label={`⬆️ ${Math.round(targetTrail.elevationGain)} m`} size="small" />
                                <Chip label={`⬇️ ${Math.round(targetTrail.elevationLoss)} m`} size="small" />
                            </Stack>
                        </Fade>
                    )}

                    <Stack direction="row" spacing={2} justifyContent="center">
                        {!hintUsed && (
                            <Button
                                variant="outlined"
                                startIcon={<HintIcon />}
                                onClick={() => setHintUsed(true)}
                                sx={{ borderRadius: 2, textTransform: 'none' }}
                                color="warning"
                            >
                                {t('geoGuesser.hint')} (½ {t('geoGuesser.pts')})
                            </Button>
                        )}
                        <Button
                            variant="contained"
                            startIcon={<PinIcon />}
                            onClick={handleSwitchToGuessing}
                            sx={{ borderRadius: 2, textTransform: 'none' }}
                        >
                            {t('geoGuesser.readyToGuess')}
                        </Button>
                    </Stack>
                </>
            )}

            {/* Phase: Guessing — click on Iceland map */}
            {phase === 'guessing' && (
                <>
                    <Typography variant="h6" textAlign="center" sx={{ mb: 1 }}>
                        📍 {t('geoGuesser.clickToGuess')}
                    </Typography>
                    <Box sx={{
                        height: { xs: 300, sm: 380 },
                        borderRadius: 2, overflow: 'hidden', mb: 2,
                        border: 1, borderColor: 'divider',
                    }}>
                        <MapContainer
                            key={`guess-${round}`}
                            center={ICELAND_CENTER}
                            zoom={ICELAND_ZOOM}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={true}
                            attributionControl={false}
                        >
                            <TileLayer url={tileUrl} />
                            <MapClickHandler onClick={handleMapClick} />
                            {guessPos && (
                                <Marker position={guessPos} icon={guessIcon} />
                            )}
                        </MapContainer>
                    </Box>
                    <Fade in={!!guessPos}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Button
                                variant="contained"
                                color="success"
                                onClick={handleConfirmGuess}
                                disabled={!guessPos}
                                sx={{ borderRadius: 2, textTransform: 'none' }}
                            >
                                {t('geoGuesser.confirmGuess')}
                            </Button>
                        </Box>
                    </Fade>
                </>
            )}

            {/* Phase: Result — show both pins + distance */}
            {phase === 'result' && guessPos && actualPos && (
                <>
                    <Typography variant="h6" textAlign="center" sx={{ mb: 1 }}>
                        {targetTrail.name}
                    </Typography>
                    <Box sx={{
                        height: { xs: 280, sm: 350 },
                        borderRadius: 2, overflow: 'hidden', mb: 2,
                        border: 1, borderColor: 'divider',
                    }}>
                        <MapContainer
                            key={`result-${round}`}
                            center={ICELAND_CENTER}
                            zoom={ICELAND_ZOOM}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={true}
                            attributionControl={false}
                        >
                            <TileLayer url={tileUrl} />
                            <FitBounds positions={[guessPos, actualPos]} />
                            <Marker position={guessPos} icon={guessIcon} />
                            <Marker position={actualPos} icon={actualIcon} />
                            <Polyline
                                positions={[guessPos, actualPos]}
                                pathOptions={{
                                    color: '#ff9800',
                                    weight: 2,
                                    dashArray: '8 4',
                                    opacity: 0.8,
                                }}
                            />
                        </MapContainer>
                    </Box>

                    <Fade in>
                        <Stack alignItems="center" spacing={1}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Chip
                                    label={`${roundDistance.toFixed(1)} km`}
                                    color={roundPoints >= 75 ? 'success' : roundPoints >= 40 ? 'warning' : 'error'}
                                    variant="filled"
                                />
                                <Typography
                                    variant="h5"
                                    fontWeight="bold"
                                    color={roundPoints >= 75 ? 'success.main' : roundPoints >= 40 ? 'warning.main' : 'error.main'}
                                >
                                    +{roundPoints}
                                </Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                                {roundPoints >= 90 ? t('geoGuesser.resultBullseye') :
                                 roundPoints >= 60 ? t('geoGuesser.resultClose') :
                                 roundPoints >= 30 ? t('geoGuesser.resultFar') :
                                 t('geoGuesser.resultWayOff')}
                            </Typography>
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
                </>
            )}
        </Paper>
    );
}
