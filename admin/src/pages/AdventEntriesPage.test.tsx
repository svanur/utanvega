// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import AdventEntriesPage, { fillDailyStats } from './AdventEntriesPage';

// Issue #1895: KPI tiles + daily bar chart above the existing per-email table. The two fetches
// (/stats and /entries) are independent — this suite mocks apiFetch to control each separately.
//
// jsdom has no ResizeObserver implementation (confirmed: `new JSDOM().window.ResizeObserver` is
// undefined), and recharts v3's ResponsiveContainer constructs one unconditionally on mount —
// without a stub, rendering any chart-bearing state of this page throws. The stub below is a
// jsdom-gap workaround only (mirrors test-setup.ts's scrollIntoView stub); it never fires, so it
// doesn't make the chart report a real size, which is why the zero-fill contract itself is
// tested directly against fillDailyStats() rather than by counting rendered SVG bars.
class ResizeObserverStub {
    observe() { /* no-op: jsdom never lays out a real size for this to report */ }
    unobserve() {}
    disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const STATS_WITH_SPARSE_DAYS = {
    totalParticipants: 42,
    totalTickets: 103,
    totalAnswers: 80,
    totalShares: 23,
    dailyStats: [
        { day: 1, participantCount: 10, ticketCount: 12 },
        { day: 2, participantCount: 5, ticketCount: 5 },
        { day: 5, participantCount: 3, ticketCount: 4 },
    ],
};

vi.mock('../hooks/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../hooks/supabase', () => ({
    supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } },
}));

import { apiFetch } from '../hooks/api';

function mockApiFetch(statsResponse: unknown, statsShouldFail: boolean) {
    return vi.fn((endpoint: string) => {
        if (endpoint.startsWith('/api/v1/admin/advent/stats')) {
            return statsShouldFail ? Promise.reject(new Error('stats failed')) : Promise.resolve(statsResponse);
        }
        if (endpoint.startsWith('/api/v1/admin/advent/entries')) {
            return Promise.resolve({
                items: [
                    { email: 'runner@example.com', ticketCount: 3, lastDay: 5, lastAnsweredAt: '2026-12-05T10:00:00Z' },
                ],
                total: 1,
            });
        }
        return Promise.resolve({});
    });
}

async function renderPage(statsResponse: unknown = STATS_WITH_SPARSE_DAYS, statsShouldFail = false) {
    (apiFetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(mockApiFetch(statsResponse, statsShouldFail));
    render(<AdventEntriesPage onNotify={() => {}} />);
    // Flush the mount-time apiFetch promise chains (plain microtasks) so loading states settle.
    await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
    });
}

describe('fillDailyStats — zero-fill for the daily bar chart', () => {
    it('expands a sparse dailyStats (days 1, 2, 5 only) into all 24 days, zero-filling the rest', () => {
        const filled = fillDailyStats(STATS_WITH_SPARSE_DAYS.dailyStats);

        expect(filled).toHaveLength(24);
        expect(filled.map(d => d.day)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));

        // Present days keep their real counts.
        expect(filled[0]).toEqual({ day: 1, participantCount: 10, ticketCount: 12 });
        expect(filled[4]).toEqual({ day: 5, participantCount: 3, ticketCount: 4 });

        // Missing days (3, 4, 6-24) are zero-filled, not omitted.
        expect(filled[2]).toEqual({ day: 3, participantCount: 0, ticketCount: 0 });
        expect(filled[3]).toEqual({ day: 4, participantCount: 0, ticketCount: 0 });
        for (let day = 6; day <= 24; day++) {
            expect(filled[day - 1]).toEqual({ day, participantCount: 0, ticketCount: 0 });
        }
    });

    it('zero-fills all 24 days when dailyStats is empty', () => {
        expect(fillDailyStats([])).toEqual(
            Array.from({ length: 24 }, (_, i) => ({ day: i + 1, participantCount: 0, ticketCount: 0 })),
        );
    });
});

describe('AdventEntriesPage — KPI tiles (#1895)', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('renders KPI values from the mocked /stats response', async () => {
        await renderPage();

        expect(screen.getByText('42')).toBeTruthy();
        expect(screen.getByText('103')).toBeTruthy();
        expect(screen.getByText('80 / 23')).toBeTruthy();
    });

    it('still renders the per-email table when the /stats fetch fails', async () => {
        await renderPage(null, true);

        expect(screen.getByText('Failed to load advent stats.')).toBeTruthy();
        expect(screen.getByText('runner@example.com')).toBeTruthy();
    });
});
