using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Trails.Queries.GetDuplicateTrails;

namespace Utanvega.Backend.Tests.Caching;

/// <summary>
/// #1073: fast, always-on counterpart to GetDuplicateTrailsQueryHandlerCachingTests, which needs a
/// real Postgres/PostGIS instance and is skipped in CI. These tests never let a cache miss reach
/// completion of the handler's Postgres-only candidate SQL (GREATEST/LEAST, the geometry
/// <c>&amp;&amp;</c> operator) — SQLite doesn't recognize those functions and throws "no such
/// function" the instant it tries to prepare the statement, regardless of how many rows exist or
/// match. That throw is a reliable, DB-provider-agnostic signal that a real recompute was
/// attempted, which is enough to prove the version-token cache-hit/cache-miss contract here
/// without Docker. (Whether the recompute, once it reaches real Postgres, produces the right
/// duplicate pairs is covered by the Postgres-gated test class instead — out of scope for these.)
/// </summary>
public class GetDuplicateTrailsQueryHandlerVersionCachingTests : IDisposable
{
    private readonly TestDbContextFactory _factory;

    public GetDuplicateTrailsQueryHandlerVersionCachingTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private GetDuplicateTrailsQueryHandler CreateHandler(IMemoryCache cache) =>
        new(_factory.CreateContext(), NullLogger<GetDuplicateTrailsQueryHandler>.Instance, cache);

    private static List<DuplicatePair> FakeResult() =>
    [
        new DuplicatePair(Guid.NewGuid(), "Cached Trail A", Guid.NewGuid(), "Cached Trail B", 99)
    ];

    private static int SeedCurrentVersion(IMemoryCache cache) =>
        cache.GetOrCreate(CacheKeys.TrailDuplicatesVersion, e =>
        {
            e.Priority = CacheItemPriority.NeverRemove;
            return 0;
        });

    [Fact]
    public async Task Handle_CacheHit_ReturnsCachedValue_WithoutAttemptingRecompute()
    {
        var cache = new MemoryCache(new MemoryCacheOptions());
        var version = SeedCurrentVersion(cache);
        var fixture = FakeResult();
        cache.Set(CacheKeys.TrailDuplicates(version, 95), fixture, TimeSpan.FromMinutes(15));

        // If this recomputed instead of serving the cache, it would hit SQLite's "no such
        // function: GREATEST" and throw — reaching the assertion below proves it didn't.
        var result = await CreateHandler(cache).Handle(new GetDuplicateTrailsQuery(), CancellationToken.None);

        Assert.Same(fixture, result);
    }

    [Fact]
    public async Task Handle_ColdCache_AttemptsARealRecompute()
    {
        var cache = new MemoryCache(new MemoryCacheOptions());

        // Nothing pre-seeded for this (fresh) version — the handler has no choice but to run the
        // real candidate query, which SQLite can't execute. The throw is proof of a genuine
        // recompute attempt, not a mocked stand-in for one.
        await Assert.ThrowsAnyAsync<Exception>(() =>
            CreateHandler(cache).Handle(new GetDuplicateTrailsQuery(), CancellationToken.None));
    }

    [Fact]
    public async Task InvalidateTrail_BumpsVersion_SoAPreviouslyCachedEntryNoLongerServesTheNextCall()
    {
        var cache = new MemoryCache(new MemoryCacheOptions());
        var invalidator = new CacheInvalidator(cache);

        var version = SeedCurrentVersion(cache);
        cache.Set(CacheKeys.TrailDuplicates(version, 95), FakeResult(), TimeSpan.FromMinutes(15));

        // First call: served from the pre-seeded cache entry, no recompute.
        var first = await CreateHandler(cache).Handle(new GetDuplicateTrailsQuery(), CancellationToken.None);
        Assert.NotEmpty(first);

        // Mirrors every trail-mutating command: InvalidateTrail() runs after the write.
        invalidator.InvalidateTrail();

        // The bumped version orphans the old cache entry under a stale key — the handler has no
        // choice but to attempt a real recompute, which SQLite can't execute.
        await Assert.ThrowsAnyAsync<Exception>(() =>
            CreateHandler(cache).Handle(new GetDuplicateTrailsQuery(), CancellationToken.None));
    }

    [Fact]
    public async Task ForceBumpOfVersion_SoAPreviouslyCachedEntryNoLongerServesTheNextCall()
    {
        var cache = new MemoryCache(new MemoryCacheOptions());

        var version = SeedCurrentVersion(cache);
        cache.Set(CacheKeys.TrailDuplicates(version, 95), FakeResult(), TimeSpan.FromMinutes(15));

        var first = await CreateHandler(cache).Handle(new GetDuplicateTrailsQuery(), CancellationToken.None);
        Assert.NotEmpty(first);

        // Same version-bump mechanism the `force=true` endpoint branch uses in Program.cs — applied
        // directly here rather than through a WebApplicationFactory, since the endpoint is a thin
        // wrapper around exactly this.
        var currentVersion = SeedCurrentVersion(cache);
        cache.Set(CacheKeys.TrailDuplicatesVersion, currentVersion + 1,
            new MemoryCacheEntryOptions { Priority = CacheItemPriority.NeverRemove });

        await Assert.ThrowsAnyAsync<Exception>(() =>
            CreateHandler(cache).Handle(new GetDuplicateTrailsQuery(), CancellationToken.None));
    }
}
