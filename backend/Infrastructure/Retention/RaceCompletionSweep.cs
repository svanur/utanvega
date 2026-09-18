using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Infrastructure.Retention;

/// <summary>
/// Auto-completes individual <see cref="RaceStatus.Active"/> races whose own
/// <see cref="Race.DateOfRace"/> is past, independent of whether their parent edition has
/// completed.
///
/// <para>
/// <see cref="EventEdition.CompleteWithRaces"/> only cascades to races when the whole edition
/// completes, which is correct for a single-day edition but leaves a multi-leg Series edition's
/// early legs sitting at Active/TicketStatus.Available for months — the edition (correctly) stays
/// Active until its last leg passes, per <see cref="EditionCompletionSweep"/>'s
/// LatestEffectiveDate. This sweep closes that gap at the race level without touching the
/// edition's own status, so admins no longer have to notice and click "Mark race Completed" by
/// hand for every past-dated leg. See issue #911.
/// </para>
///
/// <para>
/// Only races under <see cref="EditionStatus.Active"/> editions are swept. Races under
/// Unconfirmed/Hidden editions are deliberately left alone — same reasoning
/// <see cref="EditionCompletionSweep"/> already applies at the edition level: those need a human
/// to confirm the edition actually happened before anything under it is marked Completed.
/// </para>
/// </summary>
public static class RaceCompletionSweep
{
    /// <summary>
    /// Completes every past-dated Active race under an Active edition, as of
    /// <paramref name="today"/>. Returns the number of races completed.
    /// </summary>
    /// <remarks>
    /// EditionStatusHelpers.IsPast isn't SQL-translatable, so the Active/DateOfRace-present filter
    /// runs in the database and the date check runs in memory — the same split
    /// EditionCompletionSweep.cs already uses for this helper.
    /// </remarks>
    public static async Task<int> RunAsync(
        UtanvegaDbContext context,
        ICacheInvalidator cacheInvalidator,
        DateOnly today,
        CancellationToken cancellationToken = default)
    {
        var candidateRaces = await context.Races
            .Include(r => r.EventEdition)
                .ThenInclude(ed => ed.Event)
            .Where(r =>
                r.Status == RaceStatus.Active &&
                r.DateOfRace.HasValue &&
                r.EventEdition.Status == EditionStatus.Active)
            .ToListAsync(cancellationToken);

        var due = candidateRaces
            .Where(r => EditionStatusHelpers.IsPast(r.DateOfRace, today))
            .ToList();

        if (due.Count == 0) return 0;

        foreach (var race in due)
        {
            race.Status = RaceStatus.Completed;
            race.TicketStatus = TicketStatus.Closed;
        }

        await context.SaveChangesAsync(cancellationToken);

        // Distinct: a Series edition can have several overdue Active races in one sweep, and
        // InvalidateEvent also bumps the shared EventVersion token — invalidating once per race
        // here would bump it redundantly for the same event. Same reasoning as
        // EditionCompletionSweep.cs, citing #909.
        foreach (var slug in due.Select(r => r.EventEdition.Event.Slug).Distinct())
        {
            cacheInvalidator.InvalidateEvent(slug);
        }

        return due.Count;
    }
}
