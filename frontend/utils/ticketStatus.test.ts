import { describe, it, expect } from 'vitest';
import { getRecentRaceDistanceDisplay, groupDistances, isAllUnavailableForRegistration, hasRaceStarted, hasRegistrationClosed, isRegistrationRequired, isRegistrationRequiredForRace, getTicketStatusColor, type DistanceEntry } from './ticketStatus';

describe('groupDistances', () => {
    it('keeps elevationGain/terrainType when two entries sharing a label agree', () => {
        const distances: DistanceEntry[] = [
            { label: '10 km', ticketStatus: 'Available', elevationGain: 250, terrainType: 'Trail' },
            { label: '10 km', ticketStatus: 'Available', elevationGain: 250, terrainType: 'Trail' },
        ];
        const [group] = groupDistances(distances);
        expect(group.count).toBe(2);
        expect(group.elevationGain).toBe(250);
        expect(group.terrainType).toBe('Trail');
    });

    it('clears elevationGain to null when two entries sharing a label disagree on it', () => {
        const distances: DistanceEntry[] = [
            { label: '10 km', ticketStatus: 'Available', elevationGain: 250, terrainType: 'Trail' },
            { label: '10 km', ticketStatus: 'Available', elevationGain: 400, terrainType: 'Trail' },
        ];
        const [group] = groupDistances(distances);
        expect(group.elevationGain).toBeNull();
        expect(group.terrainType).toBe('Trail');
    });

    it('clears terrainType to null when two entries sharing a label disagree on it', () => {
        const distances: DistanceEntry[] = [
            { label: '10 km', ticketStatus: 'Available', elevationGain: 250, terrainType: 'Trail' },
            { label: '10 km', ticketStatus: 'Available', elevationGain: 250, terrainType: 'Road' },
        ];
        const [group] = groupDistances(distances);
        expect(group.elevationGain).toBe(250);
        expect(group.terrainType).toBeNull();
    });

    it('keeps elevationGain cleared for a 3rd entry sharing the label, even one matching the original value', () => {
        const distances: DistanceEntry[] = [
            { label: '10 km', ticketStatus: 'Available', elevationGain: 250, terrainType: 'Trail' },
            { label: '10 km', ticketStatus: 'Available', elevationGain: 400, terrainType: 'Trail' },
            // Matches entry 1's original 250 exactly — must not "un-clear" the group value, since
            // clearing compares against the already-cleared group state, not entry 1's raw value.
            { label: '10 km', ticketStatus: 'Available', elevationGain: 250, terrainType: 'Trail' },
        ];
        const [group] = groupDistances(distances);
        expect(group.count).toBe(3);
        expect(group.elevationGain).toBeNull();
        expect(group.terrainType).toBe('Trail');
    });

    it('passes elevationGain/terrainType through unchanged for a single (unmerged) entry', () => {
        const distances: DistanceEntry[] = [
            { label: 'Half Marathon', ticketStatus: 'SoldOut', elevationGain: 900, terrainType: 'Mountain' },
        ];
        const [group] = groupDistances(distances);
        expect(group.count).toBe(1);
        expect(group.elevationGain).toBe(900);
        expect(group.terrainType).toBe('Mountain');
    });

    it('treats omitted elevationGain/terrainType as null and does not throw, as RacesPage/EventTableView callers do', () => {
        const distances: DistanceEntry[] = [
            { label: '5 km', ticketStatus: 'Available' },
            { label: '5 km', ticketStatus: 'Available' },
        ];
        expect(() => groupDistances(distances)).not.toThrow();
        const [group] = groupDistances(distances);
        expect(group.elevationGain).toBeNull();
        expect(group.terrainType).toBeNull();
    });

    it('escalates ticket status across the group: SoldOut > AlmostSoldOut > Closed > Available > null', () => {
        const soldOutBeatsAvailable = groupDistances([
            { label: '10 km', ticketStatus: 'Available' },
            { label: '10 km', ticketStatus: 'SoldOut' },
        ]);
        expect(soldOutBeatsAvailable[0].ticketStatus).toBe('SoldOut');

        const almostSoldOutBeatsAvailable = groupDistances([
            { label: '10 km', ticketStatus: 'Available' },
            { label: '10 km', ticketStatus: 'AlmostSoldOut' },
        ]);
        expect(almostSoldOutBeatsAvailable[0].ticketStatus).toBe('AlmostSoldOut');

        // SoldOut, once set, is not downgraded by a later AlmostSoldOut in the same group.
        const soldOutStaysAheadOfAlmostSoldOut = groupDistances([
            { label: '10 km', ticketStatus: 'SoldOut' },
            { label: '10 km', ticketStatus: 'AlmostSoldOut' },
        ]);
        expect(soldOutStaysAheadOfAlmostSoldOut[0].ticketStatus).toBe('SoldOut');

        // Neither SoldOut nor AlmostSoldOut is present, so the first value seen (Closed) is retained.
        const closedBeatsAvailable = groupDistances([
            { label: '10 km', ticketStatus: 'Closed' },
            { label: '10 km', ticketStatus: 'Available' },
        ]);
        expect(closedBeatsAvailable[0].ticketStatus).toBe('Closed');

        const nullStaysNullWithoutEscalation = groupDistances([
            { label: '10 km', ticketStatus: null },
            { label: '10 km', ticketStatus: null },
        ]);
        expect(nullStaysNullWithoutEscalation[0].ticketStatus).toBeNull();
    });
});

