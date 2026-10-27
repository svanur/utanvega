// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/en.json';
import { EventTrailLegend } from './EventTrailLegend';
import { getTrailRouteStyle } from './trailRouteColors';

// Mirrors CompetitionDetailPage.test.tsx's setup — real i18next so
// t('map.selectRouteAriaLabel', { name }) actually interpolates, not just returns the raw key.
afterEach(cleanup);
void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

const entries = [
    { slug: 'race-a', name: 'Race A' },
    { slug: 'race-b', name: 'Race B' },
];
const sortedSlugs = ['race-a', 'race-b'];

// #1543: covers the list half of the per-trail-colors feature — TrailMapView.test.tsx covers the
// map/Polyline half. Both consume the same trailRouteColors.ts helpers so their assertions about
// color/dash agree without duplicating that logic.
describe('EventTrailLegend (#1543)', () => {
    it('renders nothing with fewer than two entries — nothing to distinguish', () => {
        const { container } = render(
            <EventTrailLegend entries={[entries[0]]} sortedSlugs={sortedSlugs} selectedSlug={null} onSelectionChange={vi.fn()} />
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders one entry per race, each with a swatch matching its map color', () => {
        render(
            <EventTrailLegend entries={entries} sortedSlugs={sortedSlugs} selectedSlug={null} onSelectionChange={vi.fn()} />
        );

        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(2);

        const expectedColorA = getTrailRouteStyle('race-a', sortedSlugs).color;
        const lineA = items[0].querySelector('line');
        expect(lineA?.getAttribute('stroke')).toBe(expectedColorA);
    });

    it('clicking an entry calls onSelectionChange with that slug and source "track"', () => {
        const onSelectionChange = vi.fn();
        render(
            <EventTrailLegend entries={entries} sortedSlugs={sortedSlugs} selectedSlug={null} onSelectionChange={onSelectionChange} />
        );

        screen.getAllByRole('listitem')[1].click();

        expect(onSelectionChange).toHaveBeenCalledWith('race-b', 'track');
    });

    it('clicking the already-selected entry clears the selection (toggle-off-on-reclick)', () => {
        const onSelectionChange = vi.fn();
        render(
            <EventTrailLegend entries={entries} sortedSlugs={sortedSlugs} selectedSlug="race-a" onSelectionChange={onSelectionChange} />
        );

        screen.getAllByRole('listitem')[0].click();

        expect(onSelectionChange).toHaveBeenCalledWith(null, null);
    });

    it('renders the selected entry\'s swatch in red, matching the map\'s selected-route color', () => {
        render(
            <EventTrailLegend entries={entries} sortedSlugs={sortedSlugs} selectedSlug="race-a" onSelectionChange={vi.fn()} />
        );

        const items = screen.getAllByRole('listitem');
        const lineA = items[0].querySelector('line');
        expect(lineA?.getAttribute('stroke')).toBe('#f44336');
    });
});
