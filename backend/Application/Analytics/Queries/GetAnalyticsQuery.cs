using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Analytics.Queries;

public record GetAnalyticsQuery : IRequest<AnalyticsDto>;

public record AnalyticsDto(
    SummaryDto Summary,
    List<DailyViewsDto> DailyViews,
    List<HourlyViewsDto> HourlyViews,
    List<TopTrailDto> TopTrails,
    List<TrendingTrailDto> TrendingTrails
);

public record SummaryDto(
    int TotalViews,
    int UniqueVisitors,
    int ViewsThisWeek,
    int ViewsLastWeek,
    double AvgViewsPerTrail,
    int TrailsWithViews
);

public record DailyViewsDto(string Date, int Views, int UniqueVisitors);
public record HourlyViewsDto(int Hour, int Views);
public record TopTrailDto(string Name, string Slug, int ViewCount, int UniqueVisitors);
public record TrendingTrailDto(string Name, string Slug, int ViewsThisWeek, int ViewsLastWeek, double ChangePercent);

public class GetAnalyticsQueryHandler : IRequestHandler<GetAnalyticsQuery, AnalyticsDto>
{
    private readonly UtanvegaDbContext _context;

    public GetAnalyticsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<AnalyticsDto> Handle(GetAnalyticsQuery request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var startOfWeek = now.AddDays(-7);
        var startOfLastWeek = now.AddDays(-14);
        var thirtyDaysAgo = now.AddDays(-30);

        // Fetch all views — lightweight rows (no heavy data)
        var views = await _context.TrailViews
            .AsNoTracking()
            .Select(v => new { v.TrailId, v.ViewedAtUtc, v.IpHash })
            .ToListAsync(cancellationToken);

        // Summary
        var totalViews = views.Count;
        var uniqueVisitors = views.Select(v => v.IpHash).Where(h => h != null).Distinct().Count();
        var viewsThisWeek = views.Count(v => v.ViewedAtUtc >= startOfWeek);
        var viewsLastWeek = views.Count(v => v.ViewedAtUtc >= startOfLastWeek && v.ViewedAtUtc < startOfWeek);
        var trailsWithViews = views.Select(v => v.TrailId).Distinct().Count();
        var avgViewsPerTrail = trailsWithViews > 0 ? (double)totalViews / trailsWithViews : 0;

        var summary = new SummaryDto(totalViews, uniqueVisitors, viewsThisWeek, viewsLastWeek, Math.Round(avgViewsPerTrail, 1), trailsWithViews);

        // Daily views (last 30 days)
        var dailyViews = views
            .Where(v => v.ViewedAtUtc >= thirtyDaysAgo)
            .GroupBy(v => v.ViewedAtUtc.Date)
            .Select(g => new DailyViewsDto(
                g.Key.ToString("yyyy-MM-dd"),
                g.Count(),
                g.Select(v => v.IpHash).Where(h => h != null).Distinct().Count()
            ))
            .OrderBy(d => d.Date)
            .ToList();

        // Hourly distribution (all-time)
        var hourlyViews = views
            .GroupBy(v => v.ViewedAtUtc.Hour)
            .Select(g => new HourlyViewsDto(g.Key, g.Count()))
            .OrderBy(h => h.Hour)
            .ToList();

        // Top 10 trails (all-time)
        var trailNames = await _context.Trails
            .Where(t => t.Status != TrailStatus.Deleted)
            .AsNoTracking()
            .Select(t => new { t.Id, t.Name, t.Slug })
            .ToDictionaryAsync(t => t.Id, cancellationToken);

        var topTrails = views
            .GroupBy(v => v.TrailId)
            .Select(g => new
            {
                TrailId = g.Key,
                ViewCount = g.Count(),
                UniqueVisitors = g.Select(v => v.IpHash).Where(h => h != null).Distinct().Count()
            })
            .OrderByDescending(x => x.ViewCount)
            .Take(10)
            .Where(x => trailNames.ContainsKey(x.TrailId))
            .Select(x => new TopTrailDto(
                trailNames[x.TrailId].Name,
                trailNames[x.TrailId].Slug,
                x.ViewCount,
                x.UniqueVisitors
            ))
            .ToList();

        // Trending: this week vs last week
        var thisWeekByTrail = views
            .Where(v => v.ViewedAtUtc >= startOfWeek)
            .GroupBy(v => v.TrailId)
            .ToDictionary(g => g.Key, g => g.Count());

        var lastWeekByTrail = views
            .Where(v => v.ViewedAtUtc >= startOfLastWeek && v.ViewedAtUtc < startOfWeek)
            .GroupBy(v => v.TrailId)
            .ToDictionary(g => g.Key, g => g.Count());

        var allTrendingIds = thisWeekByTrail.Keys.Union(lastWeekByTrail.Keys).ToList();
        var trendingTrails = allTrendingIds
            .Where(id => trailNames.ContainsKey(id))
            .Select(id =>
            {
                var thisWeek = thisWeekByTrail.GetValueOrDefault(id, 0);
                var lastWeek = lastWeekByTrail.GetValueOrDefault(id, 0);
                var change = lastWeek > 0 ? Math.Round(((double)thisWeek - lastWeek) / lastWeek * 100, 1) : (thisWeek > 0 ? 100.0 : 0.0);
                return new TrendingTrailDto(trailNames[id].Name, trailNames[id].Slug, thisWeek, lastWeek, change);
            })
            .OrderByDescending(t => t.ViewsThisWeek)
            .Take(10)
            .ToList();

        return new AnalyticsDto(summary, dailyViews, hourlyViews, topTrails, trendingTrails);
    }
}
