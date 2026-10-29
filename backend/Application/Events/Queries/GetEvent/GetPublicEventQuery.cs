using MediatR;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Application.Events.Queries.GetEvents;
using Utanvega.Backend.Application.PhotoGalleries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetEvent;

// Narrowed public-facing projection of EventDetailDto — same shape except Editions nests
// EventEditionPublicDto (whose Races are RacePublicDto, not RaceDto). See #1562.
public record EventDetailPublicDto(
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
    List<EventEditionPublicDto> Editions,
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

// Narrowed public-facing projection of EventEditionDto — same shape except Races is
// List<RacePublicDto>, not List<RaceDto>. See #1562.
public record EventEditionPublicDto(
    Guid Id,
    Guid EventId,
    int? Year,
    DateOnly? Date,
    DateOnly? EndDate,
    string? Title,
    string? TitleEn,
    string? RegistrationUrl,
    string? ResultsUrl,
    string? Notes,
    string? NotesEn,
    string RegistrationStatus,
    Guid? TrailId,
    string? TrailName,
    string? TrailSlug,
    List<RacePublicDto> Races,
    List<PublicPhotoGalleryDto> Galleries,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    Dictionary<string, string>? TranslationHashes = null,
    string Status = "Active",
    bool EffectiveCancelled = false,
    DateTime? RegistrationOpens = null,
    DateTime? RegistrationCloses = null,
    bool NeedsReview = false,
    double[]? PrimaryElevationProfile = null,
    string? PrimaryTerrainType = null
);

// Public counterpart to GetEventQuery (#1562) — backs only GET /api/v1/events/{slug}. Never
// carries an IncludeHidden flag: Hidden events/editions, NeedsReview and
// AnyEditionUnconfirmed are already gated off for every caller of this query, so there is no
// "dead" admin-only branch to drop here the way there would be if this mirrored GetEventQuery.
public record GetPublicEventQuery(string Slug) : IRequest<EventDetailPublicDto?>, ICacheable
{
    public string CacheKey => CacheKeys.EventPublic(Slug);

    // Same 1-hour duration the public (IncludeHidden=false) branch of GetEventQuery used
    // before the split.
    public TimeSpan CacheDuration => TimeSpan.FromHours(1);
}

public class GetPublicEventQueryHandler : IRequestHandler<GetPublicEventQuery, EventDetailPublicDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IScheduleRuleEngine _scheduleEngine;

    public GetPublicEventQueryHandler(UtanvegaDbContext context, IScheduleRuleEngine scheduleEngine)
    {
        _context = context;
        _scheduleEngine = scheduleEngine;
    }

    public async Task<EventDetailPublicDto?> Handle(GetPublicEventQuery request, CancellationToken cancellationToken)
    {
        var computed = await EventDetailComputer.ComputeAsync(
            _context, _scheduleEngine, request.Slug, includeHidden: false, cancellationToken);

        if (computed == null) return null;

        var ev = computed.Event;

        var editions = computed.Editions.Select(ec => new EventEditionPublicDto(
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
                .Select(rc => new RacePublicDto(
                    rc.Race.Id,
                    rc.Race.EventEditionId,
                    rc.Race.TrailId,
                    rc.TrailName,
                    rc.TrailSlug,
                    rc.Race.Name,
                    rc.Race.NameEn,
                    rc.Race.DistanceLabel,
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
                    ActivityType: rc.Race.ActivityType?.ToString()
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

        return new EventDetailPublicDto(
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
