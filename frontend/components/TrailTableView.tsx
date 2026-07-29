import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TableSortLabel, Paper, Typography, Chip, IconButton, Tooltip, Stack,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import VideocamIcon from '@mui/icons-material/Videocam';
import NearMeIcon from '@mui/icons-material/NearMe';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { formatDistanceKm } from '../utils/geo';
import { getActivityIcon } from '../utils/activityIcon';
import { estimateDuration, estimateDurationMinutes } from '../utils/estimateDuration';
import type { Trail } from '../hooks/useTrails';

interface TrailTableViewProps {
    trails: Trail[];
    favorites: string[];
    onToggleFavorite: (slug: string) => void;
    userLocation: { lat: number; lng: number } | null;
}

type SortField = 'name' | 'length' | 'elevationGain' | 'difficulty' | 'activityType' | 'distance' | 'location' | 'duration';
type SortDir = 'asc' | 'desc';

const DIFFICULTY_ORDER: Record<string, number> = { Easy: 0, Moderate: 1, Hard: 2, Expert: 3, Extreme: 4 };

function getDifficultyColor(d: string): 'success' | 'info' | 'warning' | 'error' | 'default' {
    switch (d) {
        case 'Easy': return 'success';
        case 'Moderate': return 'info';
        case 'Hard': return 'warning';
        case 'Expert': return 'error';
        case 'Extreme': return 'error';
        default: return 'default';
    }
}


