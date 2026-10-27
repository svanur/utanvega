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
import { describe, it, expect, afterEach, afterAll, beforeAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import ClimateCard from './ClimateCard';
import { getClimateBackground } from '../utils/getClimateBackground';
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

        // #1461: the "h" unit now comes from t('climate.sunshineUnit') instead of a literal —
        // this test's i18next has no resources, so it renders as the untranslated key.
        const sunshineBox = screen.getByTestId('sunshine-tile');
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

        const precipitationBox = screen.getByTestId('precipitation-tile');
        const precipitationStack = precipitationBox.parentElement!;

        expect(getComputedStyle(precipitationBox).minWidth).toBe('0');
        expect(getComputedStyle(precipitationStack).minWidth).toBe('0');
    });
});

// #1452: getPrecipitationLabelKey and getSunshineLabelKey (ClimateCard.tsx, added by #1450/#1446)
// had no band-boundary coverage of their own — the #1451 minWidth tests above exercise one value
// from each ("moderate" and "heavy"/"high"), but none of the boundary values themselves. Neither
// function is exported, so these assert on the rendered, untranslated i18n key text, same as
// every other private-helper test in this file.
describe('ClimateCard getPrecipitationLabelKey band boundaries (#1452)', () => {
    it('below 0.2 renders climate.rainLight', () => {
        render(
            <ClimateCard
                climate={makeClimate({ precipitationChance: 0.1 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('10% · climate.rainLight')).toBeTruthy();
    });

    it('at exactly 0.2 renders climate.rainModerate', () => {
        render(
            <ClimateCard
                climate={makeClimate({ precipitationChance: 0.2 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('20% · climate.rainModerate')).toBeTruthy();
    });

    it('between 0.2 and 0.5 renders climate.rainModerate', () => {
        render(
            <ClimateCard
                climate={makeClimate({ precipitationChance: 0.35 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('35% · climate.rainModerate')).toBeTruthy();
    });

    it('at exactly 0.5 renders climate.rainHeavy', () => {
        render(
            <ClimateCard
                climate={makeClimate({ precipitationChance: 0.5 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('50% · climate.rainHeavy')).toBeTruthy();
    });

    it('above 0.5 renders climate.rainHeavy', () => {
        render(
            <ClimateCard
                climate={makeClimate({ precipitationChance: 0.75 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('75% · climate.rainHeavy')).toBeTruthy();
    });
});

describe('ClimateCard getSunshineLabelKey band boundaries (#1452)', () => {
    it('below 4 renders climate.sunshineLow', () => {
        render(
            <ClimateCard
                climate={makeClimate({ averageSunshineHours: 3.9 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('3.9 climate.sunshineUnit · climate.sunshineLow')).toBeTruthy();
    });

    it('at exactly 4 renders climate.sunshineModerate', () => {
        render(
            <ClimateCard
                climate={makeClimate({ averageSunshineHours: 4 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('4.0 climate.sunshineUnit · climate.sunshineModerate')).toBeTruthy();
    });

    it('between 4 and 8 renders climate.sunshineModerate', () => {
        render(
            <ClimateCard
                climate={makeClimate({ averageSunshineHours: 6 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('6.0 climate.sunshineUnit · climate.sunshineModerate')).toBeTruthy();
    });

    it('at exactly 8 renders climate.sunshineHigh', () => {
        render(
            <ClimateCard
                climate={makeClimate({ averageSunshineHours: 8 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('8.0 climate.sunshineUnit · climate.sunshineHigh')).toBeTruthy();
    });

    it('above 8 renders climate.sunshineHigh', () => {
        render(
            <ClimateCard
                climate={makeClimate({ averageSunshineHours: 9.2 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('9.2 climate.sunshineUnit · climate.sunshineHigh')).toBeTruthy();
    });

    // Render-level check that the "Avg. sunshine" tile itself (the caption below the value line
    // above, not the band label) renders for a given averageSunshineHours fixture — distinct from
    // the band-key assertions above, which only cover the value line's text.
    it('renders the Avg. sunshine caption for a given averageSunshineHours fixture', () => {
        render(
            <ClimateCard
                climate={makeClimate({ averageSunshineHours: 6 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('climate.avgSunshine')).toBeTruthy();
    });
});

// #1418: the approximateLocation caption ("Áætlað gildi fyrir stórt svæði" in Icelandic — 30
// chars) had `noWrap`, so at a 375px viewport the Location tile (half the card's width there,
// per the grid's `xs: repeat(2, 1fr)`) clipped it with an ellipsis and no tooltip to recover the
// full text. Dropping `noWrap` lets it wrap to a second line instead of truncating.
describe('ClimateCard approximateLocation caption does not truncate (#1418)', () => {
    it('renders the Icelandic approximateLocation caption without noWrap when isApproximate is true', () => {
        render(
            <ClimateCard
                climate={makeClimate({ isApproximate: true })}
                loading={false}
                error={null}
                locationName="Vestfirðir"
            />
        );

        // i18next has no resources loaded in this test, so the caption renders as its
        // untranslated key — "climate.approximateLocation" is "Áætlað gildi fyrir stórt svæði"
        // in the real app (frontend/i18n/is.json). The untranslated key is long enough on its
        // own to exercise the same noWrap/wrap behavior being asserted here.
        const caption = screen.getByText('climate.approximateLocation');
        expect(caption.className).not.toContain('MuiTypography-noWrap');
    });
});

// #1454: getClimateBackground (added by #1453/#1448, originally a private helper inside
// ClimateCard.tsx) had no direct test. Split into utils/getClimateBackground.ts (same pattern as
// getActivityIcon.tsx/contactEmail.ts — a component file that also exports a plain function trips
// react-refresh/only-export-components) so these can call it directly and assert the exact
// { light, dark } gradient pair per bucket, rather than inferring the bucket indirectly through a
// rendered Paper's backgroundImage style. Mirrors getClimateIcon's own bucket order and thresholds
// exactly, so each case below pins both the bucket choice and the literal gradient strings against
// drift.
describe('ClimateCard getClimateBackground buckets (#1454)', () => {
    it('returns the snow (pale blue) pair when averageLow <= 0 and precipitationChance >= 0.3', () => {
        const result = getClimateBackground(makeClimate({ averageLow: -2, precipitationChance: 0.4 }));

        expect(result).toEqual({
            light: 'linear-gradient(135deg, rgba(187, 222, 251, 0.45) 0%, rgba(187, 222, 251, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(100, 181, 246, 0.16) 0%, rgba(100, 181, 246, 0) 100%)',
        });
    });

    it('returns the snow pair at the averageLow === 0 boundary (still <= 0)', () => {
        const result = getClimateBackground(makeClimate({ averageLow: 0, precipitationChance: 0.3 }));

        expect(result).toEqual({
            light: 'linear-gradient(135deg, rgba(187, 222, 251, 0.45) 0%, rgba(187, 222, 251, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(100, 181, 246, 0.16) 0%, rgba(100, 181, 246, 0) 100%)',
        });
    });

    it('returns the heavy rain (slate blue) pair when precipitationChance >= 0.5', () => {
        const result = getClimateBackground(makeClimate({ averageLow: 5, precipitationChance: 0.75 }));

        expect(result).toEqual({
            light: 'linear-gradient(135deg, rgba(144, 164, 174, 0.4) 0%, rgba(144, 164, 174, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(120, 144, 156, 0.18) 0%, rgba(120, 144, 156, 0) 100%)',
        });
    });

    it('returns the heavy rain pair at the precipitationChance === 0.5 boundary', () => {
        // averageLow is above 0, so the snow bucket's earlier check can't shadow this boundary.
        const result = getClimateBackground(makeClimate({ averageLow: 5, precipitationChance: 0.5 }));

        expect(result).toEqual({
            light: 'linear-gradient(135deg, rgba(144, 164, 174, 0.4) 0%, rgba(144, 164, 174, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(120, 144, 156, 0.18) 0%, rgba(120, 144, 156, 0) 100%)',
        });
    });

    it('returns the showers (light blue) pair when precipitationChance >= 0.2', () => {
        const result = getClimateBackground(makeClimate({ averageLow: 5, precipitationChance: 0.35 }));

        expect(result).toEqual({
            light: 'linear-gradient(135deg, rgba(179, 229, 252, 0.4) 0%, rgba(179, 229, 252, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(79, 195, 247, 0.14) 0%, rgba(79, 195, 247, 0) 100%)',
        });
    });

    it('returns the showers pair at the precipitationChance === 0.2 boundary', () => {
        const result = getClimateBackground(makeClimate({ averageLow: 5, precipitationChance: 0.2 }));

        expect(result).toEqual({
            light: 'linear-gradient(135deg, rgba(179, 229, 252, 0.4) 0%, rgba(179, 229, 252, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(79, 195, 247, 0.14) 0%, rgba(79, 195, 247, 0) 100%)',
        });
    });

    it('returns the sunny (warm yellow) pair when precipitationChance < 0.2 and averageHigh >= 15', () => {
        const result = getClimateBackground(makeClimate({ averageLow: 5, precipitationChance: 0.1, averageHigh: 20 }));

        expect(result).toEqual({
            light: 'linear-gradient(135deg, rgba(255, 224, 130, 0.4) 0%, rgba(255, 224, 130, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(255, 183, 77, 0.14) 0%, rgba(255, 183, 77, 0) 100%)',
        });
    });

    it('returns the sunny pair at the averageHigh === 15 boundary', () => {
        const result = getClimateBackground(makeClimate({ averageLow: 5, precipitationChance: 0.1, averageHigh: 15 }));

        expect(result).toEqual({
            light: 'linear-gradient(135deg, rgba(255, 224, 130, 0.4) 0%, rgba(255, 224, 130, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(255, 183, 77, 0.14) 0%, rgba(255, 183, 77, 0) 100%)',
        });
    });

    it('returns the cloudy (neutral grey) pair when none of the above thresholds are met', () => {
        const result = getClimateBackground(makeClimate({ averageLow: 5, precipitationChance: 0.1, averageHigh: 14 }));

        expect(result).toEqual({
            light: 'linear-gradient(135deg, rgba(207, 216, 220, 0.4) 0%, rgba(207, 216, 220, 0) 100%)',
            dark: 'linear-gradient(135deg, rgba(144, 164, 174, 0.14) 0%, rgba(144, 164, 174, 0) 100%)',
        });
    });
});

// #1470: every other describe block above renders under the file-level `lng: 'en'` instance
// (beforeAll at the top of this file), so formatDecimal's Icelandic (comma) branch — exercised
// via i18n.language at ClimateCard.tsx:160/205/216/238 — had no automated coverage, only the
// manual spot-check noted in #1461/#1469's review. Switches the shared i18next instance to 'is'
// for this block only, then restores 'en' in afterAll so every other describe block in this file
// keeps running under its original English default.
describe('ClimateCard renders Icelandic comma decimals (#1470)', () => {
    beforeAll(async () => {
        await i18next.changeLanguage('is');
    });

    afterAll(async () => {
        await i18next.changeLanguage('en');
    });

    it('formats the sunshine-hours value with a comma decimal separator under i18n.language "is"', () => {
        render(
            <ClimateCard
                // averageSunshineHours=6 -> formatDecimal(6, 'is') -> "6,0" (Intl.NumberFormat's
                // Icelandic comma separator) and getSunshineLabelKey's "moderate" band (>=4, <8).
                // i18next has no 'is' resources loaded, so the band label still renders as its
                // untranslated key, same convention as every other case in this file.
                climate={makeClimate({ averageSunshineHours: 6 })}
                loading={false}
                error={null}
                locationName="Reykjavík"
            />
        );

        expect(screen.getByText('6,0 climate.sunshineUnit · climate.sunshineModerate')).toBeTruthy();
    });
});
