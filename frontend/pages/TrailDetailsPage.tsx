import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
    Box, 
    Typography, 
    Button, 
    ButtonBase,
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
    Avatar,
    Collapse,
    TextField,
    Snackbar,
    Alert,
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import GroupsIcon from '@mui/icons-material/Groups';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VideocamIcon from '@mui/icons-material/Videocam';
import Layout from '../components/Layout';
import { useTrailBySlug, useTrails, useTrailSuggestions, useTrailWeather, useTrailLeaderboard, recordTrailView, API_URL } from '../hooks/useTrails';
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
import { useAuth } from '../hooks/useAuth';
import { useTickedTrails } from '../hooks/useTickedTrails';
import LoginModal from '../components/LoginModal';
import { useLoginEnabled } from '../hooks/useLoginEnabled';
import TrailLeaderboardCard from '../components/TrailLeaderboardCard';
import { useTrailCheckIns } from '../hooks/useTrailCheckIns';
import { getAvatarFallbackText, getAvatarImageSrc } from '../utils/avatarPresets';

const ALLOWED_YT_HOSTS = ['www.youtube.com', 'youtube.com', 'youtu.be', 'www.youtube-nocookie.com'];

function toYoutubeEmbedUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
        if (!ALLOWED_YT_HOSTS.includes(parsed.hostname)) return null;

        if (parsed.hostname === 'youtu.be') {
            const id = parsed.pathname.slice(1);
            return id ? `https://www.youtube.com/embed/${id}` : null;
        }
        if (parsed.pathname.startsWith('/embed/')) {
            return `https://www.youtube.com${parsed.pathname}`;
        }
        const videoId = parsed.searchParams.get('v');
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    } catch {
        return null;
    }
}

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

const CHECK_IN_SEARCH_THRESHOLD = 10;
const CHECK_IN_NEARBY_RADIUS_KM = 0.8;
const CHECK_IN_JUST_ARRIVED_MINUTES = 10;
const CHECK_IN_LEAVING_SOON_MINUTES = 30;
const CHECK_IN_NEARBY_GEO_CACHE_MS = 15 * 60 * 1000;

