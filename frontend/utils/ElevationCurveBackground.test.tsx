import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { alpha } from '@mui/material/styles';
import { ElevationCurveBackground } from './ElevationCurveBackground';

// Pulls the opening tag (attributes and all) for the first match of `tagName` out of a markup
// string, so assertions below can read individual SVG attributes without a DOM/jsdom dependency.
function extractTag(markup: string, tagName: string): string {
    const match = markup.match(new RegExp(`<${tagName}\\b[^>]*>`));
    if (!match) throw new Error(`<${tagName}> not found in: ${markup}`);
    return match[0];
}

function extractAttr(tag: string, attr: string): string | undefined {
    return tag.match(new RegExp(`${attr}="([^"]*)"`))?.[1];
}

function countTags(markup: string, tagName: string): number {
    return (markup.match(new RegExp(`<${tagName}\\b`, 'g')) ?? []).length;
}

// #1013: rendering-test gap spotted in PR #1012 review, filed back when this component still lived
// in terrainVisuals.tsx. By the time this test was written, #1010 (PR #1016) had already split it
// out into its own file (this one's sibling). Rendered via react-dom/server's renderToStaticMarkup
// rather than jsdom/@testing-library/react: the component has no events, effects, or refs, so
// asserting on the static markup string is enough and avoids adding a DOM-testing dependency for a
// single decorative component.
describe('ElevationCurveBackground', () => {
    it('renders nothing when the profile has fewer than 2 points', () => {
        const markup = renderToStaticMarkup(<ElevationCurveBackground profile={[10]} color="#ff0000" />);
        expect(markup).toBe('');
        expect(markup).not.toContain('<svg');
    });

    it('renders nothing for an empty profile', () => {
        const markup = renderToStaticMarkup(<ElevationCurveBackground profile={[]} color="#ff0000" />);
        expect(markup).toBe('');
    });

    it('renders exactly one svg with a 0 0 100 100 viewBox, one polygon and one polyline for a valid profile', () => {
        const markup = renderToStaticMarkup(<ElevationCurveBackground profile={[10, 50, 20]} color="#ff0000" />);
        expect(countTags(markup, 'svg')).toBe(1);
        expect(countTags(markup, 'polygon')).toBe(1);
        expect(countTags(markup, 'polyline')).toBe(1);
        expect(extractAttr(extractTag(markup, 'svg'), 'viewBox')).toBe('0 0 100 100');
    });

    it("derives the polygon's fill and the polyline's stroke from the color prop via alpha()", () => {
        const color = '#3366ff';
        const markup = renderToStaticMarkup(<ElevationCurveBackground profile={[10, 50, 20]} color={color} />);
        expect(extractAttr(extractTag(markup, 'polygon'), 'fill')).toBe(alpha(color, 0.06));
        expect(extractAttr(extractTag(markup, 'polyline'), 'stroke')).toBe(alpha(color, 0.25));
    });

    // Two flat, equally-spaced points (0 and 100) make the polyline's second point's y-coordinate
    // fall out to exactly 100 * (1 - factor), with no float rounding to worry about — see
    // terrainHeightFactor's branches in terrainVisuals.ts for the factors asserted below.
    describe('scales the polyline height by terrainHeightFactor', () => {
        const cases: { terrainType: string | null | undefined; expectedPoints: string }[] = [
            { terrainType: 'Mountainous', expectedPoints: '0,100 100,25' },
            { terrainType: 'Hilly', expectedPoints: '0,100 100,50' },
            { terrainType: 'Flat', expectedPoints: '0,100 100,75' },
            { terrainType: undefined, expectedPoints: '0,100 100,0' },
        ];

        it.each(cases)('terrainType $terrainType', ({ terrainType, expectedPoints }) => {
            const markup = renderToStaticMarkup(
                <ElevationCurveBackground profile={[0, 100]} color="#ff0000" terrainType={terrainType} />
            );
            expect(extractAttr(extractTag(markup, 'polyline'), 'points')).toBe(expectedPoints);
        });
    });
});
