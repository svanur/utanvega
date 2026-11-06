using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Infrastructure.Newsletter;

namespace Utanvega.Backend.Tests.Services;

// #1666: NewsletterCooldownGate's per-key lock dictionary (added #1655) used to GetOrAdd a lock
// object per cooldown key and never remove it, so every distinct subscriber email ever submitted
// left a permanent entry for the process lifetime. These tests cover the two properties the fix
// (reference-counted lock entries, removed once the last waiter leaves) must preserve: the
// dictionary does not grow with the number of distinct keys ever seen, and the atomic
// check-and-arm guarantee from #1655 still holds for concurrent callers on the same key.
public class NewsletterCooldownGateTests
{
    private static IMemoryCache NewCache() => new MemoryCache(new MemoryCacheOptions());

    // Acceptance criterion: arm+complete N distinct keys, internal lock structure stays bounded
    // rather than retaining one entry per key forever.
    [Fact]
    public void TryArm_ManyDistinctKeysInSequence_LockDictionaryDoesNotGrow()
    {
        var cache = NewCache();

        for (var i = 0; i < 500; i++)
        {
            var armed = NewsletterCooldownGate.TryArm(cache, $"cooldown-key-{i}", TimeSpan.FromMinutes(5));
            Assert.True(armed);
        }

        // Each call above both enters and fully exits its own critical section synchronously, with
        // no other thread ever holding a reference to that key's lock entry — so every entry must
        // have been removed again by the time TryArm returns, regardless of how many distinct keys
        // were ever seen.
        Assert.Equal(0, NewsletterCooldownGate.LockCountForTests);
    }

    // Same property, but for keys that fail to arm (already present) — the lock entry must be
    // released on that path too, not just the "we armed it" path.
    [Fact]
    public void TryArm_RepeatedCallsOnAlreadyArmedKey_LockDictionaryDoesNotGrow()
    {
        var cache = NewCache();

        for (var i = 0; i < 50; i++)
        {
            var key = $"repeat-key-{i}";
            Assert.True(NewsletterCooldownGate.TryArm(cache, key, TimeSpan.FromMinutes(5)));
            Assert.False(NewsletterCooldownGate.TryArm(cache, key, TimeSpan.FromMinutes(5)));
        }

        Assert.Equal(0, NewsletterCooldownGate.LockCountForTests);
    }

    // #1655's original guarantee, re-proven against the reference-counted rewrite: two threads
    // racing TryArm for the identical key must never both win — exactly one true, one false —
    // even though they now both briefly share and increment/decrement the same lock entry's
    // refcount before entering the critical section.
    [Fact]
    public async Task TryArm_TwoConcurrentCallsSameKey_ExactlyOneWins()
    {
        var cache = NewCache();
        const string key = "race-key";
        var barrier = new Barrier(2);

        Func<Task<bool>> run = () => Task.Run(() =>
        {
            barrier.SignalAndWait();
            return NewsletterCooldownGate.TryArm(cache, key, TimeSpan.FromMinutes(5));
        });

        var results = await Task.WhenAll(run(), run());

        Assert.Equal(1, results.Count(r => r));
        Assert.Equal(1, results.Count(r => !r));
        // Both callers are done, neither left anything behind for this key.
        Assert.Equal(0, NewsletterCooldownGate.LockCountForTests);
    }

    // Stress variant of the above: many concurrent callers racing the same key, repeated across many
    // distinct keys in parallel, must still only ever let one caller through per key, and must not
    // leak lock entries under concurrent load (not just the sequential case covered above).
    [Fact]
    public async Task TryArm_ManyConcurrentCallersAcrossManyKeys_OneWinnerPerKeyAndNoLeak()
    {
        var cache = NewCache();
        const int keyCount = 20;
        const int callersPerKey = 10;

        var tasks = new List<Task<bool>>();
        foreach (var keyIndex in Enumerable.Range(0, keyCount))
        {
            var key = $"stress-key-{keyIndex}";
            for (var c = 0; c < callersPerKey; c++)
                tasks.Add(Task.Run(() => NewsletterCooldownGate.TryArm(cache, key, TimeSpan.FromMinutes(5))));
        }

        var results = await Task.WhenAll(tasks);

        Assert.Equal(keyCount, results.Count(r => r));
        Assert.Equal(keyCount * (callersPerKey - 1), results.Count(r => !r));
        Assert.Equal(0, NewsletterCooldownGate.LockCountForTests);
    }
}
