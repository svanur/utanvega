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
    // block arming an unrelated "b@example.com".
    private static readonly ConcurrentDictionary<string, object> Locks = new();

    /// <summary>
    /// Atomically checks whether <paramref name="key"/> is already present in <paramref name="cache"/>
    /// and, if not, sets it (value <c>true</c>, expiring after <paramref name="ttl"/>) within the
    /// same critical section. Returns <c>true</c> if this call armed the marker — the key was not
    /// already present — or <c>false</c> if the key was already present, meaning the caller is
    /// inside an existing cooldown/in-flight window and must not proceed.
    /// </summary>
    public static bool TryArm(IMemoryCache cache, string key, TimeSpan ttl)
    {
        lock (Locks.GetOrAdd(key, static _ => new object()))
        {
            if (cache.TryGetValue(key, out _))
                return false;

            cache.Set(key, true, ttl);
            return true;
        }
    }
}
