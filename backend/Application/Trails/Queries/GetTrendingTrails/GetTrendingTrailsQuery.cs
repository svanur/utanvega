using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrendingTrails;

public record TrendingTrailDto(
    string Name,
    string Slug,
    string ActivityType,
    double Length,
    double ElevationGain,
    int ViewCount
);

public record GetTrendingTrailsQuery(int Count = 10, int Days = 7) : IRequest<List<TrendingTrailDto>>, ICacheable
{
    public string CacheKey => CacheKeys.Trending(Count, Days);
    public TimeSpan CacheDuration => TimeSpan.FromMinutes(15);
}

public class GetTrendingTrailsQueryHandler : IRequestHandler<GetTrendingTrailsQuery, List<TrendingTrailDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetTrendingTrailsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<TrendingTrailDto>> Handle(GetTrendingTrailsQuery request, CancellationToken cancellationToken)
    {
        var since = DateTime.UtcNow.AddDays(-request.Days);

        var trending = await _context.TrailViews
            .Where(v => v.ViewedAtUtc >= since)
            .GroupBy(v => v.TrailId)
            .Select(g => new
            {
                TrailId = g.Key,
                ViewCount = g.Count()
            })
            .OrderByDescending(x => x.ViewCount)
            .Take(request.Count)
            .Join(
                _context.Trails.Where(t => t.Status == TrailStatus.Published),
                x => x.TrailId,
                t => t.Id,
                (x, t) => new TrendingTrailDto(
                    t.Name,
                    t.Slug,
                    t.ActivityTypeId.ToString(),
                    t.Length,
                    t.ElevationGain,
                    x.ViewCount
                )
            )
            .ToListAsync(cancellationToken);

        return trending;
    }
}
