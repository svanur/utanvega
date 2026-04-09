import React, { useState, useEffect, useMemo } from 'react';
import { 
    Dialog, 
    DialogContent, 
    Box, 
    Typography, 
    IconButton, 
    Chip,
    Button,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RouteIcon from '@mui/icons-material/Route';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import LandscapeIcon from '@mui/icons-material/Landscape';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trail, API_URL } from '../hooks/useTrails';
import { estimateDuration } from '../utils/estimateDuration';
import DifficultyInfo from './DifficultyInfo';

// Mini SVG elevation silhouette for background
function ElevationSilhouette({ coordinates, color }: { coordinates: number[][]; color: string }) {
    const path = useMemo(() => {
        if (!coordinates || coordinates.length < 2) return '';
        const elevations = coordinates.map(c => c.length > 2 ? c[2] : 0);
        const minE = Math.min(...elevations);
        const maxE = Math.max(...elevations);
        const range = maxE - minE || 1;

        // Sample ~80 points max for performance
        const step = Math.max(1, Math.floor(coordinates.length / 80));
        const sampled = elevations.filter((_, i) => i % step === 0 || i === elevations.length - 1);

        const width = 100;
        const height = 100;
        const points = sampled.map((e, i) => {
            const x = (i / (sampled.length - 1)) * width;
            const y = height - ((e - minE) / range) * height * 0.8 - height * 0.1;
            return `${x},${y}`;
        });

        return `M0,${height} L${points.join(' L')} L${width},${height} Z`;
    }, [coordinates]);

    if (!path) return null;

    return (
        <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0.08,
                pointerEvents: 'none',
            }}
        >
            <path d={path} fill={color} />
        </svg>
    );
}

interface TrailQuickViewProps {
    trail: Trail | null;
    open: boolean;
    onClose: () => void;
}

const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'trailrunning': return <LandscapeIcon fontSize="small" />;
        case 'running': return <DirectionsRunIcon fontSize="small" />;
        case 'cycling': return <DirectionsBikeIcon fontSize="small" />;
        case 'hiking': return <HikingIcon fontSize="small" />;
        default: return <RouteIcon fontSize="small" />;
    }
};

const getTrailTypeLabelTranslated = (type: string, t: (key: string) => string) => {
    switch (type) {
        case 'OutAndBack': return t('quickView.outAndBack');
        case 'Loop': return t('quickView.loop');
        case 'PointToPoint': return t('quickView.pointToPoint');
        default: return type.toLowerCase();
    }
};


function generateSummary(trail: Trail, t: (key: string, opts?: Record<string, unknown>) => string, language: string): string {
    const km = (trail.length / 1000).toFixed(1);
    const difficultyRaw = trail.difficulty?.toLowerCase() || '';
    const difficulty = difficultyRaw ? t(`difficulty.${difficultyRaw}`) : '';
    const trailType = getTrailTypeLabelTranslated(trail.trailType, t);
    const locationName = trail.locations.length > 0 ? trail.locations[0].name : null;
    const gain = Math.round(trail.elevationGain);

    let s = difficulty
        ? t('quickView.summaryBase', { difficulty, km, trailType })
        : t('quickView.summaryBaseNoDifficulty', { km, trailType });

    if (language === 'is') {
        // IS: {difficulty} leið, {km} km {trailType} með {gain}m hækkun. Staðsetning: {location}.
        if (gain > 50) s += ` ${t('quickView.summaryGain', { gain })}`;
        s += '.';
        if (locationName) s += ` ${t('quickView.summaryIn', { location: locationName })}.`;
    } else {
        // EN: A {difficulty} {km} km {trailType} in {location} with {gain}m elevation gain
        if (locationName) s += ` ${t('quickView.summaryIn', { location: locationName })}`;
        if (gain > 50) s += ` ${t('quickView.summaryGain', { gain })}`;
    }

    return s;
}

