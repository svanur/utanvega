using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Application.Events.Queries.GetEvents;
using Utanvega.Backend.Application.PhotoGalleries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetEvent;

public record EventDetailDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string? NameEn,
    string? DescriptionEn,
    string Type,
    string ActivityType,
    string Status,
    string? OrganizerName,
    string? OrganizerNameEn,
    string? OrganizerWebsite,
    Guid? OrganizerId,
    string? AlertMessage,
    string? AlertMessageEn,
    string? AlertSeverity,
    Guid? LocationId,
    string? LocationName,
    ScheduleRule? ScheduleRule,
    List<SocialLink>? SocialLinks,
    DateOnly? NextEditionDate,
    int? DaysUntil,
    List<DateOnly> UpcomingDates,
    List<EventEditionDto> Editions,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateOnly? DisplayDate = null,
    List<string>? Certifications = null,
    string? YoutubeUrl = null,
    List<string>? ChampionshipCategories = null,
    List<int>? ItraPoints = null,
    double? GpxPointLat = null,
    double? GpxPointLng = null,
    Dictionary<string, string>? TranslationHashes = null,
    List<string>? ActivityTypes = null,
    string? EditionStatus = null,
    bool EditionEffectiveCancelled = false,
    string? OrganizerSlug = null
);

public record GetEventQuery(string Slug, bool IncludeHidden = false) : IRequest<EventDetailDto?>, ICacheable
{
    public string CacheKey => CacheKeys.Event(Slug, IncludeHidden);
    public TimeSpan CacheDuration => TimeSpan.FromHours(1);
}

