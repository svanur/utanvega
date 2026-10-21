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
import { render, screen, cleanup } from '@testing-library/react';
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

// #1460: the Start/Finish tab control was removed along with the point-to-point split — a single
// ClimateCard now always renders the one resolved climate directly, with no tab/toggle of any
// kind. This covers that the tab control and its wording are gone for good.
describe('ClimateCard renders without a Start/Finish tab control (#1460)', () => {
    it('renders the plain title and no "at start"/"at finish" wording', () => {
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
        expect(screen.queryByRole('button', { name: /start/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /finish/i })).toBeNull();
    });

    it('renders the locationName directly, with no start/finish prefix', () => {
        render(
            <ClimateCard
                climate={makeClimate()}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('Reykjavík')).toBeTruthy();
    });
});

// #1451: sunshine and precipitation-chance tiles didn't carry the `minWidth: 0` flex pattern the
// Location tile (#1413, above) already uses to let its Typography wrap instead of overflowing the
// row — flagged non-blocking during #1450's review. Asserts the computed style directly (both
// tiles' outer Stack and inner Box) rather than just checking the longest labels render without
// throwing, since a missing `minWidth: 0` wouldn't throw either — MUI Typography wraps at spaces
// on its own; the regression this guards against is a flex child refusing to shrink below its
// content width, not a thrown error.
describe('ClimateCard sunshine/precipitation tiles minWidth: 0 (#1451)', () => {
    it('applies minWidth: 0 to the sunshine tile Stack and Box with the longest Icelandic label', () => {
        render(
            <ClimateCard
                // averageSunshineHours=5 -> getSunshineLabelKey's "moderate" band (>=4, <8),
                // rendered here as the untranslated key since this test's i18next has no
                // resources — `climate.sunshineModerate` is Icelandic's longest sunshine label
                // ("Skiptist á sól og skýjum") in the real app, per the work order.
                climate={makeClimate({ averageSunshineHours: 5 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        const sunshineText = screen.getByText('5.0 h · climate.sunshineModerate');
        const sunshineBox = sunshineText.closest('div')!;
        const sunshineStack = sunshineBox.parentElement!;

        // jsdom's getComputedStyle normalizes MUI's `minWidth: 0` sx value (a bare number,
        // serialized to the unitless CSS string "0") rather than adding a "px" suffix.
        expect(getComputedStyle(sunshineBox).minWidth).toBe('0');
        expect(getComputedStyle(sunshineStack).minWidth).toBe('0');
    });

    it('applies minWidth: 0 to the precipitation-chance tile Stack and Box with the longest Icelandic label', () => {
        render(
            <ClimateCard
                // precipitationChance=0.6 -> getPrecipitationLabelKey's "heavy" band (>=0.5),
                // rendered as the untranslated key — `climate.rainHeavy` is Icelandic's "Tíð
                // rigning" in the real app, per the work order.
                climate={makeClimate({ precipitationChance: 0.6 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        const precipitationText = screen.getByText('60% · climate.rainHeavy');
        const precipitationBox = precipitationText.closest('div')!;
        const precipitationStack = precipitationBox.parentElement!;

        expect(getComputedStyle(precipitationBox).minWidth).toBe('0');
        expect(getComputedStyle(precipitationStack).minWidth).toBe('0');
    });
});
