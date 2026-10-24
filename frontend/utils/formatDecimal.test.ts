import { describe, it, expect } from 'vitest';
import { formatDecimal } from './formatDecimal';

// #1472: formatDecimal had no colocated test, unlike every other non-trivial util here (see
// calendarLinks.test.ts). Direct coverage guards the Icelandic comma-separator branch, which
// component tests exercising ClimateCard/WeatherCard don't reliably hit.
describe('formatDecimal', () => {
    it('uses a period decimal separator for English', () => {
        expect(formatDecimal(12.3, 'en')).toBe('12.3');
    });

    it('uses a period decimal separator for en-US', () => {
        expect(formatDecimal(12.3, 'en-US')).toBe('12.3');
    });

    it('uses a comma decimal separator for Icelandic', () => {
        expect(formatDecimal(12.3, 'is')).toBe('12,3');
    });

    it('uses a comma decimal separator for is-IS', () => {
        expect(formatDecimal(12.3, 'is-IS')).toBe('12,3');
    });

    it('defaults to 1 fraction digit when fractionDigits is omitted', () => {
        expect(formatDecimal(5, 'en')).toBe('5.0');
    });

    it('respects an explicit fractionDigits override', () => {
        expect(formatDecimal(5, 'en', 2)).toBe('5.00');
        expect(formatDecimal(1.2345, 'is', 3)).toBe('1,235');
    });
});
