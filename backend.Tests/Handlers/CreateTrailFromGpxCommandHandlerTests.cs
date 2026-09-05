using System.Globalization;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Trails.Commands.BulkCreateTrailsFromGpx;
using Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Handlers;

public class CreateTrailFromGpxCommandHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly ICacheInvalidator _cacheInvalidator = new Mock<ICacheInvalidator>().Object;
    private readonly IMemoryCache _memoryCache;

    public CreateTrailFromGpxCommandHandlerTests()
    {
        _factory = new TestDbContextFactory();
        _memoryCache = new MemoryCache(new MemoryCacheOptions());
    }

    public void Dispose()
    {
        _factory.Dispose();
        _memoryCache.Dispose();
    }

    // ─── GPX builders ───

    // trkType, when supplied, is embedded as <trk><type>...</type> — matching where
    // GpxProcessor.Process (line 125) actually reads it from, nested under <trk>, not the GPX root.
    private static string BuildGpx(IEnumerable<(double lat, double lon, double ele)> points, string? trkType = null)
    {
        var trkpts = string.Concat(points.Select(p =>
            $"<trkpt lat=\"{p.lat.ToString(CultureInfo.InvariantCulture)}\" " +
            $"lon=\"{p.lon.ToString(CultureInfo.InvariantCulture)}\">" +
            $"<ele>{p.ele.ToString(CultureInfo.InvariantCulture)}</ele></trkpt>"));

        var typeElement = trkType == null ? "" : $"<type>{trkType}</type>";

        return $"<?xml version=\"1.0\"?><gpx xmlns=\"http://www.topografix.com/GPX/1/1\"><trk>{typeElement}<trkseg>{trkpts}</trkseg></trk></gpx>";
    }

    // A ~5.5km route climbing steadily from 100m to 800m — well past the 1000m length skip and
    // with a genuine (non-degenerate) elevation profile, whatever terrain bucket it lands in.
    private static readonly (double lat, double lon, double ele)[] MountainousRoute =
        Enumerable.Range(0, 100)
            .Select(i => (64.0 + i * 0.0005, -18.0 + i * 0.0005, 100.0 + i * 7.0))
            .ToArray();

    // Two points ~90m apart — well under the 1000m skip threshold.
    private static readonly (double lat, double lon, double ele)[] ShortRoute =
    [
        (64.0000, -18.0000, 100.0),
        (64.0008, -18.0000, 300.0),
    ];

    // A >1km route with a perfectly flat elevation — degenerate per ElevationProfileValidator
    // (fewer than 2 distinct sampled values), even though the route itself is long enough.
    private static readonly (double lat, double lon, double ele)[] FlatDegenerateRoute =
        Enumerable.Range(0, 50)
            .Select(i => (64.0 + i * 0.0005, -18.0 + i * 0.0005, 500.0))
            .ToArray();

    private CreateTrailFromGpxCommandHandler CreateHandler(Infrastructure.Persistence.UtanvegaDbContext context)
    {
        var locationDetector = new LocationDetector(context, _memoryCache);
        return new CreateTrailFromGpxCommandHandler(context, locationDetector, _cacheInvalidator);
    }

    // ─── ProcessGpx: TerrainType classification ───

    [Fact]
    public void ProcessGpx_NormalTrail_ClassifiesTerrainType()
    {
        using var ctx = _factory.CreateContext();
        var handler = CreateHandler(ctx);

        var trail = handler.ProcessGpx("Mountain Trail", BuildGpx(MountainousRoute), ActivityType.Hiking);

        Assert.True(trail.Length > 1000);
        Assert.False(ElevationProfileValidator.IsDegenerate(trail.ElevationProfile));

        var maxAltitude = ElevationProfileValidator.GetMaxAltitude(trail.ElevationProfile)!.Value;
        var expected = MountainIndexClassifier.Classify(trail.Length, trail.ElevationGain, maxAltitude);

        Assert.NotNull(trail.TerrainType);
        Assert.Equal(expected, trail.TerrainType);
    }

    [Fact]
    public void ProcessGpx_ShortTrail_LeavesTerrainTypeNull()
    {
        using var ctx = _factory.CreateContext();
        var handler = CreateHandler(ctx);

        var trail = handler.ProcessGpx("Short Trail", BuildGpx(ShortRoute), ActivityType.Hiking);

        Assert.True(trail.Length <= 1000);
        Assert.Null(trail.TerrainType);
    }

    [Fact]
    public void ProcessGpx_DegenerateElevationProfile_LeavesTerrainTypeNull()
    {
        using var ctx = _factory.CreateContext();
        var handler = CreateHandler(ctx);

        var trail = handler.ProcessGpx("Flat Degenerate Trail", BuildGpx(FlatDegenerateRoute), ActivityType.Hiking);

        Assert.True(trail.Length > 1000);
        Assert.True(ElevationProfileValidator.IsDegenerate(trail.ElevationProfile));
        Assert.Null(trail.TerrainType);
    }

    // ─── ProcessGpx / ProcessGpxWithDetection: ActivityType override vs. detection (#581) ───

    [Fact]
    public void ProcessGpx_ExplicitActivityType_OverridesGpxDeclaredType()
    {
        using var ctx = _factory.CreateContext();
        var handler = CreateHandler(ctx);

        // GPX declares "hiking" (→ ActivityType.Hiking), but the caller explicitly asks for
        // Cycling — the explicit argument must win, not the GPX-declared type.
        var trail = handler.ProcessGpx("Explicit Type Trail", BuildGpx(ShortRoute, trkType: "hiking"), ActivityType.Cycling);

        Assert.Equal(ActivityType.Cycling, trail.ActivityTypeId);
    }

    [Fact]
    public void ProcessGpxWithDetection_RecognisedType_ReturnsDetectedActivityType()
    {
        using var ctx = _factory.CreateContext();
        var handler = CreateHandler(ctx);

        var (trail, detectedActivityType) = handler.ProcessGpxWithDetection("Detected Type Trail", BuildGpx(ShortRoute, trkType: "hiking"));

        Assert.Equal(ActivityType.Hiking, detectedActivityType);
        Assert.Equal(ActivityType.Hiking, trail.ActivityTypeId);
    }

    [Fact]
    public void ProcessGpxWithDetection_NoTypeElement_ReturnsNullDetectionAndDefaultsToTrailRunning()
    {
        using var ctx = _factory.CreateContext();
        var handler = CreateHandler(ctx);

        var (trail, detectedActivityType) = handler.ProcessGpxWithDetection("Undetected Type Trail", BuildGpx(ShortRoute));

        // No <type> element at all: detection must yield null (not a default) — and the
        // fallback to ActivityType.TrailRunning only happens on the persisted Trail, per
        // CreateTrailFromGpxCommand.cs:142 (`activityType ?? result.DetectedActivityType ?? ActivityType.TrailRunning`).
        Assert.Null(detectedActivityType);
        Assert.Equal(ActivityType.TrailRunning, trail.ActivityTypeId);
    }

    // ─── BulkCreateTrailsFromGpxCommandHandler: same code path via ProcessGpx ───

    // BulkCreateTrailsFromGpxCommandHandler.Handle (line 43) calls
    // _singleHandler.ProcessGpx(file.Name, file.GpxXml, file.ActivityType) — the exact same public
    // overload exercised above — so fixing ProcessGpx once fixes both create paths. We call it
    // here the same way bulk does, via a GpxFileInfo, rather than exercising the full bulk
    // Handle(): that also calls LocationDetector.DetectAndLinkAsync, which queries Location.Center
    // (now round-tripped via WKB in TestDbContext, see TestDbContextFactory.cs) and is unrelated
    // to terrain classification, so it isn't something this issue's test needs to (or should)
    // cover — a full BulkCreateTrailsFromGpxCommandHandler test suite is tracked separately (#583).
    [Fact]
    public void BulkCreate_UsesSameProcessGpxPath_ClassifiesTerrainType()
    {
        using var ctx = _factory.CreateContext();
        var singleHandler = CreateHandler(ctx);
        var file = new GpxFileInfo("Bulk Mountain Trail", BuildGpx(MountainousRoute), ActivityType.Hiking);

        var trail = singleHandler.ProcessGpx(file.Name, file.GpxXml, file.ActivityType);

        var maxAltitude = ElevationProfileValidator.GetMaxAltitude(trail.ElevationProfile)!.Value;
        var expected = MountainIndexClassifier.Classify(trail.Length, trail.ElevationGain, maxAltitude);

        Assert.NotNull(trail.TerrainType);
        Assert.Equal(expected, trail.TerrainType);
    }
}
