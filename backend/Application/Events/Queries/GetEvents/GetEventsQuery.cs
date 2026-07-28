using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetEvents;

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
            .Include(e => e.Location)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.Races)
                    .ThenInclude(r => r.Trail)
            .AsQueryable();

        if (!request.IncludeHidden)
            query = query.Where(e => e.Status != EventStatus.Hidden && e.Status != EventStatus.Unlisted);

        var events = await query
            .OrderBy(e => e.Name)
            .ToListAsync(cancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var oneYearAhead = today.AddYears(1);

        return events.Select(e =>
        {
            var nextDate = ResolveNextDate(e, today);

            // Check for recently-past editions (up to 3 days ago)
            // so events with schedule rules still show as "recently completed"
            var mostRecentPast = e.Editions
                .Where(ed => ed.Date.HasValue && ed.Date.Value < today)
                .OrderByDescending(ed => ed.Date)
                .Select(ed => ed.Date)
                .FirstOrDefault();

            var recentlyCompleted = e.Status != EventStatus.Cancelled
                && mostRecentPast.HasValue
                && (today.DayNumber - mostRecentPast.Value.DayNumber) <= 3;

            int? daysUntil;
            DateOnly? displayDate;
            if (recentlyCompleted)
            {
                daysUntil = mostRecentPast!.Value.DayNumber - today.DayNumber;
                displayDate = mostRecentPast.Value;
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
            var relevantEdition = recentlyCompleted
                ? e.Editions.FirstOrDefault(ed => ed.Date == mostRecentPast)
                : e.Editions
                    .Where(ed => ed.Date.HasValue && ed.Date.Value >= today)
                    .OrderBy(ed => ed.Date)
                    .FirstOrDefault();

            var relevantRaces = relevantEdition?.Races
                .Where(r => r.Status != RaceStatus.Cancelled)
                .OrderBy(r => r.SortOrder)
                .ToList();

            var distances = relevantRaces?
                .Select(r => {
                    var label = !string.IsNullOrWhiteSpace(r.DistanceLabel)
                        ? r.DistanceLabel
                        : r.Trail != null && r.Trail.Length > 0
                            ? $"{r.Trail.Length / 1000.0:0.#} km"
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
                .Select(r => r.Trail?.YoutubeUrl)
                .FirstOrDefault(u => !string.IsNullOrWhiteSpace(u));

            List<SeriesRaceDto>? seriesRaces = null;
            if (e.Type == EventType.Series)
            {
                seriesRaces = e.Editions
                    .SelectMany(ed => ed.Races
                        .Where(r => r.Status != RaceStatus.Cancelled
                            && r.DateOfRace.HasValue
                            && r.DateOfRace.Value >= today
                            && r.DateOfRace.Value <= oneYearAhead)
                        .Select(r => new SeriesRaceDto(
                            r.Id,
                            r.Name,
                            r.DateOfRace,
                            r.StartTime,
                            !string.IsNullOrWhiteSpace(r.DistanceLabel) ? r.DistanceLabel
                                : r.Trail != null && r.Trail.Length > 0 ? $"{r.Trail.Length / 1000.0:0.#} km"
                                : null,
                            r.TicketStatus.ToString(),
                            ed.RegistrationUrl
                        )))
                    .OrderBy(r => r.DateOfRace)
                    .ToList();
            }

            var isMountainRace = e.Editions
                .SelectMany(ed => ed.Races)
                .Any(r => r.Trail?.TerrainType == Core.Entities.TerrainType.Mountainous);

            var terrainType = e.Editions
                .SelectMany(ed => ed.Races)
                .Select(r => r.Trail?.TerrainType)
                .Where(t => t != null)
                .GroupBy(t => t)
                .OrderByDescending(g => g.Count())
                .Select(g => g.Key!.Value.ToString())
                .FirstOrDefault();

            return new EventSummaryDto(
                e.Id,
                e.Name,
                e.Slug,
                e.Description,
                e.Type.ToString(),
                e.ActivityType.ToString(),
                e.Status.ToString(),
                e.OrganizerName,
                e.OrganizerWebsite,
                e.AlertMessage,
                e.AlertSeverity,
                e.LocationId,
                e.Location?.Name,
                e.ScheduleRule,
                e.SocialLinks,
                nextDate,
                daysUntil,
                e.Editions.Count,
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
                TerrainType: terrainType
            );
        }).ToList();
    }

    private DateOnly? ResolveNextDate(Core.Entities.Event e, DateOnly today)
    {
        var nextEditionDate = e.Editions
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
