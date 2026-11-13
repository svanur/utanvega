import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, Tooltip as LeafletTooltip, useMap, useMapEvents, LayersControl } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import L from 'leaflet';
import { Box, Typography, Button, IconButton, Paper, Tooltip, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import RouteIcon from '@mui/icons-material/Route';
import { Trail } from '../hooks/useTrails';
import { useTrailGeometries } from '../hooks/useTrailGeometries';
import { useLocations } from '../hooks/useLocations';
import { useLocalize } from '../utils/localize';
import { computeMapBounds } from './trailMapBounds';
import { geoJsonBoundaryToLatLngParts, getBoundaryPathOptions, SIMPLEMAPS_CC_BY_ATTRIBUTION } from './locationBoundary';
import { computeSortedSlugs, getTrailRouteStyle, toggleTrailSelection } from './trailRouteColors';
import { Link as RouterLink } from 'react-router-dom';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix for Leaflet marker icons in React
// @ts-expect-error - Leaflet internal _getIconUrl not in type definitions
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIconRetina,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

interface TrailMapViewProps {
    trails: Trail[];
    userLocation: { lat: number; lng: number } | null;
    // #1309: shown as a marker (and used to center/zoom the map) only when `trails` resolves to
    // zero markers of its own — e.g. an event with no linked trail but a known gpxPointLat/Lng.
    // Optional and unused by existing call sites (LocationDetailsPage), which keep today's behavior.
    fallbackCenter?: { lat: number; lng: number } | null;
    // #1543: optional controlled selection — lets a sibling component (e.g. CompetitionDetailPage's
    // EventTrailLegend) read/drive the same highlight state as clicking a pin or a route. Omitted
    // (undefined, not null) by existing call sites (LocationDetailsPage), which keep today's
    // uncontrolled internal-state behavior unchanged.
    selectedSlug?: string | null;
    selectionSource?: 'pin' | 'track' | null;
    onSelectionChange?: (slug: string | null, source: 'pin' | 'track' | null) => void;
    // #1545: lets a caller that wraps this component in a fixed-height container (e.g.
    // CompetitionDetailPage, LocationDetailsPage) pass that same height through, so the
    // bottom-anchored selected-track info chip isn't clipped by an outer container shorter than
    // the default 70vh. Omitted by TrailList, which keeps today's 70vh behavior unchanged.
    height?: string;
    // #1707: optional municipality boundary outline (Location.Boundary, #1705), rendered as a
    // Polygon layer beneath the trail routes/selected-track highlight so it reads as context, not
    // as another route. Omitted (undefined/null) by TrailList and CompetitionDetailPage, which
    // have no location boundary to show.
    // `attribution`: set only when the boundary's source requires a visible credit (landsvæði
    // regions are simplemaps.com, CC BY 4.0 — see SIMPLEMAPS_CC_BY_ATTRIBUTION below); omitted for
    // municipality boundaries, which are LMÍ-sourced and don't need this per-page credit.
    locationBoundary?: { geoJson: string; color?: string; attribution?: string } | null;
    // #1777: opt-in overlay — one boundary shape per distinct location behind `trails` that has a
    // saved Location.boundaryGeoJson (#1705), hover-highlighted the same way EventMapView's
    // equivalent overlay is (#1776). Explicit prop rather than inferring "on" from `locationBoundary`
    // being absent — CompetitionDetailPage also omits `locationBoundary` and must not pick this up
    // implicitly. Defaults to `false`; only TrailList's map view passes `true`.
    showLocationBoundaries?: boolean;
}

// Leaflet's attribution control only reflects TileLayer attribution automatically; an overlay
// (here, a boundary Polygon sourced from somewhere other than the active base tile layer) has to
// register/unregister itself imperatively so its credit stays visible regardless of which base
// layer (OSM/CARTO/OpenTopoMap) is currently selected. `text` is expected to be referentially
// stable (a module-level constant, not a literal built fresh each render) since it's also the key
// used to remove the attribution on cleanup.
export function MapAttributionSync({ text }: { text: string | null }) {
    const map = useMap();
    useEffect(() => {
        if (!text) return;
        map.attributionControl.addAttribution(text);
        return () => { map.attributionControl.removeAttribution(text); };
    }, [map, text]);
    return null;
}

function ChangeView({ bounds, followMe, userLocation, containerReady }: {
    bounds: L.LatLngBoundsExpression | null,
    followMe: boolean,
    userLocation: { lat: number; lng: number } | null,
    // #1535: bumped once MapInvalidateSize has corrected the container's real size, so fitBounds
    // re-runs against the true size instead of leaving the first (possibly zero/lazy-loaded) fit
    // in place — without this, part of a route can be cut off after the container resizes.
    containerReady: boolean,
}) {
    const map = useMap();

    useMapEvents({
        dragstart: () => {
            // We'll handle disabling followMe via a prop callback if needed,
            // but since ChangeView is a child, we'll use a simpler approach in the main component
        },
    });

    useEffect(() => {
        if (!followMe && bounds && (bounds as L.LatLngBounds).isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [bounds, map, followMe, containerReady]);

    useEffect(() => {
        if (followMe && userLocation) {
            map.setView([userLocation.lat, userLocation.lng], map.getZoom());
        }
    }, [followMe, userLocation, map]);

    return null;
}

// Must be stable components (not inline) to avoid Leaflet re-registration
function MapInvalidateSize({ onReady }: { onReady: () => void }) {
    const map = useMap();
    useEffect(() => {
        // Fix tiles not rendering when map is lazy-loaded into a container
        const timer = setTimeout(() => {
            map.invalidateSize();
            // #1535: signal ChangeView to re-fit bounds now that the container's real size is
            // known — without this, fitBounds (run earlier against the stale/zero size) can leave
            // part of a route cut off.
            onReady();
        }, 200);
        return () => clearTimeout(timer);
    }, [map, onReady]);
    return null;
}

function MapDragHandler({ onDrag, onMapClick, ignoreClickRef }: { 
    onDrag: () => void; 
    onMapClick?: () => void;
    ignoreClickRef?: React.MutableRefObject<boolean>;
}) {
    useMapEvents({
        dragstart: onDrag,
        click: () => {
            if (ignoreClickRef?.current) {
                ignoreClickRef.current = false;
                return;
            }
            onMapClick?.();
        },
    });
    return null;
}

export const TrailMapView: React.FC<TrailMapViewProps> = ({
    trails,
    userLocation,
    fallbackCenter = null,
    selectedSlug: selectedSlugProp,
    selectionSource: selectionSourceProp,
    onSelectionChange,
    height = '70vh',
    locationBoundary = null,
    showLocationBoundaries = false,
}) => {
    const { t } = useTranslation();
    const loc = useLocalize();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    // #1780: only fetch GET /api/v1/locations when boundaries are actually rendered — skips the
    // fetch for LocationDetailsPage/CompetitionDetailPage, which never pass showLocationBoundaries.
    const { locations } = useLocations(showLocationBoundaries);
    const [followMe, setFollowMe] = useState(false);
    const [showTracks, setShowTracks] = useState(true);
    // #1777: one location's boundary shape hovered (or tapped — Leaflet's default tap-to-open
    // behavior on touch) at a time, independent of the single-boundary `locationBoundary` prop's
    // own (non-interactive) rendering below. Keyed by slug, not id — `Trail.locations[].slug` is
    // all `LocationInfo` (useTrails.ts) carries; unlike EventSummary, it has no locationId.
    const [hoveredLocationSlug, setHoveredLocationSlug] = useState<string | null>(null);
    // #1535: flips once after MapInvalidateSize's delayed invalidateSize() has corrected the
    // container's real size, so ChangeView's fitBounds re-runs against that size.
    const [containerReady, setContainerReady] = useState(false);
    const handleContainerReady = useCallback(() => setContainerReady(true), []);
    // #1543: selection is controlled when the caller passes `selectedSlug` at all (even `null`) —
    // distinguished from the uncontrolled default via `undefined`, same convention MUI itself uses
    // for controlled/uncontrolled inputs. LocationDetailsPage never passes it, so it keeps today's
    // internal-state behavior unchanged; CompetitionDetailPage does, so its sibling EventTrailLegend
    // can read/drive the same state.
    const isControlled = selectedSlugProp !== undefined;
    const [internalSelectedSlug, setInternalSelectedSlug] = useState<string | null>(null);
    const [internalSelectionSource, setInternalSelectionSource] = useState<'pin' | 'track' | null>(null);
    const selectedSlug = isControlled ? selectedSlugProp : internalSelectedSlug;
    const selectionSource = isControlled ? (selectionSourceProp ?? null) : internalSelectionSource;
    const applySelection = useCallback((slug: string | null, source: 'pin' | 'track' | null) => {
        if (isControlled) {
            onSelectionChange?.(slug, source);
        } else {
            setInternalSelectedSlug(slug);
            setInternalSelectionSource(source);
        }
    }, [isControlled, onSelectionChange]);
    const { geometries } = useTrailGeometries();

    const handleFollowMeClick = () => {
        setFollowMe(prev => !prev);
    };

    const handleDrag = React.useCallback(() => setFollowMe(false), []);
    const handleMapClick = React.useCallback(() => applySelection(null, null), [applySelection]);
    const ignoreMapClick = React.useRef(false);
    const trailsWithLocation = useMemo(() => 
        trails.filter(t => t.startLatitude !== null && t.startLongitude !== null && (t.startLatitude !== 0 || t.startLongitude !== 0)),
    [trails]);

    const trailBySlug = useMemo(() => {
        const map = new Map<string, Trail>();
        trails.forEach(t => map.set(t.slug, t));
        return map;
    }, [trails]);

    // Geometries for trails in the current view, independent of showTracks — this feeds the
    // bounds calculation below so toggling the hide/show-tracks button never re-fits the map
    // (#1303). Only `visibleGeometries` (derived from this) is gated by showTracks, and that
    // gating affects rendered <Polyline>s only.
    const geometriesForTrails = useMemo(() => {
        if (geometries.length === 0) return [];
        const slugSet = new Set(trails.map(t => t.slug));
        return geometries.filter(g => slugSet.has(g.slug));
    }, [trails, geometries]);

    const visibleGeometries = useMemo(() => {
        if (!showTracks) return [];
        return geometriesForTrails;
    }, [geometriesForTrails, showTracks]);

    // #1543: stable, sorted slug list feeding getTrailRouteStyle — derived from `trails`/`geometries`
    // (not visibleGeometries) so a slug's assigned color/dash never shifts when showTracks is
    // toggled off and back on, same independence-from-showTracks `bounds` already relies on above.
    // Shared with CompetitionDetailPage's EventTrailLegend via the same computeSortedSlugs() call,
    // so the map and the legend never disagree on which slug gets which color/dash.
    const sortedSlugs = useMemo(
        () => computeSortedSlugs(trails, geometries),
        [trails, geometries],
    );

    const bounds = useMemo(() => {
        const corners = computeMapBounds(trailsWithLocation, geometriesForTrails, userLocation, fallbackCenter);
        return corners ? L.latLngBounds(corners[0], corners[1]) : null;
    }, [trailsWithLocation, geometriesForTrails, userLocation, fallbackCenter]);

    // #1707/#1739: parsed once per geoJson string, not per render — the boundary itself never
    // changes while a location detail page is mounted. One part per polygon (Polygon: one part;
    // MultiPolygon: one part per disconnected shape, e.g. an exclave).
    const boundaryParts = useMemo(
        () => (locationBoundary ? geoJsonBoundaryToLatLngParts(locationBoundary.geoJson) : null),
        [locationBoundary],
    );
    // Theme-driven default (secondary.main) rather than a hardcoded hex, per #1707 — must stay
    // legible in dark mode. Visually distinct from both TRAIL_ROUTE_PALETTE and the selected-track
    // highlight red by the dashed stroke + low fill opacity below, not by color alone.
    const boundaryColor = locationBoundary?.color ?? theme.palette.secondary.main;

    // #1777: distinct locations behind the current trail set that have a saved boundary
    // (Location.boundaryGeoJson, #1705) — rendered as Polygon outlines alongside (not instead of)
    // the single `locationBoundary` prop above, adapting EventMapView.tsx's equivalent (#1776).
    // Joined on slug, not id — `Trail.locations[].slug` (LocationInfo, useTrails.ts) is all a Trail
    // carries about its locations; `useLocations()`'s own `Location.slug` is the matching key.
    // Gated behind showLocationBoundaries so CompetitionDetailPage/LocationDetailsPage, which also
    // omit `locationBoundary` but never pass this prop, stay visually unchanged.
    const boundaryLocations = useMemo(() => {
        if (!showLocationBoundaries) return [];
        const locationBySlug = new Map(locations.map(l => [l.slug, l]));
        const slugs = new Set(
            trails.flatMap(trail => trail.locations.map(l => l.slug)),
        );
        return Array.from(slugs)
            .map(slug => locationBySlug.get(slug))
            .filter((l): l is NonNullable<typeof l> & { boundaryGeoJson: string } => !!l?.boundaryGeoJson);
    }, [showLocationBoundaries, locations, trails]);

    // #1777: a landsvæði Region boundary is simplemaps.com (CC BY 4.0) — surface that credit
    // whenever one is among the shapes currently rendered, same gate LocationsPage.tsx/
    // EventMapView.tsx use for the same data. Combined with locationBoundary's own attribution
    // (below) so neither source's credit is dropped when both happen to be present.
    const hasSimplemapsBoundary = useMemo(
        () => boundaryLocations.some(l => l.type === 'Region'),
        [boundaryLocations],
    );

    const userLocationIcon = useMemo(() => new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }), []);

    const trailIcon = useMemo(() => new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
        className: 'trail-marker'
    }), []);

    // Memoize marker cluster to prevent re-clustering on unrelated state changes
    // (selectedSlug/selectionSource updates caused re-renders that re-processed all markers)
    const selectedSlugRef = useRef(selectedSlug);
    selectedSlugRef.current = selectedSlug;
    const selectionSourceRef = useRef(selectionSource);
    selectionSourceRef.current = selectionSource;

    const handleMarkerClick = useCallback((e: L.LeafletMouseEvent) => {
        ignoreMapClick.current = true;
        e.target.openPopup();
    }, []);

    const handlePopupOpen = useCallback((slug: string) => {
        applySelection(slug, 'pin');
    }, [applySelection]);

    const handlePopupClose = useCallback(() => {
        applySelection(null, null);
    }, [applySelection]);

    const markerCluster = useMemo(() => (
                <MarkerClusterGroup
                    chunkedLoading
                    maxClusterRadius={50}
                    spiderfyOnMaxZoom
                    showCoverageOnHover={false}
                >
                {trailsWithLocation.map(trail => (
                    <Marker 
                        key={trail.id} 
                        position={[trail.startLatitude!, trail.startLongitude!]}
                        icon={trailIcon}
                        eventHandlers={{
                            click: handleMarkerClick,
                            popupopen: () => handlePopupOpen(trail.slug),
                            popupclose: handlePopupClose,
                        }}
                    >
                        <Popup>
                            <Box sx={{ minWidth: 200, p: 0.5 }}>
                                <Typography variant="h6" gutterBottom>{trail.name}</Typography>
                                <Typography variant="body2" color="textSecondary" gutterBottom>
                                    {({'OutAndBack': t('trail.outAndBack'), Loop: t('trail.loop'), PointToPoint: t('trail.pointToPoint')} as Record<string, string>)[trail.trailType] ?? trail.trailType} • {(trail.length / 1000).toFixed(1)} km
                                </Typography>
                                {trail.description && (
                                    <Typography variant="body2" sx={{ mb: 1, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {trail.description}
                                    </Typography>
                                )}
                                <Button 
                                    component={RouterLink} 
                                    to={`/trails/${trail.slug}`} 
                                    variant="contained" 
                                    size="small" 
                                    fullWidth
                                    sx={{ 
                                        color: '#fff !important',
                                        '&:hover': { color: '#fff !important' }
                                    }}
                                >
                                    {t('map.viewDetails')}
                                </Button>
                            </Box>
                        </Popup>
                    </Marker>
                ))}
                </MarkerClusterGroup>
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [trailsWithLocation, trailIcon, handleMarkerClick, handlePopupOpen, handlePopupClose]);

    return (
        <Box sx={{
            height,
            width: '100%',
            borderRadius: 2, 
            overflow: 'hidden', 
            border: '1px solid #ccc', 
            mb: 2,
            '& .trail-marker': {
                filter: 'grayscale(0.4) opacity(0.8)',
                transition: 'filter 0.3s ease, transform 0.3s ease',
            },
            '& .trail-marker:hover': {
                filter: 'grayscale(0) opacity(1)',
                transform: 'scale(1.1)',
                zIndex: 1000,
            }
        }}>
            <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
                <Paper 
                    elevation={3} 
                    sx={{ 
                        position: 'absolute', 
                        top: 10, 
                        right: 10, 
                        zIndex: 1100,
                        borderRadius: 4,
                        overflow: 'hidden',
                        backgroundColor: 'white',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        p: 0.5,
                    }}
                >
                    {userLocation !== null && (
                        <Tooltip title={followMe ? t('map.stopFollowing') : t('map.followLocation')} placement="left">
                            <IconButton
                                onClick={handleFollowMeClick}
                                color={followMe ? "primary" : "default"}
                                size="small"
                                sx={{
                                    backgroundColor: followMe ? 'rgba(25, 118, 210, 0.1)' : 'white',
                                    '&:hover': {
                                        backgroundColor: followMe ? 'rgba(25, 118, 210, 0.2)' : '#f5f5f5',
                                    }
                                }}
                                aria-label="follow my location"
                            >
                                <MyLocationIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title={showTracks ? t('map.hideTracks') : t('map.showTracks')} placement="left">
                        <IconButton
                            onClick={() => setShowTracks(prev => !prev)}
                            color={showTracks ? "primary" : "default"}
                            size="small"
                            sx={{
                                backgroundColor: showTracks ? 'rgba(25, 118, 210, 0.1)' : 'white',
                                '&:hover': {
                                    backgroundColor: showTracks ? 'rgba(25, 118, 210, 0.2)' : '#f5f5f5',
                                }
                            }}
                            aria-label="toggle tracks"
                        >
                            <RouteIcon />
                        </IconButton>
                    </Tooltip>
                </Paper>

                <MapContainer 
                    center={[64.1265, -21.8174]} 
                    zoom={10} 
                    style={{ height: '100%', width: '100%' }}
                >
                    <MapInvalidateSize onReady={handleContainerReady} />
                    <MapDragHandler onDrag={handleDrag} onMapClick={handleMapClick} ignoreClickRef={ignoreMapClick} />
                    <MapAttributionSync text={locationBoundary?.attribution ?? null} />
                    {/* #1777: separate registration from locationBoundary's own attribution above
                        so both sources' credits stay visible if either (or both, LocationDetailsPage
                        aside) happen to be present at once — unless they're the literal same string,
                        in which case registering it twice would just double up for no benefit. */}
                    <MapAttributionSync
                        text={
                            hasSimplemapsBoundary && locationBoundary?.attribution !== SIMPLEMAPS_CC_BY_ATTRIBUTION
                                ? SIMPLEMAPS_CC_BY_ATTRIBUTION
                                : null
                        }
                    />
                <LayersControl key={isDark ? 'dark' : 'light'} position="topleft">
                        <LayersControl.BaseLayer checked={!isDark} name={t('map.street')}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer checked={isDark} name={t('map.dark')}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name={t('map.topo')}>
                            <TileLayer
                                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                                maxZoom={17}
                            />
                        </LayersControl.BaseLayer>
                    </LayersControl>
                
                {/* #1707/#1739: location boundary outline(s) — rendered first so it sits below the
                    trail routes/highlight in z-order; dashed + lightly filled so it reads as
                    context, not as another route competing with TRAIL_ROUTE_PALETTE. One <Polygon>
                    per part so a MultiPolygon boundary (e.g. a municipality's exclave) renders as
                    several disconnected outlines rather than one shape joining them. */}
                {boundaryParts?.map((part, index) => (
                    <Polygon
                        key={`boundary-${index}`}
                        positions={part}
                        pathOptions={{
                            color: boundaryColor,
                            weight: 2,
                            dashArray: '6 6',
                            fillColor: boundaryColor,
                            fillOpacity: 0.08,
                        }}
                        interactive={false}
                    />
                ))}

                {/* #1777: the opt-in multi-location overlay (showLocationBoundaries) — rendered in
                    the same boundary z-order slot as the single-boundary block above, beneath
                    markerCluster/visibleGeometries below, so it reads as context rather than
                    covering trail routes/markers. Styled via getBoundaryPathOptions (theme-driven,
                    unlike the hand-written pathOptions above) and interactive, since hovering/
                    tapping a shape is the point of this overlay. */}
                {showLocationBoundaries && boundaryLocations.flatMap(location => {
                    const parts = geoJsonBoundaryToLatLngParts(location.boundaryGeoJson);
                    if (!parts) return [];
                    const isHovered = hoveredLocationSlug === location.slug;
                    // #1739: one <Polygon> per part so a MultiPolygon boundary (e.g. an exclave)
                    // renders as several disconnected outlines, all sharing the same hover
                    // handlers so hovering/tapping any part highlights the same location.
                    return parts.map((part, index) => (
                        <Polygon
                            key={`location-boundary-${location.slug}-${index}`}
                            positions={part}
                            pathOptions={getBoundaryPathOptions(theme, isHovered)}
                            eventHandlers={{
                                mouseover: () => setHoveredLocationSlug(location.slug),
                                mouseout: () => setHoveredLocationSlug(null),
                            }}
                        >
                            <LeafletTooltip direction="center" sticky>
                                <Typography variant="caption" fontWeight="bold">
                                    {loc(location.name, location.nameEn) ?? location.name}
                                </Typography>
                            </LeafletTooltip>
                        </Polygon>
                    ));
                })}

                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                        <Popup>
                            <Typography variant="body2">{t('map.youAreHere')}</Typography>
                        </Popup>
                    </Marker>
                )}

                {/* #1309: when no trail has a plottable location, fall back to the caller-supplied
                    center (e.g. an event's own gpxPointLat/Lng) so the map still shows a marker and
                    zooms somewhere meaningful instead of sitting at its hardcoded default view. */}
                {trailsWithLocation.length === 0 && fallbackCenter && (
                    <Marker position={[fallbackCenter.lat, fallbackCenter.lng]} icon={trailIcon}>
                        <Popup>
                            <Typography variant="body2">{t('map.eventLocation')}</Typography>
                        </Popup>
                    </Marker>
                )}

                {visibleGeometries.map(geo => {
                    const isSelected = selectedSlug === geo.slug;
                    const isDimmed = selectedSlug !== null && !isSelected;
                    // #1543: per-trail-slug color/dash (instead of ACTIVITY_COLORS[geo.activityType])
                    // so same-activityType races on one event no longer render pixel-identical routes.
                    const { color, dashArray } = getTrailRouteStyle(geo.slug, sortedSlugs);
                    return (
                        <Polyline
                            key={geo.slug}
                            positions={geo.coordinates}
                            pathOptions={{
                                color: isSelected ? '#f44336' : color,
                                dashArray: isSelected ? undefined : dashArray,
                                weight: isSelected ? 5 : 3,
                                opacity: isDimmed ? 0.15 : isSelected ? 1 : 0.7,
                            }}
                            eventHandlers={{
                                click: (e) => {
                                    L.DomEvent.stopPropagation(e.originalEvent);
                                    ignoreMapClick.current = true;
                                    const next = toggleTrailSelection(selectedSlug, geo.slug);
                                    applySelection(next.slug, next.source);
                                }
                            }}
                        />
                    );
                })}

                {markerCluster}

                {bounds && <ChangeView bounds={bounds} followMe={followMe} userLocation={userLocation} containerReady={containerReady} />}
            </MapContainer>

                {/* Minimal info strip for selected track (only on track click, not pin click) */}
                {selectedSlug && selectionSource === 'track' && (() => {
                    const trail = trailBySlug.get(selectedSlug);
                    if (!trail) return null;
                    return (
                        <Box
                            component={RouterLink}
                            to={`/trails/${trail.slug}`}
                            sx={{
                                position: 'absolute',
                                bottom: 8,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 1100,
                                backgroundColor: 'rgba(0,0,0,0.65)',
                                backdropFilter: 'blur(8px)',
                                color: '#fff',
                                px: 2,
                                py: 0.75,
                                borderRadius: 3,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                textDecoration: 'none',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' },
                                maxWidth: '90%',
                            }}
                        >
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {trail.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                                {(trail.length / 1000).toFixed(1)} km · ↑{trail.elevationGain?.toFixed(0) ?? '?'}m
                            </Typography>
                        </Box>
                    );
                })()}
            </Box>
        </Box>
    );
};
