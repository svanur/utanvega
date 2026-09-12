import { describe, it, expect } from 'vitest';
import { formatYearRanges, getEditionTimingStatus, msUntilNextMidnight } from './eventUtils';

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

// #711: getEditionTimingStatus drives the timing chip on EditionHistoryPage — the comparison must
// be date-only (calendar dates), never sensitive to the time of day passed in `now`.
describe('getEditionTimingStatus', () => {
    it('returns "past" for a single-day edition dated before today', () => {
        const now = new Date('2026-03-15T00:00:00');
        expect(getEditionTimingStatus('2026-03-10', undefined, now)).toBe('past');
    });

    it('returns "ongoing" for a single-day edition dated today', () => {
        const now = new Date('2026-03-15T00:00:00');
        expect(getEditionTimingStatus('2026-03-15', undefined, now)).toBe('ongoing');
    });

    it('returns "upcoming" for a single-day edition dated after today', () => {
        const now = new Date('2026-03-15T00:00:00');
        expect(getEditionTimingStatus('2026-03-20', undefined, now)).toBe('upcoming');
    });

    it('returns "ongoing" for a multi-day edition where today falls within [date, endDate]', () => {
        const now = new Date('2026-03-16T00:00:00');
        expect(getEditionTimingStatus('2026-03-14', '2026-03-18', now)).toBe('ongoing');
    });

    it('returns "upcoming" for a multi-day edition where today is before date', () => {
        const now = new Date('2026-03-10T00:00:00');
        expect(getEditionTimingStatus('2026-03-14', '2026-03-18', now)).toBe('upcoming');
    });

    it('returns "past" for a multi-day edition where today is after endDate', () => {
        const now = new Date('2026-03-20T00:00:00');
        expect(getEditionTimingStatus('2026-03-14', '2026-03-18', now)).toBe('past');
    });

    it('returns null when date is null or undefined', () => {
        expect(getEditionTimingStatus(null, undefined, new Date('2026-03-15T00:00:00'))).toBeNull();
        expect(getEditionTimingStatus(undefined, undefined, new Date('2026-03-15T00:00:00'))).toBeNull();
    });

    it('compares dates only, ignoring time of day — a late "now" on edition day is still "ongoing"', () => {
        const now = new Date('2026-03-15T23:59:59');
        expect(getEditionTimingStatus('2026-03-15', undefined, now)).toBe('ongoing');
    });
});

// #759: extracted from EditionHistoryPage's midnight-scheduling useEffect so the boundary math
// (an exact-midnight `now` must still yield a full 24h, not 0) is unit-testable.
describe('msUntilNextMidnight', () => {
    it('returns a small positive value for a "now" just before midnight', () => {
        const now = new Date('2026-03-15T23:59:59.500');
        expect(msUntilNextMidnight(now)).toBe(500);
    });

    it('returns a full 24h when "now" is exactly midnight', () => {
        const now = new Date('2026-03-15T00:00:00.000');
        expect(msUntilNextMidnight(now)).toBe(86400000);
    });

    it('returns the remaining ms in the day for a "now" mid-day', () => {
        const now = new Date('2026-03-15T12:00:00.000');
        expect(msUntilNextMidnight(now)).toBe(12 * 60 * 60 * 1000);
    });
});
