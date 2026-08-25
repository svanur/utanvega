using Utanvega.Backend.Application.Analytics.Queries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;
using Xunit;

namespace Utanvega.Backend.Tests.Handlers;

/// <summary>
/// Covers the analytics rollups, which moved from grouping every TrailView row
/// in memory to aggregating in SQL. The risk in that change is the figures
/// shifting, so each one is pinned against a known set of views.
/// </summary>
public class AnalyticsHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly DateTime _now = DateTime.UtcNow;

    private static readonly Guid EsjaId = Guid.NewGuid();
    private static readonly Guid HengillId = Guid.NewGuid();
    private static readonly Guid ArchivedId = Guid.NewGuid();

    public AnalyticsHandlerTests()
    {
        _factory = new TestDbContextFactory();
        Seed();
    }

    public void Dispose() => _factory.Dispose();

    private static Trail Trail(Guid id, string name, string slug, TrailStatus status) => new()
    {
        Id = id,
        Name = name,
        Slug = slug,
        Status = status,
        Length = 10_000,
        ElevationGain = 500,
    };

    private void Seed()
    {
        using var context = _factory.CreateContext();

        context.Trails.AddRange(
            Trail(EsjaId, "Esja", "esja", TrailStatus.Published),
            Trail(HengillId, "Hengill", "hengill", TrailStatus.Published),
            Trail(ArchivedId, "Gone", "gone", TrailStatus.Archived));

        void View(Guid trailId, double daysAgo, string? ipHash) =>
            context.TrailViews.Add(new TrailView
            {
                Id = Guid.NewGuid(),
                TrailId = trailId,
                ViewedAtUtc = _now.AddDays(-daysAgo),
                IpHash = ipHash,
            });

        // Esja — 4 views this week from 2 visitors, 1 last week.
        View(EsjaId, 1, "aaa");
        View(EsjaId, 2, "aaa");
        View(EsjaId, 3, "bbb");
        View(EsjaId, 4, "bbb");
        View(EsjaId, 9, "aaa");

        // Hengill — 1 this week, 2 last week, so it is trending downward.
        View(HengillId, 2, "ccc");
        View(HengillId, 8, "ccc");
        View(HengillId, 10, "ddd");

        // A view with no IP hash: counted as a view, but not as a visitor.
        View(HengillId, 3, null);

        // Archived trail — excluded from trail-keyed results, but its views
        // still count toward the totals, as before.
        View(ArchivedId, 1, "eee");

        // Older than 30 days: outside the daily window, inside the totals.
        View(EsjaId, 40, "fff");

        context.SaveChanges();
    }

    private async Task<AnalyticsDto> Run()
    {
        await using UtanvegaDbContext context = _factory.CreateContext();
        var handler = new GetAnalyticsQueryHandler(context);
        return await handler.Handle(new GetAnalyticsQuery(), CancellationToken.None);
    }

    // ── Summary ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Summary_CountsEveryView_IncludingArchivedAndUndated()
    {
        var result = await Run();
        Assert.Equal(11, result.Summary.TotalViews);
    }

    [Fact]
    public async Task Summary_CountsDistinctVisitors_IgnoringNullHashes()
    {
        var result = await Run();
        // aaa, bbb, ccc, ddd, eee, fff — the null-hash view is not a visitor.
        Assert.Equal(6, result.Summary.UniqueVisitors);
    }

    [Fact]
    public async Task Summary_SplitsThisWeekFromLastWeek()
    {
        var result = await Run();
        // This week: 4 Esja + 2 Hengill (one null-hash) + 1 archived = 7.
        Assert.Equal(7, result.Summary.ViewsThisWeek);
        // Last week: 1 Esja + 2 Hengill = 3. The 40-day-old view is in neither.
        Assert.Equal(3, result.Summary.ViewsLastWeek);
    }

    [Fact]
    public async Task Summary_AveragesOverTrailsThatHaveViews()
    {
        var result = await Run();
        Assert.Equal(3, result.Summary.TrailsWithViews);
        Assert.Equal(Math.Round(11d / 3, 1), result.Summary.AvgViewsPerTrail);
    }

    // ── Daily ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task DailyViews_CoverThirtyDays_AndExcludeOlder()
    {
        var result = await Run();
        var oldest = _now.AddDays(-40).ToString("yyyy-MM-dd");
        Assert.DoesNotContain(result.DailyViews, d => d.Date == oldest);
        Assert.Equal(10, result.DailyViews.Sum(d => d.Views));
    }

    [Fact]
    public async Task DailyViews_DoNotCountANullHashAsAVisitor()
    {
        // Three days ago holds two views — Esja from "bbb" and Hengill with no
        // hash — so one identified visitor. Counting distinct values without
        // excluding nulls would report two, inflating every day that contains
        // an unidentified view. Views from before the retention sweep have no
        // hash at all, so that would be most days eventually.
        var result = await Run();
        var day = result.DailyViews.Single(d => d.Date == _now.AddDays(-3).ToString("yyyy-MM-dd"));
        Assert.Equal(2, day.Views);
        Assert.Equal(1, day.UniqueVisitors);
    }

    [Fact]
    public async Task DailyViews_AreOrderedOldestFirst()
    {
        var result = await Run();
        Assert.Equal(result.DailyViews.OrderBy(d => d.Date).Select(d => d.Date), result.DailyViews.Select(d => d.Date));
    }

    // ── Hourly ────────────────────────────────────────────────────────────

    [Fact]
    public async Task HourlyViews_CoverAllTime_AndAreOrderedByHour()
    {
        var result = await Run();
        Assert.Equal(11, result.HourlyViews.Sum(h => h.Views));
        Assert.Equal(result.HourlyViews.OrderBy(h => h.Hour).Select(h => h.Hour), result.HourlyViews.Select(h => h.Hour));
        Assert.All(result.HourlyViews, h => Assert.InRange(h.Hour, 0, 23));
    }

    // ── Top trails ────────────────────────────────────────────────────────

    [Fact]
    public async Task TopTrails_RankByViewCount_AndExcludeArchived()
    {
        var result = await Run();
        Assert.Equal(["esja", "hengill"], result.TopTrails.Select(t => t.Slug));
        Assert.DoesNotContain(result.TopTrails, t => t.Slug == "gone");
    }

    [Fact]
    public async Task TopTrails_CountViewsPerTrail()
    {
        var result = await Run();
        Assert.Equal(6, result.TopTrails.Single(t => t.Slug == "esja").ViewCount);
        Assert.Equal(4, result.TopTrails.Single(t => t.Slug == "hengill").ViewCount);
    }

    // ── Trending ──────────────────────────────────────────────────────────

    [Fact]
    public async Task TrendingTrails_CompareThisWeekWithLast()
    {
        var result = await Run();

        var esja = result.TrendingTrails.Single(t => t.Slug == "esja");
        Assert.Equal(4, esja.ViewsThisWeek);
        Assert.Equal(1, esja.ViewsLastWeek);
        Assert.Equal(300.0, esja.ChangePercent);

        var hengill = result.TrendingTrails.Single(t => t.Slug == "hengill");
        Assert.Equal(2, hengill.ViewsThisWeek);
        Assert.Equal(2, hengill.ViewsLastWeek);
        Assert.Equal(0.0, hengill.ChangePercent);
    }

    [Fact]
    public async Task TrendingTrails_ExcludeArchived_AndAreOrderedByThisWeek()
    {
        var result = await Run();
        Assert.DoesNotContain(result.TrendingTrails, t => t.Slug == "gone");
        Assert.Equal(
            result.TrendingTrails.OrderByDescending(t => t.ViewsThisWeek).Select(t => t.Slug),
            result.TrendingTrails.Select(t => t.Slug));
    }

    [Fact]
    public async Task TrendingTrails_TreatGrowthFromZeroAsFullyNew()
    {
        // A trail seen only this week has no baseline to divide by; the
        // previous implementation reported +100% rather than dividing by zero.
        using (var context = _factory.CreateContext())
        {
            var id = Guid.NewGuid();
            context.Trails.Add(Trail(id, "Brand new", "brand-new", TrailStatus.Published));
            context.TrailViews.Add(new TrailView
            {
                Id = Guid.NewGuid(),
                TrailId = id,
                ViewedAtUtc = _now.AddDays(-1),
                IpHash = "zzz",
            });
            context.SaveChanges();
        }

        var result = await Run();
        Assert.Equal(100.0, result.TrendingTrails.Single(t => t.Slug == "brand-new").ChangePercent);
    }
}
