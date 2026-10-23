import type { EventClimate } from '../hooks/useTrails';

// #1448: subtle background wash per ClimateCard.tsx's getClimateIcon bucket — reuses that
// classification rather than re-deriving it, so the two never drift apart. Each pair fades from
// a low-alpha tint (left) to fully transparent (right), so the Paper's own
// theme.palette.background.paper still shows through — a wash, not a banner — and text/stat
// contrast is unaffected since nothing opaque sits behind it. Dark variants use a lower alpha
// than light ones, since the same alpha reads more strongly against a dark background.
//
// #1454: split out of ClimateCard.tsx (same pattern as getActivityIcon.tsx/contactEmail.ts) so
// this can be imported and asserted on directly in tests — a component file that also exports a
// plain function trips react-refresh/only-export-components.
export function getClimateBackground(climate: EventClimate): { light: string; dark: string } {
    if (climate.averageLow <= 0 && climate.precipitationChance >= 0.3) {
        // snow — pale blue
        return {
            light: 'linear-gradient(135deg, rgba(187, 222, 251, 0.45) 0%, rgba(187, 222, 251, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(100, 181, 246, 0.16) 0%, rgba(100, 181, 246, 0) 100%)',
        };
    }
    if (climate.precipitationChance >= 0.5) {
        // heavy rain — slate blue
        return {
            light: 'linear-gradient(135deg, rgba(144, 164, 174, 0.4) 0%, rgba(144, 164, 174, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(120, 144, 156, 0.18) 0%, rgba(120, 144, 156, 0) 100%)',
        };
    }
    if (climate.precipitationChance >= 0.2) {
        // showers — light blue
        return {
            light: 'linear-gradient(135deg, rgba(179, 229, 252, 0.4) 0%, rgba(179, 229, 252, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(79, 195, 247, 0.14) 0%, rgba(79, 195, 247, 0) 100%)',
        };
    }
    if (climate.averageHigh >= 15) {
        // sunny — warm yellow
        return {
            light: 'linear-gradient(135deg, rgba(255, 224, 130, 0.4) 0%, rgba(255, 224, 130, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(255, 183, 77, 0.14) 0%, rgba(255, 183, 77, 0) 100%)',
        };
    }
    // cloudy — neutral grey
    return {
        light: 'linear-gradient(135deg, rgba(207, 216, 220, 0.4) 0%, rgba(207, 216, 220, 0) 100%)',
        dark: 'linear-gradient(135deg, rgba(144, 164, 174, 0.14) 0%, rgba(144, 164, 174, 0) 100%)',
    };
}
