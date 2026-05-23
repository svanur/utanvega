import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TableSortLabel, Paper, Typography, Chip, IconButton, Tooltip, Stack,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import LandscapeIcon from '@mui/icons-material/Landscape';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import GrassIcon from '@mui/icons-material/Grass';
import type { Trail } from '../hooks/useTrails';

interface TrailTableViewProps {
    trails: Trail[];
    favorites: string[];
    onToggleFavorite: (slug: string) => void;
    userLocation: { lat: number; lng: number } | null;
}

type SortField = 'name' | 'length' | 'elevationGain' | 'difficulty' | 'activityType' | 'distance' | 'location';
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

function getActivityIcon(type: string) {
    switch (type) {
        case 'TrailRunning': return <LandscapeIcon fontSize="small" />;
        case 'Running': return <DirectionsRunIcon fontSize="small" />;
        case 'Hiking': return <HikingIcon fontSize="small" />;
        case 'Cycling': return <DirectionsBikeIcon fontSize="small" />;
        case 'FunRun': return <CelebrationIcon fontSize="small" />;
        case 'ObstacleCourse': return <FitnessCenterIcon fontSize="small" />;
        case 'CrossCountryRun': return <GrassIcon fontSize="small" />;
        default: return <DirectionsRunIcon fontSize="small" />;
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
                default:
                    return 0;
            }
        });
    }, [trails, sortField, sortDir]);

    const columns: { field: SortField; label: string; align?: 'left' | 'right' | 'center' }[] = [
        { field: 'name', label: t('trail.name', 'Name') },
        { field: 'length', label: t('trail.distance'), align: 'right' },
        { field: 'elevationGain', label: t('trail.gain'), align: 'right' },
        { field: 'distance', label: t('trail.kmAway', 'km away'), align: 'right' },
        { field: 'difficulty', label: t('trail.difficulty', 'Difficulty'), align: 'center' },
        { field: 'activityType', label: t('trail.activity', 'Activity'), align: 'center' },
        { field: 'location', label: t('trail.location', 'Location') },
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
                        <TableCell align="center">360°</TableCell>
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
                                onClick={() => navigate(`/trails/${trail.slug}`)}
                            >
                                <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                                    <IconButton size="small" onClick={() => onToggleFavorite(trail.slug)} aria-label={isFav ? 'Unfavorite' : 'Favorite'}>
                                        {isFav ? <StarIcon fontSize="small" color="warning" /> : <StarBorderIcon fontSize="small" />}
                                    </IconButton>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 220 }}>
                                        {trail.name}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2">{(trail.length / 1000).toFixed(1)} km</Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2">{Math.round(trail.elevationGain)} m</Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2" color="text.secondary">
                                        {distKm != null && distKm !== Infinity
                                            ? `${distKm.toFixed(1)} km`
                                            : '—'}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center">
                                    <Chip label={trail.difficulty} size="small" color={getDifficultyColor(trail.difficulty)} variant="outlined" />
                                </TableCell>
                                <TableCell align="center">
                                    <Tooltip title={t(`difficulty.${trail.activityType.charAt(0).toLowerCase() + trail.activityType.slice(1)}`, trail.activityType)}>
                                        <Stack alignItems="center">
                                            {getActivityIcon(trail.activityType)}
                                        </Stack>
                                    </Tooltip>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 140 }}>
                                        {primaryLocation ?? '—'}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center" onClick={e => e.stopPropagation()}>
                                    {trail.youtubeUrl ? (
                                        <Tooltip title={t('video360', '360° Video')}>
                                            <IconButton
                                                size="small"
                                                component="a"
                                                href={trail.youtubeUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label="360° video"
                                            >
                                                <img src="/images/360-play.avif" alt="360°" style={{ width: 20, height: 20 }} />
                                            </IconButton>
                                        </Tooltip>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {sortedTrails.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
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
