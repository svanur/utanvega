import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { matchesYearMonthFilter, nextWeekMondayOffset, formatAgendaHeader, type YearMonthFilterable } from './eventHelpers';

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

// #836: plain `(8 - today.day()) % 7` gives 0 (not 7) when today is already Monday, which would
// resolve "next week" to today rather than 7 days out — the `|| 7` fallback is the fix, and the
// Sunday case below (day() === 0: (8-0)%7 === 1) is the one that already worked without it.
describe('nextWeekMondayOffset', () => {
  // 2026-09-06 is a Sunday, so today.add(i, 'day') walks through all 7 weekdays in order.
  const sunday = dayjs('2026-09-06');

  it('returns a value in 1–7 (never 0 or negative) for every weekday, landing on the following Monday', () => {
    for (let i = 0; i < 7; i++) {
      const today = sunday.add(i, 'day');
      const offset = nextWeekMondayOffset(today);
      expect(offset).toBeGreaterThanOrEqual(1);
      expect(offset).toBeLessThanOrEqual(7);
      expect(today.add(offset, 'day').day()).toBe(1); // Monday
    }
  });

  it('returns 7 (not 0) when today is already Monday', () => {
    const monday = sunday.add(1, 'day');
    expect(monday.day()).toBe(1);
    expect(nextWeekMondayOffset(monday)).toBe(7);
  });
});

describe('formatAgendaHeader', () => {
  it('formats a range within a single month with the month/year stated once', () => {
    const start = dayjs('2026-09-13');
    const end = dayjs('2026-09-20');
    expect(formatAgendaHeader(start, end)).toBe('13. – 20. september 2026');
  });

  it('formats a range spanning a month boundary with both month names', () => {
    const start = dayjs('2026-11-30');
    const end = dayjs('2026-12-06');
    expect(formatAgendaHeader(start, end)).toBe('30. nóvember – 6. desember 2026');
  });

  it('formats a range spanning a year boundary (Dec → Jan) with the end year', () => {
    const start = dayjs('2026-12-29');
    const end = dayjs('2027-01-04');
    expect(formatAgendaHeader(start, end)).toBe('29. desember – 4. janúar 2027');
  });
});
