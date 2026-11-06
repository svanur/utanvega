// @vitest-environment jsdom
//
// #1670: WeatherCard's raceDate prop (and the DailyForecast isRaceDay highlight it drives,
// WeatherCard.tsx:229/274-276) had no direct test of its own — it's exercised in the real app only
// through CompetitionDetailPage's new live-forecast swap, which mocks WeatherCard out entirely
// (see CompetitionDetailPage.test.tsx's "live forecast swap" suite), so the wiring itself was never
// proven end-to-end. Follows ClimateCard.test.tsx's bare-i18next-instance pattern (no react-i18next
// resources, assertions on untranslated keys) since this only asserts on raceDate-driven structure,
// never on translated copy.
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import WeatherCard from './WeatherCard';
import type { TrailWeather, WeatherPointDto, DailyForecastDto } from '../hooks/useTrails';

afterEach(cleanup);

beforeAll(() => {
    i18next.use(initReactI18next).init({
        lng: 'en',
        resources: { en: { translation: {} } },
        returnEmptyString: false,
        interpolation: { escapeValue: false },
    });
});

function makePoint(overrides: Partial<WeatherPointDto> = {}): WeatherPointDto {
    return {
        latitude: 64.25,
        longitude: -21.13,
        elevation: 50,
        temperature: 8,
        apparentTemperature: 6,
        windSpeed: 4,
        windGusts: 7,
        precipitation: 0,
        weatherCode: 1,
        cloudCover: 30,
        label: 'Trailhead',
        ...overrides,
    };
}

function makeDaily(overrides: Partial<DailyForecastDto> = {}): DailyForecastDto {
    return {
        date: '2026-11-10',
        temperatureMax: 9,
        temperatureMin: 3,
        precipitationSum: 0,
        windSpeedMax: 6,
        windGustsMax: 10,
        weatherCode: 1,
        ...overrides,
    };
}

function makeWeather(daily: DailyForecastDto[]): TrailWeather {
    return {
        current: makePoint(),
        hourly: [],
        daily,
        summit: null,
        condition: 'Good',
    };
}

// Expands the collapsed card by clicking its header — DailyForecast only renders inside the
// Collapse (WeatherCard.tsx:356/383), same as a real user tapping the card open.
function expand() {
    fireEvent.click(screen.getByText('weather.title'));
}

describe('WeatherCard raceDate / isRaceDay highlight (#1670)', () => {
    it('highlights the daily forecast entry whose date matches raceDate with the race-day Chip', () => {
        const daily = [
            makeDaily({ date: '2026-11-09' }),
            makeDaily({ date: '2026-11-10' }),
            makeDaily({ date: '2026-11-11' }),
        ];

        render(
            <WeatherCard
                weather={makeWeather(daily)}
                loading={false}
                error={null}
                raceDate="2026-11-10"
            />
        );
        expand();

        // Untranslated i18n key, same convention as ClimateCard.test.tsx — the emoji prefix plus
        // the key is the Chip's literal label (WeatherCard.tsx:275).
        expect(screen.getByText('🏁 weather.raceDay')).toBeTruthy();
    });

    it('renders no race-day Chip when raceDate falls outside the returned forecast range', () => {
        const daily = [
            makeDaily({ date: '2026-11-09' }),
            makeDaily({ date: '2026-11-10' }),
        ];

        render(
            <WeatherCard
                weather={makeWeather(daily)}
                loading={false}
                error={null}
                raceDate="2026-11-20"
            />
        );
        expand();

        expect(screen.queryByText('🏁 weather.raceDay')).toBeNull();
    });

    it('renders no race-day Chip when raceDate is null', () => {
        const daily = [makeDaily({ date: '2026-11-09' })];

        render(
            <WeatherCard
                weather={makeWeather(daily)}
                loading={false}
                error={null}
                raceDate={null}
            />
        );
        expand();

        expect(screen.queryByText('🏁 weather.raceDay')).toBeNull();
    });
});
