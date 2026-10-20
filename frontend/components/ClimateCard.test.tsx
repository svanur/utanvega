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
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Profiler } from 'react';
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
        averageSunshineHours: 6,
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

// #1435: today's single call site (CompetitionDetailPage) remounts ClimateCard between events,
// so this was unreachable in practice — hardens the assumption for a future client-side
// transition that could reuse the mounted instance instead of remounting it.
describe('ClimateCard activeTab reset on prop identity change (#1435)', () => {
    it('resets activeTab back to "start" when climate/finish props are replaced without unmounting', () => {
        const { rerender } = render(
            <ClimateCard
                climate={makeClimate({ averageHigh: 15, lat: 64.15, lon: -21.94 })}
                finish={makeClimate({ averageHigh: 2, lat: 65.68, lon: -18.1 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        fireEvent.click(screen.getByText('climate.atFinish'));
        expect(screen.getByText('climate.atFinish — 65.68°N, 18.10°W')).toBeTruthy();

        // Same component instance (no unmount) — new EventClimate objects (different identity,
        // standing in for a different event's data) via rerender, not a fresh render() call.
        rerender(
            <ClimateCard
                climate={makeClimate({ averageHigh: 20, lat: 63.4, lon: -19.0 })}
                finish={makeClimate({ averageHigh: 1, lat: 66.0, lon: -17.0 })}
                loading={false}
                error={null}
                locationName="Vík"
            />
        );

        // activeTab reset to 'start' rather than persisting the old event's "finish" selection.
        expect(screen.getByText('climate.atStart — Vík')).toBeTruthy();
        expect(screen.queryByText('climate.atFinish — 66.00°N, 17.00°W')).toBeNull();
    });
});

// #1440: hardens the above reset to happen at render time (an "adjust state during render" bail
// before commit), not inside a useEffect that fires after an initial commit. React's Profiler
// onRender fires once per *committed* render of its subtree — a setState call during render
// (this fix) discards the in-progress render and restarts before ever committing, so the
// corrected frame is the *only* commit; a useEffect-based reset instead commits once with the
// stale tab + new data, then a second time after the effect's setState fires. Asserting exactly
// one onRender call after the prop-identity change is therefore direct evidence that no
// intermediate render ever pairs the old activeTab with the new climate/finish data.
describe('ClimateCard activeTab reset happens at render time, not via useEffect (#1440)', () => {
    it('commits exactly once when climate/finish identity changes on a mounted instance', () => {
        const onRender = vi.fn();
        const renderWithProfiler = (climate: EventClimate, finish: EventClimate, locationName: string) => (
            <Profiler id="climate-card" onRender={onRender}>
                <ClimateCard
                    climate={climate}
                    finish={finish}
                    loading={false}
                    error={null}
                    locationName={locationName}
                />
            </Profiler>
        );

        const { rerender } = render(
            renderWithProfiler(
                makeClimate({ averageHigh: 15, lat: 64.15, lon: -21.94 }),
                makeClimate({ averageHigh: 2, lat: 65.68, lon: -18.1 }),
                'Reykjavík'
            )
        );

        fireEvent.click(screen.getByText('climate.atFinish'));
        expect(screen.getByText('climate.atFinish — 65.68°N, 18.10°W')).toBeTruthy();
        onRender.mockClear();

        // Same instance (no unmount) — new EventClimate objects standing in for a different event.
        rerender(
            renderWithProfiler(
                makeClimate({ averageHigh: 20, lat: 63.4, lon: -19.0 }),
                makeClimate({ averageHigh: 1, lat: 66.0, lon: -17.0 }),
                'Vík'
            )
        );

        // Exactly one commit — no separate, earlier commit existed where the stale "finish" tab
        // was paired with Vík's new data before being corrected back to "start".
        expect(onRender).toHaveBeenCalledTimes(1);
        expect(screen.getByText('climate.atStart — Vík')).toBeTruthy();
        expect(screen.queryByText('climate.atFinish — 66.00°N, 17.00°W')).toBeNull();
    });
});
