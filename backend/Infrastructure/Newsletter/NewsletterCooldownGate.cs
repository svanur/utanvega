using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;

namespace Utanvega.Backend.Infrastructure.Newsletter;

/// <summary>
/// Atomic check-and-arm for the newsletter per-email cooldown/in-flight marker (#1647, #1655).
/// <see cref="IMemoryCache"/> has no TryAdd-with-TTL primitive: a plain
/// <c>TryGetValue</c>-then-<c>Set</c> is two separate calls, so two requests for the same
/// normalized email arriving close enough together can both observe "not present" on
/// <c>TryGetValue</c> and both proceed to MailerLite before either <c>Set</c> lands — the race
/// this class closes. Mirrors <c>CacheVersionBumper</c>'s per-key lock shape: a lock scoped to one
/// cooldown key never blocks an unrelated email's check-and-arm.
/// </summary>
public static class NewsletterCooldownGate
{
    // Per-key lock, not one lock shared by every cooldown key — arming "a@example.com" must never
    // block arming an unrelated "b@example.com". Unlike CacheVersionBumper's CreationLocks (a small
    // bounded set of cache-version tokens, intentionally kept forever), this dictionary's keys are
    // every distinct subscriber email ever submitted — unbounded over a process lifetime — so each
    // entry is reference-counted and removed once the last caller waiting on it leaves (#1666).
    private static readonly ConcurrentDictionary<string, RefCountedLock> Locks = new();

    // Test-only hook (backend.Tests has InternalsVisibleTo) proving Locks does not grow with the
    // number of distinct keys ever seen — see NewsletterCooldownGateTests.
    internal static int LockCountForTests => Locks.Count;

    private sealed class RefCountedLock
    {
        // Guarded by `lock (this)` — every read/write of RefCount below happens inside a lock on
        // the same instance, so plain int (no Interlocked) is enough.
        public int RefCount;
    }

    /// <summary>
    /// Atomically checks whether <paramref name="key"/> is already present in <paramref name="cache"/>
    /// and, if not, sets it (value <c>true</c>, expiring after <paramref name="ttl"/>) within the
    /// same critical section. Returns <c>true</c> if this call armed the marker — the key was not
    /// already present — or <c>false</c> if the key was already present, meaning the caller is
    /// inside an existing cooldown/in-flight window and must not proceed.
    /// </summary>
    public static bool TryArm(IMemoryCache cache, string key, TimeSpan ttl)
    {
        while (true)
        {
            var entry = Locks.GetOrAdd(key, static _ => new RefCountedLock());

            lock (entry)
            {
                // Another thread may have already decremented this exact entry to zero and
                // removed it from Locks (see the finally block below) between our GetOrAdd call
                // and acquiring the lock on it — RefCount is left at -1 as the tombstone marker
                // for that case. Retrying re-reads Locks, which by now either holds a fresh entry
                // or lets us create one, so we never register our wait against a lock object that
                // has already been retired.
                if (entry.RefCount < 0)
                    continue;

                entry.RefCount++;
            }

            try
            {
                lock (entry)
                {
                    if (cache.TryGetValue(key, out _))
                        return false;

                    cache.Set(key, true, ttl);
                    return true;
                }
            }
            finally
            {
                lock (entry)
                {
                    entry.RefCount--;
                    if (entry.RefCount == 0)
                    {
                        // Safe to drop: still holding entry's lock, so no other thread can be
                        // mid-GetOrAdd-then-increment on this same entry right now — any thread
                        // that already has a reference to it is blocked on this lock, and will see
                        // the -1 tombstone below and retry with a fresh entry once we release it.
                        Locks.TryRemove(key, out _);
                        entry.RefCount = -1;
                    }
                }
            }
        }
    }
}
