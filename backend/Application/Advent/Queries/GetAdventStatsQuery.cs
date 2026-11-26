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

        // AdventEntrySource has exactly two members (Answer, Share — see AdventEntry.cs), so
        // TotalTickets/TotalAnswers/TotalShares are all derivable from the same per-day row set
        // DailyStats needs anyway. Projected to an anonymous type (not AdventDailyStatDto
        // directly) — same SQLite ORDER BY limitation documented in
        // GetAdventEntrySummariesQuery.cs:34-36: the provider can't translate an ORDER BY against
        // a property read off a record built by a positional constructor call inside the same
        // query, only off named members of an anonymous type. AnswerCount/ShareCount ride along
        // here purely to roll up the site-wide totals below — they never reach AdventDailyStatDto.
        var dailyRaw = await entries
            .GroupBy(e => e.Day)
            .Select(g => new
            {
                Day = g.Key,
                ParticipantCount = g.Select(e => e.Email).Distinct().Count(),
                TicketCount = g.Count(),
                AnswerCount = g.Count(e => e.Source == AdventEntrySource.Answer),
                ShareCount = g.Count(e => e.Source == AdventEntrySource.Share),
            })
            .OrderBy(s => s.Day)
            .ToListAsync(cancellationToken);

        // Per-day ParticipantCount can't simply be summed into a site-wide total — the same email
        // can answer/share on more than one day, so that would double-count. The DTO mapping and
        // the totals rollup both happen in memory against the one already-materialized list, no
        // further query translation involved.
        var dailyStats = dailyRaw
            .Select(s => new AdventDailyStatDto(s.Day, s.ParticipantCount, s.TicketCount))
            .ToList();
        var totalTickets = dailyRaw.Sum(s => s.TicketCount);
        var totalAnswers = dailyRaw.Sum(s => s.AnswerCount);
        var totalShares = dailyRaw.Sum(s => s.ShareCount);

        // The one value that genuinely needs a cross-day distinct count the grouped query above
        // can't provide without risking a per-group correlated subquery (N+1) — a second, cheap
        // query, bringing the total to 2 round trips against AdventEntries (down from 5).
        var totalParticipants = await entries.Select(e => e.Email).Distinct().CountAsync(cancellationToken);

        return new AdventStatsDto(totalParticipants, totalTickets, totalAnswers, totalShares, dailyStats);
    }
}
