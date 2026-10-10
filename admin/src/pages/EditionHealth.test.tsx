import { describe, expect, it } from 'vitest';
import { getRaceChecks } from './EditionHealth';
import type { EventEditionDto, RaceDto } from '../hooks/useEvents';

// #1069: getRaceChecks's new 'Year' check is the gap that let #1068's bug (a race landing two
// years off its edition) score 100% healthy — getRaceChecks never read edition.year at all. This
// exercises the pure check-generation logic directly (construct RaceDto/EventEditionDto fixtures,
// assert on the returned HealthCheck[]) rather than rendering the component, since the new logic
// is entirely pure functions with no DOM/query dependency of its own.

function makeRace(overrides: Partial<RaceDto> = {}): RaceDto {
  return {
    id: 'race-1',
    eventEditionId: 'edition-1',
    trailId: 'trail-1',
    trailName: 'Some Trail',
    trailSlug: 'some-trail',
    name: 'Race',
    nameEn: null,
    distanceLabel: '10K',
    distanceLabelEn: null,
    cutoffMinutes: null,
    description: null,
    descriptionEn: null,
    status: 'Active',
    sortOrder: 0,
    ticketStatus: 'Available',
    resultType: 'Time',
    maxParticipants: null,
    itraPoints: null,
    certifiedBy: null,
    certifiedByEn: null,
    prizeMoney: 0,
    championshipCategory: null,
    championshipCategoryEn: null,
    dateOfRace: '2024-06-01',
    startTime: '10:00',
    trailDistanceMeters: null,
    trailElevationGain: null,
    activityType: null,
    ...overrides,
  };
}

function makeEdition(overrides: Partial<EventEditionDto> = {}, races: RaceDto[] = []): EventEditionDto {
  return {
    id: 'edition-1',
    eventId: 'event-1',
    year: 2024,
    date: '2024-06-01',
    endDate: null,
    title: null,
    titleEn: null,
    registrationUrl: null,
    resultsUrl: null,
    notes: null,
    notesEn: null,
    registrationStatus: 'NotRequired',
    registrationOpens: null,
    registrationCloses: null,
    trailId: null,
    trailName: null,
    trailSlug: null,
    races,
    galleries: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    status: 'Active',
    effectiveCancelled: false,
    needsReview: false,
    ...overrides,
  };
}

function yearCheck(checks: ReturnType<typeof getRaceChecks>) {
  return checks.find(c => c.label === 'Year');
}

