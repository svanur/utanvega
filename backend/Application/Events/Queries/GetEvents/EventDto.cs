namespace Utanvega.Backend.Application.Events.Queries.GetEvents;

using Utanvega.Backend.Core.Entities;

public record EventSummaryDto(
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
    int EditionCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateOnly? DisplayDate = null,
    List<string>? Distances = null,
    string? RegistrationUrl = null,
    string? RegistrationStatus = null
);

public record RaceDto(
    Guid Id,
    Guid EventEditionId,
    Guid? TrailId,
    string? TrailName,
    string? TrailSlug,
    string Name,
    string? DistanceLabel,
    int? CutoffMinutes,
    string? Description,
    string Status,
    int SortOrder,
    string TicketStatus,
    int? MaxParticipants,
    int? ItraPoints,
    string? CertifiedBy,
    decimal PrizeMoney,
    string? ChampionshipCategory,
    DateOnly? DateOfRace,
    TimeOnly? StartTime,
    double? TrailDistanceMeters,
    double? TrailElevationGain
);

public record EventEditionDto(
    Guid Id,
    Guid EventId,
    int? Year,
    DateOnly? Date,
    string? Title,
    string? RegistrationUrl,
    string? ResultsUrl,
    string? Notes,
    string RegistrationStatus,
    Guid? TrailId,
    string? TrailName,
    string? TrailSlug,
    List<RaceDto> Races,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);
