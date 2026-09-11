import { describe, it, expect } from 'vitest';
import { groupDistances, type DistanceEntry } from './ticketStatus';

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
