import { describe, it, expect } from 'vitest';
import {
  editionStatusForYear,
  shouldNudgeStatusForYear,
  titleSyncForYear,
  referenceDateForYear,
  nthWeekdayOfMonth,
  suggestSeriesLegDates,
  recomputeYearlyWeekdayDate,
} from './eventForms';
import type { ScheduleRule } from '../hooks/useEvents';

// #760: on a brand-new edition, typing a Year nudges Status/RegistrationStatus toward a sensible
// initial value — a past year reads as an already-completed historical edition, a current-or-future
// year reads as a still-hidden draft. This covers only the pure year-bucket decision; the "don't
// re-fire once the admin has manually overridden Status/RegistrationStatus" gating lives alongside
// EventDetailPage's own form state (a ref) and isn't unit-testable at this layer.
describe('editionStatusForYear', () => {
  it('buckets a year earlier than the reference year as Completed/Closed', () => {
    expect(editionStatusForYear(2020, 2026)).toEqual({ status: 'Completed', registrationStatus: 'Closed' });
  });

  it('buckets the reference year itself as Hidden/NotStarted, not Completed', () => {
    expect(editionStatusForYear(2026, 2026)).toEqual({ status: 'Hidden', registrationStatus: 'NotStarted' });
  });

  it('buckets a year later than the reference year as Hidden/NotStarted', () => {
    expect(editionStatusForYear(2030, 2026)).toEqual({ status: 'Hidden', registrationStatus: 'NotStarted' });
  });

  it('defaults the reference year to the current year when not supplied', () => {
    const currentYear = new Date().getFullYear();
    expect(editionStatusForYear(currentYear - 1)).toEqual({ status: 'Completed', registrationStatus: 'Closed' });
    expect(editionStatusForYear(currentYear)).toEqual({ status: 'Hidden', registrationStatus: 'NotStarted' });
    expect(editionStatusForYear(currentYear + 1)).toEqual({ status: 'Hidden', registrationStatus: 'NotStarted' });
  });

  // #797: a negative, zero, or wildly out-of-range year must not bucket into either nudge, or a
  // typo like '-100' would silently nudge Status/RegistrationStatus on a brand-new edition.
  it('returns null for a year outside the sane range, instead of bucketing it', () => {
    expect(editionStatusForYear(-100, 2026)).toBeNull();
    expect(editionStatusForYear(0, 2026)).toBeNull();
    expect(editionStatusForYear(9999, 2026)).toBeNull();
  });
});

// #778/#1068: a cloned edition takes the same "isNew" (create) path as a plain Add, but
// handleCloneEdition deliberately seeds Status/RegistrationStatus itself (Unconfirmed, plus a
// RegistrationStatus derived from the suggested date). The Year nudge must not blindly re-fire and
// clobber that seed the way it does for a plain Add — but correcting a clone's Year to a genuinely
// past year is new information the seed didn't have, and must still land on Completed/Closed
// (#1068); only a still-upcoming (Hidden) bucket keeps suppressing the nudge for a clone. A manual
// Status/RegistrationStatus change must still win regardless of isNew/isClone/bucket, same as before.
describe('shouldNudgeStatusForYear', () => {
  it('fires for a plain new edition that has not been manually touched, regardless of bucket', () => {
    expect(shouldNudgeStatusForYear(true, false, false, 'Hidden')).toBe(true);
    expect(shouldNudgeStatusForYear(true, false, false, 'Completed')).toBe(true);
  });

  it('does not fire for a cloned edition when the corrected year still buckets to Hidden (#778 regression guard)', () => {
    expect(shouldNudgeStatusForYear(true, true, false, 'Hidden')).toBe(false);
  });

  it('fires for a cloned edition when the corrected year buckets to Completed (#1068)', () => {
    expect(shouldNudgeStatusForYear(true, true, false, 'Completed')).toBe(true);
  });

  it('does not fire once the admin has manually touched Status/RegistrationStatus, clone or not, any bucket', () => {
    expect(shouldNudgeStatusForYear(true, false, true, 'Hidden')).toBe(false);
    expect(shouldNudgeStatusForYear(true, false, true, 'Completed')).toBe(false);
    expect(shouldNudgeStatusForYear(true, true, true, 'Hidden')).toBe(false);
    expect(shouldNudgeStatusForYear(true, true, true, 'Completed')).toBe(false);
  });

  it('does not fire for an existing (non-new) edition', () => {
    expect(shouldNudgeStatusForYear(false, false, false, 'Hidden')).toBe(false);
    expect(shouldNudgeStatusForYear(false, true, false, 'Completed')).toBe(false);
  });
});