// #1601: direct unit coverage for the gating function itself, in addition to the page-level
// RacesPage.test.tsx/EventTableView.test.tsx regression guards for its three call sites.
describe('isAllUnavailableForRegistration', () => {
    it('returns false when distances is null', () => {
        expect(isAllUnavailableForRegistration(null)).toBe(false);
    });

    it('returns false when distances is undefined', () => {
        expect(isAllUnavailableForRegistration(undefined)).toBe(false);
    });

    it('returns false when distances is an empty array', () => {
        expect(isAllUnavailableForRegistration([])).toBe(false);
    });

    it('returns true when every race is NotStarted', () => {
        expect(isAllUnavailableForRegistration([
            { ticketStatus: 'NotStarted' },
            { ticketStatus: 'NotStarted' },
        ])).toBe(true);
    });

    it('returns true for a mix of SoldOut/Closed/NotStarted with zero Available/AlmostSoldOut races', () => {
        expect(isAllUnavailableForRegistration([
            { ticketStatus: 'SoldOut' },
            { ticketStatus: 'Closed' },
            { ticketStatus: 'NotStarted' },
        ])).toBe(true);
    });

    it('returns false as soon as one race is Available', () => {
        expect(isAllUnavailableForRegistration([
            { ticketStatus: 'NotStarted' },
            { ticketStatus: 'Available' },
        ])).toBe(false);
    });

    it('returns false as soon as one race is AlmostSoldOut', () => {
        expect(isAllUnavailableForRegistration([
            { ticketStatus: 'SoldOut' },
            { ticketStatus: 'AlmostSoldOut' },
        ])).toBe(false);
    });

    it('agrees with isAllSoldOut for a fully SoldOut/Closed set (both true)', () => {
        expect(isAllUnavailableForRegistration([
            { ticketStatus: 'SoldOut' },
            { ticketStatus: 'Closed' },
        ])).toBe(true);
    });
});

describe('hasRegistrationClosed', () => {
    it('returns false when registrationCloses is null', () => {
        expect(hasRegistrationClosed(null, new Date('2026-01-01T00:00:00Z'))).toBe(false);
    });

    it('returns false when registrationCloses is undefined', () => {
        expect(hasRegistrationClosed(undefined, new Date('2026-01-01T00:00:00Z'))).toBe(false);
    });

    it('returns false one millisecond before the stored instant, even mid-calendar-day (#1071)', () => {
        // RegistrationCloses now carries real time-of-day precision — no more rolling forward to
        // the end of the calendar day. A 09:00 cutoff must close right at 09:00, not at midnight.
        const now = new Date('2026-03-10T08:59:59.999Z');
        expect(hasRegistrationClosed('2026-03-10T09:00:00Z', now)).toBe(false);
    });

    it('returns true exactly at the stored instant', () => {
        const now = new Date('2026-03-10T09:00:00.000Z');
        expect(hasRegistrationClosed('2026-03-10T09:00:00Z', now)).toBe(true);
    });

    it('returns true when now is well after the stored instant', () => {
        const now = new Date('2026-03-15T12:00:00Z');
        expect(hasRegistrationClosed('2026-03-10T09:00:00Z', now)).toBe(true);
    });

    // Cross-check against the backend's EditionStatusHelpers.ComputeEffectiveRegistrationStatus
    // (same instant, same closes value) — the two must agree now that both compare the raw
    // instant directly (#1071's acceptance criteria).
    it('agrees with the backend-mirrored instant comparison just before and at the closes instant', () => {
        const closes = '2026-03-01T09:00:00Z';
        expect(hasRegistrationClosed(closes, new Date('2026-03-01T08:59:00Z'))).toBe(false);
        expect(hasRegistrationClosed(closes, new Date('2026-03-01T09:00:00Z'))).toBe(true);
    });

    // Legacy rows (and every edition still created via EventWizardPage's date-only DatePicker)
    // store registrationCloses as exact midnight UTC. Caught in PR #1551 review: comparing that
    // directly against `now` flipped these a full day early, since midnight is the *start* of
    // the closes day, not its end.
    it('stays open through the rest of the closes day when registrationCloses is midnight UTC', () => {
        const closes = '2026-03-01T00:00:00Z';
        expect(hasRegistrationClosed(closes, new Date('2026-03-01T23:00:00Z'))).toBe(false);
    });

    it('closes once the day after a midnight-UTC registrationCloses begins', () => {
        const closes = '2026-03-01T00:00:00Z';
        expect(hasRegistrationClosed(closes, new Date('2026-03-02T00:00:00Z'))).toBe(true);
    });
});

