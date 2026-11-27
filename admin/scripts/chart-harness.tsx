import { createRoot } from 'react-dom/client';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { fillDailyStats, type AdventDailyStatDto } from '../src/pages/adventEntriesHelpers';

// Standalone render fixture for #1913 — mirrors the XAxis-bearing chart block in
// AdventEntriesPage.tsx:233-248 (BarChart/XAxis dataKey="day" fontSize={12}, no explicit
// interval/angle) closely enough to reproduce its label density at narrow widths, without
// pulling in the real page's auth/API/MUI-theme dependency chain (apiFetch, supabase,
// useTheme, Layout, router, etc.) — none of which affect XAxis tick layout. Bar fill colors
// are hardcoded here rather than read from the MUI theme since this fixture checks label
// position/overlap, not fill color (the real page's theme-token wiring was the subject of
// #1908, not this issue).
//
// Served by the admin Vite dev server and driven by scripts/verify-advent-chart-xaxis.mjs —
// see that file for how to run the check. Not part of the admin app's router or build output;
// do not import this from src/.
const dailyStats: AdventDailyStatDto[] = Array.from({ length: 24 }, (_, i) => ({
    day: i + 1,
    participantCount: (i % 7) + 1,
    ticketCount: (i % 5) + 1,
}));

function ChartHarness() {
    return (
        <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height={280}>
                <BarChart data={fillDailyStats(dailyStats)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" fontSize={12} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ticketCount" name="Tickets" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="participantCount" name="Participants" fill="#1976d2" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

const container = document.getElementById('root');
if (!container) throw new Error('chart-harness.html is missing #root');
createRoot(container).render(<ChartHarness />);
