using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using Microsoft.Extensions.Caching.Memory;

namespace Utanvega.Backend.Application.Caching;

/// <summary>
/// Single creation+read+bump path for version-token cache entries, so every caller — the four
/// version-reading query handlers (GetEventCalendarQuery, GetEditionsHistoryQuery,
/// GetDuplicateTrailsQuery, GetTrailLeaderboardHandler) and CacheInvalidator's three bump sites,
/// plus Program.cs's duplicate-detection force=true branch — converges on exactly one boxed int
/// per key, created at most once.
///
/// IMemoryCache.GetOrCreate is NOT atomic for creation: two racing calls that both miss can each
/// build their own boxed value and both Set it, with the dictionary ending up holding whichever
/// Set landed last. Before this (#1265 review round 2), the four readers used a plain
/// IMemoryCache.GetOrCreate independently of this class's own creation path, so a reader and a
/// Bump racing on a key that had *never* been created yet could each win creation of their own
/// box — silently orphaning whichever one lost, dropping any increment already applied to it.
/// EnsureBox is now the only place that ever creates the entry, guarded by a per-key lock, so
/// there is exactly one creation winner regardless of whether a reader or a bump gets there first.
///
/// Once the box exists, Read is lock-free (a plain TryGetValue + unboxing copy) and Bump is
/// lock-free (<see cref="Unsafe.Unbox{T}"/> + <see cref="Interlocked.Increment(ref int)"/> mutate
/// the single box in place) — the lock is only ever taken on the one-time-per-key creation path.
/// </summary>
public static class CacheVersionBumper
{
    // Per-key creation lock, not one lock shared by every version key — creating "event:version"
    // must never block creation of an unrelated "leaderboard:some-trail:version".
    private static readonly ConcurrentDictionary<string, object> CreationLocks = new();

    /// <summary>Returns the current version for <paramref name="key"/>, creating it (as 0) if it doesn't exist yet.</summary>
    public static int Read(IMemoryCache cache, string key) => (int)EnsureBox(cache, key);

    /// <summary>Atomically increments the version token stored at <paramref name="key"/> and returns the new value.</summary>
    public static int Bump(IMemoryCache cache, string key)
    {
        var boxed = EnsureBox(cache, key);
        return Interlocked.Increment(ref Unsafe.Unbox<int>(boxed));
    }

    private static object EnsureBox(IMemoryCache cache, string key)
    {
        if (cache.TryGetValue(key, out object? boxed) && boxed is int) return boxed;

        lock (CreationLocks.GetOrAdd(key, static _ => new object()))
        {
            // Re-check inside the lock: a reader's Read or another thread's Bump may have
            // created the box while this call was waiting, in which case it must reuse that
            // same box, never make a second one.
            if (cache.TryGetValue(key, out boxed) && boxed is int) return boxed;

            boxed = 0;
            using var entry = cache.CreateEntry(key);
            entry.Priority = CacheItemPriority.NeverRemove;
            entry.Value = boxed;
            return boxed;
        }
    }
}
