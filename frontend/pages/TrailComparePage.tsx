import React, { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Typography,
    Paper,
    Autocomplete,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Container,
    Stack,
    CircularProgress,
    Tooltip,
    PaletteMode,
    Button,
    useTheme,
    alpha,
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type L from 'leaflet';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import Layout from '../components/Layout';
import ShareButtons from '../components/ShareButtons';
import { useTrailBySlug, Trail, API_URL } from '../hooks/useTrails';
import { useTrailGeometry } from '../hooks/useTrailGeometries';
import { estimateDuration } from '../utils/estimateDuration';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrailOption {
    name: string;
    slug: string;
    activityType: string;
    length: number;
    elevationGain: number;
}

// ─── Elevation helpers ────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ElevPt { distance: number; elevation: number }

function buildElevPts(coords: number[][]): ElevPt[] {
    let d = 0;
    return coords.map((c, i) => {
        if (i > 0) d += haversineMeters(c[1], c[0], coords[i - 1][1], coords[i - 1][0]);
        return { distance: d / 1000, elevation: c.length > 2 ? c[2] : 0 };
    });
}

function sampleElevAtPct(pts: ElevPt[], pct: number): number {
    if (pts.length === 0) return 0;
    if (pct <= 0) return pts[0].elevation;
    if (pct >= 1) return pts[pts.length - 1].elevation;
    const total = pts[pts.length - 1].distance;
    const target = pct * total;
    let lo = 0, hi = pts.length - 1;
    while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (pts[mid].distance <= target) lo = mid; else hi = mid;
    }
    const span = pts[hi].distance - pts[lo].distance;
    const t = span > 0 ? (target - pts[lo].distance) / span : 0;
    return pts[lo].elevation + t * (pts[hi].elevation - pts[lo].elevation);
}

/** Returns [lat, lng] at the given fraction (0–1) along the coords array */
function sampleCoordAtPct(coords: number[][], pct: number): [number, number] | null {
    if (!coords.length) return null;
    if (pct <= 0) return [coords[0][1], coords[0][0]];
    if (pct >= 1) return [coords[coords.length - 1][1], coords[coords.length - 1][0]];
    // Build cumulative distances
    const dists: number[] = [0];
    for (let i = 1; i < coords.length; i++) {
        dists.push(dists[i - 1] + haversineMeters(coords[i][1], coords[i][0], coords[i - 1][1], coords[i - 1][0]));
    }
    const total = dists[dists.length - 1];
    if (total === 0) return [coords[0][1], coords[0][0]];
    const target = pct * total;
    let lo = 0, hi = dists.length - 1;
    while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (dists[mid] <= target) lo = mid; else hi = mid;
    }
    const span = dists[hi] - dists[lo];
    const t = span > 0 ? (target - dists[lo]) / span : 0;
    return [
        coords[lo][1] + t * (coords[hi][1] - coords[lo][1]),
        coords[lo][0] + t * (coords[hi][0] - coords[lo][0]),
    ];
}

// ─── Compare Elevation Chart ─────────────────────────────────────────────────

interface MergedPt { pct: number; elevA?: number; elevB?: number; distA?: number; distB?: number }

