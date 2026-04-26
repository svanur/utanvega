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
    ToggleButton,
    ToggleButtonGroup,
    FormControlLabel,
    Checkbox,
    Fade,
    Chip,
    Tooltip,
    Skeleton,
    Card,
    CardContent,
    Stack
} from '@mui/material';
import { 
    Search as SearchIcon, 
    Clear as ClearIcon, 
    FilterList as FilterIcon,
    List as ListIcon,
    Map as MapIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    VisibilityOff as VisibilityOffIcon,
    Visibility as VisibilityIcon,
    Refresh as RefreshIcon,
    Sort as SortIcon,
    MyLocation as MyLocationIcon,
    Landscape as LandscapeIcon,
    DirectionsRun as DirectionsRunIcon,
    Hiking as HikingIcon,
    DirectionsBike as DirectionsBikeIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    Casino as CasinoIcon,
    Whatshot as WhatshotIcon,
    History as HistoryIcon,
    EmojiEvents as EmojiEventsIcon
} from '@mui/icons-material';
import { useTrails, ALL_ACTIVITY_TYPES, DEFAULT_FILTERS, useTrendingTrails } from '../hooks/useTrails';
import type { SortOption, FilterState } from '../hooks/useTrails';
import { formatDuration } from '../utils/estimateDuration';
import { useFavorites } from '../hooks/useFavorites';
import { useHiddenTrails } from '../hooks/useHiddenTrails';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { useShake } from '../hooks/useShake';
import { useLocationTree } from '../hooks/useLocations';
import type { LocationTreeNode } from '../hooks/useLocations';
import { TrailCard } from './TrailCard';
const TrailMapView = React.lazy(() => import('./TrailMapView').then(m => ({ default: m.TrailMapView })));
import ShareButtons from './ShareButtons';
import EmptyFilterState from './EmptyFilterState';
import SmartPresets from './SmartPresets';
import { getActivePresets } from '../utils/filterPresets';
import TrailSlotMachine from './TrailSlotMachine';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import ListSubheader from '@mui/material/ListSubheader';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useCompetitions } from '../hooks/useCompetitions';
import { useOfflineTrails } from '../hooks/useOfflineTrails';
import OfflinePinIcon from '@mui/icons-material/OfflinePin';

interface TrailListProps {
    tagSlug?: string;
}

