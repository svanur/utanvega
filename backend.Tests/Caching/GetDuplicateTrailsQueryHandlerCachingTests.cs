using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Trails.Queries.GetDuplicateTrails;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Tests.Caching;

/// <summary>
/// #1073: GetDuplicateTrailsQueryHandler's spatial-candidate query is raw Postgres SQL (the
/// geometry overlap operator <c>&amp;&amp;</c>, <c>GREATEST</c>/<c>LEAST</c>) that SQLite cannot
/// parse, so — like AnalyticsPostgresTranslationTests — these tests run against a real
/// Postgres/PostGIS instance and are skipped unless DUPLICATE_TRAILS_TEST_POSTGRES points at a
/// reachable database:
/// <c>docker run -d --rm -e POSTGRES_PASSWORD=test -e POSTGRES_DB=duplicates
/// -p 55434:5432 postgis/postgis:16-3.4</c>
///
/// Scope is the caching behavior added in #1073 only — the duplicate-detection math itself
/// (buffer distance, threshold, overlap %) is unchanged and is not re-verified here.
/// </summary>
public class GetDuplicateTrailsQueryHandlerCachingTests
{
    private static readonly GeometryFactory Factory = new(new PrecisionModel(), 4326);

    private static string? ConnectionString =>
        Environment.GetEnvironmentVariable("DUPLICATE_TRAILS_TEST_POSTGRES");

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
                $"DUPLICATE_TRAILS_TEST_POSTGRES points at host '{host ?? "(none)"}'. This test drops every " +
                "table before seeding, so it only runs against localhost. Start a throwaway database: " +
                "docker run -d --rm -e POSTGRES_PASSWORD=test -e POSTGRES_DB=duplicates " +
                "-p 55434:5432 postgis/postgis:16-3.4");
        }
    }

    private static DbContextOptions<UtanvegaDbContext> OptionsFor(string connectionString) =>
        new DbContextOptionsBuilder<UtanvegaDbContext>()
            .UseNpgsql(connectionString, o => o.UseNetTopologySuite())
            .Options;

    private static Trail NewTrail(string name, LineString line) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        Slug = name.ToLowerInvariant().Replace(" ", "-"),
        Status = TrailStatus.Published,
        ActivityTypeId = ActivityType.Hiking,
        Type = TrailType.Loop,
        Difficulty = Difficulty.Easy,
        Visibility = Visibility.Public,
        // 0 trips the SQL candidate query's "a.Length <= 0" escape hatch, bypassing the
        // length-ratio floor filter entirely — irrelevant to what these tests cover.
        Length = 0,
        GpxData = line,
    };

    // Two near-identical lines, ~1m apart — close enough that buffering by the production
    // ~20m constant guarantees a >=95% match, a reliable "exactly one duplicate pair" fixture.
    private static LineString OverlappingLineA() => Factory.CreateLineString(new[]
    {
        new CoordinateZ(-21.90, 64.13, 10),
        new CoordinateZ(-21.89, 64.14, 20),
        new CoordinateZ(-21.88, 64.15, 30),
    });

    private static LineString OverlappingLineB() => Factory.CreateLineString(new[]
    {
        new CoordinateZ(-21.90001, 64.13001, 10),
        new CoordinateZ(-21.89001, 64.14001, 20),
        new CoordinateZ(-21.88001, 64.15001, 30),
    });

    private async Task<(Trail A, Trail B)> SeedTwoOverlappingTrailsAsync(string connectionString)
    {
        var a = NewTrail("Trail A", OverlappingLineA());
        var b = NewTrail("Trail B", OverlappingLineB());

        await using var context = new UtanvegaDbContext(OptionsFor(connectionString));
        await context.Database.EnsureDeletedAsync();
        await context.Database.EnsureCreatedAsync();
        context.Trails.AddRange(a, b);
        await context.SaveChangesAsync();
        return (a, b);
    }

    // Renames a trail directly against the DB, bypassing CacheInvalidator entirely — same
    // "write lands without invalidation" shape EventQueryCachingBehaviorTests uses to prove a
    // cache hit really is a cache hit, rather than the computation just happening to agree twice.
    private async Task RenameTrailAsync(string connectionString, Guid trailId, string newName)
    {
        await using var context = new UtanvegaDbContext(OptionsFor(connectionString));
        var trail = await context.Trails.FindAsync(trailId);
        trail!.Name = newName;
        await context.SaveChangesAsync();
    }

    private static string NameForId(DuplicatePair pair, Guid id) =>
        pair.TrailAId == id ? pair.TrailAName : pair.TrailBName;

    [SkippableFact]
    public async Task Handle_SecondCall_IsServedFromCache_AndIgnoresAnUninvalidatedWrite()
    {
        var connectionString = ConnectionString;
        Skip.If(string.IsNullOrWhiteSpace(connectionString),
            "Set DUPLICATE_TRAILS_TEST_POSTGRES to run this against a real Postgres/PostGIS instance.");
        RequireLocalDatabase(connectionString!);

        var (a, b) = await SeedTwoOverlappingTrailsAsync(connectionString!);
        var cache = new MemoryCache(new MemoryCacheOptions());

        await using var context1 = new UtanvegaDbContext(OptionsFor(connectionString!));
        var handler1 = new GetDuplicateTrailsQueryHandler(context1, NullLogger<GetDuplicateTrailsQueryHandler>.Instance, cache);
        var first = await handler1.Handle(new GetDuplicateTrailsQuery(), CancellationToken.None);

        Assert.Single(first);
        Assert.Equal("Trail A", NameForId(first[0], a.Id));

        // Bypasses CacheInvalidator — a recomputing handler would see this immediately.
        await RenameTrailAsync(connectionString!, a.Id, "Renamed Trail A");

        await using var context2 = new UtanvegaDbContext(OptionsFor(connectionString!));
        var handler2 = new GetDuplicateTrailsQueryHandler(context2, NullLogger<GetDuplicateTrailsQueryHandler>.Instance, cache);
        var second = await handler2.Handle(new GetDuplicateTrailsQuery(), CancellationToken.None);

        Assert.Single(second);
        // Still "Trail A" — proves the second call was a cache hit, not a recompute.
        Assert.Equal("Trail A", NameForId(second[0], a.Id));
    }

    [SkippableFact]
    public async Task InvalidateTrail_BumpsVersion_SoTheNextCallRecomputes()
    {
        var connectionString = ConnectionString;
        Skip.If(string.IsNullOrWhiteSpace(connectionString),
            "Set DUPLICATE_TRAILS_TEST_POSTGRES to run this against a real Postgres/PostGIS instance.");
        RequireLocalDatabase(connectionString!);

        var (a, b) = await SeedTwoOverlappingTrailsAsync(connectionString!);
        var cache = new MemoryCache(new MemoryCacheOptions());
        var invalidator = new CacheInvalidator(cache);

        await using var context1 = new UtanvegaDbContext(OptionsFor(connectionString!));
        var handler1 = new GetDuplicateTrailsQueryHandler(context1, NullLogger<GetDuplicateTrailsQueryHandler>.Instance, cache);
        var first = await handler1.Handle(new GetDuplicateTrailsQuery(), CancellationToken.None);
        Assert.Equal("Trail A", NameForId(first[0], a.Id));

        await RenameTrailAsync(connectionString!, a.Id, "Renamed Trail A");

        // Mirrors every trail-mutating command: InvalidateTrail() is called after the write.
        invalidator.InvalidateTrail(a.Slug);

        await using var context2 = new UtanvegaDbContext(OptionsFor(connectionString!));
        var handler2 = new GetDuplicateTrailsQueryHandler(context2, NullLogger<GetDuplicateTrailsQueryHandler>.Instance, cache);
        var second = await handler2.Handle(new GetDuplicateTrailsQuery(), CancellationToken.None);

        Assert.Single(second);
        Assert.Equal("Renamed Trail A", NameForId(second[0], a.Id));
    }

    [SkippableFact]
    public async Task ForceBumpOfVersion_ForcesRecompute_AndTheFreshResultBecomesTheNewSharedCacheValue()
    {
        var connectionString = ConnectionString;
        Skip.If(string.IsNullOrWhiteSpace(connectionString),
            "Set DUPLICATE_TRAILS_TEST_POSTGRES to run this against a real Postgres/PostGIS instance.");
        RequireLocalDatabase(connectionString!);

        var (a, b) = await SeedTwoOverlappingTrailsAsync(connectionString!);
        var cache = new MemoryCache(new MemoryCacheOptions());

        await using var context1 = new UtanvegaDbContext(OptionsFor(connectionString!));
        var handler1 = new GetDuplicateTrailsQueryHandler(context1, NullLogger<GetDuplicateTrailsQueryHandler>.Instance, cache);
        var first = await handler1.Handle(new GetDuplicateTrailsQuery(), CancellationToken.None);
        Assert.Equal("Trail A", NameForId(first[0], a.Id));

        await RenameTrailAsync(connectionString!, a.Id, "Force-Renamed Trail A");

        // Same version-bump mechanism the `force=true` endpoint branch uses (Program.cs), applied
        // directly here rather than via a WebApplicationFactory, since the endpoint itself is a
        // thin wrapper around exactly this.
        var currentVersion = cache.GetOrCreate(CacheKeys.TrailDuplicatesVersion, e =>
        {
            e.Priority = CacheItemPriority.NeverRemove;
            return 0;
        });
        cache.Set(CacheKeys.TrailDuplicatesVersion, currentVersion + 1,
            new MemoryCacheEntryOptions { Priority = CacheItemPriority.NeverRemove });

        await using var context2 = new UtanvegaDbContext(OptionsFor(connectionString!));
        var handler2 = new GetDuplicateTrailsQueryHandler(context2, NullLogger<GetDuplicateTrailsQueryHandler>.Instance, cache);
        var second = await handler2.Handle(new GetDuplicateTrailsQuery(), CancellationToken.None);

        Assert.Single(second);
        Assert.Equal("Force-Renamed Trail A", NameForId(second[0], a.Id));

        // No further version bump, no further DB write — a subsequent plain call must still see
        // the fresh result, proving it replaced the shared cache entry rather than just being
        // returned once as a one-off response.
        await using var context3 = new UtanvegaDbContext(OptionsFor(connectionString!));
        var handler3 = new GetDuplicateTrailsQueryHandler(context3, NullLogger<GetDuplicateTrailsQueryHandler>.Instance, cache);
        var third = await handler3.Handle(new GetDuplicateTrailsQuery(), CancellationToken.None);

        Assert.Single(third);
        Assert.Equal("Force-Renamed Trail A", NameForId(third[0], a.Id));
    }
}
