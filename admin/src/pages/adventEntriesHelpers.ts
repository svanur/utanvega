const ADVENT_DAYS = 24;

// Mirrors backend/Application/Advent/Queries/GetAdventStatsQuery.cs's AdventDailyStatDto/AdventStatsDto.
export interface AdventDailyStatDto {
    day: number;
    participantCount: number;
    ticketCount: number;
}

// dailyStats is sparse (days with zero entries are never materialized server-side, see
// GetAdventStatsQuery.cs) — build the full 1-24 range here so the chart never shows a gap in
// the axis, same technique as AnalyticsPage.tsx's filledHourlyViews.
export function fillDailyStats(dailyStats: AdventDailyStatDto[]): AdventDailyStatDto[] {
    return Array.from({ length: ADVENT_DAYS }, (_, i) => {
        const day = i + 1;
        const found = dailyStats.find(d => d.day === day);
        return found ?? { day, participantCount: 0, ticketCount: 0 };
    });
}
