using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Infrastructure.Retention;

/// <summary>
/// Auto-clones a next-year edition for every <see cref="EditionStatus.Completed"/> Race/Series
/// edition, so admins no longer have to remember to click "Clone edition to next year" (see
/// EventDetailPage.handleCloneEdition in admin) once a season wraps up.
///
/// <para>
/// Reproduces that exact client-side logic — <c>suggestEditionDateForYear</c>,
/// <c>suggestEditionEndDateForYear</c>, <c>bumpYearInUrl</c>, <c>computeClonedRaceDate</c> (all in
/// admin/src/utils/eventHelpers.ts) — server-side rather than delegating to it, so the clone runs
/// automatically regardless of whether the edition reached Completed via
/// <see cref="EditionCompletionSweep"/> (#361) or a manual "Mark edition Completed" click. See
/// issue #904.
/// </para>
///
/// <para>
/// Eligibility is computed fresh on every run from each edition's current state (Completed +
/// parent Event.Type + Event.Status), not tied to what the completion sweep produced in the same
/// pass — an edition completed by hand is picked up exactly the same way as one the sweep
/// completed itself.
/// </para>
/// </summary>
public static class EditionAutoCloneSweep
{
    /// <summary>
    /// Clones a next-year edition for every eligible Completed edition as of <paramref name="today"/>.
    /// Returns the number of editions cloned.
    /// </summary>
    public static async Task<int> RunAsync(
        UtanvegaDbContext context,
        ICacheInvalidator cacheInvalidator,
        DateOnly today,
        CancellationToken cancellationToken = default)
    {
        // Event.Type is filtered by a positive Race-or-Series check rather than excluding known
        // non-race types by name — see #904's CONTEXT note on EventType not having a
        // FunRun/Training member. Anything else (Social, Advertisement, Festival, Other) is
        // excluded by construction regardless of what it's called.
        //
        // AsNoTracking: this query only reads source editions/events/races to decide what to
        // clone — nothing in the result set itself is ever mutated, only new EventEdition/Race
        // entities are added below.
        var eligibleEditions = await context.EventEditions
            .AsNoTracking()
            .Include(ed => ed.Event)
            .Include(ed => ed.Races)
            .Where(ed => ed.Status == EditionStatus.Completed &&
                         (ed.Event.Type == EventType.Race || ed.Event.Type == EventType.Series) &&
                         ed.Event.Status == EventStatus.Confirmed)
            .ToListAsync(cancellationToken);

        if (eligibleEditions.Count == 0) return 0;

        // Tracks which of the eligible editions actually produced a clone this run — not every
        // eligible edition does (a next-year edition may already exist) — so the cache
        // invalidation below only fires for events whose editions actually changed.
        var clonedSources = new List<EventEdition>();

        foreach (var source in eligibleEditions)
        {
            // Mirrors handleCloneEdition's `edition.year ?? new Date().getFullYear()`.
            var nextYear = (source.Year ?? today.Year) + 1;

            // Read-only existence check — the new edition/races added below are the only entities
            // this sweep mutates, so this lookup alone is AsNoTracking().
            var alreadyExists = await context.EventEditions
                .AsNoTracking()
                .AnyAsync(ed => ed.EventId == source.EventId && ed.Year == nextYear, cancellationToken);
            if (alreadyExists) continue;

            var suggestedDate = SuggestEditionDateForYear(source.Date, nextYear);
            var suggestedEndDate = SuggestEditionEndDateForYear(source.Date, source.EndDate, suggestedDate);

            // Success: a usable Date could be projected forward. Failure: the source edition had
            // no Date to project from, so the clone can't be trusted — it's still created (races
            // and all) but hidden and flagged for a human to fix up rather than published as a
            // guess. See #904's acceptance criteria for both paths.
            var isSuccess = suggestedDate.HasValue;

            // Unlike the manual "Clone edition to next year" flow (EventDetailPage
            // handleCloneEdition), which always leaves RegistrationOpens/Closes blank because a
            // human reviews the pre-filled form before saving, this sweep runs unattended — so
            // when the source has a full registration window it's worth projecting forward rather
            // than losing outright, but a *guessed* window must never go live unreviewed. Only
            // shift when both bounds are set (a one-sided window isn't a real window to project);
            // otherwise leave both null exactly as before. See #973.
            var projectRegistrationWindow = source.RegistrationOpens.HasValue && source.RegistrationCloses.HasValue;
            var (newRegistrationOpens, newRegistrationCloses) = projectRegistrationWindow
                ? ProjectRegistrationWindowForYear(source.RegistrationOpens!.Value, source.RegistrationCloses!.Value, nextYear)
                : (null, null);

            var newEdition = new EventEdition
            {
                Id = Guid.NewGuid(),
                EventId = source.EventId,
                Year = nextYear,
                Date = suggestedDate,
                EndDate = suggestedEndDate,
                // Title carries the bare next year the same way handleCloneEdition's
                // `title: edition.title ? String(nextYear) : ''` does — IsNullOrEmpty rather than
                // a plain null check, so a persisted "" (falsy in JS) doesn't fabricate a title
                // the source's own truthy check would have left blank. TitleEn and Notes are a
                // specific-year window that isn't meaningfully copyable to next year, so those
                // start blank rather than carrying over stale content.
                Title = !string.IsNullOrEmpty(source.Title) ? nextYear.ToString() : null,
                TitleEn = null,
                RegistrationUrl = BumpYearInUrl(source.RegistrationUrl, source.Year, nextYear),
                ResultsUrl = BumpYearInUrl(source.ResultsUrl, source.Year, nextYear),
                Notes = null,
                NotesEn = null,
                TrailId = source.TrailId,
                RegistrationOpens = newRegistrationOpens,
                RegistrationCloses = newRegistrationCloses,
                // The projected date is always in the future (it's next year's version of an
                // edition that just completed), so this always resolves to NotStarted on the
                // success path — mirrors `suggestedDate && isPastDate(suggestedDate) ? 'Closed' :
                // 'NotStarted'`, where the Closed branch is unreachable here.
                RegistrationStatus = RegistrationStatus.NotStarted,
                Status = isSuccess ? EditionStatus.Unconfirmed : EditionStatus.Hidden,
                // A projected registration window is a guess just like a failed date projection —
                // flag it for review unconditionally, even when the Date projection itself
                // succeeded (isSuccess), since the two are independent risks.
                NeedsReview = !isSuccess || projectRegistrationWindow,
                CreatedAt = DateTime.UtcNow,
            };

            context.EventEditions.Add(newEdition);

            foreach (var race in source.Races.OrderBy(r => r.SortOrder).ThenBy(r => r.Name))
            {
                context.Races.Add(new Race
                {
                    Id = Guid.NewGuid(),
                    EventEditionId = newEdition.Id,
                    TrailId = race.TrailId,
                    Name = race.Name,
                    NameEn = race.NameEn,
                    DistanceLabel = race.DistanceLabel,
                    DistanceLabelEn = race.DistanceLabelEn,
                    CutoffMinutes = race.CutoffMinutes,
                    Description = race.Description,
                    Status = RaceStatus.Active,
                    SortOrder = race.SortOrder,
                    TicketStatus = TicketStatus.Available,
                    ResultType = race.ResultType,
                    MaxParticipants = race.MaxParticipants,
                    ItraPoints = race.ItraPoints,
                    CertifiedBy = race.CertifiedBy,
                    PrizeMoney = race.PrizeMoney,
                    ChampionshipCategory = race.ChampionshipCategory,
                    DateOfRace = ComputeClonedRaceDate(source.Date, race.DateOfRace, suggestedDate),
                    StartTime = race.StartTime,
                });
            }

            clonedSources.Add(source);
        }

        if (clonedSources.Count == 0) return 0;

        await context.SaveChangesAsync(cancellationToken);

        foreach (var source in clonedSources)
        {
            cacheInvalidator.InvalidateEvent(source.Event.Slug);
        }

        return clonedSources.Count;
    }

