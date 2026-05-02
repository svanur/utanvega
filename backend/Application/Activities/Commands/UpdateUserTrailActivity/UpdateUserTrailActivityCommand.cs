namespace Utanvega.Backend.Application.Activities.Commands.UpdateUserTrailActivity;

using MediatR;

public record UpdateUserTrailActivityCommand(
    Guid Id,
    Guid UserId,
    int Time,
    decimal? Distance,
    int? ElevationGain,
    DateOnly? LogDate,
    string? Notes,
    bool IsPublic
) : IRequest<UpdateUserTrailActivityResponse>;

public record UpdateUserTrailActivityResponse(
    Guid Id,
    Guid UserId,
    string TrailSlug,
    int Time,
    decimal? Distance,
    int? ElevationGain,
    DateOnly? LogDate,
    string? Notes,
    bool IsPublic,
    DateTimeOffset LoggedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt
);
