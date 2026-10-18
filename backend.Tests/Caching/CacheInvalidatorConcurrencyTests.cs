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

    // #1265 review round 2: the tests above all pre-seed the key (SeedCurrentVersion) before
    // firing concurrent invalidations, so they only ever exercise the "key already exists" fast
    // path. They never exercised the cold-start creation race the reviewer found: a reader's
    // IMemoryCache.GetOrCreate and CacheInvalidator's bump racing on a key that has *never* been
    // created yet, where the two could each create and commit their own box, with the loser's
    // increment silently dropped. The tests below deliberately never seed the key first.

    [Fact]
    public async Task InvalidateLeaderboard_ConcurrentCallsOnNeverSeededKey_BumpVersionByExactlyN()
    {
        const int concurrentCalls = 200;
        const string slug = "never-seeded-trail";
        var versionKey = CacheKeys.LeaderboardVersion(slug);
        // Deliberately no SeedCurrentVersion call — the key does not exist in _cache yet, so the
        // very first of these N concurrent calls is also racing to create the entry.

        await Task.WhenAll(Enumerable.Range(0, concurrentCalls)
            .Select(_ => Task.Run(() => _invalidator.InvalidateLeaderboard(slug))));

        var finalVersion = SeedCurrentVersion(_cache, versionKey);
        Assert.Equal(concurrentCalls, finalVersion);
    }

    [Fact]
    public async Task ColdStart_ReadersRacingInvalidateEvent_OnNeverSeededKey_NeverLosesABump()
    {
        // Mirrors what actually happens in production: GetEventCalendarQuery/GetEditionsHistoryQuery
        // read EventVersion via CacheVersionBumper.Read on every request, completely independently
        // of writes. Here, readers and bumps race concurrently on a key that has never been
        // touched by either side — the exact gap the reviewer found in round 1, where the reader
        // used an unguarded IMemoryCache.GetOrCreate instead of going through CacheVersionBumper.
        const int readerCalls = 100;
        const int bumpCalls = 100;
        // No SeedCurrentVersion call — key is untouched going into the race.

        var readers = Enumerable.Range(0, readerCalls)
            .Select(_ => Task.Run(() => CacheVersionBumper.Read(_cache, CacheKeys.EventVersion)));
        var bumps = Enumerable.Range(0, bumpCalls)
            .Select(_ => Task.Run(() => _invalidator.InvalidateEvent()));
        await Task.WhenAll(readers.Concat(bumps));

        var finalVersion = CacheVersionBumper.Read(_cache, CacheKeys.EventVersion);
        Assert.Equal(bumpCalls, finalVersion);
    }

    [Fact]
    public async Task ColdStart_SingleReadThenSingleBump_OnNeverSeededKey_BumpIsNeverOrphaned()
    {
        // The reviewer's minimal repro: one reader and one bump, racing on a key that has never
        // been created, repeated across many fresh caches to make a lost increment visible even
        // though it's a low-probability race per trial (reviewer measured 37/500 on the old code).
        const int trials = 300;
        var failures = 0;

        for (var trial = 0; trial < trials; trial++)
        {
            using var cache = new MemoryCache(new MemoryCacheOptions());
            var invalidator = new CacheInvalidator(cache);
            var key = CacheKeys.LeaderboardVersion($"cold-trial-{trial}");

            var readTask = Task.Run(() => CacheVersionBumper.Read(cache, key));
            var bumpTask = Task.Run(() => invalidator.InvalidateLeaderboard($"cold-trial-{trial}"));
            await Task.WhenAll(readTask, bumpTask);

            if (CacheVersionBumper.Read(cache, key) != 1) failures++;
        }

        Assert.Equal(0, failures);
    }
}
