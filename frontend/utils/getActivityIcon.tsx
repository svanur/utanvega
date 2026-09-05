import LandscapeIcon from '@mui/icons-material/Landscape';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import GrassIcon from '@mui/icons-material/Grass';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PetsIcon from '@mui/icons-material/Pets';
import PoolIcon from '@mui/icons-material/Pool';

// Split out of activityIcon.tsx: that file also exports the ActivityIcons component, and a
// component file that also exports a plain (non-component, lowercase) function trips
// react-refresh/only-export-components. This file exports only the plain function.
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
        case 'Canicross': return <PetsIcon fontSize="small" />;
        case 'IronMan': return <FitnessCenterIcon fontSize="small" />;
        case 'Other': return <HelpOutlineIcon fontSize="small" />;
        default: return <HelpOutlineIcon fontSize="small" />;
    }
}
