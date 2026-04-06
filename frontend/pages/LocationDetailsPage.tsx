import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Box, 
    Typography, 
    Button, 
    Paper, 
    Grid, 
    Chip,
    Stack,
    PaletteMode,
    Container,
    Alert,
    Divider,
    Card,
    CardActionArea,
    CardContent
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FolderIcon from '@mui/icons-material/Folder';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Layout from '../components/Layout';
import { useLocationBySlug, useLocationTree } from '../hooks/useLocations';
import type { LocationTreeNode } from '../hooks/useLocations';
import { TrailCard } from '../components/TrailCard';
import { TrailMapView } from '../components/TrailMapView';
import RunningLoader from '../components/RunningLoader';

type LocationDetailsPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function LocationDetailsPage({ mode, onToggleMode }: LocationDetailsPageProps) {
    const { t } = useTranslation();
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { location, childLocations, trails, loading, error } = useLocationBySlug(slug);
    const { tree: locationTree } = useLocationTree();
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    // Build breadcrumb path from tree
    const breadcrumbs = useMemo(() => {
        if (!slug || locationTree.length === 0) return [];

        function findPath(nodes: LocationTreeNode[], target: string): { name: string; slug: string }[] | null {
            for (const node of nodes) {
                if (node.slug === target) return [{ name: node.name, slug: node.slug }];
                const childPath = findPath(node.children, target);
                if (childPath) return [{ name: node.name, slug: node.slug }, ...childPath];
            }
            return null;
        }

        return findPath(locationTree, slug) || [];
    }, [slug, locationTree]);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (err) => {
                    console.warn('Geolocation failed:', err.message);
                }
            );
        }
    }, []);

    if (loading) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                    <RunningLoader />
                </Box>
            </Layout>
        );
    }

    if (error || !location) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Container sx={{ mt: 4 }}>
                    <Alert severity="error">{error || t('locations.locationNotFound')}</Alert>
                    <Button 
                        startIcon={<ArrowBackIcon />} 
                        onClick={() => navigate('/locations')}
                        sx={{ mt: 2 }}
                    >
                        {t('locations.backToLocations')}
                    </Button>
                </Container>
            </Layout>
        );
    }

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="md" sx={{ py: 2 }}>
                {/* Breadcrumb navigation */}
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap' }}>
                    <Button
                        size="small"
                        onClick={() => navigate('/locations')}
                        sx={{ minWidth: 'auto', textTransform: 'none' }}
                    >
                        {t('locations.title')}
                    </Button>
                    {breadcrumbs.map((crumb, i) => (
                        <Stack key={crumb.slug} direction="row" alignItems="center" spacing={0.5}>
                            <NavigateNextIcon fontSize="small" color="disabled" />
                            {i < breadcrumbs.length - 1 ? (
                                <Button
                                    size="small"
                                    onClick={() => navigate(`/locations/${crumb.slug}`)}
                                    sx={{ minWidth: 'auto', textTransform: 'none' }}
                                >
                                    {crumb.name}
                                </Button>
                            ) : (
                                <Typography variant="body2" color="text.secondary" fontWeight="bold">
                                    {crumb.name}
                                </Typography>
                            )}
                        </Stack>
                    ))}
                </Stack>

                <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: '16px' }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                        <LocationOnIcon color="primary" fontSize="large" />
                        <Typography variant="h4" component="h1" fontWeight="bold">
                            {location.name}
                        </Typography>
                    </Stack>
                    
                    <Stack direction="row" spacing={1} mb={2}>
                        <Chip label={location.type} color="secondary" variant="outlined" size="small" />
                    </Stack>

                    {location.description && (
                        <Typography variant="body1" color="text.secondary" paragraph>
                            {location.description}
                        </Typography>
                    )}
                </Paper>

                {childLocations && childLocations.length > 0 && (
                    <Box mb={4}>
                        <Typography variant="h5" fontWeight="bold" gutterBottom>
                            {t('locations.subLocationsTitle')}
                        </Typography>
                        <Grid container spacing={2}>
                            {childLocations.map(child => (
                                <Grid item xs={12} sm={6} md={4} key={child.id}>
                                    <Card 
                                        elevation={1}
                                        sx={{ borderRadius: '12px' }}
                                    >
                                        <CardActionArea onClick={() => navigate(`/locations/${child.slug}`)}>
                                            <CardContent>
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    <FolderIcon color="primary" fontSize="small" />
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {child.name}
                                                    </Typography>
                                                </Stack>
                                                <Stack direction="row" spacing={1} mt={1}>
                                                    <Chip label={child.type} size="small" variant="outlined" />
                                                    <Chip 
                                                        label={t('locations.trailCount', { count: child.trailsCount })}
                                                        size="small"
                                                        color="primary"
                                                        variant="outlined"
                                                    />
                                                </Stack>
                                            </CardContent>
                                        </CardActionArea>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                )}

                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    {t('locations.trailsIn', { name: location.name, count: trails?.length || 0 })}
                </Typography>

                {trails && trails.length > 0 ? (
                    <Box mt={2}>
                        <Box sx={{ mb: 4, height: '400px', borderRadius: '16px', overflow: 'hidden' }}>
                           <TrailMapView trails={trails} userLocation={userLocation} />
                        </Box>
                        
                        <Divider sx={{ mb: 4 }} />

                        <Grid container spacing={1}>
                            {trails.map(trail => (
                                <Grid item xs={12} key={trail.id}>
                                    <TrailCard trail={trail} />
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                ) : (
                    <Box textAlign="center" py={8}>
                        <Typography color="text.secondary">
                            {t('locations.noTrailsInLocation')}
                        </Typography>
                    </Box>
                )}
            </Container>
        </Layout>
    );
}