// #780: the Year field's onChange also auto-syncs Title/titleEn to the typed year, but only while
// the title still looks like it was left at a previous auto-synced value (empty, or a bare
// 4-digit year) — once the admin has typed a real title, a later Year edit must not clobber it.
describe('titleSyncForYear', () => {
  it('syncs when the title is empty and the year is complete', () => {
    expect(titleSyncForYear('2026', '')).toEqual({ title: '2026', titleEn: '2026' });
  });

  it('does not sync when the title is a real, non-year value', () => {
    expect(titleSyncForYear('2026', 'Reykjavik Marathon')).toBeNull();
  });

  it('syncs when the title is still a bare 4-digit year (a previous auto-sync)', () => {
    expect(titleSyncForYear('2027', '2026')).toEqual({ title: '2027', titleEn: '2027' });
  });

  it('does not sync when the year is incomplete or invalid', () => {
    expect(titleSyncForYear('202', '')).toBeNull();
    expect(titleSyncForYear('abcd', '')).toBeNull();
  });

  // #797: '-100' and '0000' are both 4 characters long and parse as non-NaN numbers, so the
  // length/isNaN checks above alone let them through to auto-fill Title/titleEn — a sane range
  // guard is needed to catch these and years like '9999', mirroring referenceDateForYear's guard.
  it('does not sync when the year is outside the sane range, even though it is 4 characters and parses as a number', () => {
    expect(titleSyncForYear('-100', '')).toBeNull();
    expect(titleSyncForYear('0000', '')).toBeNull();
    expect(titleSyncForYear('9999', '')).toBeNull();
  });
});

// #780: drives which month/year the four edition date pickers open on when they have no value of
// their own yet — a not-yet-4-digit or invalid Year leaves their default (today) behaviour
// unchanged, signalled by returning undefined.
describe('referenceDateForYear', () => {
  it('returns a Dayjs anchored to the given year for a complete 4-digit year', () => {
    const result = referenceDateForYear('2030');
    expect(result?.year()).toBe(2030);
  });

  it('returns undefined for an incomplete year', () => {
    expect(referenceDateForYear('202')).toBeUndefined();
  });

  it('returns undefined for a non-numeric year', () => {
    expect(referenceDateForYear('abcd')).toBeUndefined();
  });

  // #781: '-100' and '0000' are both 4 characters long and parse as non-NaN numbers, so the
  // length/isNaN checks above alone let them through to dayjs().year() — a sane range guard is
  // needed to catch these and years like '9999' that are still nonsensical as a race edition.
  it('returns undefined for a negative year, even though it is 4 characters and parses as a number', () => {
    expect(referenceDateForYear('-100')).toBeUndefined();
  });

  it('returns undefined for a zero year', () => {
    expect(referenceDateForYear('0000')).toBeUndefined();
  });

  it('returns undefined for a year outside the sane range', () => {
    expect(referenceDateForYear('9999')).toBeUndefined();
  });
});

// #1251: computes the Nth (or last) occurrence of a weekday in a month/year — the shared date
// math behind a Series' "suggest dates from schedule" button and an Edition's Year-field recompute
// for a Yearly+weekOfMonth event.
describe('nthWeekdayOfMonth', () => {
  it('returns the Nth occurrence of a weekday for a positive weekOfMonth', () => {
    // The 3rd Saturday of August 2026.
    expect(nthWeekdayOfMonth(2026, 8, 3, 'Saturday')).toBe('2026-08-15');
  });

  it('returns the last occurrence of a weekday when weekOfMonth is -1', () => {
    // The last Saturday of August 2026 — not the following month, the bug this issue fixes.
    expect(nthWeekdayOfMonth(2026, 8, -1, 'Saturday')).toBe('2026-08-29');
  });

  it('returns the last occurrence of a weekday when the month\'s last day is itself that weekday', () => {
    // May 31 2026 is itself a Sunday — the "last Sunday" must be that same day, not a week earlier.
    expect(nthWeekdayOfMonth(2026, 5, -1, 'Sunday')).toBe('2026-05-31');
  });

  it('handles a month/year boundary for the last occurrence without crossing into the next month', () => {
    // The last Thursday of February 2024 (a leap year) — Feb 29 2024 is itself a Thursday.
    expect(nthWeekdayOfMonth(2024, 2, -1, 'Thursday')).toBe('2024-02-29');
  });
});