describe('hasRaceStarted', () => {
    it('returns false when dateOfRace is null/undefined, regardless of startTime', () => {
        expect(hasRaceStarted(null, '09:00:00', new Date('2026-01-01T00:00:00Z'))).toBe(false);
        expect(hasRaceStarted(undefined, '09:00:00', new Date('2026-01-01T00:00:00Z'))).toBe(false);
    });

    it('with startTime set, returns false just before the combined date+time instant', () => {
        const now = new Date('2026-03-10T08:59:59');
        expect(hasRaceStarted('2026-03-10', '09:00:00', now)).toBe(false);
    });

    it('with startTime set, returns true exactly at and after the combined date+time instant', () => {
        expect(hasRaceStarted('2026-03-10', '09:00:00', new Date('2026-03-10T09:00:00'))).toBe(true);
        expect(hasRaceStarted('2026-03-10', '09:00:00', new Date('2026-03-10T09:00:01'))).toBe(true);
    });

    it('with startTime set, hides mid-calendar-day even though dateOfRace is still "today"', () => {
        // The whole point of #1071 Part B: don't wait for end-of-day once the race has actually
        // started.
        const now = new Date('2026-03-10T12:00:00');
        expect(hasRaceStarted('2026-03-10', '09:00:00', now)).toBe(true);
    });

    it('without startTime, falls back to day-granularity: not started while still the race day itself', () => {
        // Regression guard — today's common case (no recorded start time) must behave exactly as
        // before: a same-day race never reads as started no matter how late in the day it is.
        const now = new Date('2026-03-10T23:59:59');
        expect(hasRaceStarted('2026-03-10', null, now)).toBe(false);
    });

    it('without startTime, falls back to day-granularity: started the day after dateOfRace', () => {
        const now = new Date('2026-03-11T00:00:00');
        expect(hasRaceStarted('2026-03-10', null, now)).toBe(true);
    });

    it('without startTime, has not started before the race day at all', () => {
        const now = new Date('2026-03-01T00:00:00');
        expect(hasRaceStarted('2026-03-10', undefined, now)).toBe(false);
    });
});

describe('isRegistrationRequired', () => {
    it('returns false for NotRequired', () => {
        expect(isRegistrationRequired('NotRequired')).toBe(false);
    });

    it('returns false for Invitational (entry by selection, e.g. Backyard Ultra World Championship)', () => {
        expect(isRegistrationRequired('Invitational')).toBe(false);
    });

    it('returns true for every other registrationStatus value, including null/undefined', () => {
        expect(isRegistrationRequired('Open')).toBe(true);
        expect(isRegistrationRequired('Closed')).toBe(true);
        expect(isRegistrationRequired('NotStarted')).toBe(true);
        expect(isRegistrationRequired(null)).toBe(true);
        expect(isRegistrationRequired(undefined)).toBe(true);
    });
});

describe('isRegistrationRequiredForRace', () => {
    it('returns false for Free (the ticketStatus a NotRequired-registration race resolves to)', () => {
        expect(isRegistrationRequiredForRace('Free')).toBe(false);
    });

    it('returns false for Invitational (the ticketStatus an Invitational-registration race resolves to)', () => {
        expect(isRegistrationRequiredForRace('Invitational')).toBe(false);
    });

    // #1607: this race's own registration window hasn't opened yet (#1553) — same unavailable
    // outcome as Free/Invitational, just a different reason.
    it('returns false for NotStarted (this race\'s registration window has not opened yet)', () => {
        expect(isRegistrationRequiredForRace('NotStarted')).toBe(false);
    });

    it('returns true for every other ticketStatus value, including null/undefined', () => {
        expect(isRegistrationRequiredForRace('Available')).toBe(true);
        expect(isRegistrationRequiredForRace('AlmostSoldOut')).toBe(true);
        expect(isRegistrationRequiredForRace('SoldOut')).toBe(true);
        expect(isRegistrationRequiredForRace('Closed')).toBe(true);
        expect(isRegistrationRequiredForRace(null)).toBe(true);
        expect(isRegistrationRequiredForRace(undefined)).toBe(true);
    });
});

