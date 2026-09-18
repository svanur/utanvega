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
            .Where(ed => EditionStatusHelpers.IsPast(LatestEffectiveDate(ed), today))
            .ToList();

        if (due.Count == 0) return 0;

        foreach (var edition in due)
        {
            edition.CompleteWithRaces();
            edition.UpdatedAt = DateTime.UtcNow;
        }

        await context.SaveChangesAsync(cancellationToken);

        // Distinct: a Series event can have several overdue Active editions in one sweep, and
        // InvalidateEvent also bumps the shared EventVersion token — invalidating once per edition
        // here would bump it redundantly for the same event. See issue #909.
        foreach (var slug in due.Select(ed => ed.Event.Slug).Distinct())
        {
            cacheInvalidator.InvalidateEvent(slug);
        }

        return due.Count;
    }

    /// <summary>
    /// The date the sweep treats as "when this edition's run is over".
    ///
    /// <para>
    /// Normally that's <see cref="EditionStatusHelpers.EffectiveDate"/> (EndDate, or Date if unset).
    /// But for a Series edition, Date is typically the first race's date and EndDate is commonly
    /// left unset (see GenerateEditionsForSeasonCommand), so EffectiveDate alone would fall back to
    /// the first leg — and the moment that leg passes, the whole edition (and every later, still
    /// unrun leg) would get swept into Completed. Taking the later of EffectiveDate and the latest
    /// race's DateOfRace fixes that while being a no-op for editions whose races have no
    /// DateOfRace, so it's safe to apply unconditionally rather than special-casing Series.
    /// </para>
    /// </summary>
    private static DateOnly? LatestEffectiveDate(EventEdition edition)
    {
        var effectiveDate = EditionStatusHelpers.EffectiveDate(edition.Date, edition.EndDate);
        var raceDates = edition.Races
            .Where(r => r.DateOfRace.HasValue)
            .Select(r => r.DateOfRace!.Value)
            .ToList();

        if (raceDates.Count == 0)
            return effectiveDate;

        var latestRaceDate = raceDates.Max();

        return effectiveDate.HasValue && effectiveDate.Value > latestRaceDate
            ? effectiveDate
            : latestRaceDate;
    }
}