    /// <summary>
    /// Ports admin's <c>suggestEditionDateForYear</c> to <see cref="DateOnly"/>: move to the same
    /// month/day in <paramref name="toYear"/>, then nudge onto the closest matching weekday (a
    /// direct ±3-day shift, or wrap the other way around the week for a bigger gap) so a clone
    /// lands on "the same kind of day" rather than a fixed date — e.g. a race that's always held
    /// on a Saturday keeps landing on a Saturday.
    /// </summary>
    private static DateOnly? SuggestEditionDateForYear(DateOnly? prevDate, int toYear)
    {
        if (prevDate is not { } prev) return null;

        // AddMonths/AddDays from the 1st of toYear reproduces JS's `setFullYear` day-overflow
        // behaviour (e.g. Feb 29 on a non-leap toYear rolls into March) without DateOnly's
        // constructor throwing on an invalid month/day/year combination.
        var candidate = new DateOnly(toYear, 1, 1).AddMonths(prev.Month - 1).AddDays(prev.Day - 1);

        var diff = (int)prev.DayOfWeek - (int)candidate.DayOfWeek;
        var adjustment = Math.Abs(diff) <= 3 ? diff : diff > 0 ? diff - 7 : diff + 7;

        return candidate.AddDays(adjustment);
    }

    /// <summary>
    /// Projects a <see cref="DateTime"/> registration bound (RegistrationOpens/Closes) forward to
    /// <paramref name="toYear"/> using the same weekday-preserving heuristic as
    /// <see cref="SuggestEditionDateForYear"/> — reused rather than duplicated so both dates always
    /// move together the same way. Only the date part is projected; the source's time-of-day and
    /// <see cref="DateTime.Kind"/> are carried over unchanged.
    /// </summary>
    private static DateTime? ProjectRegistrationDateForYear(DateTime? prev, int toYear)
    {
        if (prev is not { } value) return null;

        var projected = SuggestEditionDateForYear(DateOnly.FromDateTime(value), toYear);
        if (projected is not { } projectedDate) return null;

        return DateTime.SpecifyKind(projectedDate.ToDateTime(TimeOnly.FromDateTime(value)), value.Kind);
    }

