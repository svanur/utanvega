import React, { useState, useRef, useCallback } from 'react';
import { 
    Card,
    CardContent,
    Typography,
    Box,
    Stack,
    Chip,
    CardActionArea,
    Tooltip,
    IconButton
} from '@mui/material';
import RouteIcon from '@mui/icons-material/Route';
import LandscapeIcon from '@mui/icons-material/Landscape';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import FilterHdrIcon from '@mui/icons-material/FilterHdr';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import StarIcon from '@mui/icons-material/Star';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NearMeIcon from '@mui/icons-material/NearMe';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ShareIcon from '@mui/icons-material/Share';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VideocamIcon from '@mui/icons-material/Videocam';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trail } from '../hooks/useTrails';
import { useLocalize } from '../utils/localize';
import ElevationSparkline from './ElevationSparkline';
import QRCodeShare from './QRCodeShare';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useLoginEnabled } from '../hooks/useLoginEnabled';
import { estimateDuration } from '../utils/estimateDuration';
import { useFavorites } from '../hooks/useFavorites';
import { getActivityIcon } from '../utils/activityIcon';
import { useTickedTrails } from '../hooks/useTickedTrails';
import { TrailQuickView } from './TrailQuickView';
import DifficultyInfo from './DifficultyInfo';

interface TrailCardProps {
    trail: Trail;
    onToggleFavorite?: (slug: string) => void;
    onTagClick?: (tagSlug: string) => void;
    isHiding?: boolean;
    isFavorited?: boolean;
    compact?: boolean;
    disableGestures?: boolean;
}


const getTrailTypeIcon = (type: string) => {
    switch (type) {
        case 'Loop': return <AllInclusiveIcon sx={{ fontSize: 14 }} />;
        case 'OutAndBack': return <CompareArrowsIcon sx={{ fontSize: 14 }} />;
        case 'PointToPoint': return <TrendingFlatIcon sx={{ fontSize: 14 }} />;
        default: return null;
    }
};

const trailTypeI18nKey = (type: string) => {
    switch (type) {
        case 'Loop': return 'trail.loop';
        case 'OutAndBack': return 'trail.outAndBack';
        case 'PointToPoint': return 'trail.pointToPoint';
        default: return type;
    }
};

const getTerrainIcon = (type: string) => {
    switch (type) {
        case 'Flat': return <HorizontalRuleIcon sx={{ fontSize: 14 }} />;
        case 'Hilly': return <ShowChartIcon sx={{ fontSize: 14 }} />;
        case 'Mountainous': return <FilterHdrIcon sx={{ fontSize: 14 }} />;
        default: return undefined;
    }
};

