import React from 'react';
import { 
    Container, 
    Typography, 
    Box, 
    CircularProgress, 
    Alert,
    TextField,
    InputAdornment,
    IconButton
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import { useTrails } from '../hooks/useTrails';
import { TrailCard } from './TrailCard';

export const TrailList: React.FC = () => {
    const { trails, loading, error, userLocation, searchQuery, setSearchQuery } = useTrails();

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
            <Box mb={3}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search name or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" />
                            </InputAdornment>
                        ),
                        endAdornment: searchQuery && (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label="clear search"
                                    onClick={() => setSearchQuery('')}
                                    edge="end"
                                    size="small"
                                >
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                        }
                    }}
                />
            </Box>

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
                    {searchQuery ? `No trails matching "${searchQuery}"` : "No trails found."}
                </Typography>
            ) : (
                trails.map(trail => (
                    <TrailCard key={trail.id} trail={trail} />
                ))
            )}
        </Container>
    );
};
