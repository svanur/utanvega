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

// #1335: GetEventClimateQuery adds an always-visible "climate normals" section (historical
// averages, Open-Meteo's archive API) independent of GetTrailWeatherQuery's live 7-day forecast.
// Climate is event data, not trail data — the coordinate source is the event's own
// GpxPointLat/Lng, falling back to its Location's center, never a race's attached trail. These
// tests cover: that coordinate resolution (including "neither exists" -> null), the server-side
// aggregation math (internal Aggregate, tested directly so no HTTP mocking is needed for the
// arithmetic), caching, and graceful failure when Open-Meteo is unreachable.
public class GetEventClimateQueryHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly IMemoryCache _cache;

    public GetEventClimateQueryHandlerTests()
    {
        _factory = new TestDbContextFactory();
        _cache = new MemoryCache(new MemoryCacheOptions());
    }

    public void Dispose()
    {
        _factory.Dispose();
        _cache.Dispose();
    }

    private static Event CreateTestEvent(string name, double? gpxLat = null, double? gpxLng = null, Core.Entities.Location? location = null)
    {
        return new Event
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Type = EventType.Race,
            ActivityType = ActivityType.TrailRunning,
            Status = EventStatus.Confirmed,
            GpxPointLat = gpxLat,
            GpxPointLng = gpxLng,
            Location = location,
            LocationId = location?.Id,
        };
    }

    private static Core.Entities.Location CreateTestLocation(double lat, double lng, LocationType type = LocationType.Place) => new()
    {
        Id = Guid.NewGuid(),
        Name = "Test Location",
        Slug = "test-location-" + Guid.NewGuid(),
        Center = new Point(lng, lat) { SRID = 4326 },
        Type = type,
    };

    // #1356: the handler now makes ONE wide call instead of one per year, so the mocked response
    // body must actually contain the 15 real anniversary windows the new Aggregate filters against
    // (computed from "today" the same way GetEventClimateQueryHandler.Handle does) — a single
    // static fixture can no longer stand in for every year regardless of its dates, since dates now
    // matter. 11 identical days (±5 day window) per year, one measurable-precipitation day per
    // window (its last day) — same 1-wet-day-in-11 ratio the pre-#1356 fixture used.
    private static string BuildFakeArchiveJson(int targetMonth, int targetDay)
    {
        var currentYear = DateTime.UtcNow.Year;
        var years = Enumerable.Range(currentYear - 15, 15);
        var dates = new List<string>();
        var highs = new List<string>();
        var lows = new List<string>();
        var precs = new List<string>();
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
                winds.Add("5");
            }
        }

        return "{\"daily\":{" +
               "\"time\":[" + string.Join(",", dates) + "]," +
               "\"temperature_2m_max\":[" + string.Join(",", highs) + "]," +
               "\"temperature_2m_min\":[" + string.Join(",", lows) + "]," +
               "\"precipitation_sum\":[" + string.Join(",", precs) + "]," +
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

    // --- Event/coordinate resolution ---

    [Fact]
    public async Task Handle_UnknownSlug_ReturnsNull()
    {
        using var ctx = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetEventClimateQueryHandler(ctx, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetEventClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetEventClimateQuery("does-not-exist", 7, 15), CancellationToken.None);

        Assert.Null(result);
        handlerMock.Protected().Verify("SendAsync", Times.Never(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task Handle_EventWithNeitherGpxPointNorLocation_ReturnsNull()
    {
        var @event = CreateTestEvent("No Coordinate Event");
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(@event);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetEventClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetEventClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetEventClimateQuery(@event.Slug, 7, 15), CancellationToken.None);

        Assert.Null(result);
        handlerMock.Protected().Verify("SendAsync", Times.Never(), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    // --- Archive API reachable: coordinate resolves and climate normals are aggregated ---

    [Fact]
    public async Task Handle_EventWithGpxPoint_ReturnsAggregatedClimate()
    {
        var @event = CreateTestEvent("Gpx Point Event", gpxLat: 64.13, gpxLng: -21.90);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(@event);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetEventClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetEventClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetEventClimateQuery(@event.Slug, 7, 15), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(10, result!.AverageHigh);
        Assert.Equal(2, result.AverageLow);
        Assert.Equal(5, result.AverageMaxWind);
        Assert.Equal(15, result.YearsOfData);
        Assert.Equal(7, result.TargetMonth);
        Assert.Equal(15, result.TargetDay);
        // 1 wet day out of 11 per year, every year — same ratio regardless of year count.
        Assert.Equal(Math.Round(1.0 / 11, 2), result.PrecipitationChance);
        // #1411: ClimateDto carries the resolved coordinate — the GPX point here, since the
        // event has no Location attached at all.
        Assert.Equal(64.13, result.Lat);
        Assert.Equal(-21.90, result.Lon);
        // #1414: the event's own GPX point is always precise, regardless of any linked Location.
        Assert.False(result.IsApproximate);
        // #1415: the GPX point is the race's start point, by the TrailStartPicker convention.
        Assert.True(result.IsStartPoint);
        // #1356: one wide call replaces the former 15 per-year calls on a cache miss.
        handlerMock.Protected().Verify("SendAsync", Times.Exactly(1), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task Handle_EventWithNoGpxPointButMunicipalityLocation_FallsBackToLocationCenter()
    {
        var location = CreateTestLocation(64.13, -21.90, LocationType.Municipality);
        var @event = CreateTestEvent("Location Fallback Event", location: location);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(location);
            ctx.Events.Add(@event);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetEventClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetEventClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetEventClimateQuery(@event.Slug, 7, 15), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(10, result!.AverageHigh);
        handlerMock.Protected().Verify("SendAsync", Times.Exactly(1), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());
        // #1411: ClimateDto carries the resolved coordinate — the Location's center here, since
        // the event has no GPX point of its own.
        Assert.Equal(64.13, result.Lat);
        Assert.Equal(-21.90, result.Lon);
        // #1414: a Municipality/Place-type Location is precise enough — not flagged approximate.
        Assert.False(result.IsApproximate);
        // #1415: a Location fallback is never the event's own start point, precise or not.
        Assert.False(result.IsStartPoint);
    }

    [Fact]
    public async Task Handle_EventWithNoGpxPointButRegionLocation_IsFlaggedApproximate()
    {
        var location = CreateTestLocation(64.13, -21.90, LocationType.Region);
        var @event = CreateTestEvent("Broad Location Event", location: location);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(location);
            ctx.Events.Add(@event);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetEventClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetEventClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetEventClimateQuery(@event.Slug, 7, 15), CancellationToken.None);

        Assert.NotNull(result);
        // #1414: a Region-type Location is a broad fallback — the climate estimate must be
        // flagged approximate so the frontend can signal it.
        Assert.True(result!.IsApproximate);
        // #1415: approximate and start-point are mutually exclusive — a Location fallback is
        // never the start point, approximate or not.
        Assert.False(result.IsStartPoint);
    }

    [Fact]
    public async Task Handle_EventWithBothGpxPointAndLocation_PrefersGpxPoint()
    {
        // Location center is a coordinate far enough from the GPX point that, if the handler used
        // it instead, FetchArchiveAsync would be called with different lat/lon values — this test
        // only asserts the result succeeds, with the GPX-point branch covered directly above and
        // the precedence documented in GetEventClimateQueryHandler.Handle's if/else-if ordering.
        var location = CreateTestLocation(0, 0);
        var @event = CreateTestEvent("Both Coordinates Event", gpxLat: 64.13, gpxLng: -21.90, location: location);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(location);
            ctx.Events.Add(@event);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var handler = new GetEventClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetEventClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetEventClimateQuery(@event.Slug, 7, 15), CancellationToken.None);

        Assert.NotNull(result);
    }

    // --- Caching (mirrors GetTrailWeatherQuery's IMemoryCache pattern) ---

    [Fact]
    public async Task Handle_CalledTwice_SecondCallIsServedFromCache()
    {
        var @event = CreateTestEvent("Cached Event", gpxLat: 64.13, gpxLng: -21.90);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(@event);
            await ctx.SaveChangesAsync();
        }

        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var factory = FactoryFor(handlerMock.Object).Object;

        using (var ctx2 = _factory.CreateContext())
        {
            var handler = new GetEventClimateQueryHandler(ctx2, factory, _cache, NullLogger<GetEventClimateQueryHandler>.Instance);
            var first = await handler.Handle(new GetEventClimateQuery(@event.Slug, 7, 15), CancellationToken.None);
            Assert.NotNull(first);
        }

        var callsAfterFirst = GetSendAsyncInvocationCount(handlerMock);

        using (var ctx3 = _factory.CreateContext())
        {
            var handler = new GetEventClimateQueryHandler(ctx3, factory, _cache, NullLogger<GetEventClimateQueryHandler>.Instance);
            var second = await handler.Handle(new GetEventClimateQuery(@event.Slug, 7, 15), CancellationToken.None);
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
        var @event = CreateTestEvent("Distinct Cache Event", gpxLat: 64.13, gpxLng: -21.90);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(@event);
            await ctx.SaveChangesAsync();
        }

        var handlerMock = MockHandlerReturning(FakeArchiveJson);
        var factory = FactoryFor(handlerMock.Object).Object;

        using (var ctx2 = _factory.CreateContext())
        {
            var handler = new GetEventClimateQueryHandler(ctx2, factory, _cache, NullLogger<GetEventClimateQueryHandler>.Instance);
            await handler.Handle(new GetEventClimateQuery(@event.Slug, 7, 15), CancellationToken.None);
        }
        var callsAfterFirst = GetSendAsyncInvocationCount(handlerMock);

        using (var ctx3 = _factory.CreateContext())
        {
            var handler = new GetEventClimateQueryHandler(ctx3, factory, _cache, NullLogger<GetEventClimateQueryHandler>.Instance);
            await handler.Handle(new GetEventClimateQuery(@event.Slug, 8, 1), CancellationToken.None);
        }
        var callsAfterSecond = GetSendAsyncInvocationCount(handlerMock);

        // A different (month, day) is a different cache key — it must hit Open-Meteo again.
        Assert.True(callsAfterSecond > callsAfterFirst);
    }

    // --- Graceful failure (mirrors GetTrailWeatherQuery's try/catch-and-return-null) ---

    [Fact]
    public async Task Handle_ArchiveApiUnreachable_ReturnsNullRatherThanThrowing()
    {
        var @event = CreateTestEvent("Unreachable Event", gpxLat: 64.13, gpxLng: -21.90);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(@event);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handlerMock = MockHandlerThrowing();
        var handler = new GetEventClimateQueryHandler(ctx2, FactoryFor(handlerMock.Object).Object, _cache, NullLogger<GetEventClimateQueryHandler>.Instance);

        var result = await handler.Handle(new GetEventClimateQuery(@event.Slug, 7, 15), CancellationToken.None);

        Assert.Null(result);
    }

    // --- Aggregation math, tested directly (internal, no HTTP mocking needed) ---
    //
    // #1356: Aggregate now takes ONE wide-range response plus the list of years it spans, instead
    // of one pre-windowed response per year — it does the ±windowDays anniversary-window filtering
    // itself. MergedResponse below builds that single response out of (date, hi, lo, precip, wind)
    // tuples, replacing the old one-response-per-year YearResponse helper.

    private const int TestWindowDays = 5;

    private static OpenMeteoArchiveResponse MergedResponse(params (string Date, double Hi, double Lo, double Precip, double Wind)[] days) => new()
    {
        Daily = new OpenMeteoArchiveDaily
        {
            Time = days.Select(d => d.Date).ToList(),
            Temperature2mMax = days.Select(d => (double?)d.Hi).ToList(),
            Temperature2mMin = days.Select(d => (double?)d.Lo).ToList(),
            PrecipitationSum = days.Select(d => (double?)d.Precip).ToList(),
            WindSpeed10mMax = days.Select(d => (double?)d.Wind).ToList(),
        },
    };

    [Fact]
    public void Aggregate_AllYearsHaveData_ComputesAverages()
    {
        var response = MergedResponse(
            ("2023-07-15", 10, 0, 0, 4),
            ("2024-07-15", 12, 2, 2, 6));

        var result = GetEventClimateQueryHandler.Aggregate(response, [2023, 2024], 7, 15, TestWindowDays, 64.13, -21.90);

        Assert.NotNull(result);
        Assert.Equal(11, result!.AverageHigh);
        Assert.Equal(1, result.AverageLow);
        Assert.Equal(1, result.AveragePrecipitation);
        Assert.Equal(5, result.AverageMaxWind);
        Assert.Equal(2, result.YearsOfData);
        // #1411: the resolved coordinate passes through Aggregate unchanged.
        Assert.Equal(64.13, result.Lat);
        Assert.Equal(-21.90, result.Lon);
    }

    [Fact]
    public void Aggregate_SomeYearsHaveNoDaysInResponse_IgnoresMissingYearsButStillSucceeds()
    {
        // 2022 and 2025 are in the requested years but the response has no day for either — e.g.
        // the archive has no reanalysis data yet for one edge of the range.
        var response = MergedResponse(("2023-07-15", 10, 0, 0, 4));

        var result = GetEventClimateQueryHandler.Aggregate(response, [2022, 2023, 2025], 7, 15, TestWindowDays, 64.13, -21.90);

        Assert.NotNull(result);
        Assert.Equal(1, result!.YearsOfData);
        Assert.Equal(10, result.AverageHigh);
    }

    [Fact]
    public void Aggregate_IsStartPointParameter_PassesThroughToTheDto()
    {
        // #1415: Aggregate doesn't compute isStartPoint itself — it just threads the caller's
        // value through to the DTO, the same way it already does for isApproximate.
        var response = MergedResponse(("2024-07-15", 10, 2, 0, 4));

        var defaulted = GetEventClimateQueryHandler.Aggregate(response, [2024], 7, 15, TestWindowDays, 64.13, -21.90);
        var explicitTrue = GetEventClimateQueryHandler.Aggregate(response, [2024], 7, 15, TestWindowDays, 64.13, -21.90, isApproximate: false, isStartPoint: true);

        Assert.NotNull(defaulted);
        Assert.False(defaulted!.IsStartPoint);
        Assert.NotNull(explicitTrue);
        Assert.True(explicitTrue!.IsStartPoint);
    }

    [Fact]
    public void Aggregate_NoDataAtAll_ReturnsNull()
    {
        var result = GetEventClimateQueryHandler.Aggregate(null, [2022, 2023, 2024], 7, 15, TestWindowDays, 64.13, -21.90);

        Assert.Null(result);
    }

    [Fact]
    public void Aggregate_MeasurablePrecipitationThreshold_CountsOnlyDaysAtOrAboveThreshold()
    {
        var response = MergedResponse(
            // 0.05mm is dew/mist noise (below the 0.1mm threshold), 0.1mm and 3mm count.
            ("2024-07-14", 10, 2, 0.05, 4),
            ("2024-07-15", 10, 2, 0.1, 4),
            ("2024-07-16", 10, 2, 3, 4));

        var result = GetEventClimateQueryHandler.Aggregate(response, [2024], 7, 15, TestWindowDays, 64.13, -21.90);

        Assert.NotNull(result);
        Assert.Equal(Math.Round(2.0 / 3, 2), result!.PrecipitationChance);
    }

    // --- #1356: single wide-call aggregation vs. the former per-year-call aggregation ---

    // Mirrors the arithmetic the pre-#1356 Aggregate performed over one pre-windowed response per
    // year — flattening every year's days into running totals with no window check, since each
    // response it received was already scoped by FetchArchiveAsync's own per-year start_date/
    // end_date. Kept only here, as the equivalence baseline the acceptance criteria asks for; it is
    // deliberately NOT shared with production code, which no longer has (or needs) this shape.
    private static ClimateDto? LegacyAggregate(IEnumerable<OpenMeteoArchiveResponse?> perYearResponses, int targetMonth, int targetDay, double lat, double lon)
    {
        var highs = new List<double>();
        var lows = new List<double>();
        var precipValues = new List<double>();
        var windValues = new List<double>();
        var wetDays = 0;
        var yearsWithData = 0;

        foreach (var response in perYearResponses)
        {
            var daily = response?.Daily;
            if (daily == null || daily.Time.Count == 0)
                continue;

            yearsWithData++;

            for (var i = 0; i < daily.Time.Count; i++)
            {
                var hi = daily.Temperature2mMax.ElementAtOrDefault(i);
                var lo = daily.Temperature2mMin.ElementAtOrDefault(i);
                var precip = daily.PrecipitationSum.ElementAtOrDefault(i);
                var wind = daily.WindSpeed10mMax.ElementAtOrDefault(i);

                if (hi.HasValue) highs.Add(hi.Value);
                if (lo.HasValue) lows.Add(lo.Value);
                if (wind.HasValue) windValues.Add(wind.Value);
                if (precip.HasValue)
                {
                    precipValues.Add(precip.Value);
                    if (precip.Value >= 0.1) wetDays++;
                }
            }
        }

        if (highs.Count == 0 || lows.Count == 0 || yearsWithData == 0)
            return null;

        return new ClimateDto(
            Math.Round(highs.Average(), 1),
            Math.Round(lows.Average(), 1),
            Math.Round(precipValues.Count > 0 ? precipValues.Average() : 0, 1),
            Math.Round(precipValues.Count > 0 ? (double)wetDays / precipValues.Count : 0, 2),
            Math.Round(windValues.Count > 0 ? windValues.Average() : 0, 1),
            yearsWithData,
            targetMonth,
            targetDay,
            lat,
            lon,
            false,
            false
        );
    }

    [Fact]
    public void Aggregate_SingleWideCall_IsNumericallyEquivalentToFormerPerYearCalls()
    {
        const int targetMonth = 7;
        const int targetDay = 15;
        int[] years = [2021, 2022, 2023, 2024];

        // Per-year fixture: 3 days (anniversary ±2, well inside the ±5 window), distinct values per
        // year so the averages aren't trivially identical across the two paths.
        var perYear = new Dictionary<int, (double Hi, double Lo, double Precip, double Wind)[]>
        {
            [2021] = [(14, 4, 0, 3), (15, 5, 0, 4), (16, 6, 1.2, 5)],
            [2022] = [(9, 1, 0, 6), (10, 2, 0.2, 7), (11, 3, 0, 8)],
            [2023] = [(18, 8, 0, 2), (19, 9, 5.0, 3), (20, 10, 0, 4)],
            [2024] = [(12, 3, 0, 5), (13, 4, 0, 6), (14, 5, 0.1, 7)],
        };

        var legacyResponses = perYear.Select(kv => new OpenMeteoArchiveResponse
        {
            Daily = new OpenMeteoArchiveDaily
            {
                Time = [$"{kv.Key}-07-13", $"{kv.Key}-07-15", $"{kv.Key}-07-17"],
                Temperature2mMax = kv.Value.Select(d => (double?)d.Hi).ToList(),
                Temperature2mMin = kv.Value.Select(d => (double?)d.Lo).ToList(),
                PrecipitationSum = kv.Value.Select(d => (double?)d.Precip).ToList(),
                WindSpeed10mMax = kv.Value.Select(d => (double?)d.Wind).ToList(),
            },
        }).ToList();

        var mergedDays = perYear
            .SelectMany(kv => new[]
            {
                (Date: $"{kv.Key}-07-13", kv.Value[0].Hi, kv.Value[0].Lo, kv.Value[0].Precip, kv.Value[0].Wind),
                (Date: $"{kv.Key}-07-15", kv.Value[1].Hi, kv.Value[1].Lo, kv.Value[1].Precip, kv.Value[1].Wind),
                (Date: $"{kv.Key}-07-17", kv.Value[2].Hi, kv.Value[2].Lo, kv.Value[2].Precip, kv.Value[2].Wind),
            })
            .ToArray();
        var mergedResponse = MergedResponse(mergedDays);

        var legacy = LegacyAggregate(legacyResponses, targetMonth, targetDay, 64.13, -21.90);
        var current = GetEventClimateQueryHandler.Aggregate(mergedResponse, years, targetMonth, targetDay, TestWindowDays, 64.13, -21.90);

        Assert.NotNull(legacy);
        Assert.NotNull(current);
        Assert.Equal(legacy!.AverageHigh, current!.AverageHigh);
        Assert.Equal(legacy.AverageLow, current.AverageLow);
        Assert.Equal(legacy.AveragePrecipitation, current.AveragePrecipitation);
        Assert.Equal(legacy.PrecipitationChance, current.PrecipitationChance);
        Assert.Equal(legacy.AverageMaxWind, current.AverageMaxWind);
        Assert.Equal(legacy.YearsOfData, current.YearsOfData);
    }

    [Fact]
    public void Aggregate_DaysOutsideEveryYearsWindow_AreExcludedFromTheAverage()
    {
        // The wide single-call response spans 2023-07-10..2024-07-20 (covering both years' ±5
        // windows), so it also contains days strictly between the two windows that belong to
        // neither year — e.g. 2023-08-01. Those must not be counted, even though they're present
        // in daily.Time.
        var response = MergedResponse(
            ("2023-07-12", 10, 2, 0, 4),
            ("2023-07-15", 10, 2, 0, 4),
            ("2023-07-18", 10, 2, 0, 4),
            // Outside both years' windows — would wreck the average if wrongly included.
            ("2023-08-01", 100, 50, 999, 99),
            ("2024-01-01", -100, -100, 999, 99),
            ("2024-07-12", 10, 2, 0, 4),
            ("2024-07-15", 10, 2, 0, 4),
            ("2024-07-18", 10, 2, 0, 4));

        var result = GetEventClimateQueryHandler.Aggregate(response, [2023, 2024], 7, 15, TestWindowDays, 64.13, -21.90);

        Assert.NotNull(result);
        Assert.Equal(10, result!.AverageHigh);
        Assert.Equal(2, result.AverageLow);
        Assert.Equal(0, result.AveragePrecipitation);
        // Only the two real in-window years count — the two junk days form no third "year".
        Assert.Equal(2, result.YearsOfData);
    }
}