const TrailTableView: React.FC<TrailTableViewProps> = ({ trails, favorites, onToggleFavorite, userLocation }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [sortField, setSortField] = useState<SortField>(userLocation ? 'distance' : 'name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const sortedTrails = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1;
        return [...trails].sort((a, b) => {
            switch (sortField) {
                case 'name':
                    return dir * a.name.localeCompare(b.name, 'is');
                case 'length':
                    return dir * (a.length - b.length);
                case 'elevationGain':
                    return dir * (a.elevationGain - b.elevationGain);
                case 'difficulty': {
                    const da = DIFFICULTY_ORDER[a.difficulty] ?? 99;
                    const db = DIFFICULTY_ORDER[b.difficulty] ?? 99;
                    return dir * (da - db);
                }
                case 'activityType':
                    return dir * a.activityType.localeCompare(b.activityType);
                case 'distance': {
                    const da = a.distanceToUser ?? Infinity;
                    const db = b.distanceToUser ?? Infinity;
                    return dir * (da - db);
                }
                case 'location': {
                    const la = a.locations?.[0]?.name ?? '';
                    const lb = b.locations?.[0]?.name ?? '';
                    return dir * la.localeCompare(lb, 'is');
                }
                case 'duration': {
                    const da = estimateDurationMinutes(a.length, a.elevationGain, a.activityType) ?? Infinity;
                    const db = estimateDurationMinutes(b.length, b.elevationGain, b.activityType) ?? Infinity;
                    return dir * (da - db);
                }
                default:
                    return 0;
            }
        });
    }, [trails, sortField, sortDir]);

    const columns: { field: SortField; label: string; align?: 'left' | 'right' | 'center' }[] = [
        { field: 'name', label: t('trail.name', 'Name') },
        { field: 'distance', label: t('trail.kmAway', 'km away'), align: 'right' },
        { field: 'length', label: t('trail.distance'), align: 'right' },
        { field: 'elevationGain', label: t('trail.gain'), align: 'right' },
    ];

    return (
        <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2, width: '100%', overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                    <TableRow>
                        <TableCell padding="checkbox" />
                        {columns.map(col => (
                            <TableCell key={col.field} align={col.align ?? 'left'}>
                                <TableSortLabel
                                    active={sortField === col.field}
                                    direction={sortField === col.field ? sortDir : 'asc'}
                                    onClick={() => handleSort(col.field)}
                                >
                                    {col.label}
                                </TableSortLabel>
                            </TableCell>
                        ))}
                        <TableCell align="right">
                            <TableSortLabel active={sortField === 'duration'} direction={sortField === 'duration' ? sortDir : 'asc'} onClick={() => handleSort('duration')}>
                                {t('filters.duration', 'Est. time')}
                            </TableSortLabel>
                        </TableCell>
                        <TableCell>
                            <TableSortLabel active={sortField === 'location'} direction={sortField === 'location' ? sortDir : 'asc'} onClick={() => handleSort('location')}>
                                {t('trail.location', 'Location')}
                            </TableSortLabel>
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sortedTrails.map((trail, idx) => {
                        const isFav = favorites.includes(trail.slug);
                        const primaryLocation = trail.locations?.[0]?.name;
                        const distKm = trail.distanceToUser;
                        return (
                            <TableRow
                                key={trail.id}
                                hover
                                sx={{
                                    cursor: 'pointer',
                                    '&:last-child td': { border: 0 },
                                    bgcolor: idx % 2 === 1 ? 'action.hover' : 'transparent',
                                }}
                                tabIndex={0}
                                role="link"
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/trails/${trail.slug}`); } }}
                                onClick={() => navigate(`/trails/${trail.slug}`)}
                            >
                                <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                                    <IconButton size="small" onClick={() => onToggleFavorite(trail.slug)} aria-label={isFav ? t('trailCard.removeFavorite') : t('trailCard.addFavorite')}>
                                        {isFav ? <StarIcon fontSize="small" color="warning" /> : <StarBorderIcon fontSize="small" />}
                                    </IconButton>
                                </TableCell>
                                <TableCell>
                                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                                        <Stack alignItems="center" justifyContent="center" sx={{ pt: 0.25, flexShrink: 0 }}>
                                            {getActivityIcon(trail.activityType)}
                                        </Stack>
                                        <Stack spacing={0.5}>
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 200 }}>
                                                    {trail.name}
                                                </Typography>
                                                {trail.youtubeUrl && (
                                                    <Tooltip title={t('trail.video360', '360° Video')}>
                                                        <IconButton
                                                            size="small"
                                                            component="a"
                                                            href={trail.youtubeUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            aria-label="360° video"
                                                            onClick={e => e.stopPropagation()}
                                                            sx={{ p: 0.25 }}
                                                        >
                                                            <VideocamIcon sx={{ fontSize: 16 }} color="error" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                {trail.difficulty && (
                                                    <Chip label={trail.difficulty} size="small" color={getDifficultyColor(trail.difficulty)} variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                                                )}
                                                {trail.terrainType && (
                                                    <Chip label={t(`trail.terrainType.${trail.terrainType}`, { defaultValue: trail.terrainType })} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                                                )}
                                                {trail.trailType && trail.trailType !== 'Unknown' && (
                                                    <Chip label={trail.trailType} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                                                )}
                                            </Stack>
                                        </Stack>
                                    </Stack>
                                </TableCell>
                                <TableCell align="right">
                                    {distKm != null && distKm !== Infinity ? (
                                        <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.25}>
                                            <NearMeIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                                            <Typography variant="body2" noWrap>{formatDistanceKm(distKm)}</Typography>
                                        </Stack>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">—</Typography>
                                    )}
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2">{(trail.length / 1000).toFixed(1)} km</Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.25}>
                                        <TrendingUpIcon sx={{ fontSize: 13, color: 'success.main' }} />
                                        <Typography variant="body2">{Math.round(trail.elevationGain)} m</Typography>
                                    </Stack>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2" color="text.secondary" noWrap>
                                        {estimateDuration(trail.length, trail.elevationGain, trail.activityType) ?? '—'}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    {primaryLocation ? (
                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                            <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 140 }}>
                                                {primaryLocation}
                                            </Typography>
                                        </Stack>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">—</Typography>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {sortedTrails.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                <Typography color="text.secondary">{t('home.noTrailsFound', 'No trails found')}</Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default TrailTableView;
