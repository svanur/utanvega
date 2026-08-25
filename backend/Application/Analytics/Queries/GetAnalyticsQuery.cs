using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Analytics.Queries;

public record GetAnalyticsQuery : IRequest<AnalyticsDto>, ICacheable
{
    public string CacheKey => CacheKeys.Analytics;
    public TimeSpan CacheDuration => TimeSpan.FromMinutes(5);
}

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
public record TopTrailDto(string Name, string Slug, int ViewCount);
public record TrendingTrailDto(string Name, string Slug, int ViewsThisWeek, int ViewsLastWeek, double ChangePercent);

public class GetAnalyticsQueryHandler : IRequestHandler<GetAnalyticsQuery, AnalyticsDto>
{
    private readonly UtanvegaDbContext _context;

    public GetAnalyticsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Every figure is aggregated by Postgres and only the results are
    /// materialised. The previous implementation pulled every TrailView row
    /// into memory and grouped in C#, which on a 512 MB machine put a hard
    /// ceiling on how long analytics could keep working — a ceiling that got
    /// closer once v1.1.1 stopped deduplicating every visitor into one.
    /// </summary>
    public async Task<AnalyticsDto> Handle(GetAnalyticsQuery request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var startOfWeek = now.AddDays(-7);
        var startOfLastWeek = now.AddDays(-14);
        var thirtyDaysAgo = now.AddDays(-30);

        var views = _context.TrailViews.AsNoTracking();

        // Archived trails are excluded from every trail-keyed result, as before.
        var visibleTrails = _context.Trails
            .AsNoTracking()
            .Where(t => t.Status != TrailStatus.Archived);

        // ── Summary ───────────────────────────────────────────────────────
        // Separate scalar aggregates rather than one combined query: EF cannot
        // reliably translate COUNT(DISTINCT ...) alongside other aggregates in
        // a single grouping, and each of these is an index-assisted count.
        var totalViews = await views.CountAsync(cancellationToken);

        var uniqueVisitors = await views
            .Where(v => v.IpHash != null)
            .Select(v => v.IpHash)
            .Distinct()
            .CountAsync(cancellationToken);

        var viewsThisWeek = await views
            .CountAsync(v => v.ViewedAtUtc >= startOfWeek, cancellationToken);

        var viewsLastWeek = await views
            .CountAsync(v => v.ViewedAtUtc >= startOfLastWeek && v.ViewedAtUtc < startOfWeek, cancellationToken);

        var trailsWithViews = await views
            .Select(v => v.TrailId)
            .Distinct()
            .CountAsync(cancellationToken);

        var avgViewsPerTrail = trailsWithViews > 0 ? (double)totalViews / trailsWithViews : 0;

        var summary = new SummaryDto(
            totalViews, uniqueVisitors, viewsThisWeek, viewsLastWeek,
            Math.Round(avgViewsPerTrail, 1), trailsWithViews);

        // ── Daily views (last 30 days) ────────────────────────────────────
        var dailyRows = await views
            .Where(v => v.ViewedAtUtc >= thirtyDaysAgo)
            .GroupBy(v => v.ViewedAtUtc.Date)
            .Select(g => new
            {
                Day = g.Key,
                Views = g.Count(),
                UniqueVisitors = g.Select(v => v.IpHash).Distinct().Count(),
            })
            .OrderBy(r => r.Day)
            .ToListAsync(cancellationToken);

        var dailyViews = dailyRows
            .Select(r => new DailyViewsDto(r.Day.ToString("yyyy-MM-dd"), r.Views, r.UniqueVisitors))
            .ToList();

        // ── Hourly distribution (all-time, UTC) ───────────────────────────
        // Grouped queries project to anonymous types and are mapped to the DTOs
        // afterwards: EF cannot order or page by a property of a projected
        // record constructor, so doing it inline fails to translate.
        var hourlyRows = await views
            .GroupBy(v => v.ViewedAtUtc.Hour)
            .Select(g => new { Hour = g.Key, Views = g.Count() })
            .OrderBy(r => r.Hour)
            .ToListAsync(cancellationToken);

        var hourlyViews = hourlyRows
            .Select(r => new HourlyViewsDto(r.Hour, r.Views))
            .ToList();

        // ── Top 10 trails (all-time) ──────────────────────────────────────
        // Counts views only. A per-trail distinct-visitor count used to be
        // computed here and returned unused by any client — it was the single
        // most expensive operation in this query, since COUNT(DISTINCT) runs
        // per trail group across the whole table before the top ten are taken.
        // If it is wanted again, note it would be a 90-day figure sitting next
        // to an all-time ViewCount, and needs labelling as such.
        var topRows = await views
            .Join(visibleTrails, v => v.TrailId, t => t.Id, (v, t) => new { t.Name, t.Slug })
            .GroupBy(x => new { x.Name, x.Slug })
            .Select(g => new
            {
                g.Key.Name,
                g.Key.Slug,
                ViewCount = g.Count(),
            })
            .OrderByDescending(r => r.ViewCount)
            .Take(10)
            .ToListAsync(cancellationToken);

        var topTrails = topRows
            .Select(r => new TopTrailDto(r.Name, r.Slug, r.ViewCount))
            .ToList();

        // ── Trending: this week vs last week ──────────────────────────────
        // One pass over the fortnight, splitting the two weeks with filtered
        // counts, rather than a query per week plus a union.
        var trendingRows = await views
            .Where(v => v.ViewedAtUtc >= startOfLastWeek)
            .Join(visibleTrails, v => v.TrailId, t => t.Id, (v, t) => new { v.ViewedAtUtc, t.Name, t.Slug })
            .GroupBy(x => new { x.Name, x.Slug })
            .Select(g => new
            {
                g.Key.Name,
                g.Key.Slug,
                ThisWeek = g.Count(x => x.ViewedAtUtc >= startOfWeek),
                LastWeek = g.Count(x => x.ViewedAtUtc < startOfWeek),
            })
            .OrderByDescending(r => r.ThisWeek)
            .Take(10)
            .ToListAsync(cancellationToken);

        var trendingTrails = trendingRows
            .Select(r => new TrendingTrailDto(
                r.Name, r.Slug, r.ThisWeek, r.LastWeek,
                PercentChange(r.ThisWeek, r.LastWeek)))
            .ToList();

        return new AnalyticsDto(summary, dailyViews, hourlyViews, topTrails, trendingTrails);
    }

    /// <summary>
    /// Week-on-week change. With no views last week any views this week count
    /// as +100% rather than dividing by zero, matching the previous behaviour.
    /// </summary>
    private static double PercentChange(int thisWeek, int lastWeek) =>
        lastWeek > 0
            ? Math.Round(((double)thisWeek - lastWeek) / lastWeek * 100, 1)
            : (thisWeek > 0 ? 100.0 : 0.0);
}
