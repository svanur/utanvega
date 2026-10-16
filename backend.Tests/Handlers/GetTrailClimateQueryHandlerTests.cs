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

// #1335: GetTrailClimateQuery adds an always-visible "climate normals" section (historical
// averages, Open-Meteo's archive API) independent of GetTrailWeatherQuery's live 7-day forecast.
// These tests cover: trail/coordinate resolution (mirroring GetTrailWeatherQueryHandlerTests'
// sibling, which doesn't exist yet — there is no prior weather handler test coverage to mirror),
// the server-side aggregation math (internal Aggregate, tested directly so no HTTP mocking is
// needed for the arithmetic), caching, and graceful failure when Open-Meteo is unreachable.
public class GetTrailClimateQueryHandlerTests : IDisposable
{
    private static readonly GeometryFactory Factory = new(new PrecisionModel(), 4326);

    private readonly TestDbContextFactory _factory;
    private readonly IMemoryCache _cache;

    public GetTrailClimateQueryHandlerTests()
    {
        _factory = new TestDbContextFactory();
        _cache = new MemoryCache(new MemoryCacheOptions());
    }

    public void Dispose()
    {
        _factory.Dispose();
        _cache.Dispose();
    }

    private static LineString SimpleLine() => Factory.CreateLineString(new[]
    {
        new CoordinateZ(-21.90, 64.13, 10),
        new CoordinateZ(-21.89, 64.14, 45),
    });