    /// <summary>
    /// Projects a source RegistrationOpens/RegistrationCloses pair forward to
    /// <paramref name="toYear"/> without ever producing an inverted clone (Closes &lt; Opens).
    /// <see cref="ProjectRegistrationDateForYear"/>'s ±3/±7-day weekday nudge is applied
    /// independently per bound by <see cref="SuggestEditionDateForYear"/>'s underlying heuristic,
    /// so a source window narrow enough (roughly under a week) can nudge Opens later and Closes
    /// earlier — or vice versa — far enough to cross. Mirrors
    /// <see cref="SuggestEditionEndDateForYear"/>'s pattern instead: only Opens is independently
    /// projected, and Closes is derived from the newly projected Opens plus the source's original
    /// Opens→Closes gap, so the two bounds always move together and the gap can never flip sign.
    /// A non-positive source gap (Closes at or before Opens already — a corrupt source window)
    /// mirrors SuggestEditionEndDateForYear's own guard and yields both bounds null rather than
    /// projecting a nonsensical window forward.
    /// </summary>
    private static (DateTime? Opens, DateTime? Closes) ProjectRegistrationWindowForYear(
        DateTime opens, DateTime closes, int toYear)
    {
        var gap = closes - opens;
        if (gap <= TimeSpan.Zero) return (null, null);

        var newOpens = ProjectRegistrationDateForYear(opens, toYear);
        if (newOpens is not { } newOpensValue) return (null, null);

        var newCloses = DateTime.SpecifyKind(newOpensValue.Add(gap), closes.Kind);
        return (newOpensValue, newCloses);
    }

    /// <summary>Ports admin's <c>suggestEditionEndDateForYear</c>: preserves the source edition's
    /// Date→EndDate duration on top of the newly suggested start date.</summary>
    private static DateOnly? SuggestEditionEndDateForYear(DateOnly? prevStart, DateOnly? prevEnd, DateOnly? newStart)
    {
        if (prevStart is not { } start || prevEnd is not { } end || newStart is not { } newStartDate) return null;

        var durationDays = end.DayNumber - start.DayNumber;
        return durationDays <= 0 ? null : newStartDate.AddDays(durationDays);
    }

    /// <summary>Ports admin's <c>computeClonedRaceDate</c>: preserves a race's day offset from its
    /// source edition's Date on top of the newly derived edition Date.</summary>
    private static DateOnly? ComputeClonedRaceDate(DateOnly? sourceEditionDate, DateOnly? raceDate, DateOnly? newEditionDate)
    {
        if (sourceEditionDate is not { } sourceDate || raceDate is not { } race || newEditionDate is not { } newDate)
            return null;

        var offsetDays = race.DayNumber - sourceDate.DayNumber;
        return newDate.AddDays(offsetDays);
    }

    /// <summary>Ports admin's <c>bumpYearInUrl</c>: replaces every occurrence of the source year
    /// substring with the new year, unchanged if there's no URL or no source year to look for.
    /// `fromYear == 0` is treated the same as null — TS's `!fromYear` is falsy for 0 too — even
    /// though a persisted Year of 0 looks unreachable in practice.</summary>
    private static string? BumpYearInUrl(string? url, int? fromYear, int toYear)
    {
        if (string.IsNullOrEmpty(url) || fromYear is not { } from || from == 0) return url;
        return url.Replace(from.ToString(), toYear.ToString());
    }
}
