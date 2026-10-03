using Microsoft.Extensions.Configuration;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Application.Trails.Queries.GetTrailGpx;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

// #1173: GetTrailGpxQueryHandler used to hardcode "Hlaupadagskra.is" as the GPX creator/text
// regardless of the request's lang — these tests lock in the lang-aware brand resolution
// (mirroring GetEventCalendarIcs's isEnglish branch) and the per-lang cache key.
public class GetTrailGpxQueryHandlerTests : IDisposable
{
    private static readonly GeometryFactory Factory = new(new PrecisionModel(), 4326);

    private readonly TestDbContextFactory _factory;

    public GetTrailGpxQueryHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private static LineString SimpleLine() => Factory.CreateLineString(new[]
    {
        new CoordinateZ(-21.90, 64.13, 10),
        new CoordinateZ(-21.89, 64.14, 45),
    });

    private static Trail CreateTestTrail(string name)
    {
        return new Trail
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Length = 5000,
            ActivityTypeId = ActivityType.Hiking,
            Type = TrailType.Loop,
            Difficulty = Difficulty.Easy,
            Visibility = Visibility.Public,
            GpxData = SimpleLine(),
        };
    }

    // Empty IConfiguration — handler must fall back to CalendarHostHelpers.DefaultSiteUrl /
    // DefaultSiteUrlEn, same as GetEventCalendarIcs does when SiteUrl/SiteUrlEn are unset.
    private static IConfiguration EmptyConfiguration() =>
        new ConfigurationBuilder().Build();

    [Fact]
    public async Task Handle_NoLang_UsesDefaultIcelandicBrand()
    {
        var trail = CreateTestTrail("Mountain Loop");
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailGpxQueryHandler(ctx, EmptyConfiguration());
            var result = await handler.Handle(new GetTrailGpxQuery(trail.Slug), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Contains("creator=\"Hlaupadagskra.is\"", result!.Content);
            Assert.Contains("<text>Hlaupadagskra.is</text>", result.Content);
            Assert.Contains(CalendarHostHelpers.DefaultSiteUrl, result.Content);
        }
    }

    [Fact]
    public async Task Handle_LangEn_UsesEnglish360RunsBrand()
    {
        var trail = CreateTestTrail("Mountain Loop");
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailGpxQueryHandler(ctx, EmptyConfiguration());
            var result = await handler.Handle(new GetTrailGpxQuery(trail.Slug, "en"), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Contains("creator=\"360Runs.com\"", result!.Content);
            Assert.Contains("<text>360Runs.com</text>", result.Content);
            Assert.Contains(CalendarHostHelpers.DefaultSiteUrlEn, result.Content);
            Assert.DoesNotContain("Hlaupadagskra.is", result.Content);
        }
    }

    [Theory]
    [InlineData("EN")]
    [InlineData("En")]
    public async Task Handle_LangIsCaseInsensitive(string lang)
    {
        var trail = CreateTestTrail("Mountain Loop");
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailGpxQueryHandler(ctx, EmptyConfiguration());
            var result = await handler.Handle(new GetTrailGpxQuery(trail.Slug, lang), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Contains("360Runs.com", result!.Content);
        }
    }

    [Fact]
    public async Task Handle_TrailWithoutGpxData_ReturnsNull()
    {
        var trail = CreateTestTrail("No Gpx Trail");
        trail.GpxData = null;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailGpxQueryHandler(ctx, EmptyConfiguration());
            var result = await handler.Handle(new GetTrailGpxQuery(trail.Slug), CancellationToken.None);

            Assert.Null(result);
        }
    }

    [Fact]
    public async Task Handle_UnknownSlug_ReturnsNull()
    {
        using var ctx = _factory.CreateContext();
        var handler = new GetTrailGpxQueryHandler(ctx, EmptyConfiguration());
        var result = await handler.Handle(new GetTrailGpxQuery("does-not-exist"), CancellationToken.None);

        Assert.Null(result);
    }

    // --- Cache key distinctness (#1173) ---

    [Fact]
    public void CacheKey_DiffersByLang()
    {
        var defaultQuery = new GetTrailGpxQuery("mountain-loop");
        var englishQuery = new GetTrailGpxQuery("mountain-loop", "en");

        Assert.NotEqual(defaultQuery.CacheKey, englishQuery.CacheKey);
        Assert.Equal(CacheKeys.Gpx("mountain-loop", false), defaultQuery.CacheKey);
        Assert.Equal(CacheKeys.Gpx("mountain-loop", true), englishQuery.CacheKey);
    }

    [Fact]
    public void CacheKey_UnknownLang_FallsBackToDefaultIcelandicKey()
    {
        // Anything other than "en" (case-insensitively) is treated as the Icelandic/default path,
        // matching GetEventCalendarIcs's isEnglish check.
        var query = new GetTrailGpxQuery("mountain-loop", "is");

        Assert.Equal(CacheKeys.Gpx("mountain-loop", false), query.CacheKey);
    }
}
