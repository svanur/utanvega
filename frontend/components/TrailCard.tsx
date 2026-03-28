import React from 'react';
import { 
    Card, 
    CardContent, 
    Typography, 
    Box, 
    Stack, 
    Chip 
} from '@mui/material';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import TerrainIcon from '@mui/icons-material/Terrain';
import RouteIcon from '@mui/icons-material/Route';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { Trail } from '../hooks/useTrails';

interface TrailCardProps {
    trail: Trail;
}

const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'running': return <DirectionsRunIcon fontSize="small" />;
        case 'cycling': return <DirectionsBikeIcon fontSize="small" />;
        case 'hiking': return <TerrainIcon fontSize="small" />;
        default: return <RouteIcon fontSize="small" />;
    }
};

export const TrailCard: React.FC<TrailCardProps> = ({ trail }) => {
    const distanceKm = (trail.length / 1000).toFixed(1);
    const userDist = trail.distanceToUser !== undefined && trail.distanceToUser !== Infinity
        ? `${trail.distanceToUser.toFixed(1)} km away`
        : null;

    return (
        <Card sx={{ mb: 2, overflow: 'visible', position: 'relative' }}>
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Typography variant="h6" component="div" fontWeight="bold">
                        {trail.name}
                    </Typography>
                    <Chip 
                        icon={getActivityIcon(trail.activityType)} 
                        label={trail.activityType} 
                        size="small" 
                        variant="outlined" 
                        color="primary"
                    />
                </Box>

                <Stack direction="row" spacing={2} color="text.secondary">
                    <Box display="flex" alignItems="center">
                        <RouteIcon sx={{ mr: 0.5, fontSize: 18 }} />
                        <Typography variant="body2">{distanceKm} km</Typography>
                    </Box>
                    <Box display="flex" alignItems="center">
                        <TrendingUpIcon sx={{ mr: 0.5, fontSize: 18 }} />
                        <Typography variant="body2">+{Math.round(trail.elevationGain)} m</Typography>
                    </Box>
                    {userDist && (
                        <Box display="flex" alignItems="center" ml="auto !important">
                            <LocationOnIcon sx={{ mr: 0.5, fontSize: 18, color: 'primary.main' }} />
                            <Typography variant="body2" color="primary.main" fontWeight="medium">
                                {userDist}
                            </Typography>
                        </Box>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
};
