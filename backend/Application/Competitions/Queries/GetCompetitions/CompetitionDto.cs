namespace Utanvega.Backend.Application.Competitions.Queries.GetCompetitions;

using Utanvega.Backend.Core.Entities;

public record CompetitionDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string? OrganizerName,
    string? OrganizerWebsite,
    string? RegistrationUrl,
    string? AlertMessage,
    string? AlertSeverity,
    Guid? LocationId,
    string? LocationName,
    string Status,
    ScheduleRule? ScheduleRule,
    DateOnly? NextDate,
    int? DaysUntil,
    int RaceCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record RaceDto(
    Guid Id,
    Guid CompetitionId,
    Guid? TrailId,
    string? TrailName,
    string? TrailSlug,
    string Name,
    string? DistanceLabel,
    int? CutoffMinutes,
    string? Description,
    string Status,
    int SortOrder,
    double? TrailDistanceMeters,
    double? TrailElevationGain
);
