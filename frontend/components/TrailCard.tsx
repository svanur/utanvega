import React, { useState, useRef } from 'react';
import { 
    Card, 
    CardContent, 
    Typography, 
    Box, 
    Stack, 
    Chip,
    CardActionArea
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
import { useNavigate } from 'react-router-dom';
import { Trail } from '../hooks/useTrails';
import { useFavorites } from '../hooks/useFavorites';

interface TrailCardProps {
    trail: Trail;
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

export const TrailCard: React.FC<TrailCardProps> = ({ trail }) => {
    const navigate = useNavigate();
    const { isFavorite, toggleFavorite } = useFavorites();
    const [swipeOffset, setSwipeOffset] = useState(0);
    const touchStart = useRef<number | null>(null);
    const isFavorited = isFavorite(trail.slug);

    const distanceKm = (trail.length / 1000).toFixed(1);
    const userDist = trail.distanceToUser !== undefined && trail.distanceToUser !== Infinity
        ? `${trail.distanceToUser.toFixed(1)} km away`
        : null;

    const handleClick = () => {
        if (Math.abs(swipeOffset) < 10) {
            navigate(`/trails/${trail.slug}`);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStart.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStart.current !== null) {
            const currentX = e.touches[0].clientX;
            const diff = currentX - touchStart.current;
            // Only allow right swipe for favorites, max offset for effect
            if (diff > 0) {
                setSwipeOffset(Math.min(diff, 150));
            }
        }
    };

    const handleTouchEnd = () => {
        if (swipeOffset > 100) {
            toggleFavorite(trail.slug);
            // Trigger haptic feedback if available
            if ('vibrate' in navigator) {
                navigator.vibrate(10);
            }
        }
        setSwipeOffset(0);
        touchStart.current = null;
    };

    return (
        <Box sx={{ position: 'relative', mb: 2 }}>
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
                        {[...trail.locations]
                            .sort((a, b) => a.order - b.order)
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
                    <Stack direction="row" spacing={1.5} color="text.secondary" flexWrap="wrap" mt={2}>
                        <Box display="flex" alignItems="center">
                            <RouteIcon sx={{ mr: 0.5, fontSize: 18 }} />
                            <Typography variant="body2">{distanceKm} km</Typography>
                        </Box>
                        <Box display="flex" alignItems="center">
                            <TrendingUpIcon sx={{ mr: 0.5, fontSize: 18 }} />
                            <Typography variant="body2">+{Math.round(trail.elevationGain)} m</Typography>
                        </Box>
                        <Box display="flex" alignItems="center">
                            <TrendingDownIcon sx={{ mr: 0.5, fontSize: 18 }} />
                            <Typography variant="body2">-{Math.round(trail.elevationLoss)} m</Typography>
                        </Box>
                        {userDist && (
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
        </Box>
    );
};
