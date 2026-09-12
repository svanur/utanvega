import { describe, it, expect } from 'vitest';
import { editionStatusForYear, shouldNudgeStatusForYear } from './eventForms';

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