export const TrailList: React.FC<TrailListProps> = ({ tagSlug }) => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const { 
        trails, 
        loading, 
        refreshing,
        refresh,
        error, 
        userLocation,
        locationDenied,
        requestLocation,
        searchQuery, 
        setSearchQuery,
        filters,
        setFilters,
        resetFilters
    } = useTrails();

    const { favorites, toggleFavorite } = useFavorites();
    const { hiddenSlugs, hideTrail, clearHidden } = useHiddenTrails();
    const { recentSlugs } = useRecentlyViewed();
    const { trending } = useTrendingTrails();
    const { tree: locationTree } = useLocationTree();
    const navigate = useNavigate();
    const { isEnabled } = useFeatureFlags();
    const locationsPageEnabled = isEnabled('locations_page');
    const { competitions: allCompetitions, loading: competitionsLoading } = useCompetitions();
    const { offlineSlugs, isOffline } = useOfflineTrails();

    // Extract preset ID from navigation state (e.g. navigating from tag page with preset)
    const initialPresetId = React.useMemo(() => {
        const state = location.state as { presetId?: string } | null;
        return state?.presetId ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const [viewMode, setViewMode] = React.useState<'list' | 'map'>('list');
    const [showHidden, setShowHidden] = React.useState(false);

    // Easter egg: "hin upprunalegu" in search triggers The Originals
    const originalsTriggered = React.useRef(false);
    React.useEffect(() => {
        if (searchQuery.toLowerCase().trim() === 'hin upprunalegu' && !originalsTriggered.current) {
            originalsTriggered.current = true;
            window.dispatchEvent(new CustomEvent('easter-egg', { detail: { egg: 'originals' } }));
            setTimeout(() => { originalsTriggered.current = false; }, 10000);
        }
    }, [searchQuery]);
    const [hidingSlugs, setHidingSlugs] = React.useState<string[]>([]);
    const [discoveryTab, setDiscoveryTab] = React.useState<'trending' | 'recent' | 'races'>('trending');
    const discoveryScrollRef = React.useRef<HTMLDivElement>(null);
    const navigatingAway = React.useRef(false);

    const handleDiscoveryTabChange = (tab: 'trending' | 'recent' | 'races') => {
        setDiscoveryTab(tab);
        if (discoveryScrollRef.current) {
            discoveryScrollRef.current.scrollTo({ left: 0 });
        }
    };

    const scrollDiscovery = (direction: 'left' | 'right') => {
        if (discoveryScrollRef.current) {
            const { scrollLeft, clientWidth } = discoveryScrollRef.current;
            discoveryScrollRef.current.scrollTo({
                left: direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth,
                behavior: 'smooth'
            });
        }
    };

    // Map trending data to full trail objects for TrailCard rendering
    const trendingTrails = React.useMemo(() => {
        if (!trending.length || !trails.length) return [];
        return trending
            .map(tt => {
                const trail = trails.find(t => t.slug === tt.slug);
                return trail ? { ...trail, viewCount: tt.viewCount } : null;
            })
            .filter(Boolean) as (typeof trails[0] & { viewCount: number })[];
    }, [trending, trails]);

    const upcomingCompetitions = React.useMemo(() =>
        allCompetitions
            .filter(c => c.status === 'Active' && c.nextDate != null && (c.daysUntil ?? 999) >= 0)
            .sort((a, b) => (a.nextDate ?? '').localeCompare(b.nextDate ?? ''))
            .slice(0, 10),
        [allCompetitions]
    );

    // Default to 'recent' tab if user has recent views but no trending data
    React.useEffect(() => {
        if (trendingTrails.length === 0 && recentSlugs.length > 0) {
            setDiscoveryTab('recent');
        }
    }, [trendingTrails.length, recentSlugs.length]);

    // Shake-to-random-trail
    const [slotMachine, setSlotMachine] = React.useState<{ open: boolean; winner: string; winnerSlug: string }>({ open: false, winner: '', winnerSlug: '' });
    const filteredTrailsRef = React.useRef<typeof trails>([]);
    const userLocationRef = React.useRef(userLocation);
    React.useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

    const handleShake = React.useCallback(() => {
        const candidates = filteredTrailsRef.current;
        if (candidates.length === 0) return;

        // If location enabled, prefer trails within 50km
        let nearby = candidates;
        if (userLocationRef.current) {
            const close = candidates.filter(t => t.distanceToUser !== undefined && t.distanceToUser !== Infinity && t.distanceToUser <= 50);
            if (close.length > 0) nearby = close;
        }

        // If no difficulty filter active, prefer Easy/Moderate trails
        if (filters.difficulty === 'All') {
            const easyMod = nearby.filter(t => t.difficulty === 'Easy' || t.difficulty === 'Moderate');
            if (easyMod.length > 0) nearby = easyMod;
        }

        const pick = nearby[Math.floor(Math.random() * nearby.length)];
        if (navigator.vibrate) navigator.vibrate(200);
        setSlotMachine({ open: true, winner: pick.name, winnerSlug: pick.slug });
    }, [filters.difficulty]);

    const handleSlotComplete = React.useCallback(() => {
        const slug = slotMachine.winnerSlug;
        setSlotMachine(s => ({ ...s, open: false }));
        if (slug) navigate(`/trails/${slug}`);
    }, [navigate, slotMachine.winnerSlug]);

    const { supported: shakeSupported, permissionGranted: shakePermission, requestPermission: requestShakePermission } = useShake({
        onShake: handleShake,
        threshold: 25,
        cooldown: 3000,
    });

    // Initialize filters from URL params on first render
    const urlInitialized = React.useRef(false);
    React.useEffect(() => {
        if (urlInitialized.current) return;
        urlInitialized.current = true;

        const q = searchParams.get('q');
        const activity = searchParams.get('activity');
        const difficulty = searchParams.get('difficulty');
        const trailType = searchParams.get('trailType');
        const sort = searchParams.get('sort') as SortOption | null;
        const view = searchParams.get('view');
        const favShortcut = searchParams.get('favorites');
        const randomShortcut = searchParams.get('random');

        if (q) setSearchQuery(q);
        if (view === 'map') setViewMode('map');

        const updates: Partial<FilterState> = {};
        if (activity) updates.selectedActivityTypes = activity.split(',');
        if (difficulty && difficulty !== 'All') updates.difficulty = difficulty;
        if (trailType && trailType !== 'All') updates.trailType = trailType;
        if (sort) updates.sortBy = sort;
        if (favShortcut === 'true') updates.favoritesOnly = true;

        if (Object.keys(updates).length > 0) {
            setFilters(prev => ({ ...prev, ...updates }));
        }

        // PWA shortcut: random trail — trigger after trails load
        if (randomShortcut === 'true') {
            const cleanParams = new URLSearchParams(searchParams);
            cleanParams.delete('random');
            setSearchParams(cleanParams, { replace: true });
            // Delay to let trails load
            setTimeout(() => handleShake(), 500);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync filters → URL params (skip defaults to keep URL clean)
    React.useEffect(() => {
        if (!urlInitialized.current || navigatingAway.current) return;
        const params = new URLSearchParams();

        if (searchQuery) params.set('q', searchQuery);
        if (filters.selectedActivityTypes.length > 0) {
            params.set('activity', filters.selectedActivityTypes.join(','));
        }
        if (filters.difficulty !== 'All') params.set('difficulty', filters.difficulty);
        if (filters.trailType !== 'All') params.set('trailType', filters.trailType);
        if (filters.sortBy !== 'distance') params.set('sort', filters.sortBy);
        if (viewMode === 'map') params.set('view', 'map');

        setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, filters.selectedActivityTypes, filters.difficulty, filters.trailType, filters.sortBy, viewMode]);

    // Build flat list of locations with depth + descendant slug sets for the dropdown
    const { locationMenuItems, descendantSlugs } = React.useMemo(() => {
        const items: { slug: string; name: string; depth: number; totalTrails: number }[] = [];
        const descendants = new Map<string, Set<string>>();

        function flatten(nodes: LocationTreeNode[], depth: number): string[] {
            const allSlugs: string[] = [];
            for (const node of nodes) {
                items.push({ slug: node.slug, name: node.name, depth, totalTrails: node.totalTrailsCount });
                const childSlugs = flatten(node.children, depth + 1);
                const descSet = new Set(childSlugs);
                descendants.set(node.slug, descSet);
                allSlugs.push(node.slug, ...childSlugs);
            }
            return allSlugs;
        }

        flatten(locationTree, 0);
        return { locationMenuItems: items, descendantSlugs: descendants };
    }, [locationTree]);

    // Sync URL tag slug with filter state
    React.useEffect(() => {
        if (tagSlug && !filters.selectedTags.includes(tagSlug)) {
            setFilters(prev => ({ ...prev, selectedTags: [tagSlug] }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tagSlug]);

    // Apply preset from navigation state (when navigating from tag page with preset)
    React.useEffect(() => {
        const state = location.state as { presetId?: string } | null;
        if (state?.presetId) {
            const presets = getActivePresets(new Date(), !!userLocation);
            const preset = presets.find(p => p.id === state.presetId);
            if (preset) {
                setFilters({ ...DEFAULT_FILTERS, ...preset.filters });
            }
            // Clear the state so it doesn't re-apply on re-renders
            window.history.replaceState({}, '', location.pathname);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    // Filter trails based on favorites/offline if enabled
    const filteredTrails = React.useMemo(() => {
        let result = trails;
        if (filters.favoritesOnly) {
            result = result.filter(t => favorites.includes(t.slug));
        }
        if (filters.offlineOnly) {
            result = result.filter(t => isOffline(t.slug));
        }
        if (!showHidden) {
            result = result.filter(t => !hiddenSlugs.includes(t.slug) || hidingSlugs.includes(t.slug));
        }
        return result;
    }, [trails, filters.favoritesOnly, filters.offlineOnly, favorites, isOffline, hiddenSlugs, showHidden, hidingSlugs]);
    React.useEffect(() => { filteredTrailsRef.current = filteredTrails; }, [filteredTrails]);

    // Gather trail names for the slot machine display
    const slotTrailNames = React.useMemo(() => {
        const names = filteredTrails.map(t => t.name);
        while (names.length > 0 && names.length < 8) {
            names.push(...names.slice(0, 8 - names.length));
        }
        return names;
    }, [filteredTrails]);

    // Recently viewed trails (resolved from slugs → trail objects)
    const recentTrails = React.useMemo(() => {
        if (!recentSlugs.length || !trails.length) return [] as typeof trails;
        const result: typeof trails = [];
        for (const slug of recentSlugs) {
            const found = trails.find(t => t.slug === slug);
            if (found) result.push(found);
            if (result.length >= 6) break;
        }
        return result;
    }, [recentSlugs, trails]);

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
            <Container maxWidth="md" sx={{ mt: 2 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i} sx={{ mb: 2 }}>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Skeleton variant="text" width="60%" height={32} />
                                <Skeleton variant="circular" width={20} height={20} />
                            </Box>
                            <Skeleton variant="text" width="90%" height={18} sx={{ mt: 0.5 }} />
                            <Skeleton variant="text" width="70%" height={18} />
                            <Box display="flex" gap={1} mt={1.5}>
                                <Skeleton variant="rounded" width={90} height={24} />
                                <Skeleton variant="rounded" width={70} height={24} />
                                <Skeleton variant="rounded" width={80} height={24} />
                            </Box>
                            <Stack direction="row" spacing={2} mt={2}>
                                <Skeleton variant="text" width={60} height={20} />
                                <Skeleton variant="text" width={60} height={20} />
                                <Skeleton variant="text" width={60} height={20} />
                            </Stack>
                        </CardContent>
                    </Card>
                ))}
            </Container>
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

    const handleFilterChange = (key: string, value: string | number | boolean | string[]) => {
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

    const handleLocationChange = (slug: string) => {
        if (slug === 'All') {
            setFilters({ ...filters, location: 'All', locationSlugs: [] });
        } else {
            const expanded = [slug, ...(descendantSlugs.get(slug) ?? [])];
            setFilters({ ...filters, location: slug, locationSlugs: expanded });
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

            {/* Activity Type pills */}
            {isEnabled('activity_pills') && (
            <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                {ALL_ACTIVITY_TYPES.map(type => {
                    const selected = filters.selectedActivityTypes.includes(type);
                    const icon = {
                        TrailRunning: <LandscapeIcon fontSize="small" />,
                        Running: <DirectionsRunIcon fontSize="small" />,
                        Hiking: <HikingIcon fontSize="small" />,
                        Cycling: <DirectionsBikeIcon fontSize="small" />,
                    }[type];
                    const label = t(`difficulty.${type.charAt(0).toLowerCase() + type.slice(1)}`);
                    return (
                        <Tooltip key={type} title={label} arrow>
                            <Chip
                                icon={icon}
                                label={label}
                                onClick={() => {
                                    const current = filters.selectedActivityTypes;
                                    const updated = selected
                                        ? current.filter(t => t !== type)
                                        : [...current, type];
                                    setFilters(f => ({ ...f, selectedActivityTypes: updated }));
                                }}
                                color={selected ? 'primary' : 'default'}
                                variant={selected ? 'filled' : 'outlined'}
                                sx={{ 
                                    fontWeight: selected ? 'bold' : 'normal',
                                    opacity: selected ? 1 : 0.6,
                                    '& .MuiChip-label': { display: { xs: 'none', sm: 'block' } },
                                    '& .MuiChip-icon': { mx: { xs: 0, sm: undefined } },
                                    px: { xs: 0.5, sm: undefined },
                                    minWidth: { xs: 36, sm: undefined },
                                    justifyContent: 'center',
                                }}
                            />
                        </Tooltip>
                    );
                })}
            </Box>
            )}

            {/* Smart time-aware filter presets */}
            {isEnabled('smart_presets') && (
            <SmartPresets
                filters={filters}
                setFilters={setFilters}
                defaultFilters={DEFAULT_FILTERS}
                hasGeolocation={!!userLocation}
                initialPresetId={initialPresetId}
                onPresetApply={tagSlug ? (presetId) => {
                    navigatingAway.current = true;
                    navigate('/', { replace: true, state: { presetId } });
                } : undefined}
            />
            )}

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

                        {/* Estimated Duration */}
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                                {t('filters.duration')}: {filters.minDuration === 0 && filters.maxDuration >= 480
                                    ? t('filters.any')
                                    : `${formatDuration(filters.minDuration)} – ${filters.maxDuration >= 480 ? '8h+' : formatDuration(filters.maxDuration)}`}
                            </Typography>
                            <Slider
                                size="small"
                                value={[filters.minDuration, filters.maxDuration]}
                                onChange={(_, v) => {
                                    const [min, max] = v as number[];
                                    setFilters({ ...filters, minDuration: min, maxDuration: max });
                                }}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(v) => v >= 480 ? '8h+' : formatDuration(v)}
                                min={0}
                                max={480}
                                step={15}
                                marks={[
                                    { value: 0, label: '0' },
                                    { value: 60, label: '1h' },
                                    { value: 120, label: '2h' },
                                    { value: 240, label: '4h' },
                                    { value: 480, label: '8h+' },
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

                        {locationsPageEnabled && (
                        <Grid item xs={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('filters.location')}</InputLabel>
                                <Select
                                    value={filters.location}
                                    label={t('filters.location')}
                                    onChange={(e) => handleLocationChange(e.target.value)}
                                >
                                    <MenuItem value="All">{t('filters.allLocations')}</MenuItem>
                                    {locationMenuItems.length > 0
                                        ? locationMenuItems
                                            .filter(item => item.depth === 0 && item.totalTrails > 0)
                                            .flatMap(root => {
                                                const children = locationMenuItems.filter(
                                                    child => descendantSlugs.get(root.slug)?.has(child.slug) && child.depth === 1 && child.totalTrails > 0
                                                );
                                                if (children.length === 0) {
                                                    return [
                                                        <MenuItem key={root.slug} value={root.slug}>
                                                            {root.name} ({root.totalTrails})
                                                        </MenuItem>
                                                    ];
                                                }
                                                return [
                                                    <ListSubheader key={`hdr-${root.slug}`} sx={{ lineHeight: '32px', bgcolor: 'background.paper' }}>
                                                        {root.name}
                                                    </ListSubheader>,
                                                    <MenuItem key={root.slug} value={root.slug} sx={{ pl: 2 }}>
                                                        {t('filters.allIn', { name: root.name })} ({root.totalTrails})
                                                    </MenuItem>,
                                                    ...children.map(child => (
                                                        <MenuItem key={child.slug} value={child.slug} sx={{ pl: 4 }}>
                                                            {child.name} ({child.totalTrails})
                                                        </MenuItem>
                                                    ))
                                                ];
                                            })
                                        : locations.map(loc => (
                                            <MenuItem key={loc} value={loc}>{loc}</MenuItem>
                                        ))
                                    }
                                </Select>
                            </FormControl>
                        </Grid>
                        )}

                        <Grid item xs={12} sm={6}>
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
                        {isEnabled('offline_button') && offlineSlugs.size > 0 && (
                        <Grid item xs={12} sm={6}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={filters.offlineOnly}
                                        onChange={(e) => handleFilterChange('offlineOnly', e.target.checked)}
                                        icon={<OfflinePinIcon />}
                                        checkedIcon={<OfflinePinIcon sx={{ color: 'success.main' }} />}
                                    />
                                }
                                label={t('filters.showOfflineOnly')}
                            />
                        </Grid>
                        )}

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

            {/* Discovery carousel — tabbed: Trending / Recently Viewed / Next Races */}
            {isEnabled('discovery_carousel') && (trendingTrails.length > 0 || recentTrails.length > 0 || upcomingCompetitions.length > 0) && viewMode === 'list' && !searchQuery && !filters.favoritesOnly && !tagSlug && (
                <Box mb={3}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                            {trendingTrails.length > 0 && (
                                <Chip
                                    icon={<WhatshotIcon />}
                                    label={t('home.trendingTrails')}
                                    size="small"
                                    variant={discoveryTab === 'trending' ? 'filled' : 'outlined'}
                                    color={discoveryTab === 'trending' ? 'warning' : 'default'}
                                    onClick={() => handleDiscoveryTabChange('trending')}
                                    sx={{ cursor: 'pointer' }}
                                />
                            )}
                            {recentTrails.length > 0 && (
                                <Chip
                                    icon={<HistoryIcon />}
                                    label={t('home.recentlyViewed')}
                                    size="small"
                                    variant={discoveryTab === 'recent' ? 'filled' : 'outlined'}
                                    color={discoveryTab === 'recent' ? 'primary' : 'default'}
                                    onClick={() => handleDiscoveryTabChange('recent')}
                                    sx={{ cursor: 'pointer' }}
                                />
                            )}
                            {isEnabled('races_page') && upcomingCompetitions.length > 0 && (
                                <Chip
                                    icon={<EmojiEventsIcon />}
                                    label={t('home.nextRaces')}
                                    size="small"
                                    variant={discoveryTab === 'races' ? 'filled' : 'outlined'}
                                    color={discoveryTab === 'races' ? 'success' : 'default'}
                                    onClick={() => handleDiscoveryTabChange('races')}
                                    sx={{ cursor: 'pointer' }}
                                />
                            )}
                        </Box>
                        <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
                            <IconButton onClick={() => scrollDiscovery('left')} size="small">
                                <ChevronLeftIcon />
                            </IconButton>
                            <IconButton onClick={() => scrollDiscovery('right')} size="small">
                                <ChevronRightIcon />
                            </IconButton>
                        </Box>
                    </Box>
                    <Box
                        ref={discoveryScrollRef}
                        sx={{
                            display: 'flex',
                            gap: 2,
                            overflowX: 'auto',
                            pb: 1,
                            scrollSnapType: 'x mandatory',
                            '&::-webkit-scrollbar': { display: 'none' },
                            msOverflowStyle: 'none',
                            scrollbarWidth: 'none',
                        }}
                    >
                        {discoveryTab === 'trending' && trendingTrails.map(trail => (
                            <Box key={trail.slug} sx={{ minWidth: 200, maxWidth: 240, height: 140, display: 'flex', scrollSnapAlign: 'start', position: 'relative' }}>
                                <TrailCard trail={trail} compact disableGestures />
                                <Chip
                                    label={t('home.views', { count: trail.viewCount })}
                                    size="small"
                                    color="warning"
                                    sx={{
                                        position: 'absolute',
                                        top: 6,
                                        right: 6,
                                        fontSize: '0.65rem',
                                        height: 20,
                                        opacity: 0.9,
                                    }}
                                />
                            </Box>
                        ))}
                        {discoveryTab === 'recent' && recentTrails.map(trail => (
                            <Box key={trail.slug} sx={{ minWidth: 200, maxWidth: 240, height: 140, display: 'flex', scrollSnapAlign: 'start' }}>
                                <TrailCard trail={trail} compact disableGestures />
                            </Box>
                        ))}
                        {discoveryTab === 'races' && competitionsLoading && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', py: 2 }}>
                                <CircularProgress size={24} color="success" />
                            </Box>
                        )}
                        {discoveryTab === 'races' && !competitionsLoading && upcomingCompetitions.length === 0 && (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2, width: '100%', textAlign: 'center' }}>
                                {t('races.noUpcoming')}
                            </Typography>
                        )}
                        {discoveryTab === 'races' && !competitionsLoading && upcomingCompetitions.map(comp => (
                            <Card
                                key={comp.id}
                                onClick={() => navigate(`/races/${comp.slug}`)}
                                sx={{
                                    minWidth: 200,
                                    maxWidth: 260,
                                    scrollSnapAlign: 'start',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    transition: 'transform 0.15s',
                                    '&:hover': { transform: 'translateY(-2px)' },
                                }}
                            >
                                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                                    <Typography variant="subtitle2" noWrap fontWeight="bold">
                                        {comp.name}
                                    </Typography>
                                    {locationsPageEnabled && comp.locationName && (
                                        <Typography variant="caption" color="text.secondary" noWrap>
                                            📍 {comp.locationName}
                                        </Typography>
                                    )}
                                    <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
                                        {comp.daysUntil != null && comp.daysUntil >= 0 && (
                                            <Chip
                                                label={comp.daysUntil === 0
                                                    ? t('races.today')
                                                    : t('races.daysUntil', { count: comp.daysUntil })}
                                                size="small"
                                                color={comp.daysUntil <= 7 ? 'error' : comp.daysUntil <= 30 ? 'warning' : 'success'}
                                                sx={{ fontSize: '0.65rem', height: 20 }}
                                            />
                                        )}
                                        {comp.raceCount > 0 && (
                                            <Chip
                                                label={t('races.raceCount', { count: comp.raceCount })}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontSize: '0.65rem', height: 20 }}
                                            />
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                </Box>
            )}

            <Box mb={2} display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Typography variant="h5" fontWeight="bold">
                    {filters.selectedTags.length > 0
                        ? t('home.trailsTagged', { tags: filters.selectedTags.map(s => availableTags.find(tg => tg.slug === s)?.name || s).join(', ') })
                        : viewMode === 'list' ? t('home.allTrails') : t('home.trailMap')
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
                        <Tooltip title={locationDenied ? t('home.locationDenied') : t('home.enableLocation')}>
                            <IconButton
                                size="small"
                                onClick={requestLocation}
                                color={locationDenied ? 'warning' : 'primary'}
                            >
                                <MyLocationIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {viewMode === 'list' && (
                        <Select
                            value={filters.sortBy}
                            onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value as SortOption }))}
                            size="small"
                            variant="outlined"
                            startAdornment={<SortIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />}
                            sx={{ minWidth: 140, fontSize: '0.85rem' }}
                        >
                            <MenuItem value="distance" disabled={!userLocation}>
                                {t('sort.distance')}
                            </MenuItem>
                            <MenuItem value="name">{t('sort.name')}</MenuItem>
                            <MenuItem value="shortest">{t('sort.shortest')}</MenuItem>
                            <MenuItem value="longest">{t('sort.longest')}</MenuItem>
                            <MenuItem value="elevation">{t('sort.elevation')}</MenuItem>
                            <MenuItem value="popular">{t('sort.popular')}</MenuItem>
                        </Select>
                    )}
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(_, value) => value && setViewMode(value)}
                        size="small"
                        aria-label={t('home.viewMode')}
                    >
                        <ToggleButton value="list" aria-label={t('home.listView')}>
                            <ListIcon fontSize="small" />
                        </ToggleButton>
                        <ToggleButton value="map" aria-label={t('home.mapView')}>
                            <MapIcon fontSize="small" />
                        </ToggleButton>
                    </ToggleButtonGroup>
                    {isEnabled('share_trail') && <ShareButtons title={t('home.allTrails')} />}
                    {isEnabled('random_trail') && (
                    <Tooltip title={shakeSupported && !shakePermission ? t('home.enableShake') : t('home.randomTrail')}>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                                if (shakeSupported && !shakePermission) {
                                    requestShakePermission();
                                } else {
                                    handleShake();
                                }
                            }}
                        >
                            <CasinoIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    )}
                </Box>
            </Box>

            {viewMode === 'list' ? (
                filteredTrails.length === 0 ? (
                    <EmptyFilterState 
                        hasActiveFilters={!!(searchQuery || Object.values(filters).some(v => v !== 'All' && v !== 250 && v !== 0 && v !== 100 && v !== 2000 && v !== false))}
                        onClearFilters={() => { resetFilters(); setSearchQuery(''); }}
                        searchQuery={searchQuery}
                    />
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
                <React.Suspense fallback={
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                        <CircularProgress />
                    </Box>
                }>
                    <TrailMapView trails={filteredTrails} userLocation={userLocation} />
                </React.Suspense>
            )}

            <TrailSlotMachine
                open={slotMachine.open}
                trailNames={slotTrailNames}
                winner={slotMachine.winner}
                onComplete={handleSlotComplete}
            />
        </Container>
    );
};