export const TrailQuickView: React.FC<TrailQuickViewProps> = ({ trail, open, onClose }) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [coordinates, setCoordinates] = useState<number[][] | null>(null);

    useEffect(() => {
        if (open && trail) {
            fetch(`${API_URL}/api/v1/trails/${trail.slug}/geometry`)
                .then(res => res.ok ? res.json() : null)
                .then(data => setCoordinates(data?.coordinates || null))
                .catch(() => setCoordinates(null));
        } else if (!open) {
            setCoordinates(null);
        }
    }, [open, trail]);

    if (!trail) return null;

    const distanceKm = (trail.length / 1000).toFixed(1);
    const estTime = estimateDuration(trail.length, trail.elevationGain, trail.activityType);
    const summary = generateSummary(trail, t, i18n.language);

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            fullScreen={false}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: { 
                    borderRadius: fullScreen ? '0 0 16px 16px' : 3,
                    ...(fullScreen && {
                        position: 'fixed',
                        top: 0,
                        m: 0,
                    }),
                }
            }}
            sx={{
                '& .MuiDialog-container': { alignItems: 'flex-start' },
            }}
            slotProps={{
                backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.3)' } }
            }}
        >
            <DialogContent sx={{ p: 2, position: 'relative', overflow: 'hidden' }}>
                {/* Elevation silhouette background */}
                {coordinates && (
                    <ElevationSilhouette coordinates={coordinates} color={theme.palette.primary.main} />
                )}
                {/* Header: name + close */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Typography variant="h6" fontWeight="bold" sx={{ pr: 2 }}>
                        {trail.name}
                    </Typography>
                    <IconButton onClick={onClose} size="small" edge="end">
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>

                {/* Summary */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {summary}
                </Typography>

                {/* Stats strip */}
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-around', 
                    alignItems: 'center',
                    bgcolor: theme.palette.action.hover,
                    borderRadius: 2,
                    py: 1.5,
                    mb: 2,
                }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                            <RouteIcon sx={{ fontSize: 16 }} color="action" />
                            <Typography variant="subtitle2" fontWeight="bold">{distanceKm} km</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">{t('quickView.distance')}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                            <TrendingUpIcon sx={{ fontSize: 16 }} color="success" />
                            <Typography variant="subtitle2" fontWeight="bold">+{Math.round(trail.elevationGain)}m</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">{t('quickView.gain')}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                            <TrendingDownIcon sx={{ fontSize: 16 }} color="error" />
                            <Typography variant="subtitle2" fontWeight="bold">-{Math.round(trail.elevationLoss)}m</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">{t('quickView.loss')}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                            <AccessTimeIcon sx={{ fontSize: 16 }} color="primary" />
                            <Typography variant="subtitle2" fontWeight="bold">{estTime}</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">{t('quickView.estTime')}</Typography>
                    </Box>
                </Box>

                {/* Chips */}
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                    {trail.difficulty && (
                        <DifficultyInfo difficulty={trail.difficulty} activityType={trail.activityType} />
                    )}
                    <Chip
                        icon={getActivityIcon(trail.activityType)}
                        label={trail.activityType}
                        size="small"
                        variant="outlined"
                        color="primary"
                    />
                    {trail.locations.map(loc => (
                        <Chip key={loc.slug} label={loc.name} size="small" variant="outlined" />
                    ))}
                    {trail.tags?.map(tag => (
                        <Chip
                            key={tag.slug}
                            label={tag.name}
                            size="small"
                            sx={{
                                backgroundColor: tag.color || undefined,
                                color: tag.color ? '#fff' : undefined,
                            }}
                            variant={tag.color ? 'filled' : 'outlined'}
                        />
                    ))}
                </Box>

                {/* View details button */}
                <Button
                    fullWidth
                    variant="contained"
                    endIcon={<OpenInNewIcon />}
                    onClick={() => {
                        onClose();
                        navigate(`/trails/${trail.slug}`);
                    }}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
                >
                    {t('quickView.viewDetails')}
                </Button>
            </DialogContent>
        </Dialog>
    );
};
