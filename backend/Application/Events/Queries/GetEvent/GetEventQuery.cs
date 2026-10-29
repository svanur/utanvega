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
    string? LocationType,
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

    // Admin (IncludeHidden) reads must never be cached: on a multi-instance deployment,
    // invalidation on the writing instance does not reach the in-process caches of the others,
    // leaving admin views stale for up to the cache duration. TimeSpan.Zero tells
    // CachingBehavior to skip caching entirely for this variant.
    public TimeSpan CacheDuration => IncludeHidden ? TimeSpan.Zero : TimeSpan.FromHours(1);
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
        var computed = await EventDetailComputer.ComputeAsync(
            _context, _scheduleEngine, request.Slug, request.IncludeHidden, cancellationToken);

        if (computed == null) return null;

        var ev = computed.Event;

        var editions = computed.Editions.Select(ec => new EventEditionDto(
            ec.Edition.Id,
            ec.Edition.EventId,
            ec.Edition.Year ?? ec.EffDate?.Year,
            ec.EffDate,
            ec.EffEndDate,
            ec.Edition.Title,
            ec.Edition.TitleEn,
            ec.Edition.RegistrationUrl,
            ec.Edition.ResultsUrl,
            ec.Edition.Notes,
            ec.Edition.NotesEn,
            ec.EffectiveRegistrationStatus,
            ec.Edition.TrailId,
            ec.TrailName,
            ec.TrailSlug,
            ec.Races
                .OrderBy(rc => rc.Race.SortOrder)
                .Select(rc => new RaceDto(
                    rc.Race.Id,
                    rc.Race.EventEditionId,
                    rc.Race.TrailId,
                    rc.TrailName,
                    rc.TrailSlug,
                    rc.Race.Name,
                    rc.Race.NameEn,
                    rc.Race.DistanceLabel,
                    rc.Race.DistanceLabelEn,
                    rc.Race.CutoffMinutes,
                    rc.Race.Description,
                    rc.Race.DescriptionEn,
                    rc.Race.Status.ToString(),
                    rc.Race.SortOrder,
                    rc.TicketStatus,
                    rc.Race.MaxParticipants,
                    rc.Race.ItraPoints,
                    rc.Race.CertifiedBy,
                    rc.Race.CertifiedByEn,
                    rc.Race.PrizeMoney,
                    rc.Race.ChampionshipCategory,
                    rc.Race.ChampionshipCategoryEn,
                    rc.Race.DateOfRace,
                    rc.Race.StartTime,
                    rc.TrailDistanceMeters,
                    rc.TrailElevationGain,
                    rc.TrailTerrainType,
                    rc.TrailDifficulty,
                    rc.TrailActivityType,
                    TranslationHashes: null,
                    ActivityType: rc.Race.ActivityType?.ToString(),
                    ResultType: rc.Race.ResultType.ToString(),
                    RegistrationOpensMinutesBeforeRace: rc.Race.RegistrationOpensMinutesBeforeRace
                ))
                .ToList(),
            ec.Edition.PhotoGalleries.ToPublicDtos(),
            ec.Edition.CreatedAt,
            ec.Edition.UpdatedAt,
            Status: ec.Edition.Status.ToString(),
            EffectiveCancelled: ec.EffectiveCancelled,
            RegistrationOpens: ec.Edition.RegistrationOpens,
            RegistrationCloses: ec.Edition.RegistrationCloses,
            NeedsReview: ec.NeedsReview,
            PrimaryElevationProfile: ec.PrimaryElevationProfile,
            PrimaryTerrainType: ec.PrimaryTerrainType
        )).ToList();

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
            ev.Location?.Type.ToString(),
            ev.ScheduleRule,
            ev.SocialLinks,
            computed.NextDate,
            computed.DaysUntil,
            computed.UpcomingDates,
            editions,
            ev.CreatedAt,
            ev.UpdatedAt,
            computed.DisplayDate,
            computed.Certifications,
            computed.YoutubeUrl,
            computed.ChampionshipCategories,
            computed.ItraPoints,
            ev.GpxPointLat,
            ev.GpxPointLng,
            TranslationHashes: null,
            ActivityTypes: computed.ActivityTypes,
            EditionStatus: computed.EditionStatus,
            EditionEffectiveCancelled: computed.EditionEffectiveCancelled,
            OrganizerSlug: ev.Organizer != null ? ev.Organizer.Slug : null
        );
    }
}
