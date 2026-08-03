import LandscapeIcon from '@mui/icons-material/Landscape';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import GrassIcon from '@mui/icons-material/Grass';
import CampaignIcon from '@mui/icons-material/Campaign';
import RouteIcon from '@mui/icons-material/Route';
import PoolIcon from '@mui/icons-material/Pool';
import { Box, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

export function getActivityIcon(type: string) {
    switch (type) {
        case 'TrailRunning': return <LandscapeIcon fontSize="small" />;
        case 'Running': return <DirectionsRunIcon fontSize="small" />;
        case 'Hiking': return <HikingIcon fontSize="small" />;
        case 'Cycling': return <DirectionsBikeIcon fontSize="small" />;
        case 'FunRun': return <CelebrationIcon fontSize="small" />;
        case 'ObstacleCourse': return <FitnessCenterIcon fontSize="small" />;
        case 'CrossCountryRun': return <GrassIcon fontSize="small" />;
        case 'Swim': return <PoolIcon fontSize="small" />;
        case 'Advertisement': return <CampaignIcon fontSize="small" />;
        default: return <RouteIcon fontSize="small" />;
    }
}

interface ActivityIconsProps {
    activityTypes?: string[] | null;
    activityType: string;
}

export function ActivityIcons({ activityTypes, activityType }: ActivityIconsProps) {
    const { t } = useTranslation();
    const types = activityTypes && activityTypes.length > 0 ? activityTypes : [activityType];
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0, pt: 0.3, color: 'text.secondary' }}>
            {types.map(type => (
                <Tooltip key={type} title={t(`races.activityTypes.${type}`, { defaultValue: type })}>
                    <span style={{ display: 'flex' }}>{getActivityIcon(type)}</span>
                </Tooltip>
            ))}
        </Box>
    );
}
