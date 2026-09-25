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
// EditionHistoryPage.tsx (#927) and EditionsHistoryPage.tsx (#806) both pass terrainType through
// to this function, so they scale identically; the default branch below now only applies when an
// edition has an elevation profile but no primaryTerrainType (see #1020).
export function terrainHeightFactor(terrainType?: string | null): number {
    switch (terrainType) {
        case 'Mountainous': return 0.75;
        case 'Hilly': return 0.5;
        case 'Flat': return 0.25;
        default: return 1;
    }
}