export default function TrailDetailsPage({ mode, onToggleMode }: TrailDetailsPageProps) {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { trail, loading, error } = useTrailBySlug(slug);
    const { weather, loading: weatherLoading, error: weatherError } = useTrailWeather(slug);
    const { isEnabled } = useFeatureFlags();
    const loginEnabled = useLoginEnabled();
    const locationsPageEnabled = isEnabled('locations_page');
    const tagsEnabled = isEnabled('tags_page');
    const leaderboardEnabled = isEnabled('trail_leaderboard', false);
    const checkInEnabled = isEnabled('trail_checkin', false);
    const { leaderboard, totalEntries, loading: leaderboardLoading, error: leaderboardError } = useTrailLeaderboard(slug, 3, leaderboardEnabled);
    const {
        entries: checkIns,
        totalActive: totalCheckIns,
        loading: checkInLoading,
        error: checkInQueryError,
        isCheckedIn,
        checkIn,
        checkOut,
        saving: checkInSaving,
    } = useTrailCheckIns(slug, checkInEnabled);
    const { trails: allTrails } = useTrails();
    const { isFavorite, toggleFavorite } = useFavorites();
    const { addRecent } = useRecentlyViewed();
    const { user } = useAuth();
    const { tickedSlugs, toggleTick } = useTickedTrails();
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [checkInError, setCheckInError] = useState<string | null>(null);
    const [checkInExpanded, setCheckInExpanded] = useState(false);
    const [videoExpanded, setVideoExpanded] = useState(true);
    const [checkInSearch, setCheckInSearch] = useState('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [nearbyPromptVisible, setNearbyPromptVisible] = useState(false);
    const previousCheckInCountRef = useRef<number | null>(null);
    const suppressRealtimeToastUntilRef = useRef<number>(0);
    const nearbyPromptGeoCacheRef = useRef<{
        userId: string;
        trailSlug: string;
        timestamp: number;
        isNearby: boolean;
    } | null>(null);
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

    const formatCheckedInText = (checkedInAt: string) => {
        const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(checkedInAt)) / 60000));
        if (minutes <= 0) return t('trail.checkInJustNow');
        return t('trail.checkInMinutesAgo', { count: minutes });
    };

    const formatExpiresInText = (expiresAt: string) => {
        const totalMinutes = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 60000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        return t('trail.checkInExpiresInTime', { time });
    };

    const getCrowdSignal = (count: number) => {
        if (count <= 3) return { label: t('trail.checkInCrowdQuiet'), color: 'success' as const };
        if (count <= 10) return { label: t('trail.checkInCrowdModerate'), color: 'warning' as const };
        return { label: t('trail.checkInCrowdBusy'), color: 'error' as const };
    };

    const crowdSignal = getCrowdSignal(totalCheckIns);

    const isLeavingSoon = (expiresAt: string) => Date.parse(expiresAt) - Date.now() <= CHECK_IN_LEAVING_SOON_MINUTES * 60 * 1000;
    const isJustArrived = (checkedInAt: string) => Date.now() - Date.parse(checkedInAt) <= CHECK_IN_JUST_ARRIVED_MINUTES * 60 * 1000;

    const sortedCheckIns = useMemo(() => {
        const sorted = [...checkIns].sort((a, b) => Date.parse(b.checkedInAt) - Date.parse(a.checkedInAt));
        if (!user) return sorted;
        const meIndex = sorted.findIndex((entry) => entry.userId === user.id);
        if (meIndex <= 0) return sorted;
        const [me] = sorted.splice(meIndex, 1);
        sorted.unshift(me);
        return sorted;
    }, [checkIns, user]);

    const filteredCheckIns = useMemo(() => {
        const query = checkInSearch.trim().toLowerCase();
        if (!query) return sortedCheckIns;
        return sortedCheckIns.filter((entry) => entry.displayName.toLowerCase().includes(query));
    }, [sortedCheckIns, checkInSearch]);

    const shouldShowCheckInSearch = totalCheckIns > CHECK_IN_SEARCH_THRESHOLD;

    const handleToggleCheckIn = async () => {
        if (!user) {
            setLoginModalOpen(true);
            return;
        }

        setCheckInError(null);
        try {
            suppressRealtimeToastUntilRef.current = Date.now() + 2000;
            if (isCheckedIn) {
                await checkOut();
                setToastMessage(t('trail.checkInToastCheckedOut'));
            } else {
                await checkIn();
                setToastMessage(t('trail.checkInToastCheckedIn'));
            }
        } catch (error) {
            setCheckInError(error instanceof Error ? error.message : t('trail.checkInActionFailed'));
        }
    };

    const handleStillHere = async () => {
        if (!user) return;
        setCheckInError(null);
        try {
            suppressRealtimeToastUntilRef.current = Date.now() + 2000;
            await checkIn();
            setToastMessage(t('trail.checkInToastRefreshed'));
        } catch (error) {
            setCheckInError(error instanceof Error ? error.message : t('trail.checkInActionFailed'));
        }
    };

    useEffect(() => {
        if (!checkInEnabled) return;
        const previousCount = previousCheckInCountRef.current;
        if (previousCount === null) {
            previousCheckInCountRef.current = totalCheckIns;
            return;
        }
        if (Date.now() < suppressRealtimeToastUntilRef.current) {
            previousCheckInCountRef.current = totalCheckIns;
            return;
        }
        if (totalCheckIns > previousCount) {
            setToastMessage(t('trail.checkInToastJoined', { count: totalCheckIns - previousCount }));
        } else if (totalCheckIns < previousCount) {
            setToastMessage(t('trail.checkInToastLeft', { count: previousCount - totalCheckIns }));
        }
        previousCheckInCountRef.current = totalCheckIns;
    }, [totalCheckIns, checkInEnabled, t]);

    useEffect(() => {
        if (!checkInEnabled || !checkInExpanded || !trail || !user || isCheckedIn) {
            setNearbyPromptVisible(false);
            return;
        }
        if (trail.startLatitude === null || trail.startLongitude === null || !navigator.geolocation) {
            setNearbyPromptVisible(false);
            return;
        }

        const now = Date.now();
        const cached = nearbyPromptGeoCacheRef.current;
        if (
            cached &&
            cached.userId === user.id &&
            cached.trailSlug === trail.slug &&
            now - cached.timestamp < CHECK_IN_NEARBY_GEO_CACHE_MS
        ) {
            setNearbyPromptVisible(cached.isNearby);
            return;
        }

        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            return 2 * R * Math.asin(Math.sqrt(a));
        };

        let cancelled = false;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const distanceKm = haversineKm(
                    position.coords.latitude,
                    position.coords.longitude,
                    trail.startLatitude!,
                    trail.startLongitude!
                );
                const isNearby = distanceKm <= CHECK_IN_NEARBY_RADIUS_KM;
                nearbyPromptGeoCacheRef.current = {
                    userId: user.id,
                    trailSlug: trail.slug,
                    timestamp: Date.now(),
                    isNearby,
                };
                if (!cancelled) {
                    setNearbyPromptVisible(isNearby);
                }
            },
            () => {
                nearbyPromptGeoCacheRef.current = {
                    userId: user.id,
                    trailSlug: trail.slug,
                    timestamp: Date.now(),
                    isNearby: false,
                };
                if (!cancelled) {
                    setNearbyPromptVisible(false);
                }
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
        );
        return () => {
            cancelled = true;
        };
    }, [checkInEnabled, checkInExpanded, trail, user, isCheckedIn]);

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
                                                    <Chip label={t(`difficulty.${s.activityType.charAt(0).toLowerCase() + s.activityType.slice(1)}`)} size="small" variant="outlined" />
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
                        {loginEnabled && (
                        <Tooltip title={tickedSlugs.has(trail.slug) ? t('trail.untick') : t('trail.tick')}>
                            <IconButton
                                onClick={() => user ? toggleTick(trail.slug) : setLoginModalOpen(true)}
                                color="success"
                                sx={{ mt: 0.5 }}
                            >
                                {tickedSlugs.has(trail.slug) ? <CheckCircleIcon /> : <CheckCircleOutlineIcon />}
                            </IconButton>
                        </Tooltip>
                        )}
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
                            label={t(`difficulty.${trail.activityType.charAt(0).toLowerCase() + trail.activityType.slice(1)}`)} 
                            color="primary" 
                            variant="outlined" 
                            size="small"
                        />
                        {locationsPageEnabled && trail.locations && trail.locations.length > 0 && trail.locations.map((loc) => {
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
                        {tagsEnabled && trail.tags && trail.tags.length > 0 && trail.tags.map((tag) => (
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
                        {isEnabled('trail_comparison') && (
                        <Tooltip title={t('compare.compareButton')} arrow>
                            <IconButton
                                size="small"
                                onClick={() => navigate(`/compare?a=${trail.slug}`)}
                            >
                                <CompareArrowsIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        )}
                        {isEnabled('tool_trail_predictor') && (
                        <Tooltip title={t('tools.trailPredictor.title')} arrow>
                            <IconButton
                                size="small"
                                onClick={() => navigate(`/tools/trail-predictor?trail=${encodeURIComponent(trail.slug)}`)}
                            >
                                <QueryStatsIcon fontSize="small" />
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
                        {trail.activityType === 'TrailRunning' && trail.length > 0 && (
                            <Grid item xs={4} sm>
                                <Stack alignItems="center" spacing={0.5}>
                                    <LandscapeIcon color="action" fontSize="small" />
                                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{t('trail.climbRatio')}</Typography>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                        {Math.round(trail.elevationGain / (trail.length / 1000))} m/km
                                    </Typography>
                                </Stack>
                            </Grid>
                        )}
                        <Grid item xs={4} sm>
                            <Stack alignItems="center" spacing={0.5}>
                                {getTrailTypeIcon(trail.trailType)}
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{t('trail.type')}</Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>{getTrailTypeLabel(trail.trailType, t)}</Typography>
                            </Stack>
                        </Grid>
                        <Grid item xs={4} sm>
                            {isEnabled('pace_info') && estTime && <PaceInfo activityType={trail.activityType} formattedDuration={estTime} />}
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

            {/* YouTube 360° video */}
            {trail.youtubeUrl && toYoutubeEmbedUrl(trail.youtubeUrl) && (
                <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
                    <ButtonBase
                        onClick={() => setVideoExpanded(prev => !prev)}
                        aria-expanded={videoExpanded}
                        aria-label={t('trail.video360')}
                        sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', borderRadius: 1 }}
                    >
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <VideocamIcon color="primary" />
                            <Typography variant="h6" fontWeight="bold">
                                {t('trail.video360')}
                            </Typography>
                        </Stack>
                        <IconButton size="small" tabIndex={-1} aria-hidden="true">
                            {videoExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    </ButtonBase>
                    <Collapse in={videoExpanded} unmountOnExit>
                        <Box sx={{ position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0, borderRadius: 1, overflow: 'hidden', mt: 2 }}>
                            <iframe
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                src={toYoutubeEmbedUrl(trail.youtubeUrl)!}
                                title={t('trail.video360')}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                                allowFullScreen
                                loading="lazy"
                            />
                        </Box>
                    </Collapse>
                </Paper>
            )}

            {/* Weather forecast */}
            {isEnabled('weather_forecast') && (
            <WeatherCard weather={weather} loading={weatherLoading} error={weatherError} />
            )}

            {leaderboardEnabled && (
                <TrailLeaderboardCard
                    leaderboard={leaderboard}
                    totalEntries={totalEntries}
                    loading={leaderboardLoading}
                    error={leaderboardError}
                    trailSlug={trail.slug}
                />
            )}

            {checkInEnabled && (
                <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        onClick={() => setCheckInExpanded((prev) => !prev)}
                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <GroupsIcon color="primary" />
                            <Typography variant="h6" fontWeight="bold">
                                {t('trail.checkInTitle')}
                            </Typography>
                            {!checkInExpanded && (
                                <Typography variant="body2" color="text.secondary">
                                    {t('trail.checkInActiveCount', { count: totalCheckIns })}
                                </Typography>
                            )}
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Chip color="primary" variant="outlined" label={t('trail.checkInActiveCount', { count: totalCheckIns })} size="small" />
                            <Chip color={crowdSignal.color} variant="outlined" label={crowdSignal.label} size="small" />
                            <IconButton size="small" sx={{ ml: 0.5 }}>
                                {checkInExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                        </Stack>
                    </Stack>

                    <Collapse in={checkInExpanded}>
                        <Box sx={{ mt: 1.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {t('trail.checkInDescription')}
                            </Typography>

                            {nearbyPromptVisible && (
                                <Alert severity="info" sx={{ mb: 1.5 }}>
                                    {t('trail.checkInNearbyPrompt')}
                                </Alert>
                            )}

                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                                <Button
                                    variant={isCheckedIn ? 'outlined' : 'contained'}
                                    onClick={handleToggleCheckIn}
                                    disabled={checkInLoading || checkInSaving}
                                >
                                    {isCheckedIn ? t('trail.checkOut') : t('trail.checkIn')}
                                </Button>
                                {isCheckedIn && (
                                    <Button
                                        variant="text"
                                        onClick={handleStillHere}
                                        disabled={checkInLoading || checkInSaving}
                                    >
                                        {t('trail.checkInStillHere')}
                                    </Button>
                                )}
                                {(checkInLoading || checkInSaving) && <CircularProgress size={18} />}
                            </Stack>

                            {(checkInError || checkInQueryError) && (
                                <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
                                    {checkInError || checkInQueryError}
                                </Typography>
                            )}

                            {shouldShowCheckInSearch && (
                                <TextField
                                    size="small"
                                    fullWidth
                                    value={checkInSearch}
                                    onChange={(event) => setCheckInSearch(event.target.value)}
                                    placeholder={t('trail.checkInSearchPlaceholder')}
                                    sx={{ mb: 1.5 }}
                                />
                            )}

                            {filteredCheckIns.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    {checkIns.length === 0 ? t('trail.checkInNoActive') : t('trail.checkInNoMatches')}
                                </Typography>
                            ) : (
                                <Stack spacing={1}>
                                    {filteredCheckIns.map((entry) => (
                                        <Stack
                                            key={entry.id}
                                            direction="row"
                                            spacing={1.5}
                                            alignItems="center"
                                            sx={{
                                                p: 1,
                                                borderRadius: 1.5,
                                                bgcolor: user?.id === entry.userId ? 'action.selected' : 'action.hover',
                                            }}
                                        >
                                            <Avatar
                                                src={getAvatarImageSrc(entry.avatarUrl)}
                                                sx={{ width: 30, height: 30, fontSize: '0.85rem' }}
                                            >
                                                {getAvatarFallbackText(entry.avatarUrl, entry.displayName.charAt(0).toUpperCase())}
                                            </Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="body2" fontWeight={600} noWrap>
                                                    {entry.displayName}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatCheckedInText(entry.checkedInAt)} · {formatExpiresInText(entry.expiresAt)}
                                                </Typography>
                                            </Box>
                                            <Stack direction="row" spacing={0.5}>
                                                {user?.id === entry.userId && <Chip size="small" label={t('trail.checkInBadgeYou')} color="primary" variant="filled" />}
                                                {isJustArrived(entry.checkedInAt) && <Chip size="small" label={t('trail.checkInBadgeJustArrived')} variant="outlined" />}
                                                {isLeavingSoon(entry.expiresAt) && <Chip size="small" label={t('trail.checkInBadgeLeavingSoon')} color="warning" variant="outlined" />}
                                            </Stack>
                                        </Stack>
                                    ))}
                                </Stack>
                            )}
                        </Box>
                    </Collapse>
                </Paper>
            )}

            <Snackbar
                open={Boolean(toastMessage)}
                autoHideDuration={3000}
                onClose={() => setToastMessage(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="info" variant="filled" onClose={() => setToastMessage(null)}>
                    {toastMessage}
                </Alert>
            </Snackbar>

            {(() => {
                const visibleRaces = (trail.linkedRaces ?? []).filter(
                    r => r.daysUntil == null || r.daysUntil >= -30
                );
                if (!visibleRaces.length) return null;

                const byEvent = visibleRaces.reduce<Record<string, typeof visibleRaces>>((acc, r) => {
                    (acc[r.eventSlug] ??= []).push(r);
                    return acc;
                }, {});

                return (
                    <Box mt={4} mb={3}>
                        <Typography variant="h5" component="h2" fontWeight="bold" mb={1.5}>
                            {t('trail.racesOnTrail')}
                        </Typography>
                        <Grid container spacing={1.5}>
                            {Object.values(byEvent).flatMap(races =>
                                races.map(race => {
                                    const past = race.daysUntil != null && race.daysUntil < 0;
                                    return (
                                        <Grid item xs={12} sm={6} md={4} key={`${race.eventSlug}-${race.raceName}`}>
                                            <Paper
                                                component={RouterLink}
                                                to={`/events/${race.eventSlug}`}
                                                elevation={0}
                                                sx={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: 0.5,
                                                    p: 2,
                                                    borderRadius: 2,
                                                    bgcolor: 'action.hover',
                                                    textDecoration: 'none',
                                                    color: 'inherit',
                                                    height: '100%',
                                                    transition: 'background-color 0.2s',
                                                    '&:hover': { bgcolor: 'action.selected' },
                                                }}
                                            >
                                                <Typography variant="caption" color="text.secondary" noWrap>
                                                    {race.eventName}
                                                </Typography>
                                                <Typography variant="body2" fontWeight={600} noWrap>
                                                    {race.raceName}
                                                </Typography>
                                                {race.startTime && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        🕐 {race.startTime}
                                                    </Typography>
                                                )}
                                                <Stack direction="row" spacing={0.75} alignItems="center" mt={0.75} flexWrap="wrap" gap={0.5}>
                                                    {race.distanceLabel && (
                                                        <Chip label={race.distanceLabel} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                                                    )}
                                                    {race.itraPoints != null && (
                                                        <Chip label={`ITRA ${race.itraPoints}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                                                    )}
                                                    {race.ticketStatus && race.ticketStatus !== 'Available' && race.ticketStatus !== 'NotStarted' && (
                                                        <Chip
                                                            label={t(`races.ticketStatus.${race.ticketStatus}`)}
                                                            size="small"
                                                            color={race.ticketStatus === 'SoldOut' || race.ticketStatus === 'Closed' ? 'error' : race.ticketStatus === 'AlmostSoldOut' ? 'warning' : 'default'}
                                                            sx={{ fontSize: '0.7rem', height: 22 }}
                                                        />
                                                    )}
                                                    {race.daysUntil != null && (
                                                        <Chip
                                                            label={
                                                                race.daysUntil === 0
                                                                    ? t('races.today')
                                                                    : race.daysUntil === 1
                                                                    ? t('races.tomorrow')
                                                                    : past
                                                                    ? t('races.daysAgo_other', { count: Math.abs(race.daysUntil) })
                                                                    : t('races.daysUntil', { count: race.daysUntil })
                                                            }
                                                            size="small"
                                                            color={past ? 'default' : race.daysUntil <= 7 ? 'warning' : 'success'}
                                                            sx={{ fontSize: '0.7rem', height: 22 }}
                                                        />
                                                    )}
                                                </Stack>
                                            </Paper>
                                        </Grid>
                                    );
                                })
                            )}
                        </Grid>
                    </Box>
                );
            })()}

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
                            hoverPoint={hoverPoint}
                            activityType={trail.activityType}
                            height="100%"
                            mapInstanceRef={dialogMapRef}
                            providedGeometry={geometry}
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
            {loginEnabled && (
            <LoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
            )}
        </Layout>
    );
}