describe('getRecentRaceDistanceDisplay', () => {
    it('groups comp.distances for the chip row and folds a single distance inline when there is no recentRace', () => {
        const distances: DistanceEntry[] = [
            { label: '10 km', ticketStatus: 'Available' },
        ];
        const result = getRecentRaceDistanceDisplay(null, distances);
        expect(result.groupedDistances).toHaveLength(1);
        expect(result.singleDistanceLabel).toBe('10 km');
        // A single distance is already shown inline, so the chip row must stay hidden.
        expect(result.showDistanceChips).toBe(false);
    });

    it('falls back to the chip row (not the inline label) when there is no recentRace and more than one distance', () => {
        const distances: DistanceEntry[] = [
            { label: '10 km', ticketStatus: 'Available' },
            { label: 'Half Marathon', ticketStatus: 'SoldOut' },
        ];
        const result = getRecentRaceDistanceDisplay(null, distances);
        expect(result.groupedDistances).toHaveLength(2);
        expect(result.singleDistanceLabel).toBeNull();
        expect(result.showDistanceChips).toBe(true);
    });

    it('uses recentRace.distanceLabel inline and suppresses the chip row entirely when it is non-blank', () => {
        const distances: DistanceEntry[] = [
            { label: '10 km', ticketStatus: 'Available' },
            { label: 'Half Marathon', ticketStatus: 'SoldOut' },
        ];
        const result = getRecentRaceDistanceDisplay({ distanceLabel: '21 km' }, distances);
        expect(result.singleDistanceLabel).toBe('21 km');
        // comp.distances is never grouped once recentRace supplies its own label.
        expect(result.groupedDistances).toHaveLength(0);
        expect(result.showDistanceChips).toBe(false);
    });

    it('falls back to grouping comp.distances for the chip row when recentRace.distanceLabel is null', () => {
        const distances: DistanceEntry[] = [
            { label: '10 km', ticketStatus: 'Available' },
        ];
        const result = getRecentRaceDistanceDisplay({ distanceLabel: null }, distances);
        // The inline label stays sourced from recentRace.distanceLabel only — never substituted.
        expect(result.singleDistanceLabel).toBeNull();
        expect(result.groupedDistances).toHaveLength(1);
        // Nothing has been shown inline, so even a single grouped distance needs the chip row.
        expect(result.showDistanceChips).toBe(true);
    });

    it('treats a blank-string recentRace.distanceLabel like null for the chip-row fallback, while the inline label itself stays the raw blank string (never substituted)', () => {
        const distances: DistanceEntry[] = [
            { label: '10 km', ticketStatus: 'Available' },
        ];
        const result = getRecentRaceDistanceDisplay({ distanceLabel: '' }, distances);
        expect(result.singleDistanceLabel).toBe('');
        expect(result.groupedDistances).toHaveLength(1);
        expect(result.showDistanceChips).toBe(true);
    });

    it('shows no chips and no inline label when recentRace.distanceLabel is null and distances is empty/null', () => {
        expect(getRecentRaceDistanceDisplay({ distanceLabel: null }, null)).toEqual({
            groupedDistances: [],
            singleDistanceLabel: null,
            showDistanceChips: false,
        });
        expect(getRecentRaceDistanceDisplay({ distanceLabel: null }, [])).toEqual({
            groupedDistances: [],
            singleDistanceLabel: null,
            showDistanceChips: false,
        });
    });

    it('returns no distance info when there is no recentRace and distances is null/undefined', () => {
        expect(getRecentRaceDistanceDisplay(null, null)).toEqual({
            groupedDistances: [],
            singleDistanceLabel: null,
            showDistanceChips: false,
        });
        expect(getRecentRaceDistanceDisplay(undefined, undefined)).toEqual({
            groupedDistances: [],
            singleDistanceLabel: null,
            showDistanceChips: false,
        });
    });
});

describe('getTicketStatusColor', () => {
    it('returns default for Invitational', () => {
        expect(getTicketStatusColor('Invitational')).toBe('default');
    });
});
