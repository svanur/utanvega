namespace Utanvega.Backend.Application.Activities.Commands.CreateUserTrailActivity;

using MediatR;

public record CreateUserTrailActivityCommand(
    Guid UserId,
    string TrailSlug,
    int Time,
    decimal? Distance,
    int? ElevationGain,
    DateOnly? LogDate,
    string? Notes,
    bool IsPublic
) : IRequest<CreateUserTrailActivityResponse>;

public record CreateUserTrailActivityResponse(
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
    DateTimeOffset CreatedAt
);
