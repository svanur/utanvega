using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Advent.Queries;

/// <summary>
/// One row of the admin "who's winning" table for #1877 — every distinct email with at least one
/// <see cref="Core.Entities.AdventEntry"/> row, rolled up to a ticket count across both
/// <see cref="Core.Entities.AdventEntrySource"/> values.
/// </summary>
public record AdventEntrySummaryDto(string Email, int TicketCount, int LastDay, DateTime LastAnsweredAt);

/// <summary>
/// Paginated, sortable per-email ticket-count summary (#1887) — the admin-facing sibling of
/// <see cref="ExportAdventEntriesQuery"/>'s flat Sportís handover list. Mirrors the pagination/sort
/// convention of <c>GetFeedbackQuery</c>.
/// </summary>
public record GetAdventEntrySummariesQuery(int Page, int PageSize, string? SortBy = null, string? SortDir = null)
    : IRequest<GetAdventEntrySummariesResult>;

public record GetAdventEntrySummariesResult(List<AdventEntrySummaryDto> Items, int Total);

public class GetAdventEntrySummariesQueryHandler(UtanvegaDbContext db)
    : IRequestHandler<GetAdventEntrySummariesQuery, GetAdventEntrySummariesResult>
{
    public async Task<GetAdventEntrySummariesResult> Handle(GetAdventEntrySummariesQuery request, CancellationToken cancellationToken)
    {
        // Projected to an anonymous type (not AdventEntrySummaryDto directly) — the SQLite provider
        // can't translate an ORDER BY against a property read off a record built by a positional
        // constructor call inside the same query, only off named members of an anonymous type.
        var grouped = db.AdventEntries
            .AsNoTracking()
            .GroupBy(e => e.Email)
            .Select(g => new
            {
                Email = g.Key,
                TicketCount = g.Count(),
                LastDay = g.Max(e => e.Day),
                LastAnsweredAt = g.Max(e => e.CreatedAt),
            });

        var total = await grouped.CountAsync(cancellationToken);

        // Email is a secondary sort key on every branch except "email" itself (already unique per
        // group) — without it, ties on TicketCount/LastDay have no guaranteed stable order across
        // separate page fetches, so a row can shift between pages and get duplicated or skipped.
        var desc = (request.SortDir ?? "desc").Equals("asc", StringComparison.OrdinalIgnoreCase) is false;
        grouped = (request.SortBy ?? "ticketCount") switch
        {
            "email"       => desc ? grouped.OrderByDescending(s => s.Email)       : grouped.OrderBy(s => s.Email),
            "lastDay"     => desc ? grouped.OrderByDescending(s => s.LastDay).ThenBy(s => s.Email)     : grouped.OrderBy(s => s.LastDay).ThenBy(s => s.Email),
            "ticketCount" => desc ? grouped.OrderByDescending(s => s.TicketCount).ThenBy(s => s.Email) : grouped.OrderBy(s => s.TicketCount).ThenBy(s => s.Email),
            _             => desc ? grouped.OrderByDescending(s => s.TicketCount).ThenBy(s => s.Email) : grouped.OrderBy(s => s.TicketCount).ThenBy(s => s.Email),
        };

        var items = await grouped
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(s => new AdventEntrySummaryDto(s.Email, s.TicketCount, s.LastDay, s.LastAnsweredAt))
            .ToListAsync(cancellationToken);

        return new GetAdventEntrySummariesResult(items, total);
    }
}
