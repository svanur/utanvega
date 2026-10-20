// @vitest-environment jsdom
//
// #1413: backfills coverage for the Location tile's visibility check (ClimateCard.tsx, the
// `(locationName || (typeof climate.lat === 'number' && typeof climate.lon === 'number'))`
// condition) — a bare `&&` truthy test on climate.lat/lon would hide the tile for a resolved
// (0, 0) coordinate, the exact bug class #1411 fixed. Not reachable with real Iceland data, but
// kept covered so the regression can't resurface silently.
//
// ClimateCard calls useTranslation(), which needs an initialized i18next instance; no other test
// file in this repo mocks react-i18next, so this one initializes the real `i18next` package
// directly (without react-i18next's HttpBackend/I18nextProvider ceremony) — cheaper than wiring up
// the app's actual i18n.ts, and sufficient since this test only asserts on the coordinate fallback
// string and structural presence/absence of the tile, never on translated copy.
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import ClimateCard from './ClimateCard';
import type { EventClimate } from '../hooks/useTrails';

afterEach(cleanup);

beforeAll(() => {
    i18next.use(initReactI18next).init({
        lng: 'en',
        resources: { en: { translation: {} } },
        // Missing keys resolve to the key itself (e.g. "climate.location") rather than throwing —
        // this test never asserts on translated copy, so the fallback is fine as-is.
        returnEmptyString: false,
        interpolation: { escapeValue: false },
    });
});

function makeClimate(overrides: Partial<EventClimate> = {}): EventClimate {
    return {
        averageHigh: 15,
        averageLow: 5,
        averagePrecipitation: 2,
        precipitationChance: 0.2,
        averageMaxWind: 5,
        yearsOfData: 15,
        targetMonth: 7,
        targetDay: 15,
        lat: 64.15,
        lon: -21.94,
        isApproximate: false,
        isStartPoint: false,
        ...overrides,
    };
}

describe('ClimateCard Location tile (#1413)', () => {
    it('renders the coordinate fallback tile for a resolved (0, 0) coordinate with no locationName', () => {
        render(
            <ClimateCard
                climate={makeClimate({ lat: 0, lon: 0 })}
                loading={false}
                error={null}
                locationName={null}
            />
        );

        // formatCoordinate(0, 0): lat >= 0 -> 'N', lon >= 0 -> 'E'.
        expect(screen.getByText('0.00°N, 0.00°E')).toBeTruthy();
    });

    it('hides the Location tile when lat/lon are null and there is no locationName', () => {
        // EventClimate types lat/lon as non-nullable `number` — the backend DTO never sends null
        // (see GetEventClimateQuery.cs). This cast exercises the defensive frontend-only branch.
        const climate = makeClimate({ lat: null as unknown as number, lon: null as unknown as number });

        render(
            <ClimateCard
                climate={climate}
                loading={false}
                error={null}
                locationName={null}
            />
        );

        expect(screen.queryByText('climate.location')).toBeNull();
    });
});

// #1430: start/finish is now one card with a Start/Finish tab instead of two ClimateCard
// instances — covers the header staying fixed, the tab appearing only when finish is passed,
// and switching it swapping which EventClimate's stats render.
describe('ClimateCard Start/Finish tab (#1430)', () => {
    it('renders no tab control and the plain title for a single-point event (finish omitted)', () => {
        render(
            <ClimateCard
                climate={makeClimate()}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('climate.title')).toBeTruthy();
        expect(screen.queryByText('climate.atStart')).toBeNull();
        expect(screen.queryByText('climate.atFinish')).toBeNull();
    });

    it('shows a Start/Finish tab for a split event and swaps stats/location on switch', () => {
        render(
            <ClimateCard
                climate={makeClimate({ averageHigh: 15, lat: 64.15, lon: -21.94 })}
                finish={makeClimate({ averageHigh: 2, lat: 65.68, lon: -18.1 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        // Header stays the plain "Climate Normals" title, never swapped for atStart/atFinish.
        expect(screen.getByText('climate.title')).toBeTruthy();
        // Start tab active by default: start's own locationName, prefixed with "At the start".
        expect(screen.getByText('climate.atStart — Reykjavík')).toBeTruthy();

        fireEvent.click(screen.getByText('climate.atFinish'));

        // Switching to the finish tab swaps the location row to the finish's own coordinate
        // (never the start's locationName — #1416 review fix, preserved under the single card)
        // and the "At the finish" wording now labels it.
        expect(screen.getByText('climate.atFinish — 65.68°N, 18.10°W')).toBeTruthy();
        expect(screen.queryByText('climate.atStart — Reykjavík')).toBeNull();
    });
});
