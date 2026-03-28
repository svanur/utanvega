import React from 'react';
import { 
    Container, 
    Typography, 
    Box, 
    CircularProgress, 
    Alert 
} from '@mui/material';
import { useTrails } from '../hooks/useTrails';
import { TrailCard } from './TrailCard';

export const TrailList: React.FC = () => {
    const { trails, loading, error, userLocation } = useTrails();

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Container sx={{ mt: 2 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="sm" sx={{ py: 2 }}>
            <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" fontWeight="bold">
                    Nearby Trails
                </Typography>
                {!userLocation && (
                    <Typography variant="caption" color="text.secondary">
                        Enable location for distance sorting
                    </Typography>
                )}
            </Box>

            {trails.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={4}>
                    No trails found.
                </Typography>
            ) : (
                trails.map(trail => (
                    <TrailCard key={trail.id} trail={trail} />
                ))
            )}
        </Container>
    );
};
