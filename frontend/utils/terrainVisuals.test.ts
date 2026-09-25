import { describe, it, expect } from 'vitest';
import { createTheme } from '@mui/material/styles';
import { getTerrainAccentColor, terrainHeightFactor } from './terrainVisuals';

const theme = createTheme();

// #1006: pattern gap spotted in PR #1005 review — getTerrainAccentColor and terrainHeightFactor
// had no test coverage even after the #1000 extraction landed them as the single shared source of
// truth for both EditionHistoryPage.tsx and EditionsHistoryPage.tsx. Colors are asserted against a
// real createTheme() instance rather than hardcoded hex strings, so this stays correct if the theme
// palette ever changes.
describe('getTerrainAccentColor', () => {
    it('returns theme.palette.error.main for "Mountainous"', () => {
        expect(getTerrainAccentColor('Mountainous', theme)).toBe(theme.palette.error.main);
    });

    it('returns theme.palette.warning.main for "Hilly"', () => {
        expect(getTerrainAccentColor('Hilly', theme)).toBe(theme.palette.warning.main);
    });

    it('returns theme.palette.success.main for "Flat"', () => {
        expect(getTerrainAccentColor('Flat', theme)).toBe(theme.palette.success.main);
    });

    it('returns undefined for null', () => {
        expect(getTerrainAccentColor(null, theme)).toBeUndefined();
    });

    it('returns undefined for an unrecognized terrain type', () => {
        expect(getTerrainAccentColor('Swampy', theme)).toBeUndefined();
    });
});

describe('terrainHeightFactor', () => {
    it('returns 0.25 for "Flat"', () => {
        expect(terrainHeightFactor('Flat')).toBe(0.25);
    });

    it('returns 0.5 for "Hilly"', () => {
        expect(terrainHeightFactor('Hilly')).toBe(0.5);
    });

    it('returns 0.75 for "Mountainous"', () => {
        expect(terrainHeightFactor('Mountainous')).toBe(0.75);
    });

    it('returns 1 for null', () => {
        expect(terrainHeightFactor(null)).toBe(1);
    });

    it('returns 1 for undefined', () => {
        expect(terrainHeightFactor(undefined)).toBe(1);
    });

    it('returns 1 for an unrecognized terrain type', () => {
        expect(terrainHeightFactor('Swampy')).toBe(1);
    });
});
