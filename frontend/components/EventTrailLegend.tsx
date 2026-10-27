import React from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getTrailRouteStyle, toggleTrailSelection } from './trailRouteColors';

interface EventTrailLegendEntry {
    slug: string;
    name: string;
}

interface EventTrailLegendProps {
    entries: EventTrailLegendEntry[];
    // Same stable, sorted slug list TrailMapView feeds into getTrailRouteStyle (TrailMapView.tsx:197-200)
    // — required so this list's swatches always match the map's own colors/dashes exactly.
    sortedSlugs: readonly string[];
    selectedSlug: string | null;
    onSelectionChange: (slug: string | null, source: 'pin' | 'track' | null) => void;
}

// #1543: compact, horizontally-scrollable swatch list sitting above TrailMapView on
// CompetitionDetailPage — lets a visitor pick out one race's route on a multi-race event map
// without guessing which of several same-activityType/same-color lines is theirs. Deliberately
// separate from the unrelated races list further down the page (racesWithAnchors.map,
// CompetitionDetailPage.tsx:1095); this one only ever drives map selection.
export const EventTrailLegend: React.FC<EventTrailLegendProps> = ({ entries, sortedSlugs, selectedSlug, onSelectionChange }) => {
    const { t } = useTranslation();

    // Nothing to distinguish with a single race — matches the map's own per-slug coloring, which
    // only matters once there's more than one route to tell apart.
    if (entries.length < 2) return null;

    const handleClick = (slug: string) => {
        const next = toggleTrailSelection(selectedSlug, slug);
        onSelectionChange(next.slug, next.source);
    };

    return (
        <Box
            role="list"
            aria-label={t('map.raceRoutes')}
            sx={{
                display: 'flex',
                gap: 1,
                overflowX: 'auto',
                flexWrap: 'nowrap',
                py: 0.5,
                mb: 1,
                WebkitOverflowScrolling: 'touch',
            }}
        >
            {entries.map(({ slug, name }) => {
                const isSelected = selectedSlug === slug;
                const { color, dashArray } = getTrailRouteStyle(slug, sortedSlugs);
                return (
                    <Tooltip key={slug} title={name}>
                        <Chip
                            role="listitem"
                            aria-pressed={isSelected}
                            aria-label={t('map.selectRouteAriaLabel', { name })}
                            onClick={() => handleClick(slug)}
                            label={name}
                            icon={(
                                // Mirrors TrailMapView's Polyline pathOptions exactly: red when
                                // selected, otherwise this slug's assigned palette color/dash.
                                <Box
                                    component="svg"
                                    aria-hidden="true"
                                    width={20}
                                    height={10}
                                    sx={{ flexShrink: 0 }}
                                >
                                    <line
                                        x1={0} y1={5} x2={20} y2={5}
                                        stroke={isSelected ? '#f44336' : color}
                                        strokeWidth={3}
                                        strokeDasharray={isSelected ? undefined : dashArray}
                                    />
                                </Box>
                            )}
                            sx={{
                                minHeight: 44,
                                borderRadius: 999,
                                flexShrink: 0,
                                fontWeight: isSelected ? 700 : 400,
                                bgcolor: isSelected ? 'action.selected' : 'action.hover',
                                '& .MuiChip-label': { px: 1 },
                            }}
                        />
                    </Tooltip>
                );
            })}
        </Box>
    );
};
