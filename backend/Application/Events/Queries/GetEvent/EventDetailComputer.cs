using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.PhotoGalleries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetEvent;

// Per-race data computed once and shared by both GetEventQueryHandler (admin) and
// GetPublicEventQueryHandler (public) — each maps this into its own RaceDto/RacePublicDto.
internal sealed record RaceComputation(
    Race Race,
    string? TrailName,
    string? TrailSlug,
    double? TrailDistanceMeters,
    double? TrailElevationGain,
    string? TrailTerrainType,
    string? TrailDifficulty,
    string? TrailActivityType,
    string TicketStatus
);

// Per-edition data computed once and shared by both handlers — each maps this into its own
// EventEditionDto/EventEditionPublicDto.
internal sealed record EditionComputation(
    EventEdition Edition,
    DateOnly? EffDate,
    DateOnly? EffEndDate,
    string EffectiveRegistrationStatus,
    string? TrailName,
    string? TrailSlug,
    List<RaceComputation> Races,
    bool EffectiveCancelled,
    bool NeedsReview,
    double[]? PrimaryElevationProfile,
    string? PrimaryTerrainType
);

// Whole-event data computed once and shared by both handlers — each maps this into its own
// EventDetailDto/EventDetailPublicDto. Certifications/ChampionshipCategories/ItraPoints/
// ActivityTypes already come out of ComputeAsync empty-to-null-filtered, so neither handler
// needs to repeat that filtering.
internal sealed record EventComputation(
    Event Event,
    List<EditionComputation> Editions,
    DateOnly? NextDate,
    int? DaysUntil,
    DateOnly? DisplayDate,
    List<DateOnly> UpcomingDates,
    List<string>? Certifications,
    string? YoutubeUrl,
    List<string>? ChampionshipCategories,
    List<int>? ItraPoints,
    List<string>? ActivityTypes,
    string? EditionStatus,
    bool EditionEffectiveCancelled
);

/// <summary>
/// Shared business logic behind GetEventQuery (admin) and GetPublicEventQuery (public) —
/// edition/date/registration-status computation, trail lookups and elevation-profile batching.
/// Extracted so the two handlers differ only in their final DTO-construction step (#1562).
/// </summary>
internal static class EventDetailComputer
{
    private record TrailDetail(string? Name, string? Slug, double Length, double ElevationGain, TerrainType? TerrainType, Difficulty Difficulty, ActivityType ActivityTypeId, string? YoutubeUrl);

