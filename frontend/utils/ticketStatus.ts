export interface DistanceEntry { label: string; ticketStatus: string | null; }
export interface GroupedDistance { label: string; count: number; ticketStatus: string | null; }

export function groupDistances(distances: DistanceEntry[]): GroupedDistance[] {
    const map = new Map<string, GroupedDistance>();
    for (const d of distances) {
        const existing = map.get(d.label);
        if (existing) {
            existing.count++;
            // Escalate ticket status: SoldOut > AlmostSoldOut/WaitingList > Closed > Available > null
            if (d.ticketStatus === 'SoldOut') existing.ticketStatus = 'SoldOut';
            else if (d.ticketStatus === 'AlmostSoldOut' && existing.ticketStatus !== 'SoldOut') existing.ticketStatus = 'AlmostSoldOut';
        } else {
            map.set(d.label, { label: d.label, count: 1, ticketStatus: d.ticketStatus });
        }
    }
    return Array.from(map.values());
}

export function getTicketStatusColor(status: string | null): 'success' | 'error' | 'warning' | 'default' {
    switch (status) {
        case 'Available': return 'success';
        case 'SoldOut': return 'error';
        case 'AlmostSoldOut': return 'warning';
        case 'WaitingList': return 'warning';
        case 'Closed': return 'default';
        default: return 'default';
    }
}
