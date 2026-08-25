using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Analytics.Queries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;
using Xunit;

namespace Utanvega.Backend.Tests.Handlers;

/// <summary>
/// Runs the analytics handler against a real Postgres.
///
/// <para>
/// The other analytics tests use SQLite, which is more permissive about
/// COUNT(DISTINCT) inside a grouping and about date/hour extraction, so passing
/// there does not prove Npgsql will accept the same LINQ. Production is
/// Postgres, and a query that fails to translate throws at request time rather
/// than at build time.
/// </para>
///
/// <para>
/// Skipped unless ANALYTICS_TEST_POSTGRES points at a reachable database, so
/// the suite stays runnable without Docker:
/// <c>docker run -d --rm -e POSTGRES_PASSWORD=test -e POSTGRES_DB=analytics
/// -p 55433:5432 postgis/postgis:16-3.4</c>
/// </para>
/// </summary>
public class AnalyticsPostgresTranslationTests
{
    private static string? ConnectionString =>
        Environment.GetEnvironmentVariable("ANALYTICS_TEST_POSTGRES");

    [SkippableFact]
    public async Task Handler_TranslatesAndAggregatesOnPostgres()
    {
        var connectionString = ConnectionString;
        Skip.If(string.IsNullOrWhiteSpace(connectionString),
            "Set ANALYTICS_TEST_POSTGRES to run this against a real Postgres.");

        var options = new DbContextOptionsBuilder<UtanvegaDbContext>()
            .UseNpgsql(connectionString, o => o.UseNetTopologySuite())
            .Options;

        await using var context = new UtanvegaDbContext(options);
        await context.Database.EnsureDeletedAsync();
        await context.Database.EnsureCreatedAsync();

        var now = DateTime.UtcNow;
        var esja = Guid.NewGuid();
        var hengill = Guid.NewGuid();
        var archived = Guid.NewGuid();

        static Trail NewTrail(Guid id, string name, string slug, TrailStatus status) => new()
        {
            Id = id, Name = name, Slug = slug, Status = status, Length = 10_000, ElevationGain = 500,
        };

        context.Trails.AddRange(
            NewTrail(esja, "Esja", "esja", TrailStatus.Published),
            NewTrail(hengill, "Hengill", "hengill", TrailStatus.Published),
            NewTrail(archived, "Gone", "gone", TrailStatus.Archived));

        void View(Guid trailId, double daysAgo, string? ipHash) =>
            context.TrailViews.Add(new TrailView
            {
                Id = Guid.NewGuid(), TrailId = trailId, ViewedAtUtc = now.AddDays(-daysAgo), IpHash = ipHash,
            });

        View(esja, 1, "aaa"); View(esja, 2, "aaa"); View(esja, 3, "bbb");
        View(esja, 4, "bbb"); View(esja, 9, "aaa");
        View(hengill, 2, "ccc"); View(hengill, 8, "ccc"); View(hengill, 10, "ddd");
        View(hengill, 3, null);
        View(archived, 1, "eee");
        View(esja, 40, "fff");

        await context.SaveChangesAsync();

        var handler = new GetAnalyticsQueryHandler(context);
        var result = await handler.Handle(new GetAnalyticsQuery(), CancellationToken.None);

        // Same expectations as the SQLite tests — the point is that Postgres
        // produces them too, from SQL rather than in-process grouping.
        Assert.Equal(11, result.Summary.TotalViews);
        Assert.Equal(6, result.Summary.UniqueVisitors);
        Assert.Equal(7, result.Summary.ViewsThisWeek);
        Assert.Equal(3, result.Summary.ViewsLastWeek);
        Assert.Equal(3, result.Summary.TrailsWithViews);
        Assert.Equal(Math.Round(11d / 3, 1), result.Summary.AvgViewsPerTrail);

        Assert.Equal(10, result.DailyViews.Sum(d => d.Views));
        Assert.Equal(11, result.HourlyViews.Sum(h => h.Views));
        Assert.All(result.HourlyViews, h => Assert.InRange(h.Hour, 0, 23));

        Assert.Equal(["esja", "hengill"], result.TopTrails.Select(t => t.Slug));
        Assert.Equal(6, result.TopTrails.Single(t => t.Slug == "esja").ViewCount);
        Assert.Equal(3, result.TopTrails.Single(t => t.Slug == "esja").UniqueVisitors);

        Assert.Equal(300.0, result.TrendingTrails.Single(t => t.Slug == "esja").ChangePercent);
        Assert.Equal(0.0, result.TrendingTrails.Single(t => t.Slug == "hengill").ChangePercent);
        Assert.DoesNotContain(result.TrendingTrails, t => t.Slug == "gone");
    }
}
