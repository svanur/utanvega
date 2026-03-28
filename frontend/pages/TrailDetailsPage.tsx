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
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import TerrainIcon from '@mui/icons-material/Terrain';
import Layout from '../components/Layout';
import { useTrailBySlug } from '../hooks/useTrails';
import TrailMap, { GeoJsonGeometry } from '../components/TrailMap';
import ElevationChart from '../components/ElevationChart';

const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'running': return <DirectionsRunIcon />;
        case 'cycling': return <DirectionsBikeIcon />;
        case 'hiking': return <TerrainIcon />;
        default: return <RouteIcon />;
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
                    <Chip 
                        icon={getActivityIcon(trail.activityType)} 
                        label={trail.activityType} 
                        color="primary" 
                        variant="outlined" 
                    />
                </Box>

                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={4}>
                        <Stack alignItems="center" spacing={1}>
                            <RouteIcon color="action" />
                            <Typography variant="body2" color="text.secondary">Distance</Typography>
                            <Typography variant="h6">{distanceKm} km</Typography>
                        </Stack>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Stack alignItems="center" spacing={1}>
                            <TrendingUpIcon color="action" />
                            <Typography variant="body2" color="text.secondary">Elevation Gain</Typography>
                            <Typography variant="h6">+{Math.round(trail.elevationGain)} m</Typography>
                        </Stack>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Stack alignItems="center" spacing={1}>
                            <TrendingDownIcon color="action" />
                            <Typography variant="body2" color="text.secondary">Elevation Loss</Typography>
                            <Typography variant="h6">-{Math.round(trail.elevationLoss)} m</Typography>
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
