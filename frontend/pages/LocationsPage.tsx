import { 
    Container, 
    Typography, 
    Box, 
    Grid, 
    Card, 
    CardContent, 
    CardActionArea,
    CircularProgress,
    Alert,
    PaletteMode,
    Chip,
    Stack
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Layout from '../components/Layout';
import { useLocations } from '../hooks/useLocations';

type LocationsPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function LocationsPage({ mode, onToggleMode }: LocationsPageProps) {
    const { locations, loading, error } = useLocations();
    const navigate = useNavigate();

    if (loading) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                    <CircularProgress />
                </Box>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Container sx={{ mt: 4 }}>
                    <Alert severity="error">{error}</Alert>
                </Container>
            </Layout>
        );
    }

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
                    Explore by Location
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Discover trails in different regions and areas.
                </Typography>

                <Grid container spacing={3} sx={{ mt: 2 }}>
                    {locations.map((loc) => (
                        <Grid item xs={12} sm={6} key={loc.id}>
                            <Card 
                                elevation={2} 
                                sx={{ 
                                    borderRadius: '16px',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: 4
                                    }
                                }}
                            >
                                <CardActionArea onClick={() => navigate(`/locations/${loc.slug}`)}>
                                    <CardContent>
                                        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                                            <LocationOnIcon color="primary" />
                                            <Typography variant="h6" fontWeight="bold">
                                                {loc.name}
                                            </Typography>
                                        </Stack>
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Chip 
                                                label={loc.type} 
                                                size="small" 
                                                variant="outlined" 
                                                color="secondary" 
                                            />
                                            {loc.childrenCount > 0 && (
                                                <Typography variant="caption" color="text.secondary">
                                                    {loc.childrenCount} sub-locations
                                                </Typography>
                                            )}
                                        </Box>
                                        {loc.description && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                {loc.description}
                                            </Typography>
                                        )}
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {locations.length === 0 && (
                    <Box textAlign="center" py={8}>
                        <Typography color="text.secondary">
                            No locations found.
                        </Typography>
                    </Box>
                )}
            </Container>
        </Layout>
    );
}
