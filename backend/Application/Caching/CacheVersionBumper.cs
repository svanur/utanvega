using System.Runtime.CompilerServices;
using Microsoft.Extensions.Caching.Memory;

namespace Utanvega.Backend.Application.Caching;

/// <summary>
/// Makes a version-token cache bump atomic. IMemoryCache has no built-in increment primitive, so
/// the previous GetOrCreate-then-Set read-modify-write let two concurrent bumps of the same key
/// both read the same "current" value and silently lose one increment (#1265).
///
/// The version is stored as a single boxed int that is created once per key and never replaced —
/// every reader of that key (here and at every existing version-reading call site, via its own
/// IMemoryCache.GetOrCreate(key)) keeps returning that same boxed instance once it exists.
/// <see cref="Unsafe.Unbox{T}"/> gives a ref straight into that box's storage, so
/// <see cref="Interlocked.Increment(ref int)"/> mutates it lock-free and atomically: N concurrent
/// bumps of the same key increase the stored version by exactly N, with no separate source of
/// truth introduced outside the one IMemoryCache entry every reader already trusts.
/// </summary>
public static class CacheVersionBumper
{
    // Only ever taken on the rare, once-per-key path where the box doesn't exist yet. Once
    // created, every subsequent bump of that key is lock-free.
    private static readonly object CreationLock = new();

    /// <summary>Atomically increments the version token stored at <paramref name="key"/> and returns the new value.</summary>
    public static int Bump(IMemoryCache cache, string key)
    {
        if (!cache.TryGetValue(key, out object? boxed) || boxed is not int)
        {
            lock (CreationLock)
            {
                // Re-check inside the lock: another thread may have created the box while this
                // one was waiting, in which case it must reuse that same box, not make a second.
                if (!cache.TryGetValue(key, out boxed) || boxed is not int)
                {
                    boxed = 0;
                    using var entry = cache.CreateEntry(key);
                    entry.Priority = CacheItemPriority.NeverRemove;
                    entry.Value = boxed;
                }
            }
        }

        return Interlocked.Increment(ref Unsafe.Unbox<int>(boxed!));
    }
}
