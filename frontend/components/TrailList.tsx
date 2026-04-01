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
    Divider,
    ToggleButton,
    ToggleButtonGroup,
    FormControlLabel,
    Checkbox,
    Fade
} from '@mui/material';
import { 
    Search as SearchIcon, 
    Clear as ClearIcon, 
    FilterList as FilterIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    List as ListIcon,
    Map as MapIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    VisibilityOff as VisibilityOffIcon,
    Visibility as VisibilityIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { useTrails } from '../hooks/useTrails';
import { useFavorites } from '../hooks/useFavorites';
import { useHiddenTrails } from '../hooks/useHiddenTrails';
import { TrailCard } from './TrailCard';
import { TrailMapView } from './TrailMapView';

export const TrailList: React.FC = () => {
    const { 
        trails, 
        loading, 
        refreshing,
        refresh,
        error, 
        userLocation, 
        searchQuery, 
        setSearchQuery,
        filters,
        setFilters,
        resetFilters
    } = useTrails();

    const { favorites, toggleFavorite } = useFavorites();
    const { hiddenSlugs, hideTrail, clearHidden } = useHiddenTrails();

    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const [viewMode, setViewMode] = React.useState<'list' | 'map'>('list');
    const [showHidden, setShowHidden] = React.useState(false);
    const [hidingSlugs, setHidingSlugs] = React.useState<string[]>([]);
    const [touchStart, setTouchStart] = React.useState<number | null>(null);
    const [pullOffset, setPullOffset] = React.useState(0);
    const PULL_THRESHOLD = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            setTouchStart(e.touches[0].clientY);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStart !== null) {
            const currentY = e.touches[0].clientY;
            const offset = currentY - touchStart;
            if (offset > 0) {
                // Apply resistance
                const resistanceOffset = Math.pow(offset, 0.85);
                setPullOffset(resistanceOffset);
                if (resistanceOffset > 10) {
                    if (e.cancelable) e.preventDefault();
                }
            }
        }
    };

    const handleTouchEnd = () => {
        if (pullOffset > PULL_THRESHOLD) {
            refresh();
        }
        setTouchStart(null);
        setPullOffset(0);
    };

    // Filter trails based on favorites if enabled
    const filteredTrails = React.useMemo(() => {
        let result = trails;
        if (filters.favoritesOnly) {
            result = result.filter(t => favorites.includes(t.slug));
        }
        if (!showHidden) {
            result = result.filter(t => !hiddenSlugs.includes(t.slug) || hidingSlugs.includes(t.slug));
        }
        return result;
    }, [trails, filters.favoritesOnly, favorites, hiddenSlugs, showHidden, hidingSlugs]);

    // Derived values for filters
    const locations = React.useMemo(() => {
        const locs = new Set<string>();
        filteredTrails.forEach(t => t.locations?.forEach(l => locs.add(l.name)));
        return Array.from(locs).sort();
    }, [filteredTrails]);

    const trailTypes = React.useMemo(() => {
        const types = new Set<string>();
        filteredTrails.forEach(t => types.add(t.trailType));
        return Array.from(types).sort();
    }, [filteredTrails]);

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

    const handleHideTrail = (slug: string) => {
        setHidingSlugs(prev => [...prev, slug]);
        setTimeout(() => {
            hideTrail(slug);
            setHidingSlugs(prev => prev.filter(s => s !== slug));
        }, 300); // Match transition duration in TrailCard
    };

    const handleFilterChange = (key: string, value: any) => {
        setFilters({ ...filters, [key]: value });
    };

    return (
        <Container 
            maxWidth="md" 
            sx={{ 
                py: 2, 
                position: 'relative',
                transform: `translateY(${pullOffset / 2}px)`,
                transition: touchStart === null ? 'transform 0.3s ease-out' : 'none'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull to refresh indicator */}
            <Fade in={pullOffset > 10 || refreshing}>
                <Box
                    sx={{
                        position: 'absolute',
                        top: -40,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'background.paper',
                        borderRadius: '50%',
                        width: 40,
                        height: 40,
                        boxShadow: 2
                    }}
                >
                    {refreshing ? (
                        <CircularProgress size={24} />
                    ) : (
                        <RefreshIcon 
                            sx={{ 
                                transform: `rotate(${Math.min(pullOffset * 2, 360)}deg)`,
                                color: pullOffset > PULL_THRESHOLD ? 'primary.main' : 'action.active'
                            }} 
                        />
                    )}
                </Box>
            </Fade>
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

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Checkbox 
                                        checked={filters.favoritesOnly}
                                        onChange={(e) => handleFilterChange('favoritesOnly', e.target.checked)}
                                        icon={<StarBorderIcon />}
                                        checkedIcon={<StarIcon sx={{ color: 'warning.main' }} />}
                                    />
                                }
                                label="Show Favorites Only"
                            />
                        </Grid>

                        <Grid item xs={12} display="flex" justifyContent="space-between" alignItems="center">
                            <Box>
                                <FormControlLabel
                                    control={
                                        <Checkbox 
                                            checked={showHidden}
                                            onChange={(e) => setShowHidden(e.target.checked)}
                                            icon={<VisibilityIcon />}
                                            checkedIcon={<VisibilityOffIcon color="error" />}
                                        />
                                    }
                                    label="Show Hidden Trails"
                                />
                                {hiddenSlugs.length > 0 && (
                                    <Button size="small" color="error" onClick={clearHidden} sx={{ ml: 1 }}>
                                        Clear Hidden ({hiddenSlugs.length})
                                    </Button>
                                )}
                            </Box>
                            <Button size="small" onClick={resetFilters}>
                                Reset Filters
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            </Collapse>

            <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" fontWeight="bold">
                    {viewMode === 'list' ? 'Nearby Trails' : 'Trail Map'}
                    <Typography 
                        component="span" 
                        variant="subtitle1" 
                        color="text.secondary" 
                        sx={{ ml: 1, fontWeight: 'normal' }}
                    >
                        ({filteredTrails.length})
                    </Typography>
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                    {!userLocation && viewMode === 'list' && (
                        <Typography variant="caption" color="text.secondary">
                            Enable location for distance sorting
                        </Typography>
                    )}
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(_, value) => value && setViewMode(value)}
                        size="small"
                        aria-label="view mode"
                    >
                        <ToggleButton value="list" aria-label="list view">
                            <ListIcon fontSize="small" />
                        </ToggleButton>
                        <ToggleButton value="map" aria-label="map view">
                            <MapIcon fontSize="small" />
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            </Box>

            {viewMode === 'list' ? (
                filteredTrails.length === 0 ? (
                    <Typography color="text.secondary" textAlign="center" py={4}>
                        {searchQuery || Object.values(filters).some(v => v !== 'All' && v !== 1000 && v !== 0 && v !== 5000 && v !== false) 
                            ? `No trails matching your search criteria` 
                            : "No trails found."}
                    </Typography>
                ) : (
                    filteredTrails.map(trail => (
                        <Collapse key={trail.id} in={!hidingSlugs.includes(trail.slug)}>
                            <TrailCard 
                                trail={trail} 
                                onHide={handleHideTrail}
                                onToggleFavorite={toggleFavorite}
                                isHiding={hidingSlugs.includes(trail.slug)}
                            />
                        </Collapse>
                    ))
                )
            ) : (
                <TrailMapView trails={filteredTrails} userLocation={userLocation} />
            )}
        </Container>
    );
};
