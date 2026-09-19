import { describe, it, expect } from 'vitest';
import { groupDistances, hasRegistrationClosed, type DistanceEntry } from './ticketStatus';

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

describe('hasRegistrationClosed', () => {
    it('returns false when registrationCloses is null', () => {
        expect(hasRegistrationClosed(null, new Date('2026-01-01T00:00:00Z'))).toBe(false);
    });

    it('returns false when registrationCloses is undefined', () => {
        expect(hasRegistrationClosed(undefined, new Date('2026-01-01T00:00:00Z'))).toBe(false);
    });

    it('returns false when now is still on the same UTC calendar day as registrationCloses', () => {
        // The closes-date stays open through its full 24 hours — checking late in the day must not
        // read as closed yet.
        const now = new Date('2026-03-10T23:59:59.999Z');
        expect(hasRegistrationClosed('2026-03-10T00:00:00Z', now)).toBe(false);
    });

    it('returns true when now is exactly at UTC midnight of the day after registrationCloses', () => {
        // The cutoff is the start of the *next* day, not the raw registrationCloses instant.
        const now = new Date('2026-03-11T00:00:00.000Z');
        expect(hasRegistrationClosed('2026-03-10T00:00:00Z', now)).toBe(true);
    });

    it('returns false one millisecond before the cutoff', () => {
        const now = new Date('2026-03-10T23:59:59.999Z');
        expect(hasRegistrationClosed('2026-03-10T00:00:00Z', now)).toBe(false);
    });

    it('returns true when now is well after the cutoff', () => {
        const now = new Date('2026-03-15T12:00:00Z');
        expect(hasRegistrationClosed('2026-03-10T00:00:00Z', now)).toBe(true);
    });
});
