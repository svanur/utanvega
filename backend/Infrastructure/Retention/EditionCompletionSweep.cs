using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Infrastructure.Retention;

/// <summary>
/// Auto-completes <see cref="EditionStatus.Active"/> editions whose run is over, so admins no
/// longer have to notice and click "Mark edition Completed" by hand for every past-dated edition.
///
/// <para>
/// Reuses <see cref="EventEdition.CompleteWithRaces"/> — the exact cascade the manual
/// CompleteEditionCommand applies (races, registration status) — rather than reimplementing the
/// transition here, so the automatic and manual paths can never drift apart. See issue #361.
/// </para>
///
/// <para>
/// Only <see cref="EditionStatus.Active"/> editions are swept. Unconfirmed/Hidden past editions
/// are deliberately left alone — those need a human to confirm they actually happened before
/// they're marked Completed.
/// </para>
/// </summary>
public static class EditionCompletionSweep
{
    /// <summary>
    /// Completes every past-dated Active edition as of <paramref name="today"/>.
    /// Returns the number of editions completed.
    /// </summary>
    /// <remarks>
    /// EditionStatusHelpers.EffectiveDate/IsPast aren't SQL-translatable, so the Active filter runs
    /// in the database and the date check runs in memory — the same split CreateEditionCommand and
    /// GenerateEditionsForSeasonCommand already use for this pair of helpers.
    /// </remarks>
    public static async Task<int> RunAsync(
        UtanvegaDbContext context,
        ICacheInvalidator cacheInvalidator,
        DateOnly today,
        CancellationToken cancellationToken = default)
    {
        var activeEditions = await context.EventEditions
            .Include(ed => ed.Event)
            .Include(ed => ed.Races)
            .Where(ed => ed.Status == EditionStatus.Active)
            .ToListAsync(cancellationToken);

        var due = activeEditions
            .Where(ed => EditionStatusHelpers.IsPast(EditionStatusHelpers.EffectiveDate(ed.Date, ed.EndDate), today))
            .ToList();

        if (due.Count == 0) return 0;

        foreach (var edition in due)
        {
            edition.CompleteWithRaces();
            edition.UpdatedAt = DateTime.UtcNow;
        }

        await context.SaveChangesAsync(cancellationToken);

        foreach (var edition in due)
        {
            cacheInvalidator.InvalidateEvent(edition.Event.Slug);
        }

        return due.Count;
    }
}
