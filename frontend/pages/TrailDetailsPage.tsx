import { useState, useRef } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
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
    PaletteMode,
    Link,
    IconButton
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
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Layout from '../components/Layout';
import { useTrailBySlug, useTrails } from '../hooks/useTrails';
import TrailMap, { GeoJsonGeometry } from '../components/TrailMap';
import ElevationChart from '../components/ElevationChart';
import RoutePlayback from '../components/RoutePlayback';
import ShareButtons from '../components/ShareButtons';
import QRCodeShare from '../components/QRCodeShare';
import DifficultyInfo from '../components/DifficultyInfo';
import { TrailCard } from '../components/TrailCard';

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
    const { trails: allTrails } = useTrails();
    const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
    const [hoverPoint, setHoverPoint] = useState<{ lat: number; lng: number } | null>(null);
    const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);

    const relatedTrails = (allTrails && trail) 
        ? allTrails
            .filter(t => t.slug !== trail.slug) // Exclude current trail
            .filter(t => t.locations.some(loc => trail.locations.some(trailLoc => trailLoc.slug === loc.slug))) // Shared location
        : [];

    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const { scrollLeft, clientWidth } = scrollRef.current;
            const scrollAmount = clientWidth;
            scrollRef.current.scrollTo({
                left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
                behavior: 'smooth'
            });
        }
    };

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

            <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
                <Box mb={3}>
                    <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
                        {trail.name}
                    </Typography>
                    
                    <Stack 
                        direction="row" 
                        spacing={1} 
                        alignItems="center" 
                        justifyContent="flex-end"
                        flexWrap="wrap" 
                        useFlexGap 
                        sx={{ mb: 2 }}
                    >
                        {trail.difficulty && (
                            <DifficultyInfo difficulty={trail.difficulty} activityType={trail.activityType} />
                        )}
                        <Chip 
                            icon={getActivityIcon(trail.activityType)} 
                            label={trail.activityType} 
                            color="primary" 
                            variant="outlined" 
                            size="small"
                        />
                        {trail.locations && trail.locations.length > 0 && trail.locations.map((loc) => (
                            <Chip 
                                key={loc.slug}
                                icon={<LocationOnIcon sx={{ fontSize: '1rem' }} />} 
                                label={loc.name} 
                                variant="outlined"
                                color="secondary"
                                component={RouterLink}
                                to={`/locations/${loc.slug}`}
                                clickable
                                size="small"
                            />
                        ))}
                        {trail.tags && trail.tags.length > 0 && trail.tags.map((tag) => (
                            <Chip
                                key={tag.slug}
                                label={tag.name}
                                size="small"
                                component={RouterLink}
                                to={`/tags/${tag.slug}`}
                                clickable
                                sx={{
                                    backgroundColor: tag.color || undefined,
                                    color: tag.color ? '#fff' : undefined,
                                }}
                                variant={tag.color ? 'filled' : 'outlined'}
                            />
                        ))}
                        <ShareButtons title={trail.name} />
                        <QRCodeShare slug={trail.slug} trailName={trail.name} />
                    </Stack>

                    <Divider sx={{ my: 2, display: { xs: 'block', sm: 'none' }, opacity: 0.6 }} />

                    <Grid container spacing={1} sx={{ mt: 1 }}>
                        <Grid item xs={3}>
                            <Stack alignItems="center" spacing={0.5}>
                                <RouteIcon color="action" fontSize="small" />
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Distance</Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{distanceKm} km</Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={3}>
                            <Stack alignItems="center" spacing={0.5}>
                                <TrendingUpIcon color="action" fontSize="small" />
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Gain</Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>+{Math.round(trail.elevationGain)}m</Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={3}>
                            <Stack alignItems="center" spacing={0.5}>
                                <TrendingDownIcon color="action" fontSize="small" />
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Loss</Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>-{Math.round(trail.elevationLoss)}m</Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={3}>
                            <Stack alignItems="center" spacing={0.5}>
                                {getTrailTypeIcon(trail.trailType)}
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Type</Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>{getTrailTypeLabel(trail.trailType)}</Typography>
                            </Stack>
                        </Grid>
                    </Grid>
                </Box>

                <Divider sx={{ mb: 3 }} />

                <Typography variant="h6" gutterBottom>
                    Route Map
                </Typography>
                <TrailMap 
                    slug={trail.slug} 
                    onDataLoaded={setGeometry} 
                    hoverPoint={hoverPoint}
                    activityType={trail.activityType}
                />

                {geometry && (
                    <>
                        <RoutePlayback
                            coordinates={geometry.coordinates}
                            onPointChange={setHoverPoint}
                            onIndexChange={setPlaybackIndex}
                        />
                        <ElevationChart 
                            coordinates={geometry.coordinates} 
                            onHover={(point: any) => setHoverPoint(point ? { lat: point.lat, lng: point.lng } : null)}
                            activeIndex={playbackIndex}
                        />
                    </>
                )}
            </Paper>

            {relatedTrails.length > 0 && (
                <Box mt={4} mb={6}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="h5" component="h2" fontWeight="bold">
                            Related Trails
                        </Typography>
                        {relatedTrails.length > 3 && (
                            <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
                                <IconButton onClick={() => scroll('left')} size="small">
                                    <ChevronLeftIcon />
                                </IconButton>
                                <IconButton onClick={() => scroll('right')} size="small">
                                    <ChevronRightIcon />
                                </IconButton>
                            </Box>
                        )}
                    </Box>
                    <Box 
                        ref={scrollRef}
                        sx={{ 
                            display: 'flex', 
                            overflowX: 'auto', 
                            gap: 2,
                            pb: 1,
                            scrollSnapType: 'x mandatory',
                            '&::-webkit-scrollbar': { display: 'none' },
                            msOverflowStyle: 'none',
                            scrollbarWidth: 'none',
                        }}
                    >
                        {relatedTrails.map((relatedTrail) => (
                            <Box 
                                key={relatedTrail.slug} 
                                sx={{ 
                                    minWidth: { xs: '85%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 10.7px)' },
                                    scrollSnapAlign: 'start'
                                }}
                            >
                                <TrailCard trail={relatedTrail} compact={true} />
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}
        </Layout>
    );
}
