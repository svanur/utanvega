import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
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
    Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Layout from '../components/Layout';
import { useLocationBySlug } from '../hooks/useLocations';
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
    const { location, trails, loading, error } = useLocationBySlug(slug);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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
                <Button 
                    startIcon={<ArrowBackIcon />} 
                    onClick={() => navigate('/locations')}
                    sx={{ mb: 2 }}
                >
                    {t('locations.backToLocations')}
                </Button>

                <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: '16px' }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                        <LocationOnIcon color="primary" fontSize="large" />
                        <Typography variant="h4" component="h1" fontWeight="bold">
                            {location.name}
                        </Typography>
                    </Stack>
                    
                    <Stack direction="row" spacing={1} mb={2}>
                        <Chip label={location.type} color="secondary" variant="outlined" size="small" />
                        {location.parentName && (
                            <Chip label={t('locations.parentLocation', { name: location.parentName })} variant="outlined" size="small" />
                        )}
                    </Stack>

                    {location.description && (
                        <Typography variant="body1" color="text.secondary" paragraph>
                            {location.description}
                        </Typography>
                    )}
                </Paper>

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
