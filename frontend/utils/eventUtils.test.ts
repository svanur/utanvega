import { describe, it, expect } from 'vitest';
import { addDays, formatYearRanges, getEditionTimingStatus, getWeekRange, msUntilNextMidnight, shortestUniqueEditionKey } from './eventUtils';

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

// #843: addDays and getWeekRange were previously local, unexported helpers duplicated between
// RacesPage.tsx and eventUtils.ts (toDateOnlyString) — moved here so they're shared and tested.
describe('addDays', () => {
    it('crosses a month boundary', () => {
        const result = addDays(new Date('2026-01-28T00:00:00'), 5);
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(1); // February
        expect(result.getDate()).toBe(2);
    });

    it('crosses a year boundary', () => {
        const result = addDays(new Date('2025-12-29T00:00:00'), 5);
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(0); // January
        expect(result.getDate()).toBe(3);
    });
});

// #783: shortestUniqueEditionKey shortens the /history/:editionKey URL to the year alone when
// that's unambiguous among sibling editions of the same event, only falling back to the full date
// (and then the id) as needed to stay unique — same-year and even same-date collisions are legal
// (EventEdition.Year/Date have no unique constraint), so uniqueness must be checked, not assumed.
describe('shortestUniqueEditionKey', () => {
    it('prefers the year when no sibling shares it, even if the edition has an exact date', () => {
        const edition = { id: 'a', date: '2025-06-14', year: 2025 };
        const siblings = [edition, { id: 'b', date: '2024-06-15', year: 2024 }];
        expect(shortestUniqueEditionKey(edition, siblings)).toBe('2025');
    });

    it('falls back to the full date when a sibling shares the year but not the date', () => {
        const edition = { id: 'a', date: '2025-06-14', year: 2025 };
        const siblings = [edition, { id: 'b', date: '2025-09-20', year: 2025 }];
        expect(shortestUniqueEditionKey(edition, siblings)).toBe('2025-06-14');
    });

    it('falls back to the id when siblings share both year and date', () => {
        const edition = { id: 'a', date: '2025-06-14', year: 2025 };
        const siblings = [edition, { id: 'b', date: '2025-06-14', year: 2025 }];
        expect(shortestUniqueEditionKey(edition, siblings)).toBe('a');
    });

    it('falls back to the id when the edition has neither date nor year', () => {
        const edition = { id: 'a', date: null, year: null };
        const siblings = [edition, { id: 'b', date: null, year: null }];
        expect(shortestUniqueEditionKey(edition, siblings)).toBe('a');
    });

    it('treats a single-edition series (one edition per season) as unambiguous — year-only', () => {
        const edition = { id: 'a', date: '2025-06-14', year: 2025 };
        expect(shortestUniqueEditionKey(edition, [edition])).toBe('2025');
    });
});

// #855: getWeekRange takes an injectable `now`, matching the other functions in this file, so
// "today" is passed directly as an argument rather than pinned with fake timers.
describe('getWeekRange', () => {
    it('"this" week returns Monday start / Sunday end six days later, for a Tue "now"', () => {
        const now = new Date('2026-03-10T09:00:00'); // Tuesday
        expect(getWeekRange('this', now)).toEqual({ start: '2026-03-09', end: '2026-03-15' });
    });

    it('"this" week returns the same Monday start / Sunday end for a Sat "now" in the same week', () => {
        const now = new Date('2026-03-14T09:00:00'); // Saturday
        expect(getWeekRange('this', now)).toEqual({ start: '2026-03-09', end: '2026-03-15' });
    });

    it('"next" week returns the Monday immediately after the current week\'s Sunday', () => {
        const now = new Date('2026-03-10T09:00:00'); // Tuesday, this week ends Sun 2026-03-15
        expect(getWeekRange('next', now)).toEqual({ start: '2026-03-16', end: '2026-03-22' });
    });

    it('boundary: "now" is a Sunday — "this" week starts the preceding Monday and ends today', () => {
        const now = new Date('2026-03-15T09:00:00'); // Sunday
        expect(getWeekRange('this', now)).toEqual({ start: '2026-03-09', end: '2026-03-15' });
        expect(getWeekRange('next', now)).toEqual({ start: '2026-03-16', end: '2026-03-22' });
    });

    it('boundary: "now" is a Monday — "this" week starts today', () => {
        const now = new Date('2026-03-16T09:00:00'); // Monday
        expect(getWeekRange('this', now)).toEqual({ start: '2026-03-16', end: '2026-03-22' });
        expect(getWeekRange('next', now)).toEqual({ start: '2026-03-23', end: '2026-03-29' });
    });
});
