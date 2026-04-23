import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
    Box, 
    Typography, 
    Button, 
    Paper, 
    Grid, 
    Chip,
    Divider,
    Stack,
    PaletteMode,
    IconButton,
    Container,
    CircularProgress,
    Tooltip,
    Dialog,
    DialogContent,
    DialogTitle,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import RouteIcon from '@mui/icons-material/Route';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import LandscapeIcon from '@mui/icons-material/Landscape';
import LoopIcon from '@mui/icons-material/Loop';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import EastIcon from '@mui/icons-material/East';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FlagIcon from '@mui/icons-material/Flag';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import NearMeIcon from '@mui/icons-material/NearMe';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import Layout from '../components/Layout';
import { useTrailBySlug, useTrails, useTrailSuggestions, useTrailWeather, recordTrailView, API_URL } from '../hooks/useTrails';
import { estimateDuration } from '../utils/estimateDuration';
import PaceInfo from '../components/PaceInfo';
import LostRunner from '../components/LostRunner';
import { useFavorites } from '../hooks/useFavorites';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import TrailMap, { GeoJsonGeometry } from '../components/TrailMap';
import ElevationChart from '../components/ElevationChart';
import RoutePlayback from '../components/RoutePlayback';
import ShareButtons from '../components/ShareButtons';
import QRCodeShare from '../components/QRCodeShare';
import DifficultyInfo from '../components/DifficultyInfo';
import RunningLoader from '../components/RunningLoader';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import WeatherCard from '../components/WeatherCard';
import OfflineButton from '../components/OfflineButton';
import { TrailCard } from '../components/TrailCard';

const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'trailrunning': return <LandscapeIcon />;
        case 'running': return <DirectionsRunIcon />;
        case 'cycling': return <DirectionsBikeIcon />;
        case 'hiking': return <HikingIcon />;
        default: return <RouteIcon />;
    }
};

const getTrailTypeIcon = (type: string) => {
    switch (type) {
        case 'OutAndBack': return <SyncAltIcon color="action" />;
        case 'Loop': return <LoopIcon color="action" />;
        case 'PointToPoint': return <EastIcon color="action" />;
        default: return <RouteIcon color="action" />;
    }
};

const getTrailTypeLabel = (type: string, t: (key: string) => string) => {
    switch (type) {
        case 'OutAndBack': return t('trail.outAndBack');
        case 'Loop': return t('trail.loop');
        case 'PointToPoint': return t('trail.pointToPoint');
        default: return type;
    }
};

type TrailDetailsPageProps = {
    mode: PaletteMode;
    onToggleMode: () => void;
};

