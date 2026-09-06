export interface DistanceEntry {
    label: string;
    ticketStatus: string | null;
    // Optional — only the editions history page populates these. Absent for every other caller
    // of groupDistances (RacesPage/EventTableView), which is fine since they're never read there.
    elevationGain?: number | null;
    terrainType?: string | null;
}
export interface GroupedDistance {
    label: string;
    count: number;
    ticketStatus: string | null;
    // Only set when every race collapsed into this group agrees on the value (or there's only one) —
    // see groupDistances below for why a mismatch clears it rather than picking one arbitrarily.
    elevationGain?: number | null;
    terrainType?: string | null;
}

export function groupDistances(distances: DistanceEntry[]): GroupedDistance[] {
    const map = new Map<string, GroupedDistance>();
    for (const d of distances) {
        const existing = map.get(d.label);
        if (existing) {
            existing.count++;
            // Escalate ticket status: SoldOut > AlmostSoldOut/WaitingList > Closed > Available > null
            if (d.ticketStatus === 'SoldOut') existing.ticketStatus = 'SoldOut';
            else if (d.ticketStatus === 'AlmostSoldOut' && existing.ticketStatus !== 'SoldOut') existing.ticketStatus = 'AlmostSoldOut';
            // Two races can share a distance label (e.g. both "10 km") while running different
            // courses with different elevation/terrain. Rather than silently keeping whichever
            // race's values happened to be seen first, clear the field the moment two races
            // sharing the label disagree — an absent fact reads honestly, a wrong one doesn't.
            if (existing.elevationGain !== (d.elevationGain ?? null)) existing.elevationGain = null;
            if (existing.terrainType !== (d.terrainType ?? null)) existing.terrainType = null;
        } else {
            map.set(d.label, {
                label: d.label,
                count: 1,
                ticketStatus: d.ticketStatus,
                elevationGain: d.elevationGain ?? null,
                terrainType: d.terrainType ?? null,
            });
        }
    }
    return Array.from(map.values());
}

// Returns true when every race in the relevant edition is sold out — used to suppress registration UI (button, swipe action)
export function isAllSoldOut(distances: DistanceEntry[] | null | undefined): boolean {
    if (!distances || distances.length === 0) return false;
    return distances.every(d => d.ticketStatus === 'SoldOut' || d.ticketStatus === 'Closed');
}

export function getTicketStatusColor(status: string | null): 'success' | 'error' | 'warning' | 'info' | 'default' {
    switch (status) {
        case 'Free': return 'success';
        case 'Available': return 'success';
        case 'AlmostSoldOut': return 'warning';
        case 'WaitingList': return 'warning';
        case 'SoldOut': return 'error';
        case 'NotStarted': return 'info';
        case 'Closed': return 'default';
        default: return 'default';
    }
}