    public static async Task<EventComputation?> ComputeAsync(
        UtanvegaDbContext context,
        IScheduleRuleEngine scheduleEngine,
        string slug,
        bool includeHidden,
        CancellationToken cancellationToken)
    {
        var ev = await context.Events
            .AsNoTracking()
            .AsSplitQuery()
            .Include(e => e.Location)
            .Include(e => e.Organizer)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.Races)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.PhotoGalleries)
                    .ThenInclude(g => g.Photographer)
            .FirstOrDefaultAsync(e => e.Slug == slug, cancellationToken);

        if (ev == null) return null;

        // Hidden events are admin-only. Without this, a hidden event's slug was fully
        // readable by anyone via the public GET /api/v1/events/{slug} endpoint.
        // Unlisted stays reachable by direct link — it's only excluded from listings.
        if (!includeHidden && ev.Status == EventStatus.Hidden) return null;

        // Collect all trail IDs from editions (ed.TrailId) and races (r.TrailId)
        var trailIds = ev.Editions
            .SelectMany(ed => ed.Races.Select(r => r.TrailId).Append(ed.TrailId))
            .Where(id => id.HasValue).Select(id => id!.Value)
            .Distinct().ToHashSet();

        var trailDetails = trailIds.Count > 0
            ? (await context.Trails.AsNoTracking()
                .Where(t => trailIds.Contains(t.Id))
                .Select(t => new { t.Id, t.Name, t.Slug, t.Status, t.Length, t.ElevationGain, t.TerrainType, t.Difficulty, t.ActivityTypeId, t.YoutubeUrl })
                .ToListAsync(cancellationToken))
                .ToDictionary(t => t.Id, t =>
                {
                    // A race can stay linked to a trail that has since been archived or hidden
                    // (archiving does not unlink races). The public trail page only serves
                    // Published/EventOnly, so handing out the slug would render a link that 404s.
                    // Drop just the slug — name, distance and elevation are still accurate.
                    var linkable = includeHidden
                        || t.Status == TrailStatus.Published
                        || t.Status == TrailStatus.EventOnly;
                    return new TrailDetail(t.Name, linkable ? t.Slug : null, t.Length, t.ElevationGain, t.TerrainType, t.Difficulty, t.ActivityTypeId, t.YoutubeUrl);
                })
            : new Dictionary<Guid, TrailDetail>();

        TrailDetail? GetTrail(Guid? id) => id.HasValue && trailDetails.TryGetValue(id.Value, out var td) ? td : null;

        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);

        // Hidden editions are admin-only and must never surface in public-facing computations below.
        // The admin path (includeHidden=true) keeps the full picture, same as GetEventsQuery.
        var publicEditions = includeHidden
            ? ev.Editions.ToList()
            : ev.Editions.Where(ed => ed.Status != EditionStatus.Hidden).ToList();

        // Series editions derive Date/EndDate live from their races' DateOfRace rather than
        // trusting the stored columns, which nothing keeps in sync — same "derive live, don't
        // store" precedent as ComputeEffectiveRegistrationStatus, and the same pattern
        // GetEventsQuery already applies for the events-list endpoint (#1070/#1320). Computed once
        // per edition here and reused via EffDate/EffEndDate everywhere below that would otherwise
        // read ed.Date/ed.EndDate raw. A Cancelled race's date must not skew the derived min/max
        // (#1261) — excluded here same as GetEventsQuery.
        var effectiveEditionDates = ev.Editions
            .ToDictionary(
                ed => ed.Id,
                ed => EditionStatusHelpers.ComputeEffectiveEditionDates(
                    ev.Type, ed.Date, ed.EndDate,
                    EditionStatusHelpers.SeriesRaceDates(ed.Races)));

        DateOnly? EffDate(EventEdition? ed) => ed != null ? effectiveEditionDates[ed.Id].Date : null;
        DateOnly? EffEndDate(EventEdition? ed) => ed != null ? effectiveEditionDates[ed.Id].EndDate : null;

        var nextDate = EditionStatusHelpers.ResolveNextEditionDate(
            publicEditions, today, EffDate, EffEndDate, ev.ScheduleRule, scheduleEngine);

        // An edition is "ongoing" when it has started (Date <= today) but not yet ended (EndDate ?? Date >= today)
        var ongoingEdition = publicEditions.FirstOrDefault(ed =>
            EffDate(ed).HasValue && EffDate(ed)!.Value <= today &&
            (EffEndDate(ed) ?? EffDate(ed)).HasValue && (EffEndDate(ed) ?? EffDate(ed))!.Value >= today);

        // Check for recently-past editions (up to 3 days ago)
        // so events with schedule rules still show as "recently completed"
        var mostRecentPast = publicEditions
            .Where(ed => (EffEndDate(ed) ?? EffDate(ed)).HasValue && (EffEndDate(ed) ?? EffDate(ed))!.Value < today)
            .OrderByDescending(ed => EffEndDate(ed) ?? EffDate(ed))
            .Select(ed => EffEndDate(ed) ?? EffDate(ed))
            .FirstOrDefault();

        var recentlyCompleted = ev.Status != EventStatus.Cancelled
            && ongoingEdition == null
            && mostRecentPast.HasValue
            && (today.DayNumber - mostRecentPast.Value.DayNumber) <= 3;

        int? daysUntil;
        DateOnly? displayDate;
        if (ongoingEdition != null)
        {
            daysUntil = 0;
            displayDate = EffDate(ongoingEdition);
        }
        else if (recentlyCompleted)
        {
            daysUntil = mostRecentPast!.Value.DayNumber - today.DayNumber;
            var recentEdition = ev.Editions.FirstOrDefault(ed => (EffEndDate(ed) ?? EffDate(ed)) == mostRecentPast);
            displayDate = EffDate(recentEdition) ?? mostRecentPast.Value;
        }
        else if (nextDate.HasValue)
        {
            daysUntil = nextDate.Value.DayNumber - today.DayNumber;
            displayDate = nextDate.Value;
        }
        else
        {
            daysUntil = null;
            displayDate = null;
        }

        var upcomingDates = ev.ScheduleRule != null
            ? scheduleEngine.GetOccurrencesInRange(ev.ScheduleRule, today, today.AddMonths(12))
            : new List<DateOnly>();

        // #927: primary race per edition, mirroring GetEditionsHistoryQueryHandler.BuildRow (#806/#815) —
        // among the edition's *visible* races with a linked trail present in trailDetails, the one
        // with the greatest trail Length, ties broken by Race.Id. Hidden races are excluded here for
        // the same reason GetEditionsHistoryQueryHandler, GetEventCalendarQuery and
        // GetTrailBySlugQuery all exclude them before deriving public-facing terrain/elevation data —
        // a Hidden race isn't shown anywhere else on this page, so it must not leak its trail's
        // terrain color into the public header either. PrimaryElevationProfile is filled in below,
        // after a batched fetch scoped to only the primary trail ids actually selected here.
        var editionResults = publicEditions
            .OrderByDescending(ed => EffDate(ed) ?? DateOnly.MinValue)
            .Select(ed => {
                // Computed once per edition and reused for every race drawn from it below —
                // do not re-derive from raw dates a second time.
                var edEffectiveRegStatus = EditionStatusHelpers.ComputeEffectiveRegistrationStatus(
                    ed.Status, ed.RegistrationStatus, ed.RegistrationOpens, ed.RegistrationCloses, now);

                var primaryTrailId = ed.Races
                    .Where(r => r.Status != RaceStatus.Hidden && r.TrailId.HasValue && trailDetails.ContainsKey(r.TrailId.Value))
                    .OrderByDescending(r => trailDetails[r.TrailId!.Value].Length)
                    .ThenBy(r => r.Id)
                    .Select(r => r.TrailId)
                    .FirstOrDefault();
                var primaryTerrainType = GetTrail(primaryTrailId)?.TerrainType?.ToString();

                var races = ed.Races
                    .OrderBy(r => r.SortOrder)
                    .Select(r => new RaceComputation(
                        r,
                        GetTrail(r.TrailId)?.Name,
                        GetTrail(r.TrailId)?.Slug,
                        GetTrail(r.TrailId)?.Length,
                        GetTrail(r.TrailId)?.ElevationGain,
                        GetTrail(r.TrailId)?.TerrainType?.ToString(),
                        GetTrail(r.TrailId)?.Difficulty.ToString(),
                        GetTrail(r.TrailId)?.ActivityTypeId.ToString(),
                        EditionStatusHelpers.ComputeEffectiveTicketStatus(
                            r.Status, r.TicketStatus, edEffectiveRegStatus,
                            r.DateOfRace, r.StartTime, r.RegistrationOpensMinutesBeforeRace, now).ToString()
                    ))
                    .ToList();

                var computation = new EditionComputation(
                    ed,
                    EffDate(ed),
                    EffEndDate(ed),
                    edEffectiveRegStatus.ToString(),
                    GetTrail(ed.TrailId)?.Name,
                    GetTrail(ed.TrailId)?.Slug,
                    races,
                    EditionStatusHelpers.ComputeEffectiveCancelled(ed.Status, ed.Races.Select(r => r.Status).ToList()),
                    // NeedsReview is an internal admin bookmark flag. The public path (includeHidden=false)
                    // must never leak it; only the admin event-detail path (includeHidden=true) sees the real value.
                    includeHidden && ed.NeedsReview,
                    // Filled in after the post-loop elevation-profile fetch, keyed by PrimaryTrailId below.
                    null,
                    primaryTerrainType
                );

                return (Computation: computation, PrimaryTrailId: primaryTrailId);
            })
            .ToList();

        // #927: elevation profile is fetched only for the distinct primary trail ids actually
        // selected across this event's editions — mirrors GetEditionsHistoryQueryHandler's post-loop
        // batched fetch, not a per-edition query.
        var primaryTrailIds = editionResults
            .Select(r => r.PrimaryTrailId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToHashSet();

        var elevationProfiles = primaryTrailIds.Count > 0
            ? (await context.Trails
                .AsNoTracking()
                .Where(t => primaryTrailIds.Contains(t.Id))
                .Select(t => new { t.Id, t.ElevationProfile })
                .ToListAsync(cancellationToken))
                .ToDictionary(t => t.Id, t => t.ElevationProfile)
            : new Dictionary<Guid, double[]?>();

        var editions = editionResults
            .Select(r => r.PrimaryTrailId.HasValue && elevationProfiles.TryGetValue(r.PrimaryTrailId.Value, out var profile)
                ? r.Computation with { PrimaryElevationProfile = profile }
                : r.Computation)
            .ToList();

        var relevantEdition = ongoingEdition
            ?? (recentlyCompleted
                ? publicEditions.FirstOrDefault(ed => (EffEndDate(ed) ?? EffDate(ed)) == mostRecentPast)
                : publicEditions
                    .Where(ed => EffDate(ed).HasValue && EffDate(ed)!.Value >= today)
                    .OrderBy(ed => EffDate(ed))
                    .FirstOrDefault());

        var relevantRaces = relevantEdition?.Races
            .Where(r => r.Status != RaceStatus.Cancelled)
            .OrderBy(r => r.SortOrder)
            .ToList();

        var certifications = relevantRaces?
            .Select(r => r.CertifiedBy)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct().Cast<string>().ToList();

        var championshipCategories = relevantRaces?
            .Select(r => r.ChampionshipCategory)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct().Cast<string>().ToList();

        var itraPoints = relevantRaces?
            .Where(r => r.ItraPoints.HasValue)
            .Select(r => r.ItraPoints!.Value)
            .Distinct().OrderBy(p => p).ToList();

        var youtubeUrl = relevantRaces?
            .Select(r => GetTrail(r.TrailId)?.YoutubeUrl)
            .FirstOrDefault(u => !string.IsNullOrWhiteSpace(u));

        var activityTypes = publicEditions
            .SelectMany(ed => ed.Races)
            .Where(r => r.Status != RaceStatus.Cancelled)
            .Select(r => (r.ActivityType?.ToString() ?? GetTrail(r.TrailId)?.ActivityTypeId.ToString()))
            .Where(a => a != null)
            .Distinct()
            .OrderBy(a => a)
            .Cast<string>()
            .ToList();

        return new EventComputation(
            ev,
            editions,
            nextDate,
            daysUntil,
            displayDate,
            upcomingDates,
            certifications?.Count > 0 ? certifications : null,
            youtubeUrl,
            championshipCategories?.Count > 0 ? championshipCategories : null,
            itraPoints?.Count > 0 ? itraPoints : null,
            activityTypes.Count > 0 ? activityTypes : null,
            relevantEdition?.Status.ToString(),
            relevantEdition != null
                && EditionStatusHelpers.ComputeEffectiveCancelled(relevantEdition.Status, relevantEdition.Races.Select(r => r.Status).ToList())
        );
    }
}
