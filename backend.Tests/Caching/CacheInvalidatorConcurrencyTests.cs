using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Caching;

namespace Utanvega.Backend.Tests.Caching;

/// <summary>
/// #1265: InvalidateTrail/InvalidateEvent/InvalidateLeaderboard used to bump their version-token
/// cache entry with a read-then-write (GetOrCreate followed by Set) that is non-atomic — two
/// concurrent callers can both read the same "current" value and one increment is silently lost.
/// These tests fire N concurrent invalidations of the same key via Task.WhenAll and assert the
/// resulting version increased by exactly N, not merely "it increased" (which the old buggy
/// version would often also satisfy under light contention).
/// </summary>
public class CacheInvalidatorConcurrencyTests : IDisposable
{
    private readonly IMemoryCache _cache;
    private readonly CacheInvalidator _invalidator;

    public CacheInvalidatorConcurrencyTests()
    {
        _cache = new MemoryCache(new MemoryCacheOptions());
        _invalidator = new CacheInvalidator(_cache);
    }

    public void Dispose() => _cache.Dispose();

    private static int SeedCurrentVersion(IMemoryCache cache, string key) =>
        cache.GetOrCreate(key, e =>
        {
            e.Priority = CacheItemPriority.NeverRemove;
            return 0;
        });

    [Fact]
    public async Task InvalidateEvent_ConcurrentCalls_BumpEventVersionByExactlyN()
    {
        const int concurrentCalls = 200;
        SeedCurrentVersion(_cache, CacheKeys.EventVersion);

        // All N calls race on the exact same version key — a lost-update bug would land below N.
        await Task.WhenAll(Enumerable.Range(0, concurrentCalls)
            .Select(_ => Task.Run(() => _invalidator.InvalidateEvent())));

        var finalVersion = SeedCurrentVersion(_cache, CacheKeys.EventVersion);
        Assert.Equal(concurrentCalls, finalVersion);
    }

    [Fact]
    public async Task InvalidateTrail_ConcurrentCalls_BumpTrailDuplicatesVersionByExactlyN()
    {
        const int concurrentCalls = 200;
        SeedCurrentVersion(_cache, CacheKeys.TrailDuplicatesVersion);

        await Task.WhenAll(Enumerable.Range(0, concurrentCalls)
            .Select(_ => Task.Run(() => _invalidator.InvalidateTrail())));

        var finalVersion = SeedCurrentVersion(_cache, CacheKeys.TrailDuplicatesVersion);
        Assert.Equal(concurrentCalls, finalVersion);
    }

    [Fact]
    public async Task InvalidateLeaderboard_ConcurrentCallsForSameSlug_BumpVersionByExactlyN()
    {
        const int concurrentCalls = 200;
        const string slug = "a-trail";
        var versionKey = CacheKeys.LeaderboardVersion(slug);
        SeedCurrentVersion(_cache, versionKey);

        await Task.WhenAll(Enumerable.Range(0, concurrentCalls)
            .Select(_ => Task.Run(() => _invalidator.InvalidateLeaderboard(slug))));

        var finalVersion = SeedCurrentVersion(_cache, versionKey);
        Assert.Equal(concurrentCalls, finalVersion);
    }

    [Fact]
    public async Task InvalidateLeaderboard_ConcurrentCallsForDifferentSlugs_DoNotCrossContaminateVersions()
    {
        const int concurrentCalls = 200;
        const string slugA = "trail-a";
        const string slugB = "trail-b";
        var versionKeyA = CacheKeys.LeaderboardVersion(slugA);
        var versionKeyB = CacheKeys.LeaderboardVersion(slugB);
        SeedCurrentVersion(_cache, versionKeyA);
        SeedCurrentVersion(_cache, versionKeyB);

        var callsA = Enumerable.Range(0, concurrentCalls).Select(_ => Task.Run(() => _invalidator.InvalidateLeaderboard(slugA)));
        var callsB = Enumerable.Range(0, concurrentCalls).Select(_ => Task.Run(() => _invalidator.InvalidateLeaderboard(slugB)));
        await Task.WhenAll(callsA.Concat(callsB));

        Assert.Equal(concurrentCalls, SeedCurrentVersion(_cache, versionKeyA));
        Assert.Equal(concurrentCalls, SeedCurrentVersion(_cache, versionKeyB));
    }
}
