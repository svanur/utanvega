import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    CircularProgress, 
    Button, 
    Paper, 
    Grid, 
    Chip,
    Divider,
    Stack,
    PaletteMode
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RouteIcon from '@mui/icons-material/Route';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import LandscapeIcon from '@mui/icons-material/Landscape';
import LoopIcon from '@mui/icons-material/Loop';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import EastIcon from '@mui/icons-material/East';
import Layout from '../components/Layout';
import { useTrailBySlug } from '../hooks/useTrails';
import TrailMap, { GeoJsonGeometry } from '../components/TrailMap';
import ElevationChart from '../components/ElevationChart';
import ShareButtons from '../components/ShareButtons';
import QRCodeShare from '../components/QRCodeShare';

const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'trailrunning': return <LandscapeIcon />;
        case 'running': return <DirectionsRunIcon />;
        case 'cycling': return <DirectionsBikeIcon />;
        case 'hiking': return <HikingIcon />;
        default: return <RouteIcon />;
    }
};

const getTrailTypeIcon = (type: string) => {
    switch (type) {
        case 'OutAndBack': return <SyncAltIcon color="action" />;
        case 'Loop': return <LoopIcon color="action" />;
        case 'PointToPoint': return <EastIcon color="action" />;
        default: return <RouteIcon color="action" />;
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

type TrailDetailsPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function TrailDetailsPage({ mode, onToggleMode }: TrailDetailsPageProps) {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { trail, loading, error } = useTrailBySlug(slug);
    const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
    const [hoverPoint, setHoverPoint] = useState<{ lat: number; lng: number } | null>(null);

    if (loading) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                    <CircularProgress />
                </Box>
            </Layout>
        );
    }

    if (error || !trail) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Box textAlign="center" mt={4}>
                    <Typography color="error" variant="h6">
                        {error || 'Trail not found'}
                    </Typography>
                    <Button 
                        startIcon={<ArrowBackIcon />} 
                        onClick={() => navigate('/')}
                        sx={{ mt: 2 }}
                    >
                        Back to Trails
                    </Button>
                </Box>
            </Layout>
        );
    }

    const distanceKm = (trail.length / 1000).toFixed(2);

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Button 
                startIcon={<ArrowBackIcon />} 
                onClick={() => navigate('/')}
                sx={{ mb: 2 }}
            >
                Back to Trails
            </Button>

            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="h4" component="h1" fontWeight="bold">
                        {trail.name}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                            icon={getActivityIcon(trail.activityType)} 
                            label={trail.activityType} 
                            color="primary" 
                            variant="outlined" 
                        />
                        <ShareButtons title={trail.name} />
                        <QRCodeShare slug={trail.slug} trailName={trail.name} />
                    </Stack>
                </Box>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={3} sm={3}>
                        <Stack alignItems="center" spacing={0.5} justifyContent="center">
                            <RouteIcon color="action" />
                            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Distance</Typography>
                            <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' } }}>{distanceKm} km</Typography>
                        </Stack>
                    </Grid>
                    <Grid item xs={3} sm={3}>
                        <Stack alignItems="center" spacing={0.5} justifyContent="center">
                            <TrendingUpIcon color="action" />
                            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Elevation Gain</Typography>
                            <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' } }}>+{Math.round(trail.elevationGain)} m</Typography>
                        </Stack>
                    </Grid>
                    <Grid item xs={3} sm={3}>
                        <Stack alignItems="center" spacing={0.5} justifyContent="center">
                            <TrendingDownIcon color="action" />
                            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Elevation Loss</Typography>
                            <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' } }}>-{Math.round(trail.elevationLoss)} m</Typography>
                        </Stack>
                    </Grid>
                    <Grid item xs={3} sm={3}>
                        <Stack alignItems="center" spacing={0.5} justifyContent="center">
                            {getTrailTypeIcon(trail.trailType)}
                            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Trail Type</Typography>
                            <Typography variant="h6" sx={{ fontSize: { xs: '0.8rem', sm: '1.25rem' }, textAlign: 'center', lineHeight: 1.1 }}>{getTrailTypeLabel(trail.trailType)}</Typography>
                        </Stack>
                    </Grid>
                </Grid>

                <Divider sx={{ mb: 3 }} />

                <Typography variant="h6" gutterBottom>
                    Route Map
                </Typography>
                <TrailMap 
                    slug={trail.slug} 
                    onDataLoaded={setGeometry} 
                    hoverPoint={hoverPoint}
                />

                {geometry && (
                    <ElevationChart 
                        coordinates={geometry.coordinates} 
                        onHover={(point: any) => setHoverPoint(point ? { lat: point.lat, lng: point.lng } : null)} 
                    />
                )}
            </Paper>
        </Layout>
    );
}
