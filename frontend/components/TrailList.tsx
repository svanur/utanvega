import React from 'react';
import { useTranslation } from 'react-i18next';
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
    Fade,
    Chip
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
import { useParams, useNavigate } from 'react-router-dom';
import RunningLoader from './RunningLoader';

interface TrailListProps {
    tagSlug?: string;
}

export const TrailList: React.FC<TrailListProps> = ({ tagSlug }) => {
    const { t } = useTranslation();
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
    const navigate = useNavigate();

    // Sync URL tag slug with filter state
    React.useEffect(() => {
        if (tagSlug && !filters.selectedTags.includes(tagSlug)) {
            setFilters(prev => ({ ...prev, selectedTags: [tagSlug] }));
        }
    }, [tagSlug]);

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

    const availableTags = React.useMemo(() => {
        const tagMap = new Map<string, { name: string; slug: string; color: string | null }>();
        trails.forEach(t => t.tags?.forEach(tag => {
            if (!tagMap.has(tag.slug)) tagMap.set(tag.slug, tag);
        }));
        return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [trails]);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" p={4}>
                <RunningLoader />
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
        if (key === 'selectedTags') {
            const tags = value as string[];
            if (tags.length === 1) {
                navigate(`/tags/${tags[0]}`, { replace: true });
            } else if (tags.length === 0 && tagSlug) {
                navigate('/', { replace: true });
            }
        }
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
                    placeholder={t('filters.searchPlaceholder')}
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
                                        aria-label={t('filters.clearSearch')}
                                        onClick={() => setSearchQuery('')}
                                        edge="end"
                                        size="small"
                                        sx={{ mr: 1 }}
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                )}
                                <IconButton
                                    aria-label={t('filters.advancedSearch')}
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
                    pr={4}
                    mb={3} 
                    sx={{ 
                        bgcolor: 'background.paper', 
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                        {t('filters.advancedFilters')}
                    </Typography>
                    
                    <Grid container spacing={2}>
                        {/* Trail Length — most useful filter first */}
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                                {t('filters.trailLength')}: {filters.minLength === 0 && filters.maxLength >= 100
                                    ? t('filters.any')
                                    : `${filters.minLength} – ${filters.maxLength >= 100 ? '100+' : filters.maxLength} km`}
                            </Typography>
                            <Slider
                                size="small"
                                value={[filters.minLength, Math.min(filters.maxLength, 100)]}
                                onChange={(_, v) => {
                                    const [min, max] = v as number[];
                                    setFilters({ ...filters, minLength: min, maxLength: max });
                                }}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(v) => v >= 100 ? '100+' : `${v}`}
                                min={0}
                                max={100}
                                step={1}
                                marks={[
                                    { value: 0, label: '0' },
                                    { value: 10, label: '10' },
                                    { value: 25, label: '25' },
                                    { value: 50, label: '50' },
                                    { value: 100, label: '100+' },
                                ]}
                                sx={{ mt: 1 }}
                            />
                        </Grid>

                        {/* Elevation Gain */}
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                                {t('filters.elevationGain')}: {filters.minElevationGain === 0 && filters.maxElevationGain >= 2000
                                    ? t('filters.any')
                                    : `${filters.minElevationGain} – ${filters.maxElevationGain >= 2000 ? '2000+' : filters.maxElevationGain} m`}
                            </Typography>
                            <Slider
                                size="small"
                                value={[filters.minElevationGain, filters.maxElevationGain]}
                                onChange={(_, v) => {
                                    const [min, max] = v as number[];
                                    setFilters({ ...filters, minElevationGain: min, maxElevationGain: max });
                                }}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(v) => v >= 2000 ? '2000+' : `${v}`}
                                min={0}
                                max={2000}
                                step={25}
                                marks={[
                                    { value: 0, label: '0' },
                                    { value: 250, label: '250' },
                                    { value: 500, label: '500' },
                                    { value: 1000, label: '1k' },
                                    { value: 2000, label: '2k+' },
                                ]}
                                sx={{ mt: 1 }}
                            />
                        </Grid>

                        {/* Elevation Loss */}
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                                {t('filters.elevationLoss')}: {filters.minElevationLoss === 0 && filters.maxElevationLoss >= 2000
                                    ? t('filters.any')
                                    : `${filters.minElevationLoss} – ${filters.maxElevationLoss >= 2000 ? '2000+' : filters.maxElevationLoss} m`}
                            </Typography>
                            <Slider
                                size="small"
                                value={[filters.minElevationLoss, filters.maxElevationLoss]}
                                onChange={(_, v) => {
                                    const [min, max] = v as number[];
                                    setFilters({ ...filters, minElevationLoss: min, maxElevationLoss: max });
                                }}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(v) => v >= 2000 ? '2000+' : `${v}`}
                                min={0}
                                max={2000}
                                step={25}
                                marks={[
                                    { value: 0, label: '0' },
                                    { value: 250, label: '250' },
                                    { value: 500, label: '500' },
                                    { value: 1000, label: '1k' },
                                    { value: 2000, label: '2k+' },
                                ]}
                                sx={{ mt: 1 }}
                            />
                        </Grid>

                        {/* Distance from You */}
                        {userLocation && (
                            <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">
                                    {t('filters.distanceFromYou')}: {filters.maxDistance >= 250 ? t('filters.any') : `≤ ${filters.maxDistance} km`}
                                </Typography>
                                <Slider
                                    size="small"
                                    value={Math.min(filters.maxDistance, 250)}
                                    onChange={(_, v) => handleFilterChange('maxDistance', v as number)}
                                    valueLabelDisplay="auto"
                                    valueLabelFormat={(v) => v >= 250 ? t('filters.any') : `${v} km`}
                                    min={0}
                                    max={250}
                                    step={5}
                                    marks={[
                                        { value: 0, label: '0 km' },
                                        { value: 50, label: '50' },
                                        { value: 100, label: '100' },
                                        { value: 150, label: '150' },
                                        { value: 250, label: t('filters.any') },
                                    ]}
                                    sx={{
                                        mt: 1,
                                        '& .MuiSlider-markLabel[data-index="0"]': {
                                            pl: '32px',
                                        },
                                    }}
                                />
                            </Grid>
                        )}

                        <Grid item xs={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('filters.trailType')}</InputLabel>
                                <Select
                                    value={filters.trailType}
                                    label={t('filters.trailType')}
                                    onChange={(e) => handleFilterChange('trailType', e.target.value)}
                                >
                                    <MenuItem value="All">{t('filters.allTypes')}</MenuItem>
                                    {trailTypes.map(type => (
                                        <MenuItem key={type} value={type}>{type}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('filters.difficulty')}</InputLabel>
                                <Select
                                    value={filters.difficulty}
                                    label={t('filters.difficulty')}
                                    onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                                >
                                    <MenuItem value="All">{t('filters.allLevels')}</MenuItem>
                                    {['Easy', 'Moderate', 'Hard', 'Expert', 'Extreme'].map(d => (
                                        <MenuItem key={d} value={d}>{d}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('filters.location')}</InputLabel>
                                <Select
                                    value={filters.location}
                                    label={t('filters.location')}
                                    onChange={(e) => handleFilterChange('location', e.target.value)}
                                >
                                    <MenuItem value="All">{t('filters.allLocations')}</MenuItem>
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
                                label={t('filters.showFavoritesOnly')}
                            />
                        </Grid>

                        {availableTags.length > 0 && (
                            <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>{t('filters.tags')}</Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {availableTags.map(tag => {
                                        const selected = filters.selectedTags.includes(tag.slug);
                                        return (
                                            <Chip
                                                key={tag.slug}
                                                label={tag.name}
                                                size="small"
                                                onClick={() => {
                                                    const next = selected
                                                        ? filters.selectedTags.filter(s => s !== tag.slug)
                                                        : [...filters.selectedTags, tag.slug];
                                                    handleFilterChange('selectedTags', next);
                                                }}
                                                sx={{
                                                    backgroundColor: selected ? (tag.color || 'primary.main') : undefined,
                                                    color: selected ? '#fff' : undefined,
                                                    borderColor: tag.color || undefined,
                                                    cursor: 'pointer',
                                                }}
                                                variant={selected ? 'filled' : 'outlined'}
                                            />
                                        );
                                    })}
                                </Box>
                            </Grid>
                        )}

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
                                    label={t('filters.showHiddenTrails')}
                                />
                                {hiddenSlugs.length > 0 && (
                                    <Button size="small" color="error" onClick={clearHidden} sx={{ ml: 1 }}>
                                        {t('filters.clearHidden', { count: hiddenSlugs.length })}
                                    </Button>
                                )}
                            </Box>
                            <Button size="small" onClick={() => {
                                resetFilters();
                                if (tagSlug) navigate('/', { replace: true });
                            }}>
                                {t('filters.resetFilters')}
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => setShowAdvanced(false)}>
                                {t('filters.closeFilters')}
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            </Collapse>

            <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" fontWeight="bold">
                    {filters.selectedTags.length > 0
                        ? t('home.trailsTagged', { tags: filters.selectedTags.map(s => availableTags.find(tg => tg.slug === s)?.name || s).join(', ') })
                        : viewMode === 'list' ? t('home.nearbyTrails') : t('home.trailMap')
                    }
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
                            {t('home.enableLocation')}
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
                        {searchQuery || Object.values(filters).some(v => v !== 'All' && v !== 250 && v !== 0 && v !== 100 && v !== 2000 && v !== false) 
                            ? t('home.noTrailsMatch')
                            : t('home.noTrailsFound')}
                    </Typography>
                ) : (
                    filteredTrails.map(trail => (
                        <Collapse key={trail.id} in={!hidingSlugs.includes(trail.slug)}>
                            <TrailCard 
                                trail={trail} 
                                onHide={handleHideTrail}
                                onToggleFavorite={toggleFavorite}
                                isFavorited={favorites.includes(trail.slug)}
                                onTagClick={(tagSlug) => {
                                    const next = filters.selectedTags.includes(tagSlug)
                                        ? filters.selectedTags.filter(s => s !== tagSlug)
                                        : [...filters.selectedTags, tagSlug];
                                    handleFilterChange('selectedTags', next);
                                }}
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
