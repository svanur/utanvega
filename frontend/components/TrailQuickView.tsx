import React, { useState, useEffect } from 'react';
import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    Box, 
    Typography, 
    IconButton, 
    Stack, 
    Chip,
    CircularProgress,
    Divider,
    Grid,
    useTheme,
    useMediaQuery,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RouteIcon from '@mui/icons-material/Route';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LandscapeIcon from '@mui/icons-material/Landscape';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import HikingIcon from '@mui/icons-material/Hiking';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import { Trail, API_URL } from '../hooks/useTrails';
import TrailMap, { GeoJsonGeometry } from './TrailMap';
import ElevationChart from './ElevationChart';

interface TrailQuickViewProps {
    trail: Trail | null;
    open: boolean;
    onClose: () => void;
}

const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'trailrunning': return <LandscapeIcon fontSize="small" />;
        case 'running': return <DirectionsRunIcon fontSize="small" />;
        case 'cycling': return <DirectionsBikeIcon fontSize="small" />;
        case 'hiking': return <HikingIcon fontSize="small" />;
        default: return <RouteIcon fontSize="small" />;
    }
};

const getTrailTypeLabel = (type: string) => {
    switch (type) {
        case 'OutAndBack': return 'Out and Back';
        case 'Loop': return 'Loop';
        case 'PointToPoint': return 'Point to Point';
        default: return type;
    }
};

export const TrailQuickView: React.FC<TrailQuickViewProps> = ({ trail, open, onClose }) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [geometry, setGeometry] = useState<GeoJsonGeometry | null>(null);
    const [hoverPoint, setHoverPoint] = useState<{ lat: number; lng: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mapExpanded, setMapExpanded] = useState(true);
    const [elevationExpanded, setElevationExpanded] = useState(true);

    useEffect(() => {
        if (open && trail) {
            const fetchGeometry = async () => {
                try {
                    setLoading(true);
                    setError(null);
                    const res = await fetch(`${API_URL}/api/v1/trails/${trail.slug}/geometry`);
                    if (!res.ok) throw new Error('Failed to fetch geometry');
                    const data = await res.json();
                    setGeometry(data);
                } catch (err: any) {
                    console.error('Failed to fetch geometry for quick view:', err);
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            fetchGeometry();
        } else if (!open) {
            // Reset state when closed
            setGeometry(null);
            setHoverPoint(null);
            setError(null);
        }
    }, [open, trail]);

    if (!trail) return null;

    const distanceKm = (trail.length / 1000).toFixed(2);

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            fullScreen={fullScreen}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: fullScreen ? 0 : 3 }
            }}
        >
            <DialogTitle sx={{ pr: 6, pb: 1 }}>
                <Typography variant="h6" fontWeight="bold" component="span">
                    {trail.name}
                </Typography>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        color: (theme) => theme.palette.grey[500],
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
                <Box p={2}>
                    <Box mb={2}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}>
                            {trail.locations.map(loc => (
                                <Chip
                                    key={loc.slug}
                                    label={loc.name}
                                    size="small"
                                    variant="outlined"
                                />
                            ))}
                        </Stack>

                        <Grid container spacing={2}>
                            <Grid item xs={3}>
                                <Box display="flex" flexDirection="column" alignItems="center">
                                    <RouteIcon color="action" />
                                    <Typography variant="caption" color="text.secondary">Distance</Typography>
                                    <Typography variant="subtitle2" fontWeight="bold">{distanceKm} km</Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={3}>
                                <Box display="flex" flexDirection="column" alignItems="center">
                                    <TrendingUpIcon color="success" />
                                    <Typography variant="caption" color="text.secondary">Gain</Typography>
                                    <Typography variant="subtitle2" fontWeight="bold">+{Math.round(trail.elevationGain)} m</Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={3}>
                                <Box display="flex" flexDirection="column" alignItems="center">
                                    <TrendingDownIcon color="error" />
                                    <Typography variant="caption" color="text.secondary">Loss</Typography>
                                    <Typography variant="subtitle2" fontWeight="bold">-{Math.round(trail.elevationLoss)} m</Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={3}>
                                <Box display="flex" flexDirection="column" alignItems="center">
                                    <LandscapeIcon color="primary" />
                                    <Typography variant="caption" color="text.secondary">Type</Typography>
                                    <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ maxWidth: '100%' }}>
                                        {trail.trailType === 'PointToPoint' ? 'P2P' : trail.trailType}
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>
                </Box>

                <Accordion 
                    expanded={mapExpanded} 
                    onChange={() => setMapExpanded(!mapExpanded)}
                    disableGutters
                    elevation={0}
                    square
                    sx={{ borderTop: 1, borderColor: 'divider' }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2" fontWeight="bold">Map</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                        <Box sx={{ height: 250, width: '100%', position: 'relative' }}>
                            {trail && (
                                <TrailMap 
                                    slug={trail.slug} 
                                    onDataLoaded={setGeometry}
                                    hoverPoint={hoverPoint}
                                />
                            )}
                            <Box 
                                sx={{ 
                                    position: 'absolute', 
                                    top: 8, 
                                    left: 8, 
                                    zIndex: 1000,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1
                                }}
                            >
                                <Chip 
                                    icon={getActivityIcon(trail.activityType)} 
                                    label={trail.activityType} 
                                    size="small" 
                                    color="primary"
                                    sx={{ boxShadow: 2 }}
                                />
                                <Chip 
                                    label={getTrailTypeLabel(trail.trailType)} 
                                    size="small" 
                                    variant="filled"
                                    sx={{ 
                                        boxShadow: 2, 
                                        bgcolor: 'background.paper',
                                        color: 'text.primary',
                                        '& .MuiChip-label': { fontWeight: 'medium' }
                                    }}
                                />
                            </Box>
                        </Box>
                    </AccordionDetails>
                </Accordion>

                <Box px={2} pb={2}>
                    <Accordion 
                        expanded={elevationExpanded} 
                        onChange={() => setElevationExpanded(!elevationExpanded)}
                        disableGutters
                        elevation={0}
                        square
                        sx={{ 
                            '&:before': { display: 'none' },
                            bgcolor: 'transparent'
                        }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
                            <Typography variant="subtitle2" fontWeight="bold">Elevation Profile</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 0, pb: 0 }}>
                            <Box sx={{ minHeight: 220, width: '100%', display: 'flex', flexDirection: 'column' }}>
                                {loading ? (
                                    <Box display="flex" justifyContent="center" alignItems="center" flex={1} py={2}>
                                        <CircularProgress size={30} />
                                    </Box>
                                ) : error ? (
                                    <Box py={2} textAlign="center">
                                        <Typography color="error" variant="body2">Could not load elevation profile</Typography>
                                    </Box>
                                ) : geometry ? (
                                    <ElevationChart 
                                        coordinates={geometry.coordinates} 
                                        onHover={(point: any) => setHoverPoint(point ? { lat: point.lat, lng: point.lng } : null)} 
                                    />
                                ) : (
                                    <Box py={2} textAlign="center">
                                        <Typography color="text.secondary" variant="body2">No elevation data available</Typography>
                                    </Box>
                                )}
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                    
                    <Box mt={2} display="flex" justifyContent="center">
                        <Typography variant="caption" color="text.secondary">
                            Release to close or tap outside
                        </Typography>
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
};
