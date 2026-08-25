using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Infrastructure.Retention;

/// <summary>
/// Clears the IP hash from trail views older than the retention window.
///
/// <para>
/// The row itself is kept. Only the identifier is removed, so every count
/// derived from views — totals, per-trail popularity, the daily and hourly
/// distributions, trending — is unaffected in perpetuity. What is lost is the
/// ability to tell whether two views older than the window came from the same
/// person, which only the unique-visitor figures use.
/// </para>
///
/// <para>
/// The hash exists for two jobs, both short-lived: deduplicating repeat views
/// within 30 minutes, and counting distinct visitors over a reporting window of
/// at most 30 days. Keeping it beyond that serves nothing, and an IP digest is
/// personal data — so it is cleared rather than retained indefinitely.
/// </para>
/// </summary>
public static class TrailViewAnonymizer
{
    /// <summary>
    /// Nulls the hash on views older than <paramref name="retention"/>.
    /// Returns the number of rows affected.
    /// </summary>
    /// <remarks>
    /// A set-based UPDATE — the rows are never loaded, so cost does not grow
    /// with how far behind the job has fallen.
    /// </remarks>
    public static async Task<int> AnonymizeAsync(
        UtanvegaDbContext context,
        TimeSpan retention,
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        var cutoff = utcNow - retention;

        return await context.TrailViews
            .Where(v => v.IpHash != null && v.ViewedAtUtc < cutoff)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(v => v.IpHash, _ => null),
                cancellationToken);
    }
}
