import React from 'react';
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
import { useNavigate } from 'react-router-dom';
import { Trail } from '../hooks/useTrails';

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
    const distanceKm = (trail.length / 1000).toFixed(1);
    const userDist = trail.distanceToUser !== undefined && trail.distanceToUser !== Infinity
        ? `${trail.distanceToUser.toFixed(1)} km away`
        : null;

    const handleClick = () => {
        navigate(`/trails/${trail.slug}`);
    };

    return (
        <Card sx={{ mb: 2, overflow: 'visible', position: 'relative' }}>
            <CardActionArea onClick={handleClick}>
                <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                        <Typography variant="h6" component="div" fontWeight="bold">
                            {trail.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Chip 
                                icon={getActivityIcon(trail.activityType)} 
                                label={trail.activityType} 
                                size="small" 
                                variant="outlined" 
                                color="primary"
                            />
                            {trail.locations?.map(loc => (
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
                        </Stack>
                    </Box>

                    {trail.description && (
                        <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ 
                                mb: 2,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {trail.description}
                        </Typography>
                    )}

                    <Stack direction="row" spacing={1.5} color="text.secondary" flexWrap="wrap">
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
                        <Box display="flex" alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                            {getTrailTypeIcon(trail.trailType)}
                            <Typography variant="body2" sx={{ ml: 0.5 }}>{getTrailTypeLabel(trail.trailType)}</Typography>
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
    );
};
