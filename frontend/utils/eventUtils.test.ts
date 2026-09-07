import { describe, it, expect } from 'vitest';
import { formatYearRanges } from './eventUtils';

// #546: the recorded-editions badge must be gap-tolerant — a missing year in the middle of the
// record must stay visible as a gap, never smoothed into a continuous range.
describe('formatYearRanges', () => {
    it('collapses a single consecutive run into a range', () => {
        expect(formatYearRanges([2021, 2022, 2023, 2024, 2025])).toBe('2021–2025');
    });

    it('keeps a gap visible instead of smoothing it into one range', () => {
        expect(formatYearRanges([2018, 2021, 2022, 2023, 2024, 2025])).toBe('2018, 2021–2025');
    });

    it('lists fully non-consecutive years individually', () => {
        expect(formatYearRanges([2018, 2020, 2022])).toBe('2018, 2020, 2022');
    });

    it('renders a single year as itself, not a range', () => {
        expect(formatYearRanges([2020])).toBe('2020');
    });

    it('renders a two-year consecutive pair as a range', () => {
        expect(formatYearRanges([2019, 2020])).toBe('2019–2020');
    });

    it('is tolerant of unsorted, duplicated input', () => {
        expect(formatYearRanges([2023, 2021, 2022, 2021])).toBe('2021–2023');
    });

    it('returns an empty string for no years', () => {
        expect(formatYearRanges([])).toBe('');
    });
});
