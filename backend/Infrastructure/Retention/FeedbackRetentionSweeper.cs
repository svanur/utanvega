using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Infrastructure.Retention;

/// <summary>
/// Clears the screenshot and browser-metadata fields from feedback rows older than the
/// retention window.
///
/// <para>
/// The row itself is kept — the report text, category, name/email, status, priority and
/// admin comment all survive, since none of those identify a device or capture a page's
/// contents the way a screenshot URL and a browser-info JSON blob (UA, viewport, timezone,
/// connection) do. Those two fields are what this sweep removes.
/// </para>
/// </summary>
public static class FeedbackRetentionSweeper
{
    /// <summary>
    /// Nulls <c>ScreenshotUrl</c> and <c>BrowserInfo</c> on feedback rows older than
    /// <paramref name="retention"/>. Returns the number of rows affected.
    /// </summary>
    /// <remarks>
    /// A set-based UPDATE — the rows are never loaded, so cost does not grow with how far
    /// behind the job has fallen.
    /// </remarks>
    public static async Task<int> SweepAsync(
        UtanvegaDbContext context,
        TimeSpan retention,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken = default)
    {
        var cutoff = utcNow - retention;

        return await context.Feedback
            .Where(f => f.CreatedAt < cutoff && (f.ScreenshotUrl != null || f.BrowserInfo != null))
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(f => f.ScreenshotUrl, _ => null)
                    .SetProperty(f => f.BrowserInfo, _ => null),
                cancellationToken);
    }
}
