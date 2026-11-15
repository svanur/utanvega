using System.Net;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Moq.Protected;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Weather.Queries;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

// #1801: GetLocationClimateQuery is the Location-keyed sibling of GetEventClimateQuery — same
// climate-normals shape (ClimateDto, Aggregate reused directly from
// GetEventClimateQueryHandlerTests' coverage of the aggregation math itself), but resolved from a
// Location slug/Center instead of an Event's linked Location. These tests mirror
// GetEventClimateQueryHandlerTests' structure, scoped to just the pieces that differ here:
// Location-by-slug resolution (including "unknown slug" / "no Center" -> null), the
// Country|Area|Region approximate-flag rule, and caching under the location-scoped cache key. The
// aggregation arithmetic itself is already covered by GetEventClimateQueryHandlerTests' Aggregate
// tests and is not re-tested here, since Aggregate is called directly, unmodified.
public class GetLocationClimateQueryHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly IMemoryCache _cache;

    public GetLocationClimateQueryHandlerTests()
    {
        _factory = new TestDbContextFactory();
        _cache = new MemoryCache(new MemoryCacheOptions());
    }

    public void Dispose()
    {
        _factory.Dispose();
        _cache.Dispose();
    }

    private static Core.Entities.Location CreateTestLocation(double? lat, double? lng, LocationType type = LocationType.Place) => new()
    {
        Id = Guid.NewGuid(),
        Name = "Test Location",
        Slug = "test-location-" + Guid.NewGuid(),
        Center = lat.HasValue && lng.HasValue ? new Point(lng.Value, lat.Value) { SRID = 4326 } : null,
        Type = type,
    };

    // Mirrors GetEventClimateQueryHandlerTests' BuildFakeArchiveJson — 15 real anniversary windows
    // (±5 days) computed from "today", 1 measurable-precipitation day per window.
    private static string BuildFakeArchiveJson(int targetMonth, int targetDay)
    {
        var currentYear = DateTime.UtcNow.Year;
        var years = Enumerable.Range(currentYear - 15, 15);
        var dates = new List<string>();
        var highs = new List<string>();
        var lows = new List<string>();
        var precs = new List<string>();
        var precHours = new List<string>();
        var sunshine = new List<string>();
        var winds = new List<string>();

        foreach (var year in years)
        {
            var day = Math.Min(targetDay, DateTime.DaysInMonth(year, targetMonth));
            var targetDate = new DateTime(year, targetMonth, day);
            for (var offset = -5; offset <= 5; offset++)
            {
                dates.Add($"\"{targetDate.AddDays(offset):yyyy-MM-dd}\"");
                highs.Add("10");
                lows.Add("2");
                precs.Add(offset == 5 ? "1.0" : "0");
                precHours.Add(offset == 5 ? "1" : "0");
                sunshine.Add("28800"); // 8 hours, every day
                winds.Add("5");
            }
        }

        return "{\"daily\":{" +
               "\"time\":[" + string.Join(",", dates) + "]," +
               "\"temperature_2m_max\":[" + string.Join(",", highs) + "]," +
               "\"temperature_2m_min\":[" + string.Join(",", lows) + "]," +
               "\"precipitation_sum\":[" + string.Join(",", precs) + "]," +
               "\"precipitation_hours\":[" + string.Join(",", precHours) + "]," +
               "\"sunshine_duration\":[" + string.Join(",", sunshine) + "]," +
               "\"wind_speed_10m_max\":[" + string.Join(",", winds) + "]" +
               "}}";
    }

    private static readonly string FakeArchiveJson = BuildFakeArchiveJson(7, 15);

    private static Mock<HttpMessageHandler> MockHandlerReturning(string json)
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(() => new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            });
        return handlerMock;
    }

    private static Mock<IHttpClientFactory> FactoryFor(HttpMessageHandler handler)
    {
        var httpClient = new HttpClient(handler);
        var factoryMock = new Mock<IHttpClientFactory>();
        factoryMock.Setup(f => f.CreateClient("OpenMeteo")).Returns(httpClient);
        return factoryMock;
    }

    // --- Location resolution ---

    [Fact]
    public async Task Handle_UnknownSlug_ReturnsNull()
    {
        using var ctx = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetLocationClimateQueryHandler(ctx, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetLocationClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetLocationClimateQuery("does-not-exist", 7, 15), CancellationToken.None);

        Assert.Null(result);
        handlerMock.Protected().Verify("SendAsync", Times.Never(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task Handle_LocationWithNoCenter_ReturnsNull()
    {
        var location = CreateTestLocation(null, null);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(location);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetLocationClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetLocationClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetLocationClimateQuery(location.Slug, 7, 15), CancellationToken.None);

        Assert.Null(result);
        handlerMock.Protected().Verify("SendAsync", Times.Never(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    // --- Archive API reachable: coordinate resolves and climate normals are aggregated ---

    [Fact]
    public async Task Handle_LocationWithCenter_ReturnsAggregatedClimate()
    {
        var location = CreateTestLocation(64.13, -21.90);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(location);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetLocationClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetLocationClimateQueryHandler>.Instance);

        var climate = await handler.Handle(new GetLocationClimateQuery(location.Slug, 7, 15), CancellationToken.None);

        Assert.NotNull(climate);
        Assert.Equal(10, climate!.AverageHigh);
        Assert.Equal(2, climate.AverageLow);
        Assert.Equal(5, climate.AverageMaxWind);
        Assert.Equal(15, climate.YearsOfData);
        Assert.Equal(7, climate.TargetMonth);
        Assert.Equal(15, climate.TargetDay);
        Assert.Equal(64.13, climate.Lat);
        Assert.Equal(-21.90, climate.Lon);
        // #1414 rule: a Place-type Location is precise enough — not flagged approximate.
        Assert.False(climate.IsApproximate);
        // One wide call, same #1356 approach GetEventClimateQueryHandler uses.
        handlerMock.Protected().Verify("SendAsync", Times.Exactly(1), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task Handle_MunicipalityLocation_IsNotApproximate()
    {
        var location = CreateTestLocation(64.13, -21.90, LocationType.Municipality);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(location);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetLocationClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetLocationClimateQueryHandler>.Instance);

        var climate = await handler.Handle(new GetLocationClimateQuery(location.Slug, 7, 15), CancellationToken.None);

        Assert.NotNull(climate);
        Assert.False(climate!.IsApproximate);
    }

    [Theory]
    [InlineData(LocationType.Country)]
    [InlineData(LocationType.Area)]
    [InlineData(LocationType.Region)]
    public async Task Handle_BroadLocationTypes_AreFlaggedApproximate(LocationType type)
    {
        var location = CreateTestLocation(64.13, -21.90, type);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(location);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetLocationClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetLocationClimateQueryHandler>.Instance);

        var climate = await handler.Handle(new GetLocationClimateQuery(location.Slug, 7, 15), CancellationToken.None);

        Assert.NotNull(climate);
        // #1414 rule: Country/Area/Region-type Locations are a broad fallback — flagged
        // approximate so the frontend can signal it.
        Assert.True(climate!.IsApproximate);
    }

    // --- Caching (mirrors GetEventClimateQueryHandlerTests' IMemoryCache coverage) ---

    [Fact]
    public async Task Handle_CalledTwice_SecondCallIsServedFromCache()
    {
        var location = CreateTestLocation(64.13, -21.90);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(location);
            await ctx.SaveChangesAsync();
        }

        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var factory = FactoryFor(handlerMock.Object).Object;

        using (var ctx2 = _factory.CreateContext())
        {
            var handler = new GetLocationClimateQueryHandler(ctx2, factory, _cache, NullLogger<GetLocationClimateQueryHandler>.Instance);
            var first = await handler.Handle(new GetLocationClimateQuery(location.Slug, 7, 15), CancellationToken.None);
            Assert.NotNull(first);
        }

        var callsAfterFirst = GetSendAsyncInvocationCount(handlerMock);

        using (var ctx3 = _factory.CreateContext())
        {
            var handler = new GetLocationClimateQueryHandler(ctx3, factory, _cache, NullLogger<GetLocationClimateQueryHandler>.Instance);
            var second = await handler.Handle(new GetLocationClimateQuery(location.Slug, 7, 15), CancellationToken.None);
            Assert.NotNull(second);
        }

        var callsAfterSecond = GetSendAsyncInvocationCount(handlerMock);

        // No additional Open-Meteo calls on the second (cached) call.
        Assert.Equal(callsAfterFirst, callsAfterSecond);
    }

    private static int GetSendAsyncInvocationCount(Mock<HttpMessageHandler> handlerMock) =>
        handlerMock.Invocations.Count(i => i.Method.Name == "SendAsync");

    [Fact]
    public async Task Handle_CacheKey_IsLocationScopedNotSharedWithEventFormat()
    {
        // The event path's cache key format is "climate:event:{slug}:{month}:{day}" — an event
        // slug and a location slug could theoretically be the same raw string, so this handler
        // must not accidentally read (or poison) an entry the event handler already cached under
        // that other format.
        var location = CreateTestLocation(64.13, -21.90);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(location);
            await ctx.SaveChangesAsync();
        }

        _cache.Set($"climate:event:{location.Slug}:7:15", (ClimateDto?)null);

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetLocationClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetLocationClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetLocationClimateQuery(location.Slug, 7, 15), CancellationToken.None);

        // Had the handler read the event-format cache entry, this would come back null instead.
        Assert.NotNull(result);
    }
}