// #1251: relocated from EventDetailPage.tsx unchanged — covers suggestSeriesLegDates' own
// year-rollover handling (it increments month per leg and bumps the year once the counter passes
// December), now unit-testable alongside the nthWeekdayOfMonth fix it depends on.
describe('suggestSeriesLegDates', () => {
  it('rolls over into the next year once the leg month counter passes December', () => {
    const rule: ScheduleRule = { type: 'Seasonal', weekOfMonth: 1, dayOfWeek: 'Monday', monthStart: 11 };
    // 3 legs starting in November 2026: Nov, Dec, then Jan 2027 — the 1st Monday of each month.
    expect(suggestSeriesLegDates(rule, 2026, 3)).toEqual(['2026-11-02', '2026-12-07', '2027-01-04']);
  });

  it('returns an empty array when the rule lacks weekOfMonth/dayOfWeek/monthStart', () => {
    expect(suggestSeriesLegDates({ type: 'Seasonal' }, 2026, 3)).toEqual([]);
  });
});

// #1251: EditionDialogInner's Year field recomputes the Start date from the parent event's
// ScheduleRule when it's Yearly+weekOfMonth+dayOfWeek+month, instead of swapping the year digits
// in the stored date — a swap keeps the old month/day, which lands on the wrong weekday whenever
// the Nth occurrence shifts year to year. Every other rule shape must return null so the caller
// falls back to its existing year-swap behaviour unchanged.
describe('recomputeYearlyWeekdayDate', () => {
  it('recomputes the date for a qualifying Yearly+weekOfMonth+dayOfWeek+month rule', () => {
    const rule: ScheduleRule = { type: 'Yearly', weekOfMonth: 3, dayOfWeek: 'Saturday', month: 8 };
    expect(recomputeYearlyWeekdayDate(rule, 2026)).toBe('2026-08-15');
  });

  it('recomputes the date for weekOfMonth === -1 ("last")', () => {
    const rule: ScheduleRule = { type: 'Yearly', weekOfMonth: -1, dayOfWeek: 'Saturday', month: 8 };
    expect(recomputeYearlyWeekdayDate(rule, 2026)).toBe('2026-08-29');
  });

  it('returns null when there is no ScheduleRule at all', () => {
    expect(recomputeYearlyWeekdayDate(null, 2026)).toBeNull();
    expect(recomputeYearlyWeekdayDate(undefined, 2026)).toBeNull();
  });

  it('returns null for a Fixed rule', () => {
    const rule: ScheduleRule = { type: 'Fixed', date: '2026-08-15' };
    expect(recomputeYearlyWeekdayDate(rule, 2026)).toBeNull();
  });

  it('returns null for a Yearly rule scheduled by dayOfMonth instead of weekOfMonth', () => {
    const rule: ScheduleRule = { type: 'Yearly', dayOfMonth: 31, month: 12 };
    expect(recomputeYearlyWeekdayDate(rule, 2026)).toBeNull();
  });

  it('returns null for a Seasonal rule', () => {
    const rule: ScheduleRule = { type: 'Seasonal', monthStart: 10, monthEnd: 3 };
    expect(recomputeYearlyWeekdayDate(rule, 2026)).toBeNull();
  });

  it('returns null for an Approximate rule', () => {
    const rule: ScheduleRule = { type: 'Approximate', month: 6 };
    expect(recomputeYearlyWeekdayDate(rule, 2026)).toBeNull();
  });
});