export default function TrailDetailsPage({ mode, onToggleMode }: TrailDetailsPageProps) {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { trail, loading, error } = useTrailBySlug(slug);
    const { weather, loading: weatherLoading, error: weatherError } = useTrailWeather(slug);
    const { isEnabled } = useFeatureFlags();
    const { trails: allTrails } = useTrails();
    const { isFavorite, toggleFavorite } = useFavorites();
    const { addRecent } = useRecentlyViewed();
    const { suggestions, loading: suggestionsLoading } = useTrailSuggestions(slug, !!error || (!loading && !trail));
    const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
    const [hoverPoint, setHoverPoint] = useState<{ lat: number; lng: number } | null>(null);
    const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);
    const [fullscreenOpen, setFullscreenOpen] = useState(false);
    const dialogMapRef = useRef<import('leaflet').Map | null>(null);

    // Record trail view for "recently viewed" + server analytics
    React.useEffect(() => {
        if (trail?.slug) {
            addRecent(trail.slug);
            recordTrailView(trail.slug);
        }
    }, [trail?.slug, addRecent]);

    const relatedTrails = (allTrails && trail) 
        ? (() => {
            const baseSlug = trail.slug.replace(/-\d+$/, '');

            const scored = allTrails
                .filter(t => t.slug !== trail.slug)
                .map(t => {
                    let score = 0;

                    const tBase = t.slug.replace(/-\d+$/, '');
                    const isSameBase = tBase === baseSlug 
                        || t.slug.startsWith(baseSlug + '-')
                        || trail.slug.startsWith(tBase + '-');
                    if (isSameBase) score += 5;

                    const sharedLocations = t.locations.filter(loc => 
                        trail.locations.some(tl => tl.slug === loc.slug)
                    ).length;
                    score += sharedLocations * 3;

                    const sharedTags = (t.tags || []).filter(tag =>
                        (trail.tags || []).some(tt => tt.slug === tag.slug)
                    ).length;
                    score += sharedTags * 2;

                    if (t.activityType === trail.activityType) score += 1;

                    return { trail: t, score, sameBase: isSameBase };
                })
                .filter(r => r.score > 0)
                .sort((a, b) => {
                    if (a.sameBase !== b.sameBase) return a.sameBase ? -1 : 1;
                    return b.score - a.score;
                })
                .slice(0, 10);

            return scored.map(r => r.trail);
        })()
        : [];

    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const { scrollLeft, clientWidth } = scrollRef.current;
            const scrollAmount = clientWidth;
            scrollRef.current.scrollTo({
                left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    if (loading) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                    <RunningLoader />
                </Box>
            </Layout>
        );
    }

    if (error || !trail) {
        return (
            <Layout mode={mode} onToggleMode={onToggleMode}>
                <LostRunner />
                {(suggestions.length > 0 || suggestionsLoading) && (
                    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                        <Typography variant="h6" gutterBottom sx={{ textAlign: 'center' }}>
                            {t('trail.wereYouLookingFor')}
                        </Typography>
                        {suggestionsLoading ? (
                            <Box display="flex" justifyContent="center" py={2}>
                                <CircularProgress size={24} />
                            </Box>
                        ) : (
                            <Stack spacing={1}>
                                {suggestions.map(s => (
                                    <Paper
                                        key={s.slug}
                                        elevation={1}
                                        sx={{
                                            p: 2,
                                            cursor: 'pointer',
                                            '&:hover': { bgcolor: 'action.hover' },
                                            borderRadius: 2,
                                        }}
                                        onClick={() => navigate(`/trails/${s.slug}`)}
                                    >
                                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight="bold">
                                                    {s.name}
                                                </Typography>
                                                <Stack direction="row" spacing={1} mt={0.5}>
                                                    <Chip label={`${(s.length / 1000).toFixed(1)} km`} size="small" variant="outlined" />
                                                    <Chip label={s.activityType} size="small" variant="outlined" />
                                                    <Chip label={s.trailType} size="small" color="info" variant="outlined" />
                                                </Stack>
                                            </Box>
                                            <Typography variant="body2" color="primary">→</Typography>
                                        </Stack>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Container>
                )}
            </Layout>
        );
    }

    const distanceKm = (trail.length / 1000).toFixed(2);
    const estTime = estimateDuration(trail.length, trail.elevationGain, trail.activityType);

    return (
        <Layout mode={mode} onToggleMode={onToggleMode}>
            <Button 
                startIcon={<ArrowBackIcon />} 
                onClick={() => navigate('/')}
                sx={{ mb: 2 }}
            >
                {t('trail.backToTrails')}
            </Button>

            <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
                <Box mb={3}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' }, flex: 1 }}>
                            {trail.name}
                        </Typography>
                        <IconButton 
                            onClick={() => toggleFavorite(trail.slug)}
                            color="warning"
                            sx={{ mt: 0.5 }}
                        >
                            {isFavorite(trail.slug) ? <StarIcon /> : <StarBorderIcon />}
                        </IconButton>
                    </Box>
                    
                    <Stack 
                        direction="row" 
                        spacing={1} 
                        alignItems="center" 
                        justifyContent="flex-end"
                        flexWrap="wrap" 
                        useFlexGap 
                        sx={{ mb: 2 }}
                    >
                        {trail.difficulty && (
                            <DifficultyInfo difficulty={trail.difficulty} activityType={trail.activityType} />
                        )}
                        <Chip 
                            icon={getActivityIcon(trail.activityType)} 
                            label={trail.activityType} 
                            color="primary" 
                            variant="outlined" 
                            size="small"
                        />
                        {trail.locations && trail.locations.length > 0 && trail.locations.map((loc) => {
                            const roleIcon = {
                                Start: <FlagIcon sx={{ fontSize: '1rem' }} />,
                                End: <SportsScoreIcon sx={{ fontSize: '1rem' }} />,
                                BelongsTo: <LocationOnIcon sx={{ fontSize: '1rem' }} />,
                                PassingThrough: <NearMeIcon sx={{ fontSize: '1rem' }} />,
                                Near: <NearMeIcon sx={{ fontSize: '1rem' }} />,
                            }[loc.role] || <LocationOnIcon sx={{ fontSize: '1rem' }} />;
                            
                            const roleLabel = loc.role && loc.role !== 'BelongsTo'
                                ? `${loc.name} · ${t(`trail.role.${loc.role}`)}`
                                : loc.name;

                            return (
                                <Chip 
                                    key={loc.slug}
                                    icon={roleIcon} 
                                    label={roleLabel}
                                    variant="outlined"
                                    color="secondary"
                                    component={RouterLink}
                                    to={`/locations/${loc.slug}`}
                                    clickable
                                    size="small"
                                />
                            );
                        })}
                        {trail.tags && trail.tags.length > 0 && trail.tags.map((tag) => (
                            <Chip
                                key={tag.slug}
                                label={tag.name}
                                size="small"
                                component={RouterLink}
                                to={`/tags/${tag.slug}`}
                                clickable
                                sx={{
                                    backgroundColor: tag.color || undefined,
                                    color: tag.color ? '#fff' : undefined,
                                }}
                                variant={tag.color ? 'filled' : 'outlined'}
                            />
                        ))}
                        {isEnabled('share_trail') && <ShareButtons title={trail.name} />}
                        {isEnabled('qr_code') && <QRCodeShare slug={trail.slug} trailName={trail.name} />}
                        {isEnabled('download_trail') && (
                        <Tooltip title={t('trail.downloadGpx')} arrow>
                            <IconButton
                                size="small"
                                component="a"
                                href={`${API_URL}/api/v1/trails/${trail.slug}/gpx`}
                                download
                            >
                                <FileDownloadIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        )}
                        {isEnabled('offline_button') && <OfflineButton slug={trail.slug} trailName={trail.name} />}
                        {isEnabled('directions_to_trailhead') && geometry && geometry.coordinates.length > 0 && (
                            <Tooltip title={t('trail.getDirections')} arrow>
                                <IconButton
                                    size="small"
                                    component="a"
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${geometry.coordinates[0][1]},${geometry.coordinates[0][0]}`}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    <DirectionsCarIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>

                    {/* Linked races banner */}
                    {trail.linkedRaces && trail.linkedRaces.length > 0 && isEnabled('races_page') && (
                        <Box sx={{ mb: 2 }}>
                            {trail.linkedRaces.map((race, i) => (
                                <Paper
                                    key={i}
                                    component={RouterLink}
                                    to={`/races/${race.competitionSlug}`}
                                    elevation={0}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        px: 2,
                                        py: 1,
                                        mb: 0.5,
                                        borderRadius: 2,
                                        bgcolor: 'action.hover',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        transition: 'background-color 0.2s',
                                        '&:hover': { bgcolor: 'action.selected' },
                                    }}
                                >
                                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                        🏆 {t('trail.partOfRace', { competition: race.competitionName, race: race.distanceLabel || race.raceName })}
                                    </Typography>
                                    {race.daysUntil != null && race.daysUntil >= 0 && (
                                        <Chip
                                            label={race.daysUntil === 0
                                                ? t('races.today')
                                                : t('races.daysUntil', { count: race.daysUntil })}
                                            size="small"
                                            color="success"
                                            sx={{ fontSize: '0.7rem', height: 22 }}
                                        />
                                    )}
                                </Paper>
                            ))}
                        </Box>
                    )}

                    {trail.description && (
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                            {trail.description}
                        </Typography>
                    )}

                    <Divider sx={{ my: 2, display: { xs: 'block', sm: 'none' }, opacity: 0.6 }} />

                    <Grid container spacing={1} sx={{ mt: 1 }}>
                        <Grid item xs={4} sm>
                            <Stack alignItems="center" spacing={0.5}>
                                <RouteIcon color="action" fontSize="small" />
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{t('trail.distance')}</Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{distanceKm} km</Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={4} sm>
                            <Stack alignItems="center" spacing={0.5}>
                                <TrendingUpIcon sx={{ color: 'success.main' }} fontSize="small" />
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{t('trail.gain')}</Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>+{Math.round(trail.elevationGain)}m</Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={4} sm>
                            <Stack alignItems="center" spacing={0.5}>
                                <TrendingDownIcon sx={{ color: 'error.main' }} fontSize="small" />
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{t('trail.loss')}</Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>-{Math.round(trail.elevationLoss)}m</Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={6} sm>
                            <Stack alignItems="center" spacing={0.5}>
                                {getTrailTypeIcon(trail.trailType)}
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{t('trail.type')}</Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>{getTrailTypeLabel(trail.trailType, t)}</Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={6} sm>
                            {isEnabled('pace_info') && <PaceInfo activityType={trail.activityType} formattedDuration={estTime} />}
                        </Grid>
                    </Grid>
                </Box>

                <Divider sx={{ mb: 3 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6">
                        {t('trail.routeMap')}
                    </Typography>
                    {geometry && (
                        <Tooltip title={t('trail.fullscreenMap')}>
                            <IconButton size="small" onClick={() => setFullscreenOpen(true)} aria-label={t('trail.fullscreenMap')}>
                                <FullscreenIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
                <TrailMap 
                    slug={trail.slug} 
                    onDataLoaded={setGeometry} 
                    hoverPoint={hoverPoint}
                    activityType={trail.activityType}
                />

                {geometry && (
                    <>
                        {isEnabled('route_playback') && (
                        <RoutePlayback
                            coordinates={geometry.coordinates}
                            onPointChange={setHoverPoint}
                            onIndexChange={setPlaybackIndex}
                        />
                        )}
                        <ElevationChart 
                            coordinates={geometry.coordinates} 
                            onHover={(point) => setHoverPoint(point ? { lat: point.lat, lng: point.lng } : null)}
                            activeIndex={playbackIndex}
                        />
                    </>
                )}
            </Paper>

            {/* Weather forecast */}
            {isEnabled('weather_forecast') && (
            <WeatherCard weather={weather} loading={weatherLoading} error={weatherError} />
            )}

            {isEnabled('related_trails') && relatedTrails.length > 0 && (
                <Box mt={4} mb={6}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="h5" component="h2" fontWeight="bold">
                            {t('trail.relatedTrails')}
                        </Typography>
                        {relatedTrails.length > 3 && (
                            <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
                                <IconButton onClick={() => scroll('left')} size="small">
                                    <ChevronLeftIcon />
                                </IconButton>
                                <IconButton onClick={() => scroll('right')} size="small">
                                    <ChevronRightIcon />
                                </IconButton>
                            </Box>
                        )}
                    </Box>
                    <Box 
                        ref={scrollRef}
                        sx={{ 
                            display: 'flex', 
                            overflowX: 'auto', 
                            gap: 2,
                            pb: 1,
                            scrollSnapType: 'x mandatory',
                            '&::-webkit-scrollbar': { display: 'none' },
                            msOverflowStyle: 'none',
                            scrollbarWidth: 'none',
                        }}
                    >
                        {relatedTrails.map((relatedTrail) => (
                            <Box 
                                key={relatedTrail.slug} 
                                sx={{ 
                                    minWidth: { xs: '60%', sm: 'calc(33.333% - 10.7px)', md: 'calc(25% - 12px)' },
                                    height: 140,
                                    scrollSnapAlign: 'start',
                                    display: 'flex',
                                }}
                            >
                                <TrailCard trail={relatedTrail} compact={true} disableGestures={true} />
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Fullscreen map + elevation dialog */}
            <Dialog
                fullScreen
                open={fullscreenOpen}
                onClose={() => {
                    setHoverPoint(null);
                    setFullscreenOpen(false);
                }}
                TransitionProps={{
                    onEntered: () => dialogMapRef.current?.invalidateSize(),
                    onExited: () => setHoverPoint(null),
                }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
                    <Typography variant="h6" component="span" noWrap>{trail.name}</Typography>
                    <IconButton
                        onClick={() => {
                            setHoverPoint(null);
                            setFullscreenOpen(false);
                        }}
                        aria-label={t('trail.closeFullscreen')}
                    >
                        <FullscreenExitIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent
                    sx={{
                        p: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        overflow: 'hidden',
                    }}
                >
                    <Box sx={{ flex: '6 1 0', minHeight: 0 }}>
                        <TrailMap
                            slug={trail.slug}
                            geometry={geometry as GeoJsonGeometry | undefined}
                            enableGeolocation={false}
                            hoverPoint={hoverPoint}
                            activityType={trail.activityType}
                            height="100%"
                            mapInstanceRef={dialogMapRef}
                        />
                    </Box>
                    {geometry && (
                        <Box sx={{ flex: '4 1 0', minHeight: 0, overflow: 'auto', px: 2, pb: 1 }}>
                            <ElevationChart
                                coordinates={geometry.coordinates}
                                onHover={(point) => setHoverPoint(point ? { lat: point.lat, lng: point.lng } : null)}
                                activeIndex={playbackIndex}
                                compact
                            />
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </Layout>
    );
}
