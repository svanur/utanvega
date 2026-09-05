import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalize } from '../utils/localize';
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
    Stack,
    Autocomplete,
    Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterIcon from '@mui/icons-material/FilterList';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ListIcon from '@mui/icons-material/List';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import TableChartIcon from '@mui/icons-material/TableChart';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import SortIcon from '@mui/icons-material/Sort';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import LandscapeIcon from '@mui/icons-material/Landscape';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import GrassIcon from '@mui/icons-material/Grass';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CasinoIcon from '@mui/icons-material/Casino';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import HistoryIcon from '@mui/icons-material/History';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useTrails, ALL_ACTIVITY_TYPES, DEFAULT_FILTERS, useTrendingTrails } from '../hooks/useTrails';
import type { SortOption, FilterState } from '../hooks/useTrails';
import { useFavorites } from '../hooks/useFavorites';
import { useHiddenTrails } from '../hooks/useHiddenTrails';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { useShake } from '../hooks/useShake';
import { useLocationTree } from '../hooks/useLocations';
import type { LocationTreeNode } from '../hooks/useLocations';
import { TrailCard } from './TrailCard';
const TrailMapView = React.lazy(() => import('./TrailMapView').then(m => ({ default: m.TrailMapView })));
const TrailTableView = React.lazy(() => import('./TrailTableView'));
import ShareButtons from './ShareButtons';
import EmptyFilterState from './EmptyFilterState';
import SmartPresets from './SmartPresets';
import { getActivePresets } from '../utils/filterPresets';
import TrailSlotMachine from './TrailSlotMachine';
import { toUserFriendlyFetchError } from '../utils/apiErrors';
import { trackViewModeChange } from '../utils/analytics';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useEvents } from '../hooks/useEvents';
import { isOngoingPastDayTwo } from '../utils/eventUtils';
import { useOfflineTrails } from '../hooks/useOfflineTrails';
import OfflinePinIcon from '@mui/icons-material/OfflinePin';

type ViewMode = 'list' | 'map' | 'table';

interface TrailListProps {
    tagSlug?: string;
    onViewModeChange?: (mode: ViewMode) => void;
}

