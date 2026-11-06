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
    /// and, if not, sets it (a freshly minted <see cref="Guid"/> token, expiring after
    /// <paramref name="ttl"/>) within the same critical section. Returns that token if this call
    /// armed the marker — the key was not already present — or <c>null</c> if the key was already
    /// present, meaning the caller is inside an existing cooldown/in-flight window and must not
    /// proceed.
    /// <para>
    /// The token exists so a caller's own cleanup can later prove it is removing the marker it
    /// itself armed, not some other request's — see <see cref="TryRelease"/>. Before #1667, cleanup
    /// was an unconditional <c>cache.Remove(key)</c>: if this marker expired or was legitimately
    /// promoted/replaced while this caller was still awaiting MailerLite, that unconditional remove
    /// could delete a different, still-in-flight request's marker for the same key, reopening the
    /// #1647/#1655 subscription-bombing window.
    /// </para>
    /// </summary>
    public static Guid? TryArm(IMemoryCache cache, string key, TimeSpan ttl) =>
        WithKeyLock(key, () =>
        {
            if (cache.TryGetValue(key, out _))
                return (Guid?)null;

            var token = Guid.NewGuid();
            cache.Set(key, token, ttl);
            return token;
        });

    /// <summary>
    /// Compare-and-remove counterpart to <see cref="TryArm"/>: removes <paramref name="key"/> from
    /// <paramref name="cache"/> only if its current value is still exactly <paramref name="token"/> —
    /// the token this same caller received from the <see cref="TryArm"/> call it is now cleaning up
    /// after. If the entry has since expired, been released, or been re-armed/promoted by another
    /// request, its current value will not match and this is a no-op, leaving that other request's
    /// marker intact (#1667). Takes the same per-key lock as <see cref="TryArm"/> so a release and a
    /// concurrent re-arm of the same key can never race each other.
    /// </summary>
    /// <returns><c>true</c> if the entry was removed, <c>false</c> if it was left alone.</returns>
    public static bool TryRelease(IMemoryCache cache, string key, Guid token) =>
        WithKeyLock(key, () =>
        {
            if (!cache.TryGetValue(key, out var current) || current is not Guid currentToken || currentToken != token)
                return false;

            cache.Remove(key);
            return true;
        });

    /// <summary>
    /// Shared critical-section plumbing for <see cref="TryArm"/> and <see cref="TryRelease"/>: takes
    /// the reference-counted per-key lock (#1666), runs <paramref name="criticalSection"/> while
    /// holding it, and releases/retires the lock entry afterward.
    /// </summary>
    private static T WithKeyLock<T>(string key, Func<T> criticalSection)
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
                    return criticalSection();
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
