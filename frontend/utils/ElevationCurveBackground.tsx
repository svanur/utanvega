import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { terrainHeightFactor } from './terrainVisuals';

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
