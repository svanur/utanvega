import React from 'react';
import { 
    Container, 
    Typography, 
    Box, 
    CircularProgress, 
    Alert,
    TextField,
    InputAdornment,
    IconButton,
    Collapse,
    Button,
    Slider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Divider
} from '@mui/material';
import { 
    Search as SearchIcon, 
    Clear as ClearIcon, 
    FilterList as FilterIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useTrails } from '../hooks/useTrails';
import { TrailCard } from './TrailCard';

export const TrailList: React.FC = () => {
    const { 
        trails, 
        loading, 
        error, 
        userLocation, 
        searchQuery, 
        setSearchQuery,
        filters,
        setFilters,
        resetFilters
    } = useTrails();

    const [showAdvanced, setShowAdvanced] = React.useState(false);

    // Derived values for filters
    const locations = React.useMemo(() => {
        const locs = new Set<string>();
        trails.forEach(t => t.locations?.forEach(l => locs.add(l)));
        return Array.from(locs).sort();
    }, [trails]);

    const trailTypes = React.useMemo(() => {
        const types = new Set<string>();
        trails.forEach(t => types.add(t.trailType));
        return Array.from(types).sort();
    }, [trails]);

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

    const handleFilterChange = (key: string, value: any) => {
        setFilters({ ...filters, [key]: value });
    };

    return (
        <Container maxWidth="sm" sx={{ py: 2 }}>
            <Box mb={2}>
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
                        endAdornment: (
                            <InputAdornment position="end">
                                {searchQuery && (
                                    <IconButton
                                        aria-label="clear search"
                                        onClick={() => setSearchQuery('')}
                                        edge="end"
                                        size="small"
                                        sx={{ mr: 1 }}
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                )}
                                <IconButton
                                    aria-label="advanced search"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    edge="end"
                                    size="small"
                                    color={showAdvanced ? 'primary' : 'default'}
                                >
                                    <FilterIcon fontSize="small" />
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

            <Collapse in={showAdvanced}>
                <Box 
                    p={2} 
                    mb={3} 
                    sx={{ 
                        bgcolor: 'background.paper', 
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                        Advanced Filters
                    </Typography>
                    
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                                Max Distance: {filters.maxDistance === 1000 ? 'Any' : `${filters.maxDistance} km`}
                            </Typography>
                            <Slider
                                size="small"
                                value={filters.maxDistance}
                                onChange={(_, v) => handleFilterChange('maxDistance', v)}
                                valueLabelDisplay="auto"
                                min={1}
                                max={1000}
                                disabled={!userLocation}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                                Elevation Gain Range: {filters.minElevationGain} - {filters.maxElevationGain} m
                            </Typography>
                            <Slider
                                size="small"
                                value={[filters.minElevationGain, filters.maxElevationGain]}
                                onChange={(_, v) => {
                                    const [min, max] = v as number[];
                                    setFilters({ ...filters, minElevationGain: min, maxElevationGain: max });
                                }}
                                valueLabelDisplay="auto"
                                min={0}
                                max={5000}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                                Elevation Loss Range: {filters.minElevationLoss} - {filters.maxElevationLoss} m
                            </Typography>
                            <Slider
                                size="small"
                                value={[filters.minElevationLoss, filters.maxElevationLoss]}
                                onChange={(_, v) => {
                                    const [min, max] = v as number[];
                                    setFilters({ ...filters, minElevationLoss: min, maxElevationLoss: max });
                                }}
                                valueLabelDisplay="auto"
                                min={0}
                                max={5000}
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Trail Type</InputLabel>
                                <Select
                                    value={filters.trailType}
                                    label="Trail Type"
                                    onChange={(e) => handleFilterChange('trailType', e.target.value)}
                                >
                                    <MenuItem value="All">All Types</MenuItem>
                                    {trailTypes.map(type => (
                                        <MenuItem key={type} value={type}>{type}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Location</InputLabel>
                                <Select
                                    value={filters.location}
                                    label="Location"
                                    onChange={(e) => handleFilterChange('location', e.target.value)}
                                >
                                    <MenuItem value="All">All Locations</MenuItem>
                                    {locations.map(loc => (
                                        <MenuItem key={loc} value={loc}>{loc}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} display="flex" justifyContent="flex-end">
                            <Button size="small" onClick={resetFilters}>
                                Reset Filters
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            </Collapse>

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
                    {searchQuery || Object.values(filters).some(v => v !== 'All' && v !== 100 && v !== 0 && v !== 2000) 
                        ? `No trails matching your search criteria` 
                        : "No trails found."}
                </Typography>
            ) : (
                trails.map(trail => (
                    <TrailCard key={trail.id} trail={trail} />
                ))
            )}
        </Container>
    );
};