export const TrailList: React.FC<TrailListProps> = ({ tagSlug, onViewModeChange }) => {
    const { t } = useTranslation();
    const loc = useLocalize();
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
    const favoritesSet = React.useMemo(() => new Set(favorites), [favorites]);
    const { hiddenSlugs } = useHiddenTrails();
    const { recentSlugs } = useRecentlyViewed();
    const { trending } = useTrendingTrails();
    const { tree: locationTree } = useLocationTree();
    const navigate = useNavigate();
    const { isEnabled } = useFeatureFlags();
    const locationsPageEnabled = isEnabled('locations_page');
    const tagsEnabled = isEnabled('tags_page');
    const { events: allCompetitions, loading: competitionsLoading } = useEvents();
    const { offlineSlugs, isOffline } = useOfflineTrails();

    // Extract preset ID from navigation state (e.g. navigating from tag page with preset)
    const initialPresetId = React.useMemo(() => {
        const state = location.state as { presetId?: string } | null;
        return state?.presetId ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const [linkCopied, setLinkCopied] = React.useState(false);
    const linkCopiedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const activeFilterCount = React.useMemo(() =>
        filters.lengthBuckets.length +
        filters.elevationGainBuckets.length +
        filters.distanceBuckets.length +
        filters.difficulties.length +
        (filters.locationSlugs.length > 0 ? 1 : 0) +
        filters.selectedActivityTypes.length +
        filters.selectedTags.length +
        (filters.favoritesOnly ? 1 : 0) +
        (filters.offlineOnly ? 1 : 0),
    [filters]);
    const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
        try {
            const saved = localStorage.getItem('utanvega-view-mode');
            if (saved === 'list' || saved === 'map' || saved === 'table') return saved;
        } catch { /* storage unavailable */ }
        return 'list';
    });
    // Easter eggs triggered by search query
    const originalsTriggered = React.useRef(false);
    const utadahlaupa = React.useRef(false);
    React.useEffect(() => {
        const q = searchQuery.toLowerCase().trim();
        if (q === 'hin upprunalegu' && !originalsTriggered.current) {
            originalsTriggered.current = true;
            window.dispatchEvent(new CustomEvent('easter-egg', { detail: { egg: 'originals' } }));
            setTimeout(() => { originalsTriggered.current = false; }, 10000);
        }
        if (q === 'út að hlaupa' && !utadahlaupa.current) {
            utadahlaupa.current = true;
            window.dispatchEvent(new CustomEvent('easter-egg', { detail: { egg: 'utadahlaupa' } }));
            setTimeout(() => { utadahlaupa.current = false; }, 10000);
        }
    }, [searchQuery]);
    const [hidingSlugs, setHidingSlugs] = React.useState<string[]>([]);
    const hidingSlugsSet = React.useMemo(() => new Set(hidingSlugs), [hidingSlugs]);
    const [discoveryTab, setDiscoveryTab] = React.useState<'trending' | 'recent' | 'races'>('races');
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
            .filter(c => !['Cancelled', 'Hidden', 'Unlisted'].includes(c.status) && c.nextEditionDate != null && (c.daysUntil ?? 999) >= 0)
            .sort((a, b) => (a.nextEditionDate ?? '').localeCompare(b.nextEditionDate ?? ''))
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
        if (filters.difficulties.length === 0) {
            const easyMod = nearby.filter(t => t.difficulty === 'Easy' || t.difficulty === 'Moderate');
            if (easyMod.length > 0) nearby = easyMod;
        }

        const pick = nearby[Math.floor(Math.random() * nearby.length)];
        if (navigator.vibrate) navigator.vibrate(200);
        setSlotMachine({ open: true, winner: pick.name, winnerSlug: pick.slug });
    }, [filters.difficulties]);

    const handleSlotComplete = React.useCallback(() => {
        const slug = slotMachine.winnerSlug;
        setSlotMachine(s => ({ ...s, open: false }));
        if (slug) navigate(`/trails/${slug}`);
    }, [navigate, slotMachine.winnerSlug]);

    const handleTagClick = React.useCallback((tagSlug: string) => {
        navigate(`/tags/${tagSlug}`);
    }, [navigate]);

    const { supported: shakeSupported, permissionGranted: shakePermission, requestPermission: requestShakePermission } = useShake({
        onShake: handleShake,
        threshold: 25,
        cooldown: 3000,
    });

    // Build flat list of locations with depth + descendant slug sets for the dropdown
    const { locationMenuItems, descendantSlugs } = React.useMemo(() => {
        const items: { slug: string; name: string; nameEn: string | null; depth: number; totalTrails: number }[] = [];
        const descendants = new Map<string, Set<string>>();

        function flatten(nodes: LocationTreeNode[], depth: number): string[] {
            const allSlugs: string[] = [];
            for (const node of nodes) {
                items.push({ slug: node.slug, name: node.name, nameEn: node.nameEn, depth, totalTrails: node.totalTrailsCount });
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

    const [selectedLocationItems, setSelectedLocationItems] = React.useState<typeof locationMenuItems>([]);

    // Initialize filters from URL params on first render
    const urlInitialized = React.useRef(false);
    React.useEffect(() => {
        if (urlInitialized.current) return;

        const q = searchParams.get('q');
        const activity = searchParams.get('activity');
        const difficulty = searchParams.get('difficulty');
        const sort = searchParams.get('sort') as SortOption | null;
        const view = searchParams.get('view');
        const favShortcut = searchParams.get('favorites');
        const randomShortcut = searchParams.get('random');

        if (q) setSearchQuery(q);
        if (view === 'map' || view === 'table') {
            setViewMode(view);
            try { localStorage.setItem('utanvega-view-mode', view); } catch {/* */}
            onViewModeChange?.(view);
        }

        const updates: Partial<FilterState> = {};
        if (activity) updates.selectedActivityTypes = activity.split(',');
        if (difficulty && difficulty !== 'All') updates.difficulties = difficulty.split(',');
        if (sort) updates.sortBy = sort;
        if (favShortcut === 'true') updates.favoritesOnly = true;

        const length = searchParams.get('length');
        const elevation = searchParams.get('elevation');
        const nearme = searchParams.get('nearme');
        const locations = searchParams.get('locations');
        const tags = searchParams.get('tags');
        const offline = searchParams.get('offline');

        if (length) updates.lengthBuckets = length.split(',');
        if (elevation) updates.elevationGainBuckets = elevation.split(',');
        if (nearme) updates.distanceBuckets = nearme.split(',');
        if (locations) updates.locationSlugs = locations.split(',');
        if (tags) updates.selectedTags = tags.split(',');
        if (offline === 'true') updates.offlineOnly = true;

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
        if (filters.selectedActivityTypes.length > 0) params.set('activity', filters.selectedActivityTypes.join(','));
        if (filters.difficulties.length > 0) params.set('difficulty', filters.difficulties.join(','));
        if (filters.lengthBuckets.length > 0) params.set('length', filters.lengthBuckets.join(','));
        if (filters.elevationGainBuckets.length > 0) params.set('elevation', filters.elevationGainBuckets.join(','));
        if (filters.distanceBuckets.length > 0) params.set('nearme', filters.distanceBuckets.join(','));
        // Write only user-selected (top-level) slugs, not the expanded descendant set
        if (selectedLocationItems.length > 0) params.set('locations', selectedLocationItems.map(i => i.slug).join(','));
        if (filters.selectedTags.length > 0) params.set('tags', filters.selectedTags.join(','));
        if (filters.favoritesOnly) params.set('favorites', 'true');
        if (filters.offlineOnly) params.set('offline', 'true');
        if (filters.sortBy !== 'distance') params.set('sort', filters.sortBy);
        if (viewMode !== 'list') params.set('view', viewMode);

        setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, filters.selectedActivityTypes, filters.difficulties, filters.lengthBuckets,
        filters.elevationGainBuckets, filters.distanceBuckets, selectedLocationItems,
        filters.selectedTags, filters.favoritesOnly, filters.offlineOnly, filters.sortBy, viewMode]);

    // Runs after the sync effect on first flush — marks init done so sync starts writing
    React.useEffect(() => { urlInitialized.current = true; }, []);

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
            result = result.filter(t => favoritesSet.has(t.slug));
        }
        if (filters.offlineOnly) {
            result = result.filter(t => isOffline(t.slug));
        }
        result = result.filter(t => !hiddenSlugs.includes(t.slug) || hidingSlugsSet.has(t.slug));
        return result;
    }, [trails, filters.favoritesOnly, filters.offlineOnly, favoritesSet, isOffline, hiddenSlugs, hidingSlugsSet]);
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

    const availableTags = React.useMemo(() => {
        const tagMap = new Map<string, { name: string; nameEn: string | null; slug: string; color: string | null }>();
        trails.forEach(t => t.tags?.forEach(tag => {
            if (!tagMap.has(tag.slug)) tagMap.set(tag.slug, tag);
        }));
        return Array.from(tagMap.values()).sort((a, b) => (loc(a.name, a.nameEn) ?? a.name).localeCompare(loc(b.name, b.nameEn) ?? b.name));
    }, [trails, loc]);

    const locationRestored = React.useRef(false);

    // Only depends on descendantSlugs (memo above) and stable state setters, so — like the effect
    // below — it's safe to declare above the loading/error early returns. Declared as a plain const
    // (not a hook) but it must still sit above those returns: a render that short-circuits at
    // `if (loading) return` never reaches a `const` declared after that point, leaving it
    // uninitialized (TDZ) for that render's closures. The effect below closes over this function, so
    // if that effect instance is later invoked by React, an uninitialized reference here throws a
    // ReferenceError — the same "reachable through an early-returning render" bug as the hook-order
    // issue below, just via a TDZ violation instead of a hook-count mismatch.
    const handleLocationSelect = (items: typeof locationMenuItems) => {
        setSelectedLocationItems(items);
        // Expand each selected slug to include its descendants for OR-based filtering
        const expanded = new Set<string>();
        for (const item of items) {
            expanded.add(item.slug);
            (descendantSlugs.get(item.slug) ?? new Set()).forEach(s => expanded.add(s));
        }
        setFilters(f => ({ ...f, locationSlugs: Array.from(expanded) }));
    };

    // Restore Autocomplete + expand descendants when locationMenuItems first loads from URL params.
    // Declared above the loading/error early returns below — all hooks in this component must run
    // on every render (Rules of Hooks), otherwise the hook count differs between the initial loading
    // render and the later loaded render, which React rejects with "Rendered more hooks than during
    // the previous render" (crashes to the error boundary on a cold /trails load with no trails cache).
    React.useEffect(() => {
        if (locationRestored.current || !locationMenuItems.length || !filters.locationSlugs.length) return;
        const restored = locationMenuItems.filter(item => filters.locationSlugs.includes(item.slug));
        if (restored.length > 0) {
            locationRestored.current = true;
            handleLocationSelect(restored);
        }
    // Run once when menu items first populate; handleLocationSelect is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationMenuItems]);

    const trailsHeading = null;

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ mt: 2 }}>
                {trailsHeading}
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
                <Alert severity="error">{toUserFriendlyFetchError(error, t('common.dataLoadUnavailable'))}</Alert>
            </Container>
        );
    }

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

    return (
        <Container
            maxWidth={viewMode === 'table' ? 'lg' : 'md'} 
            sx={{ 
                pt: 1, pb: 2,
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
            {/* Page heading */}
            {trailsHeading}

            <Box mb={1}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder={t('filters.searchTrails', 'Search trails...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" fontSize="small" />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <InputAdornment position="end">
                                {searchQuery && (
                                    <IconButton
                                        aria-label={t('filters.clearSearch')}
                                        onClick={() => setSearchQuery('')}
                                        size="small"
                                        sx={{ mr: 0.5 }}
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                )}
                                {activeFilterCount > 0 && (
                                    <IconButton size="small" onClick={() => { resetFilters(); setSelectedLocationItems([]); }} sx={{ mr: 0.5 }} title={t('filters.resetFilters')}>
                                        <ClearIcon fontSize="small" color="error" />
                                    </IconButton>
                                )}
                                {activeFilterCount > 0 && (
                                    <Tooltip title={linkCopied ? t('common.copied') : t('common.copyLink')}>
                                        <IconButton
                                            size="small"
                                            sx={{ mr: 0.5 }}
                                            onClick={() => {
                                                navigator.clipboard.writeText(window.location.href);
                                                setLinkCopied(true);
                                                if (linkCopiedTimer.current) clearTimeout(linkCopiedTimer.current);
                                                linkCopiedTimer.current = setTimeout(() => setLinkCopied(false), 2000);
                                            }}
                                        >
                                            {linkCopied
                                                ? <CheckIcon fontSize="small" color="success" />
                                                : <ContentCopyIcon fontSize="small" />}
                                        </IconButton>
                                    </Tooltip>
                                )}
                                <Button
                                    size="small"
                                    variant={showAdvanced || activeFilterCount > 0 ? 'contained' : 'outlined'}
                                    color={activeFilterCount > 0 ? 'primary' : 'inherit'}
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    startIcon={<FilterIcon fontSize="small" />}
                                    sx={{ textTransform: 'none', borderRadius: 4, px: 1.5, py: 0.5, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                >
                                    {activeFilterCount > 0
                                        ? t('races.filters.activeCount', { count: activeFilterCount })
                                        : t('filters.advancedSearch')}
                                </Button>
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>

            <Collapse in={showAdvanced}>
                <Box
                    p={2}
                    mb={2}
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
                        {/* 1. Location */}
                        {locationsPageEnabled && locationMenuItems.length > 0 && (
                        <Grid item xs={12}>
                            <Autocomplete
                                multiple
                                size="small"
                                options={locationMenuItems.filter(item => item.totalTrails > 0)}
                                getOptionLabel={(opt) => opt.name}
                                value={selectedLocationItems}
                                onChange={(_, selected) => handleLocationSelect(selected)}
                                isOptionEqualToValue={(opt, val) => opt.slug === val.slug}
                                renderOption={(props, opt) => (
                                    <li {...props} key={opt.slug} style={{ paddingLeft: opt.depth > 0 ? (opt.depth * 16 + 8) : undefined }}>
                                        {opt.depth > 0 && <span style={{ color: '#888', marginRight: 4 }}>↳</span>}
                                        {loc(opt.name, opt.nameEn) ?? opt.name} <span style={{ color: '#999', fontSize: '0.8em', marginLeft: 4 }}>({opt.totalTrails})</span>
                                    </li>
                                )}
                                renderInput={(params) => (
                                    <TextField {...params} label={t('filters.location')} placeholder={t('filters.allLocations')} />
                                )}
                                renderTags={(value, getTagProps) =>
                                    value.map((opt, index) => (
                                        <Chip {...getTagProps({ index })} key={opt.slug} label={loc(opt.name, opt.nameEn) ?? opt.name} size="small" />
                                    ))
                                }
                            />
                        </Grid>
                        )}

                        {/* 2. Activity */}
                        {isEnabled('activity_pills') && (
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>
                                {t('races.filters.activityType')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {ALL_ACTIVITY_TYPES.filter(type => trails.some(t => t.activityType === type)).map(type => {
                                    const selected = filters.selectedActivityTypes.includes(type);
                                    const icon = {
                                        TrailRunning: <LandscapeIcon fontSize="small" />,
                                        Running: <DirectionsRunIcon fontSize="small" />,
                                        Hiking: <HikingIcon fontSize="small" />,
                                        Cycling: <DirectionsBikeIcon fontSize="small" />,
                                        FunRun: <CelebrationIcon fontSize="small" />,
                                        ObstacleCourse: <FitnessCenterIcon fontSize="small" />,
                                        CrossCountryRun: <GrassIcon fontSize="small" />,
                                    }[type];
                                    return (
                                        <Chip
                                            key={type}
                                            icon={icon}
                                            label={t(`difficulty.${type.charAt(0).toLowerCase() + type.slice(1)}`)}
                                            size="small"
                                            variant={selected ? 'filled' : 'outlined'}
                                            color={selected ? 'primary' : 'default'}
                                            onClick={() => {
                                                const current = filters.selectedActivityTypes;
                                                const updated = selected ? current.filter(t => t !== type) : [...current, type];
                                                setFilters(f => ({ ...f, selectedActivityTypes: updated }));
                                            }}
                                            sx={{ cursor: 'pointer' }}
                                        />
                                    );
                                })}
                            </Box>
                        </Grid>
                        )}

                        {/* 3. Trail Length */}
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>
                                {t('filters.trailLength')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                {([
                                    { key: '<10', label: '< 10 km' },
                                    { key: '10-21', label: '10–21 km' },
                                    { key: '21-42', label: t('filters.halfMarathon', 'Half–Marathon') },
                                    { key: '42-100', label: t('filters.marathonTo100', 'Marathon–100 km') },
                                    { key: '100+', label: '100 km+' },
                                ] as const).map(({ key, label }) => {
                                    const selected = filters.lengthBuckets.includes(key);
                                    return (
                                        <Chip
                                            key={key}
                                            label={label}
                                            size="small"
                                            variant={selected ? 'filled' : 'outlined'}
                                            color={selected ? 'primary' : 'default'}
                                            onClick={() => {
                                                const next = selected
                                                    ? filters.lengthBuckets.filter(b => b !== key)
                                                    : [...filters.lengthBuckets, key];
                                                setFilters(f => ({ ...f, lengthBuckets: next }));
                                            }}
                                            sx={{ cursor: 'pointer' }}
                                        />
                                    );
                                })}
                            </Box>
                        </Grid>

                        {/* 4. Elevation Gain */}
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>
                                {t('filters.elevationGain')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                {([
                                    { key: '<200', label: '< 200 m' },
                                    { key: '200-500', label: '200–500 m' },
                                    { key: '500-1000', label: '500–1000 m' },
                                    { key: '1000+', label: '1000 m+' },
                                ] as const).map(({ key, label }) => {
                                    const selected = filters.elevationGainBuckets.includes(key);
                                    return (
                                        <Chip
                                            key={key}
                                            label={label}
                                            size="small"
                                            variant={selected ? 'filled' : 'outlined'}
                                            color={selected ? 'primary' : 'default'}
                                            onClick={() => {
                                                const next = selected
                                                    ? filters.elevationGainBuckets.filter(b => b !== key)
                                                    : [...filters.elevationGainBuckets, key];
                                                setFilters(f => ({ ...f, elevationGainBuckets: next }));
                                            }}
                                            sx={{ cursor: 'pointer' }}
                                        />
                                    );
                                })}
                            </Box>
                        </Grid>

                        {/* 5. Difficulty */}
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>
                                {t('filters.difficulty')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                {(['Easy', 'Moderate', 'Hard', 'Expert', 'Extreme'] as const).map(d => {
                                    const selected = filters.difficulties.includes(d);
                                    return (
                                        <Chip
                                            key={d}
                                            label={t(`difficulty.${d.toLowerCase()}`)}
                                            size="small"
                                            variant={selected ? 'filled' : 'outlined'}
                                            color={selected ? 'primary' : 'default'}
                                            onClick={() => {
                                                const next = selected
                                                    ? filters.difficulties.filter(x => x !== d)
                                                    : [...filters.difficulties, d];
                                                setFilters(f => ({ ...f, difficulties: next }));
                                            }}
                                            sx={{ cursor: 'pointer' }}
                                        />
                                    );
                                })}
                            </Box>
                        </Grid>

                        {/* 6. Tags */}
                        {tagsEnabled && availableTags.length > 0 && (
                            <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.75, display: 'block' }}>{t('filters.tags')}</Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {availableTags.map(tag => {
                                        const selected = filters.selectedTags.includes(tag.slug);
                                        return (
                                            <Chip
                                                key={tag.slug}
                                                label={loc(tag.name, tag.nameEn) ?? tag.name}
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

                        {/* 7. Near me — conditional on geolocation */}
                        {userLocation && (
                            <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>
                                    {t('races.nearMe.label', 'Near me')}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                    {([
                                        { key: '<10', label: '< 10 km' },
                                        { key: '10-25', label: '10–25 km' },
                                        { key: '25-50', label: '25–50 km' },
                                        { key: '50-100', label: '50–100 km' },
                                        { key: '100+', label: '100 km+' },
                                    ] as const).map(({ key, label }) => {
                                        const selected = filters.distanceBuckets.includes(key);
                                        return (
                                            <Chip
                                                key={key}
                                                label={label}
                                                size="small"
                                                variant={selected ? 'filled' : 'outlined'}
                                                color={selected ? 'primary' : 'default'}
                                                onClick={() => {
                                                    const next = selected
                                                        ? filters.distanceBuckets.filter(b => b !== key)
                                                        : [...filters.distanceBuckets, key];
                                                    setFilters(f => ({ ...f, distanceBuckets: next }));
                                                }}
                                                sx={{ cursor: 'pointer' }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Grid>
                        )}

                        {/* 8. Checkboxes row: Favorites · Offline */}
                        <Grid item xs={12}>
                            <Stack direction="row" flexWrap="wrap" sx={{ gap: 0, mx: -1 }}>
                                <FormControlLabel
                                    sx={{ mx: 1 }}
                                    control={
                                        <Checkbox
                                            checked={filters.favoritesOnly}
                                            onChange={(e) => handleFilterChange('favoritesOnly', e.target.checked)}
                                            icon={<StarBorderIcon />}
                                            checkedIcon={<StarIcon sx={{ color: 'warning.main' }} />}
                                        />
                                    }
                                    label={<Typography variant="body2">{t('filters.showFavoritesOnly')}</Typography>}
                                />
                                {isEnabled('offline_button') && offlineSlugs.size > 0 && (
                                    <FormControlLabel
                                        sx={{ mx: 1 }}
                                        control={
                                            <Checkbox
                                                checked={filters.offlineOnly}
                                                onChange={(e) => handleFilterChange('offlineOnly', e.target.checked)}
                                                icon={<OfflinePinIcon />}
                                                checkedIcon={<OfflinePinIcon sx={{ color: 'success.main' }} />}
                                            />
                                        }
                                        label={<Typography variant="body2">{t('filters.showOfflineOnly')}</Typography>}
                                    />
                                )}
                            </Stack>
                        </Grid>

                        {/* 9. Divider + Bottom actions: Reset (conditional) + Close */}
                        <Grid item xs={12}><Divider /></Grid>
                        <Grid item xs={12} display="flex" justifyContent="flex-end" gap={1}>
                            {activeFilterCount > 0 && (
                            <Button size="small" onClick={() => {
                                resetFilters(); setSelectedLocationItems([]);
                                if (tagSlug) navigate('/', { replace: true });
                            }}>
                                {t('filters.resetFilters')}
                            </Button>
                            )}
                            <Button size="small" variant="outlined" onClick={() => setShowAdvanced(false)}>
                                {t('filters.closeFilters')}
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            </Collapse>

            {/* Activity Type pills — Trail Run + Road Run always visible; other types behind feature flag */}
            <Box
                display="flex"
                gap={0.5}
                mb={2}
                flexWrap="nowrap"
                overflow="auto"
                sx={{ minWidth: 0, maxWidth: '100%', overscrollBehaviorX: 'contain' }}
            >
                <Chip
                    icon={<LandscapeIcon fontSize="small" />}
                    label={t('difficulty.trailRunning')}
                    size="small"
                    variant={filters.selectedActivityTypes.includes('TrailRunning') ? 'filled' : 'outlined'}
                    color={filters.selectedActivityTypes.includes('TrailRunning') ? 'primary' : 'default'}
                    onClick={() => {
                        const selected = filters.selectedActivityTypes.includes('TrailRunning');
                        setFilters(f => ({ ...f, selectedActivityTypes: selected ? f.selectedActivityTypes.filter(x => x !== 'TrailRunning') : [...f.selectedActivityTypes, 'TrailRunning'] }));
                    }}
                    sx={{ cursor: 'pointer' }}
                />
                <Chip
                    icon={<DirectionsRunIcon fontSize="small" />}
                    label={t('difficulty.running')}
                    size="small"
                    variant={filters.selectedActivityTypes.includes('Running') ? 'filled' : 'outlined'}
                    color={filters.selectedActivityTypes.includes('Running') ? 'primary' : 'default'}
                    onClick={() => {
                        const selected = filters.selectedActivityTypes.includes('Running');
                        setFilters(f => ({ ...f, selectedActivityTypes: selected ? f.selectedActivityTypes.filter(x => x !== 'Running') : [...f.selectedActivityTypes, 'Running'] }));
                    }}
                    sx={{ cursor: 'pointer' }}
                />
                {isEnabled('activity_pills') && ALL_ACTIVITY_TYPES
                    .filter(type => type !== 'TrailRunning' && type !== 'Running' && trails.some(t => t.activityType === type))
                    .map(type => {
                        const selected = filters.selectedActivityTypes.includes(type);
                        const icon = {
                            Hiking: <HikingIcon fontSize="small" />,
                            Cycling: <DirectionsBikeIcon fontSize="small" />,
                            FunRun: <CelebrationIcon fontSize="small" />,
                            ObstacleCourse: <FitnessCenterIcon fontSize="small" />,
                            CrossCountryRun: <GrassIcon fontSize="small" />,
                        }[type as 'Hiking' | 'Cycling' | 'FunRun' | 'ObstacleCourse' | 'CrossCountryRun'];
                        const label = t(`difficulty.${type.charAt(0).toLowerCase() + type.slice(1)}`);
                        return (
                            <Tooltip key={type} title={label} arrow>
                                <Chip
                                    icon={icon}
                                    label={label}
                                    onClick={() => {
                                        setFilters(f => ({
                                            ...f,
                                            selectedActivityTypes: selected
                                                ? f.selectedActivityTypes.filter(t => t !== type)
                                                : [...f.selectedActivityTypes, type],
                                        }));
                                    }}
                                    color={selected ? 'primary' : 'default'}
                                    variant={selected ? 'filled' : 'outlined'}
                                    size="small"
                                    sx={{
                                        fontWeight: selected ? 'bold' : 'normal',
                                        opacity: selected ? 1 : 0.6,
                                        fontSize: '0.75rem',
                                        height: 26,
                                        '& .MuiChip-label': { display: { xs: 'none', sm: 'block' }, px: 0.75 },
                                        '& .MuiChip-icon': { mx: { xs: 0, sm: undefined }, fontSize: '1rem' },
                                        px: { xs: 0.5, sm: undefined },
                                        minWidth: { xs: 32, sm: undefined },
                                        justifyContent: 'center',
                                    }}
                                />
                            </Tooltip>
                        );
                    })
                }
            </Box>

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
                                    label={t('home.nextEvents')}
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
                            minWidth: 0,
                            maxWidth: '100%',
                            overscrollBehaviorX: 'contain',
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
                                onClick={() => navigate(`/events/${comp.slug}`)}
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
                                        {loc(comp.name, comp.nameEn) ?? comp.name}
                                    </Typography>
                                    {locationsPageEnabled && comp.locationName && (
                                        <Typography variant="caption" color="text.secondary" noWrap>
                                            📍 {comp.locationName}
                                        </Typography>
                                    )}
                                    <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
                                        {comp.daysUntil != null && comp.daysUntil >= 0 && (
                                            <Chip
                                                label={isOngoingPastDayTwo(comp.daysUntil, comp.displayDate, comp.endDisplayDate)
                                                    ? t('races.ongoing')
                                                    : comp.daysUntil === 0
                                                    ? t('races.today')
                                                    : t('races.daysUntil', { count: comp.daysUntil })}
                                                size="small"
                                                color={comp.daysUntil <= 7 ? 'error' : comp.daysUntil <= 30 ? 'warning' : 'success'}
                                                sx={{ fontSize: '0.65rem', height: 20 }}
                                            />
                                        )}
                                        {comp.editionCount > 0 && (
                                            <Chip
                                                label={t('races.editionCount', { count: comp.editionCount })}
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
                        : viewMode === 'map' ? t('home.trailMap') : t('home.allTrails')
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
                        onChange={(_, value) => { if (value) { const v = value as ViewMode; setViewMode(v); try { localStorage.setItem('utanvega-view-mode', v); } catch {/* */} onViewModeChange?.(v); trackViewModeChange('trails', v); } }}
                        size="small"
                        aria-label={t('home.viewMode')}
                    >
                        <Tooltip title={t('home.listView')}>
                            <ToggleButton value="list" aria-label={t('home.listView')}>
                                <ListIcon fontSize="small" />
                            </ToggleButton>
                        </Tooltip>
                        <Tooltip title={t('home.mapView')}>
                            <ToggleButton value="map" aria-label={t('home.mapView')}>
                                <PlaceOutlinedIcon fontSize="small" />
                            </ToggleButton>
                        </Tooltip>
                        <Tooltip title={t('home.tableView')}>
                            <ToggleButton value="table" aria-label={t('home.tableView')}>
                                <TableChartIcon fontSize="small" />
                            </ToggleButton>
                        </Tooltip>
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
                filteredTrails.length === 0 && searchQuery.toLowerCase().trim() !== 'út að hlaupa' ? (
                    <EmptyFilterState
                        hasActiveFilters={!!(searchQuery || activeFilterCount > 0)}
                        onClearFilters={() => { resetFilters(); setSelectedLocationItems([]); setSearchQuery(''); }}
                        searchQuery={searchQuery}
                    />
                ) : (
                    filteredTrails.map(trail => (
                        <Collapse key={trail.id} in={!hidingSlugsSet.has(trail.slug)}>
                            <TrailCard
                                trail={trail}
                                onToggleFavorite={toggleFavorite}
                                isFavorited={favoritesSet.has(trail.slug)}
                                onTagClick={tagsEnabled ? handleTagClick : undefined}
                                isHiding={hidingSlugsSet.has(trail.slug)}
                            />
                        </Collapse>
                    ))
                )
            ) : viewMode === 'table' ? (
                <React.Suspense fallback={
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                        <CircularProgress />
                    </Box>
                }>
                    <TrailTableView trails={filteredTrails} favorites={favorites} onToggleFavorite={toggleFavorite} userLocation={userLocation} />
                </React.Suspense>
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