function ElevTooltip({ active, payload, nameA, nameB }: {
    active?: boolean;
    payload?: Array<{ value: number; name: string; color: string }>;
    nameA: string | null;
    nameB: string | null;
}) {
    const theme = useTheme();
    if (!active || !payload || !payload.length) return null;
    return (
        <Paper sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}` }}>
            {payload.map((entry, i) => (
                <Typography key={i} variant="body2" sx={{ color: entry.color }}>
                    {i === 0 ? (nameA ?? 'A') : (nameB ?? 'B')}: {Math.round(entry.value)} m
                </Typography>
            ))}
        </Paper>
    );
}

function CompareElevationChart({
    coordsA,
    coordsB,
    nameA,
    nameB,
    onHoverPct,
}: {
    coordsA: number[][] | null;
    coordsB: number[][] | null;
    nameA: string | null;
    nameB: string | null;
    onHoverPct?: (pct: number | null) => void;
}) {
    const theme = useTheme();
    const SAMPLES = 201;
    const chartRef = useRef<HTMLDivElement>(null);

    const ptsA = useMemo(() => coordsA ? buildElevPts(coordsA) : [], [coordsA]);
    const ptsB = useMemo(() => coordsB ? buildElevPts(coordsB) : [], [coordsB]);

    const mergedData = useMemo((): MergedPt[] => {
        if (!ptsA.length && !ptsB.length) return [];
        const totalA = ptsA.length ? ptsA[ptsA.length - 1].distance : 0;
        const totalB = ptsB.length ? ptsB[ptsB.length - 1].distance : 0;
        return Array.from({ length: SAMPLES }, (_, i) => {
            const pct = i / (SAMPLES - 1);
            const pt: MergedPt = { pct: Math.round(pct * 100) };
            if (ptsA.length) { pt.elevA = sampleElevAtPct(ptsA, pct); pt.distA = pct * totalA; }
            if (ptsB.length) { pt.elevB = sampleElevAtPct(ptsB, pct); pt.distB = pct * totalB; }
            return pt;
        });
    }, [ptsA, ptsB]);

    const yDomain = useMemo((): [number, number] => {
        if (!mergedData.length) return [0, 100];
        const elevs: number[] = [];
        mergedData.forEach(p => {
            if (p.elevA != null) elevs.push(p.elevA);
            if (p.elevB != null) elevs.push(p.elevB);
        });
        if (!elevs.length) return [0, 100];
        const min = Math.min(...elevs), max = Math.max(...elevs);
        const span = Math.max((max - min) * 1.2, 100);
        const mid = (min + max) / 2;
        return [Math.max(0, Math.round(mid - span / 2)), Math.round(mid + span / 2)];
    }, [mergedData]);

    if (!mergedData.length) return null;

    const YAXIS_WIDTH = 45;
    const RIGHT_MARGIN = 8;

    return (
        <Box
            ref={chartRef}
            sx={{ width: '100%', height: 280, mt: 1, cursor: 'crosshair' }}
            onMouseMove={(e) => {
                if (!chartRef.current) return;
                const rect = chartRef.current.getBoundingClientRect();
                const usable = rect.width - YAXIS_WIDTH - RIGHT_MARGIN;
                const x = e.clientX - rect.left - YAXIS_WIDTH;
                if (usable > 0) onHoverPct?.(Math.max(0, Math.min(1, x / usable)));
            }}
            onMouseLeave={() => onHoverPct?.(null)}
        >
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={mergedData}
                    margin={{ top: 8, right: RIGHT_MARGIN, left: 0, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="pct"
                        tickFormatter={(v: number) => `${v}%`}
                        fontSize={11}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        domain={yDomain}
                        tickFormatter={(v: number) => `${v}m`}
                        fontSize={11}
                        width={45}
                    />
                    <RechartsTooltip
                        content={<ElevTooltip nameA={nameA} nameB={nameB} />}
                    />
                    <Legend
                        formatter={(_value, entry) => (
                            <span style={{ color: theme.palette.text.primary, fontSize: 12 }}>
                                {entry.dataKey === 'elevA' ? (nameA ?? 'A') : (nameB ?? 'B')}
                            </span>
                        )}
                    />
                    {ptsA.length > 0 && (
                        <Line
                            type="monotone"
                            dataKey="elevA"
                            stroke={COLOR_A}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                    )}
                    {ptsB.length > 0 && (
                        <Line
                            type="monotone"
                            dataKey="elevB"
                            stroke={COLOR_B}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </Box>
    );
}

// ─── Stats helpers ────────────────────────────────────────────────────────────

function fmtKm(m: number) {
    return `${(m / 1000).toFixed(1)} km`;
}

function fmtM(m: number) {
    return `${Math.round(m)} m`;
}

function numDiff(a: number, b: number, fmt: (n: number) => string): React.ReactNode {
    const diff = b - a;
    if (Math.abs(diff) < 0.001) return <Typography variant="body2" color="text.secondary">—</Typography>;
    // Color + label by the "winner" (the trail with the larger value)
    const winnerIsB = diff > 0;
    const color = winnerIsB ? COLOR_B : COLOR_A;
    const label = winnerIsB ? 'B' : 'A';
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{
                width: 16, height: 16, borderRadius: '4px',
                bgcolor: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}>
                <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.6rem', lineHeight: 1 }}>
                    {label}
                </Typography>
            </Box>
            <Typography variant="body2" fontWeight={600} sx={{ color }}>
                +{fmt(Math.abs(diff))}
            </Typography>
        </Box>
    );
}

function catDiff(a: string, b: string, t: (key: string) => string): React.ReactNode {
    if (a === b) return <Typography variant="body2" color="text.secondary">{t('compare.same')}</Typography>;
    return <Typography variant="body2" color="text.secondary">—</Typography>;
}

// ─── Map bounds fitter ────────────────────────────────────────────────────────

function FitBounds({ boundsA, boundsB }: {
    boundsA: [number, number][];
    boundsB: [number, number][];
}) {
    const map = useMap();
    useEffect(() => {
        const combined = [...boundsA, ...boundsB];
        if (combined.length > 0) {
            map.fitBounds(combined as L.LatLngBoundsExpression, { padding: [30, 30] });
        }
    }, [map, boundsA, boundsB]);
    return null;
}

// ─── Compare Map ─────────────────────────────────────────────────────────────

const COLOR_A = '#2196f3';
const COLOR_B = '#ff6d00';

function CompareMap({
    coordsA,
    coordsB,
    nameA,
    nameB,
    hoverPct,
    userPos,
}: {
    coordsA: number[][] | null;
    coordsB: number[][] | null;
    nameA: string | null;
    nameB: string | null;
    hoverPct: number | null;
    userPos: [number, number] | null;
}) {
    const theme = useTheme();
    const { t } = useTranslation();

    // Convert [lon, lat, ele] → [lat, lng] for Leaflet
    const latLngA = useMemo((): [number, number][] => {
        if (!coordsA) return [];
        return coordsA.map(c => [c[1], c[0]]);
    }, [coordsA]);

    const latLngB = useMemo((): [number, number][] => {
        if (!coordsB) return [];
        return coordsB.map(c => [c[1], c[0]]);
    }, [coordsB]);

    const hasAny = latLngA.length > 0 || latLngB.length > 0;

    const hoverPosA = useMemo(
        () => (hoverPct != null && coordsA ? sampleCoordAtPct(coordsA, hoverPct) : null),
        [hoverPct, coordsA]
    );
    const hoverPosB = useMemo(
        () => (hoverPct != null && coordsB ? sampleCoordAtPct(coordsB, hoverPct) : null),
        [hoverPct, coordsB]
    );

    if (!hasAny) {
        return (
            <Box sx={{
                height: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.action.hover, 0.5),
                borderRadius: 2,
            }}>
                <Typography variant="body2" color="text.secondary">
                    No route data available
                </Typography>
            </Box>
        );
    }


    const initialCenter: [number, number] = latLngA.length > 0
        ? latLngA[Math.floor(latLngA.length / 2)]
        : latLngB[Math.floor(latLngB.length / 2)];

    return (
        <Box sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <MapContainer
                center={initialCenter}
                zoom={11}
                style={{ height: 300, width: '100%' }}
                zoomControl
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <FitBounds boundsA={latLngA} boundsB={latLngB} />
                {latLngA.length > 0 && (
                    <Polyline
                        positions={latLngA}
                        pathOptions={{ color: COLOR_A, weight: 3, opacity: 0.9 }}
                    />
                )}
                {latLngB.length > 0 && (
                    <Polyline
                        positions={latLngB}
                        pathOptions={{ color: COLOR_B, weight: 3, opacity: 0.9 }}
                    />
                )}
                {coordsA && (
                    <CircleMarker
                        center={hoverPosA ?? (coordsA.length ? [coordsA[0][1], coordsA[0][0]] : [0, 0])}
                        radius={7}
                        pathOptions={{
                            color: '#fff',
                            fillColor: COLOR_A,
                            fillOpacity: hoverPosA ? 1 : 0,
                            opacity: hoverPosA ? 1 : 0,
                            weight: 2,
                        }}
                    />
                )}
                {coordsB && (
                    <CircleMarker
                        center={hoverPosB ?? (coordsB.length ? [coordsB[0][1], coordsB[0][0]] : [0, 0])}
                        radius={7}
                        pathOptions={{
                            color: '#fff',
                            fillColor: COLOR_B,
                            fillOpacity: hoverPosB ? 1 : 0,
                            opacity: hoverPosB ? 1 : 0,
                            weight: 2,
                        }}
                    />
                )}
                {userPos && (
                    <CircleMarker
                        center={userPos}
                        radius={8}
                        pathOptions={{
                            color: '#fff',
                            fillColor: '#4caf50',
                            fillOpacity: 0.9,
                            opacity: 1,
                            weight: 2,
                        }}
                    />
                )}
            </MapContainer>
            {/* Legend */}
            {(nameA || nameB || userPos) && (
                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 1 }}>
                    {nameA && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 20, height: 3, bgcolor: COLOR_A, borderRadius: 1 }} />
                            <Typography variant="caption" color="text.secondary">{nameA}</Typography>
                        </Stack>
                    )}
                    {nameB && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 20, height: 3, bgcolor: COLOR_B, borderRadius: 1 }} />
                            <Typography variant="caption" color="text.secondary">{nameB}</Typography>
                        </Stack>
                    )}
                    {userPos && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4caf50', border: '2px solid #fff', boxShadow: '0 0 0 1px #4caf50' }} />
                            <Typography variant="caption" color="text.secondary">{t('compare.myLocation')}</Typography>
                        </Stack>
                    )}
                </Stack>
            )}
        </Box>
    );
}

// ─── Stats Table ─────────────────────────────────────────────────────────────

function StatRow({
    label,
    valA,
    diff,
    valB,
    loading,
}: {
    label: string;
    valA: React.ReactNode;
    diff: React.ReactNode;
    valB: React.ReactNode;
    loading?: boolean;
}) {
    const theme = useTheme();
    if (loading) {
        return (
            <TableRow>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem' }}>{label}</TableCell>
                <TableCell><CircularProgress size={14} /></TableCell>
                <TableCell />
                <TableCell><CircularProgress size={14} /></TableCell>
            </TableRow>
        );
    }
    return (
        <TableRow sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.5) } }}>
            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', py: 1 }}>{label}</TableCell>
            <TableCell sx={{ py: 1 }}>{valA}</TableCell>
            <TableCell sx={{ py: 1, textAlign: 'center' }}>{diff}</TableCell>
            <TableCell sx={{ py: 1 }}>{valB}</TableCell>
        </TableRow>
    );
}

// ─── Trail picker ─────────────────────────────────────────────────────────────

function TrailPicker({
    value,
    onChange,
    options,
    label,
    color,
    exclude,
}: {
    value: TrailOption | null;
    onChange: (v: TrailOption | null) => void;
    options: TrailOption[];
    label: string;
    color: string;
    exclude?: string | null;
}) {
    const filtered = useMemo(() => options.filter(o => o.slug !== exclude), [options, exclude]);

    return (
        <Autocomplete<TrailOption>
            value={value}
            onChange={(_e, v) => onChange(v)}
            options={filtered}
            getOptionLabel={o => o.name}
            isOptionEqualToValue={(o, v) => o.slug === v.slug}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    size="small"
                    InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, mr: 1, ml: 0.5, flexShrink: 0 }} />
                        ),
                    }}
                />
            )}
            renderOption={(props, option) => (
                <Box component="li" {...props} key={option.slug}>
                    <Stack>
                        <Typography variant="body2">{option.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {fmtKm(option.length)} · {option.activityType}
                        </Typography>
                    </Stack>
                </Box>
            )}
        />
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Props = { mode: PaletteMode; onToggleMode: () => void };

export default function TrailComparePage({ mode, onToggleMode }: Props) {
    const { t } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const slugA = searchParams.get('a') ?? '';
    const slugB = searchParams.get('b') ?? '';

    // Fetch all trails for the pickers (reuses existing cache)
    const { data: allTrails = [] } = useQuery<Trail[]>({
        queryKey: ['trails'],
        queryFn: () => fetch(`${API_URL}/api/v1/trails`).then(r => r.json()),
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const options: TrailOption[] = useMemo(
        () => allTrails.map(t => ({
            name: t.name,
            slug: t.slug,
            activityType: t.activityType,
            length: t.length,
            elevationGain: t.elevationGain,
        })),
        [allTrails]
    );

    // Filter pills state
    const [filterDist, setFilterDist] = useState<string | null>(null);
    const [filterElev, setFilterElev] = useState<string | null>(null);

    const matchesFilters = useCallback((o: TrailOption, dist: string | null, elev: string | null) => {
        const km = o.length / 1000;
        if (dist === 'short' && km >= 5) return false;
        if (dist === 'medium' && (km < 5 || km >= 21.1)) return false;
        if (dist === 'half' && (km < 21.1 || km >= 42.2)) return false;
        if (dist === 'marathon' && (km < 42.2 || km >= 50)) return false;
        if (dist === 'ultra' && km < 50) return false;
        const gain = o.elevationGain;
        if (elev === 'flat' && gain >= 300) return false;
        if (elev === 'hilly' && (gain < 300 || gain >= 800)) return false;
        if (elev === 'mountain' && gain < 800) return false;
        return true;
    }, []);

    const filteredOptions = useMemo(
        () => options.filter(o => matchesFilters(o, filterDist, filterElev)),
        [options, filterDist, filterElev, matchesFilters]
    );

    // Clear URL selections that no longer match the new filter
    const applyFilter = useCallback((newDist: string | null, newElev: string | null) => {
        const slugMap = new Map(options.map(o => [o.slug, o]));
        const next = new URLSearchParams(searchParams);
        if (slugA) {
            const trail = slugMap.get(slugA);
            if (!trail || !matchesFilters(trail, newDist, newElev)) next.delete('a');
        }
        if (slugB) {
            const trail = slugMap.get(slugB);
            if (!trail || !matchesFilters(trail, newDist, newElev)) next.delete('b');
        }
        setSearchParams(next, { replace: true });
    }, [options, searchParams, slugA, slugB, setSearchParams, matchesFilters]);

    const toggleDistFilter = useCallback((key: string) => {
        const next = filterDist === key ? null : key;
        setFilterDist(next);
        applyFilter(next, filterElev);
    }, [filterDist, filterElev, applyFilter]);

    const toggleElevFilter = useCallback((key: string) => {
        const next = filterElev === key ? null : key;
        setFilterElev(next);
        applyFilter(filterDist, next);
    }, [filterDist, filterElev, applyFilter]);

    const selectedA = useMemo(() => options.find(o => o.slug === slugA) ?? null, [options, slugA]);
    const selectedB = useMemo(() => options.find(o => o.slug === slugB) ?? null, [options, slugB]);

    const { trail: trailA, loading: loadingA } = useTrailBySlug(slugA || undefined);
    const { trail: trailB, loading: loadingB } = useTrailBySlug(slugB || undefined);

    const { coordinates: coordsA, loading: geoLoadingA } = useTrailGeometry(slugA || undefined);
    const { coordinates: coordsB, loading: geoLoadingB } = useTrailGeometry(slugB || undefined);

    const [hoverPct, setHoverPct] = useState<number | null>(null);
    const [userPos, setUserPos] = useState<[number, number] | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            pos => setUserPos([pos.coords.latitude, pos.coords.longitude]),
            () => { /* permission denied or unavailable — silently ignore */ },
            { timeout: 8000, maximumAge: 60_000 }
        );
    }, []);

    const setSlug = useCallback((key: 'a' | 'b', slug: string | null) => {
        const next = new URLSearchParams(searchParams);
        if (slug) next.set(key, slug);
        else next.delete(key);
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const handleSwap = () => {
        const next = new URLSearchParams();
        if (slugB) next.set('a', slugB);
        if (slugA) next.set('b', slugA);
        setSearchParams(next, { replace: true });
    };

    // Max elevation from geometry
    const maxEleA = useMemo(() => {
        if (!coordsA) return null;
        return Math.max(...coordsA.map(c => c.length > 2 ? c[2] : 0));
    }, [coordsA]);

    const maxEleB = useMemo(() => {
        if (!coordsB) return null;
        return Math.max(...coordsB.map(c => c.length > 2 ? c[2] : 0));
    }, [coordsB]);

    // Distance from user's location to trail start (in km)
    const distToTrailA = useMemo(() => {
        if (!userPos || !coordsA || coordsA.length === 0) return null;
        return haversineMeters(userPos[0], userPos[1], coordsA[0][1], coordsA[0][0]) / 1000;
    }, [userPos, coordsA]);

    const distToTrailB = useMemo(() => {
        if (!userPos || !coordsB || coordsB.length === 0) return null;
        return haversineMeters(userPos[0], userPos[1], coordsB[0][1], coordsB[0][0]) / 1000;
    }, [userPos, coordsB]);

    const bothLoading = loadingA || loadingB;
    const hasBoth = !!trailA && !!trailB;

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="md" sx={{ py: 2 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/')}
                    sx={{ mb: 2 }}
                >
                    {t('trail.backToTrails')}
                </Button>

                {/* Page header */}
                <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                    <CompareArrowsIcon color="primary" />
                    <Typography variant="h5" fontWeight="bold" sx={{ flex: 1 }}>
                        {t('compare.title')}
                    </Typography>
                    {(slugA || slugB) && (
                        <ShareButtons
                            title={[trailA?.name, trailB?.name].filter(Boolean).join(' vs ')}
                            url={window.location.href}
                        />
                    )}
                </Stack>

                {/* Trail pickers + filter pills */}
                <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                    >
                        <Box flex={1}>
                            <TrailPicker
                                value={selectedA}
                                onChange={v => setSlug('a', v?.slug ?? null)}
                                options={filteredOptions}
                                label={t('compare.pickTrailA')}
                                color={COLOR_A}
                                exclude={slugB}
                            />
                        </Box>
                        <Tooltip title={t('compare.swapTrails')}>
                            <span>
                                <IconButton
                                    onClick={handleSwap}
                                    disabled={!slugA && !slugB}
                                    color="primary"
                                    sx={{ flexShrink: 0 }}
                                >
                                    <SwapHorizIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Box flex={1}>
                            <TrailPicker
                                value={selectedB}
                                onChange={v => setSlug('b', v?.slug ?? null)}
                                options={filteredOptions}
                                label={t('compare.pickTrailB')}
                                color={COLOR_B}
                                exclude={slugA}
                            />
                        </Box>
                    </Stack>

                    {/* Filter pills */}
                    <Box sx={{ mt: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, flexShrink: 0 }}>
                                {t('compare.filters.distance')}:
                            </Typography>
                            {(['short', 'medium', 'half', 'marathon', 'ultra'] as const).map(key => (
                                <Chip
                                    key={key}
                                    label={t(`compare.filters.${key}`)}
                                    size="small"
                                    onClick={() => toggleDistFilter(key)}
                                    variant={filterDist === key ? 'filled' : 'outlined'}
                                    color={filterDist === key ? 'primary' : 'default'}
                                />
                            ))}
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, flexShrink: 0 }}>
                                {t('compare.filters.elevation')}:
                            </Typography>
                            {(['flat', 'hilly', 'mountain'] as const).map(key => (
                                <Chip
                                    key={key}
                                    label={t(`compare.filters.${key}`)}
                                    size="small"
                                    onClick={() => toggleElevFilter(key)}
                                    variant={filterElev === key ? 'filled' : 'outlined'}
                                    color={filterElev === key ? 'primary' : 'default'}
                                />
                            ))}
                        </Stack>
                    </Box>
                </Paper>

                {/* Prompt when trails not selected */}
                {!slugA && !slugB && (
                    <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                        <CompareArrowsIcon sx={{ fontSize: 64, opacity: 0.2, mb: 1 }} />
                        <Typography>{t('compare.selectTrails')}</Typography>
                    </Box>
                )}

                {/* Stats table */}
                {(slugA || slugB) && (
                    <Paper elevation={2} sx={{ mb: 3, overflow: 'hidden' }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ px: 2, pt: 2, pb: 1 }}>
                            {t('compare.stats')}
                        </Typography>
                        <Box sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: 380 }}>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: alpha(theme.palette.action.hover, 0.25), borderBottom: `1px solid ${theme.palette.divider}` }}>
                                        <TableCell sx={{ fontWeight: 700, width: '30%' }}></TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: COLOR_A, width: '25%' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLOR_A, flexShrink: 0 }} />
                                                <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 140 }}>
                                                    {slugA ? (trailA?.name ?? '…') : t('compare.trailA')}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700, textAlign: 'center', width: '20%', color: 'text.secondary' }}>
                                            <Tooltip title={t('compare.diffTooltip')} placement="top" arrow>
                                                <Box component="span" sx={{ cursor: 'help', borderBottom: '1px dashed', borderColor: 'text.disabled' }}>
                                                    {t('compare.diff')}
                                                </Box>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: COLOR_B, width: '25%' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLOR_B, flexShrink: 0 }} />
                                                <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 140 }}>
                                                    {slugB ? (trailB?.name ?? '…') : t('compare.trailB')}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <StatRow
                                        label={t('compare.distance')}
                                        valA={trailA ? <Typography variant="body2">{fmtKm(trailA.length)}</Typography> : null}
                                        diff={trailA && trailB ? numDiff(trailA.length, trailB.length, v => fmtKm(v)) : null}
                                        valB={trailB ? <Typography variant="body2">{fmtKm(trailB.length)}</Typography> : null}
                                        loading={bothLoading}
                                    />
                                    <StatRow
                                        label={t('compare.elevationGain')}
                                        valA={trailA ? <Typography variant="body2">{fmtM(trailA.elevationGain)}</Typography> : null}
                                        diff={trailA && trailB ? numDiff(trailA.elevationGain, trailB.elevationGain, fmtM) : null}
                                        valB={trailB ? <Typography variant="body2">{fmtM(trailB.elevationGain)}</Typography> : null}
                                        loading={bothLoading}
                                    />
                                    <StatRow
                                        label={t('compare.elevationLoss')}
                                        valA={trailA ? <Typography variant="body2">{fmtM(trailA.elevationLoss)}</Typography> : null}
                                        diff={trailA && trailB ? numDiff(trailA.elevationLoss, trailB.elevationLoss, fmtM) : null}
                                        valB={trailB ? <Typography variant="body2">{fmtM(trailB.elevationLoss)}</Typography> : null}
                                        loading={bothLoading}
                                    />
                                    <StatRow
                                        label={t('compare.maxElevation')}
                                        valA={maxEleA != null ? <Typography variant="body2">{fmtM(maxEleA)}</Typography> : (geoLoadingA ? <CircularProgress size={14} /> : <Typography variant="body2" color="text.disabled">—</Typography>)}
                                        diff={maxEleA != null && maxEleB != null ? numDiff(maxEleA, maxEleB, fmtM) : <Typography variant="body2" color="text.disabled">—</Typography>}
                                        valB={maxEleB != null ? <Typography variant="body2">{fmtM(maxEleB)}</Typography> : (geoLoadingB ? <CircularProgress size={14} /> : <Typography variant="body2" color="text.disabled">—</Typography>)}
                                    />
                                    <StatRow
                                        label={t('compare.estTime')}
                                        valA={trailA ? <Typography variant="body2">{estimateDuration(trailA.length, trailA.elevationGain, trailA.activityType)}</Typography> : null}
                                        diff={<Typography variant="body2" color="text.disabled">—</Typography>}
                                        valB={trailB ? <Typography variant="body2">{estimateDuration(trailB.length, trailB.elevationGain, trailB.activityType)}</Typography> : null}
                                        loading={bothLoading}
                                    />
                                    <StatRow
                                        label={t('compare.difficulty')}
                                        valA={trailA ? <Chip label={trailA.difficulty} size="small" variant="outlined" /> : null}
                                        diff={trailA && trailB ? catDiff(trailA.difficulty, trailB.difficulty, t) : null}
                                        valB={trailB ? <Chip label={trailB.difficulty} size="small" variant="outlined" /> : null}
                                        loading={bothLoading}
                                    />
                                    <StatRow
                                        label={t('compare.trailType')}
                                        valA={trailA ? <Typography variant="body2">{t(`trail.${trailA.trailType.charAt(0).toLowerCase() + trailA.trailType.slice(1)}`) || trailA.trailType}</Typography> : null}
                                        diff={trailA && trailB ? catDiff(trailA.trailType, trailB.trailType, t) : null}
                                        valB={trailB ? <Typography variant="body2">{t(`trail.${trailB.trailType.charAt(0).toLowerCase() + trailB.trailType.slice(1)}`) || trailB.trailType}</Typography> : null}
                                        loading={bothLoading}
                                    />
                                    <StatRow
                                        label={t('compare.activity')}
                                        valA={trailA ? <Typography variant="body2">{trailA.activityType}</Typography> : null}
                                        diff={trailA && trailB ? catDiff(trailA.activityType, trailB.activityType, t) : null}
                                        valB={trailB ? <Typography variant="body2">{trailB.activityType}</Typography> : null}
                                        loading={bothLoading}
                                    />
                                    {userPos && (
                                        <StatRow
                                            label={t('compare.distFromMe')}
                                            valA={distToTrailA != null
                                                ? <Typography variant="body2">{fmtKm(distToTrailA * 1000)}</Typography>
                                                : (geoLoadingA ? <CircularProgress size={14} /> : <Typography variant="body2" color="text.disabled">—</Typography>)}
                                            diff={distToTrailA != null && distToTrailB != null
                                                ? numDiff(distToTrailA * 1000, distToTrailB * 1000, v => fmtKm(v))
                                                : <Typography variant="body2" color="text.disabled">—</Typography>}
                                            valB={distToTrailB != null
                                                ? <Typography variant="body2">{fmtKm(distToTrailB * 1000)}</Typography>
                                                : (geoLoadingB ? <CircularProgress size={14} /> : <Typography variant="body2" color="text.disabled">—</Typography>)}
                                        />
                                    )}
                                </TableBody>
                            </Table>
                        </Box>
                    </Paper>
                )}

                {/* Map + Elevation stacked */}
                {(coordsA || coordsB || geoLoadingA || geoLoadingB) && (
                    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
                        {(geoLoadingA || geoLoadingB) && !coordsA && !coordsB ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress size={32} />
                            </Box>
                        ) : (
                            <>
                                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                    {t('compare.map')}
                                </Typography>
                                <CompareMap
                                    coordsA={coordsA}
                                    coordsB={coordsB}
                                    nameA={trailA?.name ?? null}
                                    nameB={trailB?.name ?? null}
                                    hoverPct={hoverPct}
                                    userPos={userPos}
                                />
                                {(coordsA || coordsB) && (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 3 }} gutterBottom>
                                            {t('compare.elevation')}
                                        </Typography>
                                        <CompareElevationChart
                                            coordsA={coordsA}
                                            coordsB={coordsB}
                                            nameA={trailA?.name ?? null}
                                            nameB={trailB?.name ?? null}
                                            onHoverPct={setHoverPct}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </Paper>
                )}

                {/* Show link to detail pages when both selected */}
                {hasBoth && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={() => navigate(`/trails/${trailA!.slug}`)}
                            sx={{ borderColor: COLOR_A, color: COLOR_A, '&:hover': { borderColor: COLOR_A, bgcolor: alpha(COLOR_A, 0.08) } }}
                        >
                            {t('compare.viewTrail')} {trailA?.name}
                        </Button>
                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={() => navigate(`/trails/${trailB!.slug}`)}
                            sx={{ borderColor: COLOR_B, color: COLOR_B, '&:hover': { borderColor: COLOR_B, bgcolor: alpha(COLOR_B, 0.08) } }}
                        >
                            {t('compare.viewTrail')} {trailB?.name}
                        </Button>
                    </Stack>
                )}
            </Container>
        </Layout>
    );
}
