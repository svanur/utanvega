using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetEditionsHistory;

// Fixed cache key (no per-year param), so plain ICacheable works here — unlike GetEditionsHistoryQuery.
public record GetEditionsHistoryYearsQuery : IRequest<List<int>>, ICacheable
{
    public string CacheKey => CacheKeys.EditionsHistoryYears;
    public TimeSpan CacheDuration => TimeSpan.FromHours(12);
}

public class GetEditionsHistoryYearsQueryHandler : IRequestHandler<GetEditionsHistoryYearsQuery, List<int>>
{
    private readonly UtanvegaDbContext _context;

    public GetEditionsHistoryYearsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<int>> Handle(GetEditionsHistoryYearsQuery request, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var editions = await _context.EventEditions
            .AsNoTracking()
            .Where(ed =>
                ed.Status != EditionStatus.Hidden &&
                ed.Event.Status != EventStatus.Hidden &&
                ed.Event.Status != EventStatus.Unlisted &&
                (ed.Date.HasValue || ed.Year.HasValue))
            .Select(ed => new { ed.Date, ed.EndDate, ed.Year })
            .ToListAsync(cancellationToken);

        // Same bucketing/past-cutoff rules as GetEditionsHistoryQuery: dated editions bucket by their
        // start date's year and must have concluded; dateless editions bucket by Year and only count
        // once that whole year is behind us.
        var years = new HashSet<int>();
        foreach (var ed in editions)
        {
            if (ed.Date.HasValue)
            {
                var effectiveEnd = ed.EndDate ?? ed.Date.Value;
                if (effectiveEnd < today) years.Add(ed.Date.Value.Year);
            }
            else if (ed.Year.HasValue && ed.Year.Value < today.Year)
            {
                years.Add(ed.Year.Value);
            }
        }

        return years.OrderDescending().ToList();
    }
}
