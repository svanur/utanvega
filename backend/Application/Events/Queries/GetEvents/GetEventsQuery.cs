using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Application.PhotoGalleries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetEvents;

internal record TrailSummary(double Length, string? YoutubeUrl, Core.Entities.TerrainType? TerrainType, Core.Entities.ActivityType ActivityTypeId);

public record GetEventsQuery(bool IncludeHidden = false) : IRequest<List<EventSummaryDto>>, ICacheable
{
    public string CacheKey => CacheKeys.Events(IncludeHidden);
    public TimeSpan CacheDuration => TimeSpan.FromHours(1);
}

public class GetEventsQueryHandler : IRequestHandler<GetEventsQuery, List<EventSummaryDto>>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;

    public GetEventsQueryHandler(UtanvegaDbContext context, IScheduleRuleEngine scheduleEngine)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
    }

    public async Task<List<EventSummaryDto>> Handle(GetEventsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Events
            .AsNoTracking()
            .AsSplitQuery()
            .Include(e => e.Location)
            .Include(e => e.Organizer)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.Races)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.PhotoGalleries)
                    .ThenInclude(g => g.Photographer)
            .AsQueryable();

        if (!request.IncludeHidden)
            query = query.Where(e => e.Status != EventStatus.Hidden && e.Status != EventStatus.Unlisted);

        var events = await query
            .OrderBy(e => e.Name)
            .ToListAsync(cancellationToken);

        // Fetch only the trail fields needed for list view — avoids loading GpxData and ElevationProfile.
        var trailIds = events
            .SelectMany(e => e.Editions)
            .SelectMany(ed => ed.Races)
            .Where(r => r.TrailId.HasValue)
            .Select(r => r.TrailId!.Value)
            .Distinct()
            .ToHashSet();

        var trailSummaries = trailIds.Count > 0
            ? await _context.Trails
                .AsNoTracking()
                .Where(t => trailIds.Contains(t.Id))
                .Select(t => new { t.Id, t.Length, t.YoutubeUrl, t.TerrainType, t.ActivityTypeId })
                .ToDictionaryAsync(t => t.Id, cancellationToken)
            : [];

        TrailSummary? GetTrail(Guid? trailId) =>
            trailId.HasValue && trailSummaries.TryGetValue(trailId.Value, out var ts)
                ? new TrailSummary(ts.Length, ts.YoutubeUrl, ts.TerrainType, ts.ActivityTypeId)
                : null;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var oneYearAhead = today.AddYears(1);

        return events.Select(e =>
        {
            // Hidden editions are admin-only. On the public path (IncludeHidden=false) they must not
            // influence any of the "what should the public see" computations below. The admin path
            // (IncludeHidden=true, used by the admin events list) keeps the full picture, same as
            // GetAllEventDetailsQuery.
            var editionsForCalc = request.IncludeHidden
                ? e.Editions.ToList()
                : e.Editions.Where(ed => ed.Status != EditionStatus.Hidden).ToList();

            var nextDate = ResolveNextDate(e, editionsForCalc, today);
            // True when a future edition exists — either with a specific date, or a dateless edition for the current year or later
            var hasFutureEdition = editionsForCalc.Any(ed =>
                ((ed.EndDate ?? ed.Date).HasValue && (ed.EndDate ?? ed.Date)!.Value >= today) ||
                (!ed.Date.HasValue && ed.Year.HasValue && ed.Year.Value >= today.Year));

            // An edition is "ongoing" when it has started (Date <= today) but not yet ended (EndDate ?? Date >= today)
            var ongoingEdition = editionsForCalc.FirstOrDefault(ed =>
                ed.Date.HasValue && ed.Date.Value <= today &&
                (ed.EndDate ?? ed.Date).HasValue && (ed.EndDate ?? ed.Date)!.Value >= today);

            // Check for recently-past editions (up to 3 days ago)
            // so events with schedule rules still show as "recently completed"
            var mostRecentPast = editionsForCalc
                .Where(ed => (ed.EndDate ?? ed.Date).HasValue && (ed.EndDate ?? ed.Date)!.Value < today)
                .OrderByDescending(ed => ed.EndDate ?? ed.Date)
                .Select(ed => ed.EndDate ?? ed.Date)
                .FirstOrDefault();

            var recentlyCompleted = e.Status != EventStatus.Cancelled
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
                // Use the edition's start date as displayDate so the range "start – end" renders correctly.
                // daysUntil stays end-date-based so the -1/-2/-3 countdown is accurate.
                var recentEdition = e.Editions.FirstOrDefault(ed => (ed.EndDate ?? ed.Date) == mostRecentPast);
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

            // Determine the relevant edition for distances/registration
            var relevantEdition = ongoingEdition
                ?? (recentlyCompleted
                    ? editionsForCalc.FirstOrDefault(ed => (ed.EndDate ?? ed.Date) == mostRecentPast)
                    : editionsForCalc
                        .Where(ed => ed.Date.HasValue && ed.Date.Value >= today)
                        .OrderBy(ed => ed.Date)
                        .FirstOrDefault());

            var relevantRaces = relevantEdition?.Races
                .Where(r => r.Status != RaceStatus.Cancelled)
                .OrderBy(r => r.SortOrder)
                .ToList();

            var distances = relevantRaces?
                .Select(r => {
                    var trail = GetTrail(r.TrailId);
                    var label = !string.IsNullOrWhiteSpace(r.DistanceLabel)
                        ? r.DistanceLabel
                        : trail != null && trail.Length > 0
                            ? $"{trail.Length / 1000.0:0.#} km"
                            : null;
                    return label != null
                        ? new RaceDistanceSummaryDto(label, r.TicketStatus.ToString())
                        : null;
                })
                .Where(d => d != null)
                .Cast<RaceDistanceSummaryDto>()
                .ToList();

            var certifications = relevantRaces?
                .Select(r => r.CertifiedBy)
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Distinct()
                .Cast<string>()
                .ToList();

            var championshipCategories = relevantRaces?
                .Select(r => r.ChampionshipCategory)
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Distinct()
                .Cast<string>()
                .ToList();

            var itraPoints = relevantRaces?
                .Where(r => r.ItraPoints.HasValue)
                .Select(r => r.ItraPoints!.Value)
                .Distinct()
                .OrderBy(p => p)
                .ToList();

            var youtubeUrl = relevantRaces?
                .Select(r => GetTrail(r.TrailId)?.YoutubeUrl)
                .FirstOrDefault(u => !string.IsNullOrWhiteSpace(u));

            List<SeriesRaceDto>? seriesRaces = null;
            if (e.Type == EventType.Series)
            {
                seriesRaces = editionsForCalc
                    .SelectMany(ed => ed.Races
                        .Where(r => r.Status != RaceStatus.Cancelled
                            && r.DateOfRace.HasValue
                            && r.DateOfRace.Value >= today
                            && r.DateOfRace.Value <= oneYearAhead)
                        .Select(r => new SeriesRaceDto(
                            r.Id,
                            r.Name,
                            r.NameEn,
                            r.DateOfRace,
                            r.StartTime,
                            !string.IsNullOrWhiteSpace(r.DistanceLabel) ? r.DistanceLabel
                                : GetTrail(r.TrailId) is { Length: > 0 } st ? $"{st.Length / 1000.0:0.#} km"
                                : null,
                            r.DistanceLabelEn,
                            r.TicketStatus.ToString(),
                            ed.RegistrationUrl
                        )))
                    .OrderBy(r => r.DateOfRace)
                    .ToList();
            }

            var isMountainRace = editionsForCalc
                .SelectMany(ed => ed.Races)
                .Any(r => GetTrail(r.TrailId)?.TerrainType == Core.Entities.TerrainType.Mountainous);

            var terrainType = editionsForCalc
                .SelectMany(ed => ed.Races)
                .Select(r => GetTrail(r.TrailId)?.TerrainType)
                .Where(t => t != null)
                .GroupBy(t => t)
                .OrderByDescending(g => g.Count())
                .Select(g => g.Key!.Value.ToString())
                .FirstOrDefault();

            // Derive activity types from races: explicit ActivityType on race takes precedence over trail's type
            var activityTypes = editionsForCalc
                .SelectMany(ed => ed.Races)
                .Where(r => r.Status != RaceStatus.Cancelled)
                .Select(r => (r.ActivityType?.ToString() ?? GetTrail(r.TrailId)?.ActivityTypeId.ToString()))
                .Where(a => a != null)
                .Distinct()
                .OrderBy(a => a)
                .Cast<string>()
                .ToList();

            return new EventSummaryDto(
                e.Id,
                e.Name,
                e.Slug,
                e.Description,
                e.NameEn,
                e.DescriptionEn,
                e.Type.ToString(),
                e.ActivityType.ToString(),
                e.Status.ToString(),
                e.Organizer?.Name ?? e.OrganizerName,
                e.OrganizerNameEn,
                e.OrganizerWebsite ?? e.Organizer?.Website,
                e.OrganizerId,
                e.AlertMessage,
                e.AlertMessageEn,
                e.AlertSeverity,
                e.LocationId,
                e.Location?.Name,
                e.ScheduleRule,
                e.SocialLinks,
                nextDate,
                daysUntil,
                editionsForCalc.Count,
                e.CreatedAt,
                e.UpdatedAt,
                displayDate,
                distances?.Count > 0 ? distances : null,
                relevantEdition?.RegistrationUrl,
                relevantEdition?.RegistrationStatus.ToString(),
                relevantEdition?.ResultsUrl,
                certifications?.Count > 0 ? certifications : null,
                youtubeUrl,
                championshipCategories?.Count > 0 ? championshipCategories : null,
                itraPoints?.Count > 0 ? itraPoints : null,
                seriesRaces?.Count > 0 ? seriesRaces : null,
                e.GpxPointLat,
                e.GpxPointLng,
                IsMountainRace: isMountainRace,
                TerrainType: terrainType,
                HasFutureEdition: hasFutureEdition,
                EndDisplayDate: relevantEdition?.EndDate,
                ActivityTypes: activityTypes.Count > 0 ? activityTypes : null,
                EditionStatus: relevantEdition?.Status.ToString(),
                EditionEffectiveCancelled: relevantEdition != null
                    && EditionStatusHelpers.ComputeEffectiveCancelled(relevantEdition.Status, relevantEdition.Races.Select(r => r.Status).ToList()),
                OrganizerSlug: e.Organizer != null ? e.Organizer.Slug : null,
                Galleries: relevantEdition?.PhotoGalleries.ToPublicDtos() ?? []
            );
        }).ToList();
    }

    private DateOnly? ResolveNextDate(Core.Entities.Event e, IReadOnlyCollection<EventEdition> editions, DateOnly today)
    {
        var nextEditionDate = editions
            .Where(ed => ed.Date.HasValue && ed.Date.Value >= today)
            .OrderBy(ed => ed.Date)
            .Select(ed => ed.Date)
            .FirstOrDefault();

        if (nextEditionDate.HasValue)
            return nextEditionDate;

        return e.ScheduleRule != null
            ? _scheduleEngine.GetNextOccurrence(e.ScheduleRule, today)
            : null;
    }
}
