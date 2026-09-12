import { describe, it, expect } from 'vitest';
import { editionStatusForYear, shouldNudgeStatusForYear, titleSyncForYear, referenceDateForYear } from './eventForms';

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
});

// #778: a cloned edition takes the same "isNew" (create) path as a plain Add, but
// handleCloneEdition deliberately seeds Status/RegistrationStatus itself (Unconfirmed, plus a
// RegistrationStatus derived from the suggested date), so the Year nudge must not re-fire and
// clobber that seed the way it does for a plain Add — while a manual Status/RegistrationStatus
// change must still win regardless of isNew/isClone, same as before.
describe('shouldNudgeStatusForYear', () => {
  it('fires for a plain new edition that has not been manually touched', () => {
    expect(shouldNudgeStatusForYear(true, false, false)).toBe(true);
  });

  it('does not fire for a cloned edition, even though isNew is also true', () => {
    expect(shouldNudgeStatusForYear(true, true, false)).toBe(false);
  });

  it('does not fire once the admin has manually touched Status/RegistrationStatus, clone or not', () => {
    expect(shouldNudgeStatusForYear(true, false, true)).toBe(false);
    expect(shouldNudgeStatusForYear(true, true, true)).toBe(false);
  });

  it('does not fire for an existing (non-new) edition', () => {
    expect(shouldNudgeStatusForYear(false, false, false)).toBe(false);
    expect(shouldNudgeStatusForYear(false, true, false)).toBe(false);
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
