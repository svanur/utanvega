namespace Utanvega.Backend.Application.Activities.Commands.UpdateUserTrailActivity;

using MediatR;

public record UpdateUserTrailActivityCommand(
    Guid Id,
    Guid UserId,
    DateOnly? LogDate,
    int TimeInSeconds,
    decimal? Distance,
    int? ElevationGain,
    string? Notes,
    bool IsPublic
) : IRequest<UpdateUserTrailActivityResponse>;

public record UpdateUserTrailActivityResponse(
    Guid Id,
    Guid UserId,
    string TrailSlug,
    DateOnly? LogDate,
    int TimeInSeconds,
    decimal? Distance,
    int? ElevationGain,
    string? Notes,
    bool IsPublic,
    DateTimeOffset LoggedAt,
    DateTimeOffset? UpdatedAt,
    DateTimeOffset CreatedAt
);