describe('getRaceChecks — Year check (Non-Series)', () => {
  it('fails when the race year does not match the edition year', () => {
    const race = makeRace({ dateOfRace: '2025-06-01' });
    const edition = makeEdition({ year: 2023 }, [race]);

    const check = yearCheck(getRaceChecks(race, edition, false));

    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.tooltip).toContain('2025');
    expect(check!.tooltip).toContain('2023');
  });

  it('passes when every race year matches the edition year (regression guard)', () => {
    const race = makeRace({ dateOfRace: '2023-06-01' });
    const edition = makeEdition({ year: 2023 }, [race]);

    const check = yearCheck(getRaceChecks(race, edition, false));

    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  it('omits the check entirely when the edition has no year (not enough data to judge)', () => {
    const race = makeRace({ dateOfRace: '2025-06-01' });
    const edition = makeEdition({ year: null }, [race]);

    expect(yearCheck(getRaceChecks(race, edition, false))).toBeUndefined();
  });

  it('passes (does not fail) a race with no date of its own — already covered by the Date check', () => {
    const race = makeRace({ dateOfRace: null });
    const edition = makeEdition({ year: 2023 }, [race]);

    const check = yearCheck(getRaceChecks(race, edition, false));

    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });
});

describe('getRaceChecks — Year check (Series)', () => {
  it('flags a race far from the group median while siblings still pass', () => {
    const close1 = makeRace({ id: 'r1', dateOfRace: '2024-01-15' });
    const close2 = makeRace({ id: 'r2', dateOfRace: '2024-02-01' });
    const farOutlier = makeRace({ id: 'r3', dateOfRace: '2025-06-01' });
    const edition = makeEdition({ year: null }, [close1, close2, farOutlier]);

    const farCheck = yearCheck(getRaceChecks(farOutlier, edition, true));
    const close1Check = yearCheck(getRaceChecks(close1, edition, true));
    const close2Check = yearCheck(getRaceChecks(close2, edition, true));

    expect(farCheck).toBeDefined();
    expect(farCheck!.passed).toBe(false);
    expect(close1Check!.passed).toBe(true);
    expect(close2Check!.passed).toBe(true);
  });

  it('passes every race when the whole group is clustered together', () => {
    const r1 = makeRace({ id: 'r1', dateOfRace: '2024-01-10' });
    const r2 = makeRace({ id: 'r2', dateOfRace: '2024-01-20' });
    const r3 = makeRace({ id: 'r3', dateOfRace: '2024-02-01' });
    const edition = makeEdition({ year: null }, [r1, r2, r3]);

    for (const r of [r1, r2, r3]) {
      expect(yearCheck(getRaceChecks(r, edition, true))!.passed).toBe(true);
    }
  });

  it('omits the check (not force-passed) when fewer than two races in the edition have a date', () => {
    const onlyDated = makeRace({ id: 'r1', dateOfRace: '2024-01-10' });
    const edition = makeEdition({ year: null }, [onlyDated]);

    expect(yearCheck(getRaceChecks(onlyDated, edition, true))).toBeUndefined();
  });

  it('excludes a null-dateOfRace race both from being flagged and from the sibling/median calculation', () => {
    const undated = makeRace({ id: 'r1', dateOfRace: null });
    const r2 = makeRace({ id: 'r2', dateOfRace: '2024-01-15' });
    const r3 = makeRace({ id: 'r3', dateOfRace: '2024-02-01' });
    const edition = makeEdition({ year: null }, [undated, r2, r3]);

    // Not flagged itself — the check is omitted, not force-passed or failed.
    expect(yearCheck(getRaceChecks(undated, edition, true))).toBeUndefined();

    // Still judged against each other, undated sibling excluded from the median — both pass.
    expect(yearCheck(getRaceChecks(r2, edition, true))!.passed).toBe(true);
    expect(yearCheck(getRaceChecks(r3, edition, true))!.passed).toBe(true);
  });

  it('omits the check when the only other dated sibling is excluded, leaving fewer than two dated races', () => {
    const undated = makeRace({ id: 'r1', dateOfRace: null });
    const onlyDated = makeRace({ id: 'r2', dateOfRace: '2024-01-15' });
    const edition = makeEdition({ year: null }, [undated, onlyDated]);

    expect(yearCheck(getRaceChecks(onlyDated, edition, true))).toBeUndefined();
  });

  // #1069 review round 1: with exactly two dated races (the minimum needed to activate this
  // check), computing the median *including* the race being checked pulls the median toward
  // itself — the median of a two-value set is their midpoint, so each race measured only half
  // its actual separation from "the median", and a pair dated a full year apart (#1068's exact
  // bug shape, ~365 days each way) landed inside the 396-day tolerance and passed undetected on
  // both races. getRaceYearCheck now excludes the race itself from the sibling set it's compared
  // against, so with only one other dated race the "median" is simply that race's own date and
  // the full gap is measured.
  it('flags both races in the minimum two-dated-race case when they are two years apart (#1068 shape)', () => {
    const raceA = makeRace({ id: 'r1', dateOfRace: '2023-06-01' });
    const raceB = makeRace({ id: 'r2', dateOfRace: '2025-06-01' });
    const edition = makeEdition({ year: null }, [raceA, raceB]);

    const checkA = yearCheck(getRaceChecks(raceA, edition, true));
    const checkB = yearCheck(getRaceChecks(raceB, edition, true));

    expect(checkA).toBeDefined();
    expect(checkB).toBeDefined();
    expect(checkA!.passed).toBe(false);
    expect(checkB!.passed).toBe(false);
  });

  it('passes both races in the minimum two-dated-race case when they are close together', () => {
    const raceA = makeRace({ id: 'r1', dateOfRace: '2024-01-15' });
    const raceB = makeRace({ id: 'r2', dateOfRace: '2024-02-01' });
    const edition = makeEdition({ year: null }, [raceA, raceB]);

    expect(yearCheck(getRaceChecks(raceA, edition, true))!.passed).toBe(true);
    expect(yearCheck(getRaceChecks(raceB, edition, true))!.passed).toBe(true);
  });
});
