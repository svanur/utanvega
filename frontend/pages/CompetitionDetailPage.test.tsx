import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// #1299: PR #1298 removed CompetitionDetailPage's own `userLocation` state and the
// geolocation-fetch effect that populated it, replacing the <TrailMapView> call with a permanent
// `userLocation={null}` (CompetitionDetailPage.tsx:797) — this page now never asks the browser for
// the visitor's location.
//
// CompetitionDetailPage has no render-level test harness today: reaching the map section would
// require mocking roughly a dozen data-fetching hooks (useEventBySlug, useLocations,
// useFavoriteEvents, useTrails, useTrailWeather, useFeatureFlags, ...), none of which this issue is
// about. Per #1299's scope, this is a deliberate source-level check rather than a full page
// render — it reads the shipped file's own text and asserts on what's actually there, which stays
// honest about what it covers (a regression where someone re-wires geolocation back in, or drops
// the `userLocation={null}` prop, would fail it) without adding a page-level test harness.
const sourcePath = fileURLToPath(new URL('./CompetitionDetailPage.tsx', import.meta.url));
const source = readFileSync(sourcePath, 'utf-8');

describe('CompetitionDetailPage map section (#1299)', () => {
    it('passes userLocation={null} to TrailMapView', () => {
        const match = source.match(/<TrailMapView\b[^>]*\/>/);
        expect(match).not.toBeNull();
        expect(match![0]).toContain('userLocation={null}');
    });

    it('never invokes navigator.geolocation.getCurrentPosition', () => {
        expect(source).not.toContain('navigator.geolocation');
        expect(source).not.toContain('getCurrentPosition');
    });
});