public class GetEventQueryHandler : IRequestHandler<GetEventQuery, EventDetailDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;

    private record TrailDetail(string? Name, string? Slug, double Length, double ElevationGain, Core.Entities.TerrainType? TerrainType, Core.Entities.Difficulty Difficulty, Core.Entities.ActivityType ActivityTypeId, string? YoutubeUrl);

    public GetEventQueryHandler(UtanvegaDbContext context, IScheduleRuleEngine scheduleEngine)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
    }

    public async Task<EventDetailDto?> Handle(GetEventQuery request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .AsNoTracking()
            .AsSplitQuery()
            .Include(e => e.Location)
            .Include(e => e.Organizer)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.Races)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.PhotoGalleries)
                    .ThenInclude(g => g.Photographer)
            .FirstOrDefaultAsync(e => e.Slug == request.Slug, cancellationToken);

        if (ev == null) return null;

        // Collect all trail IDs from editions (ed.TrailId) and races (r.TrailId)
        var trailIds = ev.Editions
            .SelectMany(ed => ed.Races.Select(r => r.TrailId).Append(ed.TrailId))
            .Where(id => id.HasValue).Select(id => id!.Value)
            .Distinct().ToHashSet();

        var trailDetails = trailIds.Count > 0
            ? (await _context.Trails.AsNoTracking()
                .Where(t => trailIds.Contains(t.Id))
                .Select(t => new { t.Id, t.Name, t.Slug, t.Status, t.Length, t.ElevationGain, t.TerrainType, t.Difficulty, t.ActivityTypeId, t.YoutubeUrl })
                .ToListAsync(cancellationToken))
                .ToDictionary(t => t.Id, t =>
                {
                    // A race can stay linked to a trail that has since been archived or hidden
                    // (archiving does not unlink races). The public trail page only serves
                    // Published/EventOnly, so handing out the slug would render a link that 404s.
                    // Drop just the slug — name, distance and elevation are still accurate.
                    var linkable = request.IncludeHidden
                        || t.Status == TrailStatus.Published
                        || t.Status == TrailStatus.EventOnly;
                    return new TrailDetail(t.Name, linkable ? t.Slug : null, t.Length, t.ElevationGain, t.TerrainType, t.Difficulty, t.ActivityTypeId, t.YoutubeUrl);
                })
            : new Dictionary<Guid, TrailDetail>();

        TrailDetail? GetTrail(Guid? id) => id.HasValue && trailDetails.TryGetValue(id.Value, out var td) ? td : null;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Hidden editions are admin-only and must never surface in public-facing computations below.
        // The admin path (IncludeHidden=true) keeps the full picture, same as GetEventsQuery.
        var publicEditions = request.IncludeHidden
            ? ev.Editions.ToList()
            : ev.Editions.Where(ed => ed.Status != EditionStatus.Hidden).ToList();

        var nextEditionDate = publicEditions
            .Where(ed => ed.Date.HasValue && ed.Date.Value >= today)
            .OrderBy(ed => ed.Date)
            .Select(ed => ed.Date)
            .FirstOrDefault();

        var nextDate = nextEditionDate
            ?? (ev.ScheduleRule != null ? _scheduleEngine.GetNextOccurrence(ev.ScheduleRule, today) : null);

        // An edition is "ongoing" when it has started (Date <= today) but not yet ended (EndDate ?? Date >= today)
        var ongoingEdition = publicEditions.FirstOrDefault(ed =>
            ed.Date.HasValue && ed.Date.Value <= today &&
            (ed.EndDate ?? ed.Date).HasValue && (ed.EndDate ?? ed.Date)!.Value >= today);

        // Check for recently-past editions (up to 3 days ago)
        // so events with schedule rules still show as "recently completed"
        var mostRecentPast = publicEditions
            .Where(ed => (ed.EndDate ?? ed.Date).HasValue && (ed.EndDate ?? ed.Date)!.Value < today)
            .OrderByDescending(ed => ed.EndDate ?? ed.Date)
            .Select(ed => ed.EndDate ?? ed.Date)
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
            displayDate = ongoingEdition.Date;
        }
        else if (recentlyCompleted)
        {
            daysUntil = mostRecentPast!.Value.DayNumber - today.DayNumber;
            var recentEdition = ev.Editions.FirstOrDefault(ed => (ed.EndDate ?? ed.Date) == mostRecentPast);
            displayDate = recentEdition?.Date ?? mostRecentPast.Value;
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
            ? _scheduleEngine.GetOccurrencesInRange(ev.ScheduleRule, today, today.AddMonths(12))
            : new List<DateOnly>();

        var editions = publicEditions
            .OrderByDescending(ed => ed.Date ?? DateOnly.MinValue)
            .Select(ed => new EventEditionDto(
                ed.Id,
                ed.EventId,
                ed.Year ?? ed.Date?.Year,
                ed.Date,
                ed.EndDate,
                ed.Title,
                ed.TitleEn,
                ed.RegistrationUrl,
                ed.ResultsUrl,
                ed.PhotoGalleryUrl,
                ed.Notes,
                ed.NotesEn,
                ed.RegistrationStatus.ToString(),
                ed.TrailId,
                GetTrail(ed.TrailId)?.Name,
                GetTrail(ed.TrailId)?.Slug,
                ed.Races
                    .OrderBy(r => r.SortOrder)
                    .Select(r => new RaceDto(
                        r.Id,
                        r.EventEditionId,
                        r.TrailId,
                        GetTrail(r.TrailId)?.Name,
                        GetTrail(r.TrailId)?.Slug,
                        r.Name,
                        r.NameEn,
                        r.DistanceLabel,
                        r.DistanceLabelEn,
                        r.CutoffMinutes,
                        r.Description,
                        r.DescriptionEn,
                        r.Status.ToString(),
                        r.SortOrder,
                        r.TicketStatus.ToString(),
                        r.MaxParticipants,
                        r.ItraPoints,
                        r.CertifiedBy,
                        r.CertifiedByEn,
                        r.PrizeMoney,
                        r.ChampionshipCategory,
                        r.ChampionshipCategoryEn,
                        r.DateOfRace,
                        r.StartTime,
                        GetTrail(r.TrailId)?.Length,
                        GetTrail(r.TrailId)?.ElevationGain,
                        GetTrail(r.TrailId)?.TerrainType?.ToString(),
                        GetTrail(r.TrailId)?.Difficulty.ToString(),
                        GetTrail(r.TrailId)?.ActivityTypeId.ToString(),
                        TranslationHashes: null,
                        ActivityType: r.ActivityType?.ToString(),
                        ResultType: r.ResultType.ToString()
                    ))
                    .ToList(),
                ed.PhotoGalleries.ToPublicDtos(),
                ed.CreatedAt,
                ed.UpdatedAt,
                Status: ed.Status.ToString(),
                EffectiveCancelled: EditionStatusHelpers.ComputeEffectiveCancelled(ed.Status, ed.Races.Select(r => r.Status).ToList())
            ))
            .ToList();

        var relevantEdition = ongoingEdition
            ?? (recentlyCompleted
                ? publicEditions.FirstOrDefault(ed => (ed.EndDate ?? ed.Date) == mostRecentPast)
                : publicEditions
                    .Where(ed => ed.Date.HasValue && ed.Date.Value >= today)
                    .OrderBy(ed => ed.Date)
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

        return new EventDetailDto(
            ev.Id,
            ev.Name,
            ev.Slug,
            ev.Description,
            ev.NameEn,
            ev.DescriptionEn,
            ev.Type.ToString(),
            ev.ActivityType.ToString(),
            ev.Status.ToString(),
            ev.Organizer?.Name ?? ev.OrganizerName,
            ev.OrganizerNameEn,
            ev.OrganizerWebsite ?? ev.Organizer?.Website,
            ev.OrganizerId,
            ev.AlertMessage,
            ev.AlertMessageEn,
            ev.AlertSeverity,
            ev.LocationId,
            ev.Location?.Name,
            ev.ScheduleRule,
            ev.SocialLinks,
            nextDate,
            daysUntil,
            upcomingDates,
            editions,
            ev.CreatedAt,
            ev.UpdatedAt,
            displayDate,
            certifications?.Count > 0 ? certifications : null,
            youtubeUrl,
            championshipCategories?.Count > 0 ? championshipCategories : null,
            itraPoints?.Count > 0 ? itraPoints : null,
            ev.GpxPointLat,
            ev.GpxPointLng,
            TranslationHashes: null,
            ActivityTypes: activityTypes.Count > 0 ? activityTypes : null,
            EditionStatus: relevantEdition?.Status.ToString(),
            EditionEffectiveCancelled: relevantEdition != null
                && EditionStatusHelpers.ComputeEffectiveCancelled(relevantEdition.Status, relevantEdition.Races.Select(r => r.Status).ToList()),
            OrganizerSlug: ev.Organizer != null ? ev.Organizer.Slug : null
        );
    }
}