    private static Trail CreateTestTrail(string name, bool withGpx = true)
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
            // TrailStatus defaults to Draft (enum value 0) — the handler's lookup filters to
            // Published/EventOnly only, same as GetTrailWeatherQuery, so this must be explicit.
            Status = TrailStatus.Published,
            GpxData = withGpx ? SimpleLine() : null,
        };
    }

    // 11 identical days (±5 day window) per year — every mocked HTTP call returns this same body
    // regardless of the start_date/end_date it was asked for, since these tests exercise the
    // handler's orchestration/caching, not Open-Meteo's own date-window behaviour.
    private const string FakeArchiveJson = """
        {
            "daily": {
                "time": ["2024-01-11","2024-01-12","2024-01-13","2024-01-14","2024-01-15","2024-01-16","2024-01-17","2024-01-18","2024-01-19","2024-01-20","2024-01-21"],
                "temperature_2m_max": [10,10,10,10,10,10,10,10,10,10,10],
                "temperature_2m_min": [2,2,2,2,2,2,2,2,2,2,2],
                "precipitation_sum": [0,0,0,0,0,0,0,0,0,0,1.0],
                "wind_speed_10m_max": [5,5,5,5,5,5,5,5,5,5,5]
            }
        }
        """;

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

    private static Mock<HttpMessageHandler> MockHandlerThrowing()
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("Open-Meteo archive unreachable"));
        return handlerMock;
    }

    private static Mock<IHttpClientFactory> FactoryFor(HttpMessageHandler handler)
    {
        var httpClient = new HttpClient(handler);
        var factoryMock = new Mock<IHttpClientFactory>();
        factoryMock.Setup(f => f.CreateClient("OpenMeteo")).Returns(httpClient);
        return factoryMock;
    }

    // --- Trail/coordinate resolution (mirrors GetTrailWeatherQuery's null-on-failure handling) ---

    [Fact]
    public async Task Handle_UnknownSlug_ReturnsNull()
    {
        using var ctx = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetTrailClimateQueryHandler(ctx, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetTrailClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetTrailClimateQuery("does-not-exist", 7, 15), CancellationToken.None);

        Assert.Null(result);
        handlerMock.Protected().Verify("SendAsync", Times.Never(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task Handle_TrailWithoutGpxData_ReturnsNull()
    {
        var trail = CreateTestTrail("No Gpx Trail", withGpx: false);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetTrailClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetTrailClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetTrailClimateQuery(trail.Slug, 7, 15), CancellationToken.None);

        Assert.Null(result);
        handlerMock.Protected().Verify("SendAsync", Times.Never(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    // --- Archive API reachable: coordinate resolves and climate normals are aggregated ---

    [Fact]
    public async Task Handle_ResolvedCoordinate_ReturnsAggregatedClimate()
    {
        var trail = CreateTestTrail("Mountain Loop");
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetTrailClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetTrailClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetTrailClimateQuery(trail.Slug, 7, 15), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(10, result!.AverageHigh);
        Assert.Equal(2, result.AverageLow);
        Assert.Equal(5, result.AverageMaxWind);
        Assert.Equal(15, result.YearsOfData);
        Assert.Equal(7, result.TargetMonth);
        Assert.Equal(15, result.TargetDay);
        // 1 wet day out of 11 per year, every year — same ratio regardless of year count.
        Assert.Equal(Math.Round(1.0 / 11, 2), result.PrecipitationChance);
    }

    // --- Caching (mirrors GetTrailWeatherQuery's IMemoryCache pattern) ---

    [Fact]
    public async Task Handle_CalledTwice_SecondCallIsServedFromCache()
    {
        var trail = CreateTestTrail("Cached Trail");
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var factory = FactoryFor(handlerMock.Object).Object;

        using (var ctx2 = _factory.CreateContext())
        {
            var handler = new GetTrailClimateQueryHandler(ctx2, factory, _cache, NullLogger<GetTrailClimateQueryHandler>.Instance);
            var first = await handler.Handle(new GetTrailClimateQuery(trail.Slug, 7, 15), CancellationToken.None);
            Assert.NotNull(first);
        }

        var callsAfterFirst = GetSendAsyncInvocationCount(handlerMock);

        using (var ctx3 = _factory.CreateContext())
        {
            var handler = new GetTrailClimateQueryHandler(ctx3, factory, _cache, NullLogger<GetTrailClimateQueryHandler>.Instance);
            var second = await handler.Handle(new GetTrailClimateQuery(trail.Slug, 7, 15), CancellationToken.None);
            Assert.NotNull(second);
        }

        var callsAfterSecond = GetSendAsyncInvocationCount(handlerMock);

        // No additional Open-Meteo calls on the second (cached) call.
        Assert.Equal(callsAfterFirst, callsAfterSecond);
    }

    private static int GetSendAsyncInvocationCount(Mock<HttpMessageHandler> handlerMock) =>
        handlerMock.Invocations.Count(i => i.Method.Name == "SendAsync");

    [Fact]
    public async Task Handle_DifferentDay_IsNotServedFromTheOtherDaysCacheEntry()
    {
        var trail = CreateTestTrail("Distinct Cache Trail");
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var factory = FactoryFor(handlerMock.Object).Object;

        using (var ctx2 = _factory.CreateContext())
        {
            var handler = new GetTrailClimateQueryHandler(ctx2, factory, _cache, NullLogger<GetTrailClimateQueryHandler>.Instance);
            await handler.Handle(new GetTrailClimateQuery(trail.Slug, 7, 15), CancellationToken.None);
        }
        var callsAfterFirst = GetSendAsyncInvocationCount(handlerMock);

        using (var ctx3 = _factory.CreateContext())
        {
            var handler = new GetTrailClimateQueryHandler(ctx3, factory, _cache, NullLogger<GetTrailClimateQueryHandler>.Instance);
            await handler.Handle(new GetTrailClimateQuery(trail.Slug, 8, 1), CancellationToken.None);
        }
        var callsAfterSecond = GetSendAsyncInvocationCount(handlerMock);

        // A different (month, day) is a different cache key — it must hit Open-Meteo again.
        Assert.True(callsAfterSecond > callsAfterFirst);
    }

    // --- Graceful failure (mirrors GetTrailWeatherQuery's try/catch-and-return-null) ---

    [Fact]
    public async Task Handle_ArchiveApiUnreachable_ReturnsNullRatherThanThrowing()
    {
        var trail = CreateTestTrail("Unreachable Trail");
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerThrowing();
        var handler = new GetTrailClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetTrailClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetTrailClimateQuery(trail.Slug, 7, 15), CancellationToken.None);

        Assert.Null(result);
    }

    // --- Aggregation math, tested directly (internal, no HTTP mocking needed) ---

    private static OpenMeteoArchiveResponse YearResponse(double hi, double lo, double precip, double wind) => new()
    {
        Daily = new OpenMeteoArchiveDaily
        {
            Time = ["2024-01-15"],
            Temperature2mMax = [hi],
            Temperature2mMin = [lo],
            PrecipitationSum = [precip],
            WindSpeed10mMax = [wind],
        },
    };

    [Fact]
    public void Aggregate_AllYearsHaveData_ComputesAverages()
    {
        var responses = new List<OpenMeteoArchiveResponse?>
        {
            YearResponse(10, 0, 0, 4),
            YearResponse(12, 2, 2, 6),
        };

        var result = GetTrailClimateQueryHandler.Aggregate(responses, 7, 15);

        Assert.NotNull(result);
        Assert.Equal(11, result!.AverageHigh);
        Assert.Equal(1, result.AverageLow);
        Assert.Equal(1, result.AveragePrecipitation);
        Assert.Equal(5, result.AverageMaxWind);
        Assert.Equal(2, result.YearsOfData);
    }

    [Fact]
    public void Aggregate_SomeYearsNull_IgnoresMissingYearsButStillSucceeds()
    {
        var responses = new List<OpenMeteoArchiveResponse?>
        {
            null,
            YearResponse(10, 0, 0, 4),
            null,
        };

        var result = GetTrailClimateQueryHandler.Aggregate(responses, 7, 15);

        Assert.NotNull(result);
        Assert.Equal(1, result!.YearsOfData);
        Assert.Equal(10, result.AverageHigh);
    }

    [Fact]
    public void Aggregate_NoDataAtAll_ReturnsNull()
    {
        var responses = new List<OpenMeteoArchiveResponse?> { null, null, null };

        var result = GetTrailClimateQueryHandler.Aggregate(responses, 7, 15);

        Assert.Null(result);
    }

    [Fact]
    public void Aggregate_MeasurablePrecipitationThreshold_CountsOnlyDaysAtOrAboveThreshold()
    {
        var responses = new List<OpenMeteoArchiveResponse?>
        {
            new()
            {
                Daily = new OpenMeteoArchiveDaily
                {
                    Time = ["2024-01-14", "2024-01-15", "2024-01-16"],
                    Temperature2mMax = [10, 10, 10],
                    Temperature2mMin = [2, 2, 2],
                    // 0.05mm is dew/mist noise (below the 0.1mm threshold), 0.1mm and 3mm count.
                    PrecipitationSum = [0.05, 0.1, 3],
                    WindSpeed10mMax = [4, 4, 4],
                },
            },
        };

        var result = GetTrailClimateQueryHandler.Aggregate(responses, 7, 15);

        Assert.NotNull(result);
        Assert.Equal(Math.Round(2.0 / 3, 2), result!.PrecipitationChance);
    }
}
