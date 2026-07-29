import LandscapeIcon from '@mui/icons-material/Landscape';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import GrassIcon from '@mui/icons-material/Grass';
import CampaignIcon from '@mui/icons-material/Campaign';
import RouteIcon from '@mui/icons-material/Route';

export function getActivityIcon(type: string) {
    switch (type) {
        case 'TrailRunning': return <LandscapeIcon fontSize="small" />;
        case 'Running': return <DirectionsRunIcon fontSize="small" />;
        case 'Hiking': return <HikingIcon fontSize="small" />;
        case 'Cycling': return <DirectionsBikeIcon fontSize="small" />;
        case 'FunRun': return <CelebrationIcon fontSize="small" />;
        case 'ObstacleCourse': return <FitnessCenterIcon fontSize="small" />;
        case 'CrossCountryRun': return <GrassIcon fontSize="small" />;
        case 'Advertisement': return <CampaignIcon fontSize="small" />;
        default: return <RouteIcon fontSize="small" />;
    }
}
