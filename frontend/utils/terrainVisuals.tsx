import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material';

// #1000: extracted from EditionsHistoryPage.tsx (#806) and EditionHistoryPage.tsx (#927), which
// had drifted into two verbatim copies of this same helper. Keyed to the same three TerrainType
// enum values the backend exposes (Trail.cs TerrainType), roughly ordered by how demanding the
// terrain reads: steepest first. EditionsHistoryPage's table view intentionally gets none of this
// (see EventTableView).
export function getTerrainAccentColor(terrainType: string | null, theme: Theme): string | undefined {
    switch (terrainType) {
        case 'Mountainous': return theme.palette.error.main;
        case 'Hilly': return theme.palette.warning.main;
        case 'Flat': return theme.palette.success.main;
        default: return undefined;
    }
}

// #994: same steepest-first terrain reading as getTerrainAccentColor above, but scales how tall
// the decorative curve is allowed to peak — a flat trail's tiny elevation variance shouldn't look
// as visually "tall" as a mountainous one's just because both are stretched to fill the card.
// EditionHistoryPage.tsx's call site does not pass a terrainType, so it always falls through to
// this default branch and keeps its pre-#994, unscaled curve height — that divergence is
// intentional, not a bug to unify (see #1000).
export function terrainHeightFactor(terrainType?: string | null): number {
    switch (terrainType) {
        case 'Mountainous': return 0.75;
        case 'Hilly': return 0.5;
        case 'Flat': return 0.25;
        default: return 1;
    }
}

// Faint, absolutely-positioned, non-interactive elevation curve rendered behind a card's content.
// Deliberately not a chart library dependency — this is a decorative background, not a readable
// data visualization (that's what the per-race elevation-gain chip already is).
export function ElevationCurveBackground({ profile, color, terrainType }: { profile: number[]; color: string; terrainType?: string | null }) {
    if (profile.length < 2) return null;
    const min = Math.min(...profile);
    const max = Math.max(...profile);
    const range = max - min || 1;
    const width = 100;
    const height = 100;
    const factor = terrainHeightFactor(terrainType);
    const points = profile
        .map((v, i) => `${(i / (profile.length - 1)) * width},${height - ((v - min) / range) * height * factor}`)
        .join(' ');
    const areaPoints = `0,${height} ${points} ${width},${height}`;

    return (
        <Box
            component="svg"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none',
            }}
        >
            <polygon points={areaPoints} fill={alpha(color, 0.06)} stroke="none" />
            <polyline points={points} fill="none" stroke={alpha(color, 0.25)} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </Box>
    );
}
