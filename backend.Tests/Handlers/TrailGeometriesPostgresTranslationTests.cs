using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Trails.Queries.GetTrailGeometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;
using Xunit;

namespace Utanvega.Backend.Tests.Handlers;

/// <summary>
/// #1331 (follows #1323/#1330): GetTrailGeometriesQueryHandler issues raw PostGIS SQL
/// (<c>ST_Simplify</c>, <c>LEAST</c>) that SQLite cannot parse, so — like
/// AnalyticsPostgresTranslationTests and GetDuplicateTrailsQueryHandlerCachingTests — these tests
/// run against a real Postgres/PostGIS instance and are skipped unless GEOMETRIES_TEST_POSTGRES
/// points at a reachable database:
/// <c>docker run -d --rm -e POSTGRES_PASSWORD=test -e POSTGRES_DB=geometries
/// -p 55435:5432 postgis/postgis:16-3.4</c>
///
/// Scope is the adaptive-tolerance formula added in #1323/#1330 — the manual verification table
/// from PR #1330's description, turned into assertions. The simplification constants themselves
/// are not re-derived here; see the comment on GetTrailGeometriesQuery.Handle for the rationale.
/// </summary>
public class TrailGeometriesPostgresTranslationTests
{
    private static readonly GeometryFactory Factory = new(new PrecisionModel(), 4326);

    private static string? ConnectionString =>
        Environment.GetEnvironmentVariable("GEOMETRIES_TEST_POSTGRES");

    // Mirrors AnalyticsPostgresTranslationTests.RequireLocalDatabase — this test drops every
    // table before seeding, so it must refuse anything that isn't a disposable local database.
    private static void RequireLocalDatabase(string connectionString)
    {
        var host = connectionString
            .Split(';', StringSplitOptions.RemoveEmptyEntries)
            .Select(part => part.Split('=', 2))
            .Where(kv => kv.Length == 2 && kv[0].Trim().Equals("Host", StringComparison.OrdinalIgnoreCase))
            .Select(kv => kv[1].Trim())
            .FirstOrDefault();

        var isLocal = host is not null && (
            host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
            host == "127.0.0.1" ||
            host == "::1");

        if (!isLocal)
        {
            throw new InvalidOperationException(
                $"GEOMETRIES_TEST_POSTGRES points at host '{host ?? "(none)"}'. This test drops every " +
                "table before seeding, so it only runs against localhost. Start a throwaway database: " +
                "docker run -d --rm -e POSTGRES_PASSWORD=test -e POSTGRES_DB=geometries " +
                "-p 55435:5432 postgis/postgis:16-3.4");
        }
    }

    private static DbContextOptions<UtanvegaDbContext> OptionsFor(string connectionString) =>
        new DbContextOptionsBuilder<UtanvegaDbContext>()
            .UseNpgsql(connectionString, o => o.UseNetTopologySuite())
            .Options;

    // A 61-point zigzag: a straight west-to-east baseline with the latitude alternating +/-
    // `amplitudeDegrees` every point. Douglas-Peucker (what ST_Simplify uses) measures each
    // point's perpendicular distance from the chord connecting the ends of the segment it is
    // currently considering; every interior point here sits exactly `amplitudeDegrees` off that
    // chord. That makes the zigzag a clean on/off switch for a given tolerance: a tolerance
    // below the amplitude leaves every point standing, a tolerance above it collapses the whole
    // line to its two endpoints — exactly the two regimes #1323 distinguishes between.
    private static LineString ZigzagLine(int pointCount, double amplitudeDegrees)
    {
        var coordinates = new Coordinate[pointCount];
        for (var i = 0; i < pointCount; i++)
        {
            var longitude = -21.9 + i * 0.0001;
            var latitude = 64.13 + (i % 2 == 0 ? amplitudeDegrees : -amplitudeDegrees);
            coordinates[i] = new CoordinateZ(longitude, latitude, 10 + i);
        }

        return Factory.CreateLineString(coordinates);
    }