export const TrailCard: React.FC<TrailCardProps> = ({ trail, onToggleFavorite, onTagClick, isHiding, isFavorited: isFavoritedProp, compact, disableGestures }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const loc = useLocalize();
    const { isEnabled } = useFeatureFlags();
    const loginEnabled = useLoginEnabled();
    const locationsPageEnabled = isEnabled('locations_page');
    const tagsEnabled = isEnabled('tags_page');
    const { isFavorite, toggleFavorite } = useFavorites();
    const { tickedSlugs } = useTickedTrails();
    const [swipeOffset, setSwipeOffset] = useState(0);
    const touchStart = useRef<number | null>(null);
    const touchYStart = useRef<number | null>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [quickViewOpen, setQuickViewOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const isFavorited = isFavoritedProp ?? isFavorite(trail.slug);

    const distanceKm = (trail.length / 1000).toFixed(1);
    const estTime = estimateDuration(trail.length, trail.elevationGain, trail.activityType);
    const userDist = trail.distanceToUser !== undefined && trail.distanceToUser !== Infinity
        ? `${trail.distanceToUser.toFixed(1)} ${t('trailCard.kmAway')}`
        : null;

    const handleClick = () => {
        if (Math.abs(swipeOffset) < 10 && !quickViewOpen) {
            navigate(`/trails/${trail.slug}`);
        }
    };

    const handleLongPress = useCallback(() => {
        setQuickViewOpen(true);
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStart.current = e.touches[0].clientX;
        touchYStart.current = e.touches[0].clientY;

        // Start long press timer
        longPressTimer.current = setTimeout(handleLongPress, 600);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStart.current !== null) {
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = currentX - touchStart.current;
            const diffY = currentY - (touchYStart.current || 0);

            // If we move more than 10px in any direction, cancel long press
            if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
                if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                }
            }

            // Allow right swipe for favorites and left swipe for hiding
            if (!quickViewOpen) {
                if (diffX > 0) {
                    setSwipeOffset(Math.min(diffX, 150));
                } else {
                    setSwipeOffset(Math.max(diffX, -150));
                }
            }
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (swipeOffset > 100) {
            if (onToggleFavorite) {
                onToggleFavorite(trail.slug);
            } else {
                toggleFavorite(trail.slug);
            }
            // Trigger haptic feedback if available
            if ('vibrate' in navigator) {
                navigator.vibrate(10);
            }
        } else if (swipeOffset < -100) {
            setShareOpen(true);
            if ('vibrate' in navigator) navigator.vibrate(10);
        }
        setSwipeOffset(0);
        touchStart.current = null;
        touchYStart.current = null;
    };

    return (
        <Box 
            sx={{ 
                position: 'relative', 
                mb: 2,
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                opacity: isHiding ? 0 : 1,
                transform: isHiding ? 'translateX(-100%)' : 'none',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Background Swipe Indicator */}
            {!disableGestures && (
            <Box 
                sx={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    bgcolor: isFavorited ? 'warning.light' : 'primary.main',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    pl: 3,
                    opacity: swipeOffset > 0 ? Math.min(swipeOffset / 100, 1) : 0,
                    zIndex: 0
                }}
            >
                <StarIcon sx={{ color: 'white' }} />
                <Typography sx={{ color: 'white', ml: 1, fontWeight: 'bold' }}>
                    {isFavorited ? t('trailCard.removeFavorite') : t('trailCard.addFavorite')}
                </Typography>
            </Box>
            )}

            {/* Right Background Swipe Indicator (Share) */}
            {!disableGestures && (
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: 'info.main',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pr: 3,
                    opacity: swipeOffset < 0 ? Math.min(Math.abs(swipeOffset) / 100, 1) : 0,
                    zIndex: 0
                }}
            >
                <Typography sx={{ color: 'white', mr: 1, fontWeight: 'bold' }}>
                    {t('trailCard.share')}
                </Typography>
                <ShareIcon sx={{ color: 'white' }} />
            </Box>
            )}

            <Card
                variant="outlined"
                sx={{
                    overflow: 'visible',
                    position: 'relative',
                    transform: disableGestures ? undefined : `translateX(${swipeOffset}px)`,
                    transition: disableGestures ? undefined : (swipeOffset === 0 ? 'transform 0.3s ease' : 'none'),
                    zIndex: 1,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    '@media (hover: hover)': { '&:hover': { transform: `translateX(${disableGestures ? 0 : swipeOffset}px) translateY(-2px)`, boxShadow: 4 } },
                }}
                onTouchStart={disableGestures ? undefined : handleTouchStart}
                onTouchMove={disableGestures ? undefined : handleTouchMove}
                onTouchEnd={disableGestures ? undefined : handleTouchEnd}
            >
                <CardActionArea onClick={handleClick} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
                    <CardContent sx={{ display: 'flex', flexDirection: 'column', flex: 1, ...(compact ? { p: 1.5, '&:last-child': { pb: 1.5 } } : {}) }}>
                        {/* 1st row: activity icon + Trail name + favorite/ticked */}
                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                            {compact ? (
                                <>
                                    <Typography
                                        variant="body1"
                                        component="div"
                                        fontWeight="bold"
                                        sx={{ fontSize: '0.85rem', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                                    >
                                        {trail.name}
                                    </Typography>
                                    <Box display="flex" alignItems="center" gap={0.25}>
                                        {trail.youtubeUrl && (
                                            <Tooltip title={t('trail.video360', '360° Video')}>
                                                <IconButton size="small" component="a" href={trail.youtubeUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} sx={{ p: 0.25 }}>
                                                    <VideocamIcon sx={{ fontSize: 14 }} color="error" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {loginEnabled && tickedSlugs.has(trail.slug) && <CheckCircleIcon color="success" sx={{ fontSize: 14 }} />}
                                        {isFavorited && <StarIcon color="warning" sx={{ fontSize: 14 }} />}
                                    </Box>
                                </>
                            ) : (
                                <>
                                    <Stack direction="row" alignItems="flex-start" gap={1} sx={{ flex: 1, minWidth: 0 }}>
                                        <Tooltip title={t(`difficulty.${trail.activityType.charAt(0).toLowerCase() + trail.activityType.slice(1)}`, trail.activityType)}>
                                            <Box sx={{ color: 'text.secondary', pt: 0.3, flexShrink: 0 }}>{getActivityIcon(trail.activityType)}</Box>
                                        </Tooltip>
                                        <Typography variant="subtitle1" component="div" fontWeight="bold" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: { xs: 'normal', sm: 'nowrap' } }}>
                                            {trail.name}
                                        </Typography>
                                    </Stack>
                                    <Box display="flex" alignItems="center" gap={0.25}>
                                        {trail.youtubeUrl && (
                                            <Tooltip title={t('trail.video360', '360° Video')}>
                                                <IconButton size="small" component="a" href={trail.youtubeUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} sx={{ p: 0.25 }}>
                                                    <VideocamIcon sx={{ fontSize: 18 }} color="error" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {loginEnabled && tickedSlugs.has(trail.slug) && <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />}
                                        {isFavorited && <StarIcon color="warning" sx={{ fontSize: 20 }} />}
                                    </Box>
                                </>
                            )}
                        </Stack>

                        {/* Meta line: primary location · km away (non-compact only) */}
                        {!compact && (trail.locations.length > 0 || userDist) && (
                            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                                {trail.locations.length > 0 && (
                                    <>
                                        <LocationOnIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                                        <Typography variant="body2" color="text.secondary" noWrap>
                                            {[...trail.locations].sort((a, b) => a.order - b.order)[0].name}
                                        </Typography>
                                    </>
                                )}
                                {userDist && trail.locations.length > 0 && <FiberManualRecordIcon sx={{ fontSize: 5, color: 'text.disabled' }} />}
                                {userDist && (
                                    <>
                                        <NearMeIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                                        <Typography variant="body2" color="primary.main" fontWeight={500} noWrap>{userDist}</Typography>
                                    </>
                                )}
                            </Stack>
                        )}


                    {/* 2nd row: icons-only in compact, full chips in normal */}
                    {compact ? (
                        <Stack direction="row" spacing={0.5} mt={0.5} alignItems="center" flexWrap="wrap">
                            <Tooltip title={trail.activityType} arrow>
                                <Box sx={{ color: 'primary.main', display: 'flex' }}>
                                    {getActivityIcon(trail.activityType)}
                                </Box>
                            </Tooltip>
                            {trail.trailType && trail.trailType !== 'Unknown' && (
                                <Tooltip title={t(trailTypeI18nKey(trail.trailType))} arrow>
                                    <Box sx={{ color: 'text.secondary', display: 'flex' }}>
                                        {getTrailTypeIcon(trail.trailType)}
                                    </Box>
                                </Tooltip>
                            )}
                            {trail.difficulty && (
                                <DifficultyInfo difficulty={trail.difficulty} activityType={trail.activityType} />
                            )}
                        </Stack>
                    ) : (
                    <Box
                        mt={1}
                        display="flex"
                        flexWrap="wrap"
                        gap={1}
                    >
                        {trail.difficulty && (
                            <DifficultyInfo difficulty={trail.difficulty} activityType={trail.activityType} />
                        )}
                        {trail.terrainType && (
                            <Chip
                                icon={getTerrainIcon(trail.terrainType)}
                                label={t(`trail.terrainType.${trail.terrainType}`, { defaultValue: trail.terrainType })}
                                size="small"
                                variant="outlined"
                            />
                        )}
                        <Chip
                            icon={getActivityIcon(trail.activityType)}
                            label={t(`difficulty.${trail.activityType.charAt(0).toLowerCase() + trail.activityType.slice(1)}`)}
                            size="small"
                            variant="outlined"
                            color="primary"
                        />
                        {trail.trailType && trail.trailType !== 'Unknown' && (
                            <Chip
                                icon={getTrailTypeIcon(trail.trailType) || undefined}
                                label={t(trailTypeI18nKey(trail.trailType))}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                            />
                        )}
                        {tagsEnabled && trail.tags && trail.tags.length > 0 && trail.tags
                            .map(tag => (
                                <Chip
                                    key={tag.slug}
                                    label={loc(tag.name, tag.nameEn) ?? tag.name}
                                    size="small"
                                    onClick={onTagClick ? (e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        onTagClick(tag.slug);
                                    } : undefined}
                                    sx={{
                                        backgroundColor: tag.color || undefined,
                                        color: tag.color ? '#fff' : undefined,
                                        fontSize: '0.7rem',
                                        cursor: onTagClick ? 'pointer' : undefined,
                                    }}
                                    variant={tag.color ? 'filled' : 'outlined'}
                                />
                            ))}
                    </Box>
                    )}

                    {/* 3rd row: distance, gain, loss — icon-only in compact */}
                    <Stack direction="row" spacing={compact ? 0.5 : 1.5} color="text.secondary" flexWrap="wrap" mt="auto" pt={compact ? 1 : 2} justifyContent={compact ? 'space-between' : 'flex-start'} alignItems="center">
                        <Box display="flex" alignItems="center">
                            <RouteIcon sx={{ mr: compact ? 0 : 0.5, fontSize: compact ? 14 : 18 }} />
                            <Typography variant="body2" fontSize={compact ? '0.75rem' : undefined}>{distanceKm} km</Typography>
                        </Box>
                        <Box display="flex" alignItems="center">
                            <TrendingUpIcon sx={{ mr: compact ? 0 : 0.5, fontSize: compact ? 14 : 18, color: 'success.main' }} />
                            <Typography variant="body2" fontSize={compact ? '0.75rem' : undefined}>+{Math.round(trail.elevationGain)}</Typography>
                        </Box>
                        <Box display="flex" alignItems="center">
                            <TrendingDownIcon sx={{ mr: compact ? 0 : 0.5, fontSize: compact ? 14 : 18, color: 'error.main' }} />
                            <Typography variant="body2" fontSize={compact ? '0.75rem' : undefined}>-{Math.round(trail.elevationLoss)}</Typography>
                        </Box>
                        {!compact && trail.activityType === 'TrailRunning' && trail.length > 0 && (
                            <Box display="flex" alignItems="center">
                                <LandscapeIcon sx={{ mr: 0.5, fontSize: 18 }} />
                                <Typography variant="body2">{Math.round(trail.elevationGain / (trail.length / 1000))} m/km</Typography>
                            </Box>
                        )}
                        {estTime && (
                        <Box display="flex" alignItems="center">
                            <AccessTimeIcon sx={{ mr: compact ? 0 : 0.5, fontSize: compact ? 14 : 18 }} />
                            <Typography variant="body2" fontSize={compact ? '0.75rem' : undefined}>~{estTime}</Typography>
                        </Box>
                        )}
                        {userDist && compact && (
                            <Box display="flex" alignItems="center">
                                <LocationOnIcon sx={{ mr: 0, fontSize: 14, color: 'primary.main' }} />
                                <Typography variant="body2" fontSize="0.75rem" color="primary.main" fontWeight="medium">
                                    {userDist}
                                </Typography>
                            </Box>
                        )}
                    </Stack>

                    {!compact && trail.elevationProfile && trail.elevationProfile.length >= 2 && (
                        <Box sx={{ mt: 1.5, mx: -0.5, color: 'text.secondary' }}>
                            <ElevationSparkline profile={trail.elevationProfile} width="100%" height={36} />
                        </Box>
                    )}
                    </CardContent>
                </CardActionArea>
            </Card>

            {!disableGestures && (
                <TrailQuickView
                    trail={trail}
                    open={quickViewOpen}
                    onClose={() => setQuickViewOpen(false)}
                />
            )}
            {!disableGestures && (
                <QRCodeShare
                    slug={trail.slug}
                    trailName={trail.name}
                    open={shareOpen}
                    onClose={() => setShareOpen(false)}
                />
            )}
        </Box>
    );
};
