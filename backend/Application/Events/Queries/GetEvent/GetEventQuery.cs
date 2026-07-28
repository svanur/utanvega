using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events.Queries.GetEvents;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetEvent;

public record EventDetailDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string Type,
    string ActivityType,
    string Status,
    string? OrganizerName,
    string? OrganizerWebsite,
    string? AlertMessage,
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
    double? GpxPointLng = null
);

public record GetEventQuery(string Slug) : IRequest<EventDetailDto?>, ICacheable
{
    public string CacheKey => CacheKeys.Event(Slug);
    public TimeSpan CacheDuration => TimeSpan.FromHours(1);
}

public class GetEventQueryHandler : IRequestHandler<GetEventQuery, EventDetailDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;

    public GetEventQueryHandler(UtanvegaDbContext context, IScheduleRuleEngine scheduleEngine)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
    }

    public async Task<EventDetailDto?> Handle(GetEventQuery request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .AsNoTracking()
            .Include(e => e.Location)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.Trail)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.Races)
                    .ThenInclude(r => r.Trail)
            .FirstOrDefaultAsync(e => e.Slug == request.Slug, cancellationToken);

        if (ev == null) return null;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var nextEditionDate = ev.Editions
            .Where(ed => ed.Date.HasValue && ed.Date.Value >= today)
            .OrderBy(ed => ed.Date)
            .Select(ed => ed.Date)
            .FirstOrDefault();

        var nextDate = nextEditionDate
            ?? (ev.ScheduleRule != null ? _scheduleEngine.GetNextOccurrence(ev.ScheduleRule, today) : null);

        // Check for recently-past editions (up to 3 days ago)
        // so events with schedule rules still show as "recently completed"
        var mostRecentPast = ev.Editions
            .Where(ed => ed.Date.HasValue && ed.Date.Value < today)
            .OrderByDescending(ed => ed.Date)
            .Select(ed => ed.Date)
            .FirstOrDefault();

        var recentlyCompleted = ev.Status != EventStatus.Cancelled
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

        var upcomingDates = ev.ScheduleRule != null
            ? _scheduleEngine.GetOccurrencesInRange(ev.ScheduleRule, today, today.AddMonths(12))
            : new List<DateOnly>();

        var editions = ev.Editions
            .OrderByDescending(ed => ed.Date ?? DateOnly.MinValue)
            .Select(ed => new EventEditionDto(
                ed.Id,
                ed.EventId,
                ed.Year,
                ed.Date,
                ed.Title,
                ed.RegistrationUrl,
                ed.ResultsUrl,
                ed.Notes,
                ed.RegistrationStatus.ToString(),
                ed.TrailId,
                ed.Trail?.Name,
                ed.Trail?.Slug,
                ed.Races
                    .OrderBy(r => r.SortOrder)
                    .Select(r => new RaceDto(
                        r.Id,
                        r.EventEditionId,
                        r.TrailId,
                        r.Trail?.Name,
                        r.Trail?.Slug,
                        r.Name,
                        r.DistanceLabel,
                        r.CutoffMinutes,
                        r.Description,
                        r.Status.ToString(),
                        r.SortOrder,
                        r.TicketStatus.ToString(),
                        r.MaxParticipants,
                        r.ItraPoints,
                        r.CertifiedBy,
                        r.PrizeMoney,
                        r.ChampionshipCategory,
                        r.DateOfRace,
                        r.StartTime,
                        r.Trail?.Length,
                        r.Trail?.ElevationGain,
                        r.Trail?.TerrainType?.ToString(),
                        r.Trail?.Difficulty.ToString(),
                        r.Trail?.ActivityTypeId.ToString()
                    ))
                    .ToList(),
                ed.CreatedAt,
                ed.UpdatedAt
            ))
            .ToList();

        var relevantEdition = recentlyCompleted
            ? ev.Editions.FirstOrDefault(ed => ed.Date == mostRecentPast)
            : ev.Editions
                .Where(ed => ed.Date.HasValue && ed.Date.Value >= today)
                .OrderBy(ed => ed.Date)
                .FirstOrDefault();

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
            .Select(r => r.Trail?.YoutubeUrl)
            .FirstOrDefault(u => !string.IsNullOrWhiteSpace(u));

        return new EventDetailDto(
            ev.Id,
            ev.Name,
            ev.Slug,
            ev.Description,
            ev.Type.ToString(),
            ev.ActivityType.ToString(),
            ev.Status.ToString(),
            ev.OrganizerName,
            ev.OrganizerWebsite,
            ev.AlertMessage,
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
            ev.GpxPointLng
        );
    }
}
