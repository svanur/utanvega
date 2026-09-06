using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Moq;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Trails.Commands.BulkCreateTrailsFromGpx;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Handlers;

// Full Handle() coverage for BulkCreateTrailsFromGpxCommandHandler, including LocationDetector
// wiring (#583/#674 fixed TestDbContext's Location.Center WKB round-trip, which is what unblocked
// this). CreateTrailFromGpxCommandHandlerTests.BulkCreate_UsesSameProcessGpxPath_ClassifiesTerrainType
// deliberately only exercises ProcessGpx and explicitly defers this — see its comment.
public class BulkCreateTrailsFromGpxCommandHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly Mock<ICacheInvalidator> _cacheInvalidatorMock = new();
    private readonly Mock<ILogger<BulkCreateTrailsFromGpxCommandHandler>> _loggerMock = new();
    private readonly IMemoryCache _memoryCache;

    public BulkCreateTrailsFromGpxCommandHandlerTests()
    {
        _factory = new TestDbContextFactory();
        _memoryCache = new MemoryCache(new MemoryCacheOptions());
    }

    public void Dispose()
    {
        _factory.Dispose();
        _memoryCache.Dispose();
    }

    // Same builder pattern as CreateTrailFromGpxCommandHandlerTests.BuildGpx.
    private static string BuildGpx(IEnumerable<(double lat, double lon, double ele)> points)
    {
        var trkpts = string.Concat(points.Select(p =>
            $"<trkpt lat=\"{p.lat.ToString(CultureInfo.InvariantCulture)}\" " +
            $"lon=\"{p.lon.ToString(CultureInfo.InvariantCulture)}\">" +
            $"<ele>{p.ele.ToString(CultureInfo.InvariantCulture)}</ele></trkpt>"));

        return $"<?xml version=\"1.0\"?><gpx xmlns=\"http://www.topografix.com/GPX/1/1\"><trk><trkseg>{trkpts}</trkseg></trk></gpx>";
    }

    // Öskjuhlíð-ish center, matching LocationDetectorTests' seeding pattern.
    private static readonly Point SeededCenter = new Point(-21.9174, 64.1286) { SRID = 4326 };
    private const double SeededRadiusMeters = 500;

    // Two points ~90m apart, right next to the seeded center — well inside its 500m radius.
    private static readonly (double lat, double lon, double ele)[] RouteInsideRadius =
    [
        (64.1284, -21.9176, 100.0),
        (64.1288, -21.9172, 110.0),
    ];

    // Two points far from the seeded center (~well over 100km away) — outside every radius.
    private static readonly (double lat, double lon, double ele)[] RouteOutsideRadius =
    [
        (65.6835, -18.0878, 50.0),
        (65.6840, -18.0870, 60.0),
    ];

    private async Task SeedLocationAsync(string name, string slug)
    {
        using var seedCtx = _factory.CreateContext();
        seedCtx.Locations.Add(new Core.Entities.Location
        {
            Name = name,
            Slug = slug,
            Type = LocationType.Place,
            Center = SeededCenter,
            Radius = SeededRadiusMeters,
        });
        await seedCtx.SaveChangesAsync();
    }

    private BulkCreateTrailsFromGpxCommandHandler CreateHandler(Infrastructure.Persistence.UtanvegaDbContext context)
    {
        var locationDetector = new LocationDetector(context, _memoryCache);
        return new BulkCreateTrailsFromGpxCommandHandler(context, locationDetector, _cacheInvalidatorMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_RouteWithinSeededLocationRadius_CreatesTrailLocationLink()
    {
        await SeedLocationAsync("Öskjuhlíð", "oskjuhlid");

        using var ctx = _factory.CreateContext();
        var handler = CreateHandler(ctx);
        var command = new BulkCreateTrailsFromGpxCommand(
            [new GpxFileInfo("Inside Radius Trail", BuildGpx(RouteInsideRadius), ActivityType.Hiking)]);

        var resultIds = await handler.Handle(command, CancellationToken.None);

        var trailId = Assert.Single(resultIds);
        var trailLocations = await ctx.TrailLocations
            .Where(tl => tl.TrailId == trailId)
            .ToListAsync();

        Assert.NotEmpty(trailLocations);
    }

    [Fact]
    public async Task Handle_RouteOutsideEverySeededLocationRadius_CreatesNoTrailLocationLink()
    {
        await SeedLocationAsync("Öskjuhlíð", "oskjuhlid");

        using var ctx = _factory.CreateContext();
        var handler = CreateHandler(ctx);
        var command = new BulkCreateTrailsFromGpxCommand(
            [new GpxFileInfo("Outside Radius Trail", BuildGpx(RouteOutsideRadius), ActivityType.Hiking)]);

        var resultIds = await handler.Handle(command, CancellationToken.None);

        var trailId = Assert.Single(resultIds);
        var trailLocations = await ctx.TrailLocations
            .Where(tl => tl.TrailId == trailId)
            .ToListAsync();

        Assert.Empty(trailLocations);
    }
}
