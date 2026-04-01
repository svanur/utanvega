import React, { useState, useRef, useCallback } from 'react';
import { 
    Card, 
    CardContent, 
    Typography, 
    Box, 
    Stack, 
    Chip,
    CardActionArea,
    Grid
} from '@mui/material';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import LandscapeIcon from '@mui/icons-material/Landscape';
import RouteIcon from '@mui/icons-material/Route';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LoopIcon from '@mui/icons-material/Loop';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import EastIcon from '@mui/icons-material/East';
import StarIcon from '@mui/icons-material/Star';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useNavigate } from 'react-router-dom';
import { Trail } from '../hooks/useTrails';
import { useFavorites } from '../hooks/useFavorites';
import { useHiddenTrails } from '../hooks/useHiddenTrails';
import { TrailQuickView } from './TrailQuickView';
import DifficultyInfo from './DifficultyInfo';

interface TrailCardProps {
    trail: Trail;
    onToggleFavorite?: (slug: string) => void;
    onHide?: (slug: string) => void;
    isHiding?: boolean;
    compact?: boolean;
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

const getTrailTypeIcon = (type: string) => {
    switch (type) {
        case 'OutAndBack': return <SyncAltIcon sx={{ fontSize: 18 }} />;
        case 'Loop': return <LoopIcon sx={{ fontSize: 18 }} />;
        case 'PointToPoint': return <EastIcon sx={{ fontSize: 18 }} />;
        default: return <RouteIcon sx={{ fontSize: 18 }} />;
    }
};

const getTrailTypeLabel = (type: string) => {
    switch (type) {
        case 'OutAndBack': return 'Out and Back';
        case 'Loop': return 'Loop';
        case 'PointToPoint': return 'Point to Point';
        default: return type;
    }
};

export const TrailCard: React.FC<TrailCardProps> = ({ trail, onToggleFavorite, onHide, isHiding, compact }) => {
    const navigate = useNavigate();
    const { isFavorite, toggleFavorite } = useFavorites();
    const { hideTrail } = useHiddenTrails();
    const [swipeOffset, setSwipeOffset] = useState(0);
    const touchStart = useRef<number | null>(null);
    const touchYStart = useRef<number | null>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [quickViewOpen, setQuickViewOpen] = useState(false);
    const isFavorited = isFavorite(trail.slug);

    const distanceKm = (trail.length / 1000).toFixed(1);
    const userDist = trail.distanceToUser !== undefined && trail.distanceToUser !== Infinity
        ? `${trail.distanceToUser.toFixed(1)} km away`
        : null;

    const handleClick = () => {
        if (Math.abs(swipeOffset) < 10 && !quickViewOpen) {
            navigate(`/trails/${trail.slug}`);
        }
    };

    const handleLongPress = useCallback(() => {
        setQuickViewOpen(true);
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStart.current = e.touches[0].clientX;
        touchYStart.current = e.touches[0].clientY;

        // Start long press timer
        longPressTimer.current = setTimeout(handleLongPress, 600);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStart.current !== null) {
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = currentX - touchStart.current;
            const diffY = currentY - (touchYStart.current || 0);

            // If we move more than 10px in any direction, cancel long press
            if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
                if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                }
            }

            // Allow right swipe for favorites and left swipe for hiding
            if (!quickViewOpen) {
                if (diffX > 0) {
                    setSwipeOffset(Math.min(diffX, 150));
                } else {
                    setSwipeOffset(Math.max(diffX, -150));
                }
            }
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (swipeOffset > 100) {
            if (onToggleFavorite) {
                onToggleFavorite(trail.slug);
            } else {
                toggleFavorite(trail.slug);
            }
            // Trigger haptic feedback if available
            if ('vibrate' in navigator) {
                navigator.vibrate(10);
            }
        } else if (swipeOffset < -100) {
            if (onHide) {
                onHide(trail.slug);
            } else {
                hideTrail(trail.slug);
            }
            // Trigger haptic feedback if available
            if ('vibrate' in navigator) {
                navigator.vibrate(10);
            }
        }
        setSwipeOffset(0);
        touchStart.current = null;
        touchYStart.current = null;
    };

