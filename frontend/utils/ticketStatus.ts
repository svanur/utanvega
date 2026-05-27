/**
 * Maps a race ticket status to a MUI chip color.
 * Used consistently across table view and card view distance chips.
 */
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
