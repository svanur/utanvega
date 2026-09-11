import { describe, it, expect } from 'vitest';
import { matchesYearMonthFilter, type YearMonthFilterable } from './eventHelpers';

// #734: the Month <Select> on the events list is disabled whenever yearFilter === 'all', and
// the Year <Select>'s onChange resets monthFilter back to 'all' the moment Year changes — so
// click-through can never produce "Month set, Year = 'all'". A hand-edited/bookmarked URL
// (e.g. ?monthFilter=09 with no yearFilter) can still reach that state, and monthFilter must be
// inert there rather than silently narrowing to "this month, any year".
describe('matchesYearMonthFilter', () => {
    const event = (nextEditionDate: string | null, hasFutureEdition = true): YearMonthFilterable => ({
        hasFutureEdition,
        nextEditionDate,
    });

    it('is unaffected by monthFilter when yearFilter is "all" (bare ?monthFilter=09)', () => {
        const e = event('2026-09-15');
        expect(matchesYearMonthFilter(e, 'all', '09')).toBe(matchesYearMonthFilter(e, 'all', 'all'));
        expect(matchesYearMonthFilter(e, 'all', '09')).toBe(true);
    });

    it('produces identical results for every month value once yearFilter is "all"', () => {
        const septemberEvent = event('2026-09-15');
        const januaryEvent = event('2027-01-05');
        for (const e of [septemberEvent, januaryEvent]) {
            expect(matchesYearMonthFilter(e, 'all', '09')).toBe(matchesYearMonthFilter(e, 'all', 'all'));
        }
    });

    it('filters by year and month together once a specific year is set', () => {
        expect(matchesYearMonthFilter(event('2026-09-15'), '2026', '09')).toBe(true);
        expect(matchesYearMonthFilter(event('2026-09-15'), '2026', '10')).toBe(false);
        expect(matchesYearMonthFilter(event('2026-09-15'), '2027', '09')).toBe(false);
    });

    it('filters by year alone when monthFilter is "all"', () => {
        expect(matchesYearMonthFilter(event('2026-09-15'), '2026', 'all')).toBe(true);
        expect(matchesYearMonthFilter(event('2027-01-15'), '2026', 'all')).toBe(false);
    });

    it('always matches events without a future edition, regardless of year/month filters', () => {
        const e = event(null, false);
        expect(matchesYearMonthFilter(e, '2026', '09')).toBe(true);
        expect(matchesYearMonthFilter(e, 'all', 'all')).toBe(true);
    });
});
