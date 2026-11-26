using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Advent.Queries;

/// <summary>
/// One day's roll-up in the admin stats overview (#1894) — how many distinct entrants and how
/// many tickets were earned on that <see cref="Core.Entities.AdventEntry.Day"/>. Days with zero
/// entries are never materialized (see handler), so this list is sparse, not zero-filled.
/// </summary>
public record AdventDailyStatDto(int Day, int ParticipantCount, int TicketCount);

/// <summary>
/// Overall KPI rollup for the admin advent dashboard (#1894) — the sibling of
/// <see cref="GetAdventEntrySummariesQuery"/>'s per-email table, but grouped by day instead of by
/// email, plus a few site-wide totals. No paging: bounded to at most 24 rows (one per advent day).
/// </summary>
public record AdventStatsDto(
    int TotalParticipants, int TotalTickets, int TotalAnswers, int TotalShares, List<AdventDailyStatDto> DailyStats);

public record GetAdventStatsQuery : IRequest<AdventStatsDto>;

public class GetAdventStatsQueryHandler(UtanvegaDbContext db) : IRequestHandler<GetAdventStatsQuery, AdventStatsDto>
{
    public async Task<AdventStatsDto> Handle(GetAdventStatsQuery request, CancellationToken cancellationToken)
    {
        var entries = db.AdventEntries.AsNoTracking();

        var totalParticipants = await entries.Select(e => e.Email).Distinct().CountAsync(cancellationToken);
        var totalTickets = await entries.CountAsync(cancellationToken);
        var totalAnswers = await entries.CountAsync(e => e.Source == AdventEntrySource.Answer, cancellationToken);
        var totalShares = await entries.CountAsync(e => e.Source == AdventEntrySource.Share, cancellationToken);

        // Projected to an anonymous type (not AdventDailyStatDto directly) — same SQLite ORDER BY
        // limitation documented in GetAdventEntrySummariesQuery.cs:29-31: the provider can't
        // translate an ORDER BY against a property read off a record built by a positional
        // constructor call inside the same query, only off named members of an anonymous type.
        var dailyStats = await entries
            .GroupBy(e => e.Day)
            .Select(g => new
            {
                Day = g.Key,
                ParticipantCount = g.Select(e => e.Email).Distinct().Count(),
                TicketCount = g.Count(),
            })
            .OrderBy(s => s.Day)
            .Select(s => new AdventDailyStatDto(s.Day, s.ParticipantCount, s.TicketCount))
            .ToListAsync(cancellationToken);

        return new AdventStatsDto(totalParticipants, totalTickets, totalAnswers, totalShares, dailyStats);
    }
}