    private static Trail NewTrail(string name, double length, LineString line, TrailStatus status = TrailStatus.Published) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        Slug = name.ToLowerInvariant().Replace(" ", "-"),
        Status = status,
        ActivityTypeId = ActivityType.Hiking,
        Type = TrailType.Loop,
        Difficulty = Difficulty.Easy,
        Visibility = Visibility.Public,
        Length = length,
        GpxData = line,
    };

    [SkippableFact]
    public async Task ShortTrail_ToleranceWellBelowZigzagAmplitude_KeepsCoordinatesCloseToRaw()
    {
        var connectionString = ConnectionString;
        Skip.If(string.IsNullOrWhiteSpace(connectionString),
            "Set GEOMETRIES_TEST_POSTGRES to run this against a real Postgres/PostGIS instance.");
        RequireLocalDatabase(connectionString!);

        // Length 2,000m -> tolerance = LEAST(2000 * 1e-8, 0.0005) = 0.00002 degrees, an order of
        // magnitude below the zigzag's 0.0002-degree amplitude, so no point should be dropped.
        var line = ZigzagLine(pointCount: 61, amplitudeDegrees: 0.0002);
        var trail = NewTrail("Short Trail", length: 2_000, line);

        await using var context = new UtanvegaDbContext(OptionsFor(connectionString!));
        await context.Database.EnsureDeletedAsync();
        await context.Database.EnsureCreatedAsync();
        context.Trails.Add(trail);
        await context.SaveChangesAsync();

        var handler = new GetTrailGeometriesQueryHandler(context);
        var result = await handler.Handle(new GetTrailGeometriesQuery(), CancellationToken.None);

        var feature = Assert.Single(result);
        Assert.Equal(trail.Slug, feature.Slug);
        // Raw geometry has 61 points; the tiny tolerance leaves all of them standing.
        Assert.Equal(line.NumPoints, feature.Coordinates.Length);
    }

    [SkippableFact]
    public async Task LongTrail_ToleranceCapsAt0005Degrees_SameReductionAsOldFixedTolerance()
    {
        var connectionString = ConnectionString;
        Skip.If(string.IsNullOrWhiteSpace(connectionString),
            "Set GEOMETRIES_TEST_POSTGRES to run this against a real Postgres/PostGIS instance.");
        RequireLocalDatabase(connectionString!);

        // Length 60,000m -> uncapped tolerance would be 0.0006 degrees, but LEAST(...) caps it at
        // 0.0005 — the exact fixed tolerance pre-#1323 used unconditionally for every trail. At
        // 0.0005, the tolerance exceeds the zigzag's 0.0002-degree amplitude, so Douglas-Peucker
        // collapses the entire interior and keeps only the two endpoints.
        var line = ZigzagLine(pointCount: 61, amplitudeDegrees: 0.0002);
        var trail = NewTrail("Long Trail", length: 60_000, line);

        await using var context = new UtanvegaDbContext(OptionsFor(connectionString!));
        await context.Database.EnsureDeletedAsync();
        await context.Database.EnsureCreatedAsync();
        context.Trails.Add(trail);
        await context.SaveChangesAsync();

        var handler = new GetTrailGeometriesQueryHandler(context);
        var result = await handler.Handle(new GetTrailGeometriesQuery(), CancellationToken.None);

        var feature = Assert.Single(result);
        Assert.Equal(trail.Slug, feature.Slug);
        // Verified directly against Postgres: ST_Simplify at the capped 0.0005-degree tolerance
        // reduces this 61-point zigzag to its 2 endpoints — identical to what the old, unconditional
        // 0.0005-degree tolerance produced for every trail before #1323.
        Assert.Equal(2, feature.Coordinates.Length);
    }

    [SkippableFact]
    public async Task ZeroLengthTrail_SkipsSimplification_ReturnsRawGpxDataUnchanged()
    {
        var connectionString = ConnectionString;
        Skip.If(string.IsNullOrWhiteSpace(connectionString),
            "Set GEOMETRIES_TEST_POSTGRES to run this against a real Postgres/PostGIS instance.");
        RequireLocalDatabase(connectionString!);

        // Trail.Length is a non-nullable double (see Core/Entities/Trail.cs), so the "Length IS
        // NULL" half of the handler's CASE is unreachable with this schema; 0 is what actually
        // trips the "Length <= 0" escape hatch (same choice GetDuplicateTrailsQueryHandlerCachingTests
        // makes for its own "Length <= 0" branch). Amplitude is deliberately tiny — smaller than
        // even the short trail's 0.00002-degree tolerance above — so that if the escape hatch were
        // ever bypassed and a tolerance applied anyway, the zigzag would collapse and this
        // assertion would fail instead of passing by coincidence.
        var line = ZigzagLine(pointCount: 61, amplitudeDegrees: 0.000005);
        var trail = NewTrail("Flat Length Trail", length: 0, line);

        await using var context = new UtanvegaDbContext(OptionsFor(connectionString!));
        await context.Database.EnsureDeletedAsync();
        await context.Database.EnsureCreatedAsync();
        context.Trails.Add(trail);
        await context.SaveChangesAsync();

        var handler = new GetTrailGeometriesQueryHandler(context);
        var result = await handler.Handle(new GetTrailGeometriesQuery(), CancellationToken.None);

        var feature = Assert.Single(result);
        Assert.Equal(trail.Slug, feature.Slug);
        Assert.Equal(line.NumPoints, feature.Coordinates.Length);

        // Coordinates must match the raw GpxData exactly, point for point, not just in count.
        // ParseGeoJsonCoordinates flips PostGIS's [lon, lat] to [lat, lon] for Leaflet.
        for (var i = 0; i < line.NumPoints; i++)
        {
            var point = line.GetPointN(i);
            Assert.Equal(point.Y, feature.Coordinates[i][0], precision: 6);
            Assert.Equal(point.X, feature.Coordinates[i][1], precision: 6);
        }
    }

    [SkippableFact]
    public async Task EventOnlyTrail_IsIncluded_DraftTrailIsNot()
    {
        var connectionString = ConnectionString;
        Skip.If(string.IsNullOrWhiteSpace(connectionString),
            "Set GEOMETRIES_TEST_POSTGRES to run this against a real Postgres/PostGIS instance.");
        RequireLocalDatabase(connectionString!);

        // #1534: a trail attached only to a race (Status == EventOnly) must still draw its route
        // line on the map, matching GetTrailBySlugQuery's existing Published/EventOnly allow-list
        // (#1321) for the trail's own summary data. A Draft trail stays excluded — the fix adds
        // exactly one status, not every non-Published one.
        var line = ZigzagLine(pointCount: 61, amplitudeDegrees: 0.000005);
        var eventOnlyTrail = NewTrail("Event Only Trail", length: 0, line, status: TrailStatus.EventOnly);
        var draftTrail = NewTrail("Draft Trail", length: 0, line, status: TrailStatus.Draft);

        await using var context = new UtanvegaDbContext(OptionsFor(connectionString!));
        await context.Database.EnsureDeletedAsync();
        await context.Database.EnsureCreatedAsync();
        context.Trails.AddRange(eventOnlyTrail, draftTrail);
        await context.SaveChangesAsync();

        var handler = new GetTrailGeometriesQueryHandler(context);
        var result = await handler.Handle(new GetTrailGeometriesQuery(), CancellationToken.None);

        var feature = Assert.Single(result);
        Assert.Equal(eventOnlyTrail.Slug, feature.Slug);
    }
}
