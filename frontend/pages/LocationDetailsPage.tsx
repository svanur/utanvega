import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
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
    Divider,
    Card,
    CardActionArea,
    CardContent
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FolderIcon from '@mui/icons-material/Folder';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import StraightenIcon from '@mui/icons-material/Straighten';
import TerrainIcon from '@mui/icons-material/Terrain';
import RouteIcon from '@mui/icons-material/Route';
import Layout from '../components/Layout';
import { useLocationBySlug, useLocationTree } from '../hooks/useLocations';
import type { LocationTreeNode } from '../hooks/useLocations';
import { TrailCard } from '../components/TrailCard';
import { TrailMapView } from '../components/TrailMapView';
import RunningLoader from '../components/RunningLoader';
import ShareButtons from '../components/ShareButtons';
import LostLocation from '../components/LostLocation';

type LocationDetailsPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function LocationDetailsPage({ mode, onToggleMode }: LocationDetailsPageProps) {
    const { t } = useTranslation();
    const { isEnabled } = useFeatureFlags();
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { location, childLocations, trails, loading, error } = useLocationBySlug(slug);
    const { tree: locationTree } = useLocationTree();
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [activeActivity, setActiveActivity] = useState<string | null>(null);
    const [activeTrailType, setActiveTrailType] = useState<string | null>(null);
    const [activeDifficulty, setActiveDifficulty] = useState<string | null>(null);

    const activityEmoji: Record<string, string> = {
        trailrunning: '🏃', running: '🏃‍♂️', hiking: '🥾', cycling: '🚴', walking: '🚶',
    };
    const activityI18nKey: Record<string, string> = {
        trailrunning: 'trailRunning', running: 'running', hiking: 'hiking', cycling: 'cycling', walking: 'walking',
    };

    // Reset filters when navigating to a different location
    useEffect(() => {
        setActiveActivity(null);
        setActiveTrailType(null);
        setActiveDifficulty(null);
    }, [slug]);

    const filteredTrails = useMemo(() => {
        if (!trails) return [];
        return trails.filter(trail => {
            if (activeActivity && trail.activityType?.toLowerCase() !== activeActivity) return false;
            if (activeTrailType && trail.trailType !== activeTrailType) return false;
            if (activeDifficulty && trail.difficulty !== activeDifficulty) return false;
            return true;
        });
    }, [trails, activeActivity, activeTrailType, activeDifficulty]);

    // Faceted counts — each category excludes its own filter so selected chip always stays visible
    const activityCounts = useMemo(() => {
        if (!trails) return {} as Record<string, number>;
        const result: Record<string, number> = {};
        for (const trail of trails) {
            if (activeTrailType && trail.trailType !== activeTrailType) continue;
            if (activeDifficulty && trail.difficulty !== activeDifficulty) continue;
            const act = trail.activityType?.toLowerCase() || 'unknown';
            result[act] = (result[act] || 0) + 1;
        }
        return result;
    }, [trails, activeTrailType, activeDifficulty]);

    const trailTypeCounts = useMemo(() => {
        if (!trails) return {} as Record<string, number>;
        const result: Record<string, number> = {};
        for (const trail of trails) {
            if (activeActivity && trail.activityType?.toLowerCase() !== activeActivity) continue;
            if (activeDifficulty && trail.difficulty !== activeDifficulty) continue;
            if (trail.trailType) result[trail.trailType] = (result[trail.trailType] || 0) + 1;
        }
        return result;
    }, [trails, activeActivity, activeDifficulty]);

    const difficultyCounts = useMemo(() => {
        if (!trails) return {} as Record<string, number>;
        const result: Record<string, number> = {};
        for (const trail of trails) {
            if (activeActivity && trail.activityType?.toLowerCase() !== activeActivity) continue;
            if (activeTrailType && trail.trailType !== activeTrailType) continue;
            if (trail.difficulty) result[trail.difficulty] = (result[trail.difficulty] || 0) + 1;
        }
        return result;
    }, [trails, activeActivity, activeTrailType]);

    const hasActiveFilters = activeActivity !== null || activeTrailType !== null || activeDifficulty !== null;

    const filteredStats = useMemo(() => {
        let totalKm = 0, totalGain = 0, totalLoss = 0;
        for (const trail of filteredTrails) {
            totalKm += trail.length / 1000;
            totalGain += trail.elevationGain;
            totalLoss += trail.elevationLoss;
        }
        return {
            count: filteredTrails.length,
            totalKm: Math.round(totalKm * 10) / 10,
            totalGain: Math.round(totalGain),
            totalLoss: Math.round(totalLoss),
        };
    }, [filteredTrails]);

    const clearFilters = () => {
        setActiveActivity(null);
        setActiveTrailType(null);
        setActiveDifficulty(null);
    };

    // Compute location trail statistics
    const stats = useMemo(() => {
        if (!trails || trails.length === 0) return null;
        let totalKm = 0, totalGain = 0, totalLoss = 0;
        const activities: Record<string, number> = {};
        const difficulties: Record<string, number> = {};
        const trailTypes: Record<string, number> = {};

        for (const t of trails) {
            totalKm += t.length / 1000;
            totalGain += t.elevationGain;
            totalLoss += t.elevationLoss;
            const act = t.activityType?.toLowerCase() || 'unknown';
            activities[act] = (activities[act] || 0) + 1;
            if (t.difficulty) difficulties[t.difficulty] = (difficulties[t.difficulty] || 0) + 1;
            if (t.trailType) trailTypes[t.trailType] = (trailTypes[t.trailType] || 0) + 1;
        }

        return {
            count: trails.length,
            totalKm: Math.round(totalKm * 10) / 10,
            totalGain: Math.round(totalGain),
            totalLoss: Math.round(totalLoss),
            activities,
            difficulties,
            trailTypes,
        };
    }, [trails]);

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
                <Container>
                    <LostLocation />
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

                <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: '16px' }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                        <LocationOnIcon color="primary" sx={{ fontSize: { xs: 28, sm: 35 } }} />
                        <Typography variant="h4" component="h1" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' }, flex: 1 }}>
                            {location.name}
                        </Typography>
                        {isEnabled('share_trail') && <ShareButtons title={location.name} />}
                    </Stack>
                    
                    <Stack direction="row" spacing={1} mb={2}>
                        <Chip label={t(`locations.type${location.type}`)} color="secondary" variant="outlined" size="small" />
                    </Stack>

                    {location.description && (
                        <Typography variant="body1" color="text.secondary" paragraph>
                            {location.description}
                        </Typography>
                    )}

                    {stats && (
                        <>
                            <Divider sx={{ my: 2 }} />
                            {/* Key numbers — 2x2 grid on mobile, single row on desktop */}
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                <Grid item xs={6} sm={3}>
                                    <Stack alignItems="center" spacing={0.5}>
                                        <RouteIcon color="primary" />
                                        <Typography variant="h6" fontWeight="bold">{filteredStats.count}</Typography>
                                        <Typography variant="caption" color="text.secondary">{t('locations.statsTrails')}</Typography>
                                    </Stack>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Stack alignItems="center" spacing={0.5}>
                                        <StraightenIcon color="primary" />
                                        <Typography variant="h6" fontWeight="bold">{filteredStats.totalKm} km</Typography>
                                        <Typography variant="caption" color="text.secondary">{t('locations.statsDistance')}</Typography>
                                    </Stack>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Stack alignItems="center" spacing={0.5}>
                                        <TerrainIcon color="success" />
                                        <Typography variant="h6" fontWeight="bold">↑ {filteredStats.totalGain} m</Typography>
                                        <Typography variant="caption" color="text.secondary">{t('locations.statsElevGain')}</Typography>
                                    </Stack>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Stack alignItems="center" spacing={0.5}>
                                        <TerrainIcon color="error" />
                                        <Typography variant="h6" fontWeight="bold">↓ {filteredStats.totalLoss} m</Typography>
                                        <Typography variant="caption" color="text.secondary">{t('locations.statsElevLoss')}</Typography>
                                    </Stack>
                                </Grid>
                            </Grid>

                            {/* Activity breakdown */}
                            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                                {Object.entries(stats.activities).map(([act]) => {
                                    const n = activityCounts[act] ?? 0;
                                    if (n === 0 && activeActivity !== act) return null;
                                    return (
                                        <Chip
                                            key={act}
                                            label={`${activityEmoji[act] || '🏞️'} ${t(`difficulty.${activityI18nKey[act] ?? act}`)} (${n})`}
                                            size="small"
                                            variant={activeActivity === act ? 'filled' : 'outlined'}
                                            onClick={() => setActiveActivity(prev => prev === act ? null : act)}
                                            clickable
                                        />
                                    );
                                })}
                            </Stack>

                            {/* Trail type + difficulty breakdown */}
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                                {Object.entries(stats.trailTypes).map(([type]) => {
                                    const n = trailTypeCounts[type] ?? 0;
                                    if (n === 0 && activeTrailType !== type) return null;
                                    const typeLabel = ({ OutAndBack: t('trail.outAndBack'), Loop: t('trail.loop'), PointToPoint: t('trail.pointToPoint') } as Record<string, string>)[type] ?? type;
                                    return (
                                        <Chip
                                            key={type}
                                            label={`${typeLabel} (${n})`}
                                            size="small"
                                            color="info"
                                            variant={activeTrailType === type ? 'filled' : 'outlined'}
                                            onClick={() => setActiveTrailType(prev => prev === type ? null : type)}
                                            clickable
                                        />
                                    );
                                })}
                                {Object.entries(stats.difficulties).map(([diff]) => {
                                    const n = difficultyCounts[diff] ?? 0;
                                    if (n === 0 && activeDifficulty !== diff) return null;
                                    return (
                                        <Chip
                                            key={diff}
                                            label={`${t(`difficulty.${diff.toLowerCase()}`)} (${n})`}
                                            size="small"
                                            color="warning"
                                            variant={activeDifficulty === diff ? 'filled' : 'outlined'}
                                            onClick={() => setActiveDifficulty(prev => prev === diff ? null : diff)}
                                            clickable
                                        />
                                    );
                                })}
                            </Stack>

                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                {t('locations.filterHint')}
                            </Typography>
                        </>
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
                                                    <Chip label={t(`locations.type${child.type}`)} size="small" variant="outlined" />
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

                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: hasActiveFilters ? 0.5 : 2 }}>
                    <Typography variant="h5" fontWeight="bold">
                        {t('locations.trailsIn', { name: location.name, count: trails?.length || 0 })}
                    </Typography>
                    {hasActiveFilters && (
                        <Button size="small" onClick={clearFilters} color="inherit">
                            {t('locations.clearFilters')}
                        </Button>
                    )}
                </Stack>
                {hasActiveFilters && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('locations.filterShowing', { count: filteredTrails.length, total: trails?.length || 0 })}
                    </Typography>
                )}

                {trails && trails.length > 0 ? (
                    filteredTrails.length > 0 ? (
                        <Box mt={2}>
                            <Box sx={{ mb: 4, height: '400px', borderRadius: '16px', overflow: 'hidden' }}>
                               <TrailMapView trails={filteredTrails} userLocation={userLocation} />
                            </Box>
                            
                            <Divider sx={{ mb: 4 }} />

                            <Grid container spacing={1}>
                                {filteredTrails.map(trail => (
                                    <Grid item xs={12} key={trail.id}>
                                        <TrailCard trail={trail} />
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    ) : (
                        <Box textAlign="center" py={4}>
                            <Typography color="text.secondary" gutterBottom>
                                {t('locations.noTrailsMatchFilter')}
                            </Typography>
                            <Button onClick={clearFilters} variant="outlined" size="small">
                                {t('locations.clearFilters')}
                            </Button>
                        </Box>
                    )
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
