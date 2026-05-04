namespace Utanvega.Backend.Application.Activities.Commands.CreateUserTrailActivity;

using MediatR;

public record CreateUserTrailActivityCommand(
    Guid UserId,
    string TrailSlug,
    DateOnly? LogDate,
    int TimeInSeconds,
    decimal? Distance,
    int? ElevationGain,
    string? Notes,
    bool IsPublic
) : IRequest<CreateUserTrailActivityResponse>;

public record CreateUserTrailActivityResponse(
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
    DateTimeOffset CreatedAt
);