    return (
        <Box 
            sx={{ 
                position: 'relative', 
                mb: 2,
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                opacity: isHiding ? 0 : 1,
                transform: isHiding ? 'translateX(-100%)' : 'none'
            }}
        >
            {/* Background Swipe Indicator */}
            <Box 
                sx={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    bgcolor: isFavorited ? 'warning.light' : 'primary.main',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    pl: 3,
                    opacity: swipeOffset > 0 ? Math.min(swipeOffset / 100, 1) : 0,
                    zIndex: 0
                }}
            >
                <StarIcon sx={{ color: 'white' }} />
                <Typography sx={{ color: 'white', ml: 1, fontWeight: 'bold' }}>
                    {isFavorited ? 'Remove Favorite' : 'Add Favorite'}
                </Typography>
            </Box>

            {/* Right Background Swipe Indicator (Hide) */}
            <Box 
                sx={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    bgcolor: 'error.main',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pr: 3,
                    opacity: swipeOffset < 0 ? Math.min(Math.abs(swipeOffset) / 100, 1) : 0,
                    zIndex: 0
                }}
            >
                <Typography sx={{ color: 'white', mr: 1, fontWeight: 'bold' }}>
                    Hide Trail
                </Typography>
                <VisibilityOffIcon sx={{ color: 'white' }} />
            </Box>

            <Card 
                sx={{ 
                    overflow: 'visible', 
                    position: 'relative',
                    transform: `translateX(${swipeOffset}px)`,
                    transition: swipeOffset === 0 ? 'transform 0.3s ease' : 'none',
                    zIndex: 1
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <CardActionArea onClick={handleClick}>
                    <CardContent>
                        {/* 1st row: Trail name and favorite star */}
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="h6" component="div" fontWeight="bold">
                                {trail.name}
                            </Typography>
                            {isFavorited && <StarIcon color="warning" fontSize="small" />}
                        </Box>

                    {/* 2nd row: ActivityType and locations */}
                    <Box 
                        mt={1}
                        display="flex" 
                        flexWrap="wrap" 
                        gap={1}
                        justifyContent="flex-end"
                    >
                        <Chip 
                            icon={getActivityIcon(trail.activityType)} 
                            label={trail.activityType} 
                            size="small" 
                            variant="outlined" 
                            color="primary"
                        />
                        {trail.difficulty && (
                            <DifficultyInfo difficulty={trail.difficulty} />
                        )}
                        {[...trail.locations]
                            .sort((a, b) => a.order - b.order)
                            .slice(0, compact ? 1 : undefined)
                            .map(loc => (
                                <Chip
                                    key={loc.slug}
                                    label={loc.name}
                                    size="small"
                                    variant="outlined"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/locations/${loc.slug}`);
                                    }}
                                    sx={{ cursor: 'pointer' }}
                                />
                            ))}
                    </Box>

                    {/* 3rd row: distance, gain, loss, distance-to-user */}
                    <Stack direction="row" spacing={compact ? 1 : 1.5} color="text.secondary" flexWrap="wrap" mt={2} justifyContent={compact ? 'space-between' : 'flex-start'}>
                        <Box display="flex" flexDirection={compact ? 'column' : 'row'} alignItems="center">
                            <RouteIcon sx={{ mr: compact ? 0 : 0.5, mb: compact ? 0.5 : 0, fontSize: 18 }} />
                            <Typography variant="body2">{distanceKm} km</Typography>
                        </Box>
                        <Box display="flex" flexDirection={compact ? 'column' : 'row'} alignItems="center">
                            <TrendingUpIcon sx={{ mr: compact ? 0 : 0.5, mb: compact ? 0.5 : 0, fontSize: 18 }} />
                            <Typography variant="body2">+{Math.round(trail.elevationGain)} m</Typography>
                        </Box>
                        <Box display="flex" flexDirection={compact ? 'column' : 'row'} alignItems="center">
                            <TrendingDownIcon sx={{ mr: compact ? 0 : 0.5, mb: compact ? 0.5 : 0, fontSize: 18 }} />
                            <Typography variant="body2">-{Math.round(trail.elevationLoss)} m</Typography>
                        </Box>
                        {userDist && !compact && (
                            <Box display="flex" alignItems="center">
                                <LocationOnIcon sx={{ mr: 0.5, fontSize: 18, color: 'primary.main' }} />
                                <Typography variant="body2" color="primary.main" fontWeight="medium">
                                    {userDist}
                                </Typography>
                            </Box>
                        )}
                    </Stack>
                    </CardContent>
                </CardActionArea>
            </Card>

            <TrailQuickView 
                trail={trail} 
                open={quickViewOpen} 
                onClose={() => setQuickViewOpen(false)} 
            />
        </Box>
    );
};
