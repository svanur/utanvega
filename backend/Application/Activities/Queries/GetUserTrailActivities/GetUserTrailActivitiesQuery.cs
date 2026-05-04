namespace Utanvega.Backend.Application.Activities.Queries.GetUserTrailActivities;

using MediatR;

public record GetUserTrailActivitiesQuery(Guid UserId) : IRequest<GetUserTrailActivitiesResponse>;

public record UserTrailActivityDto(
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

public record GetUserTrailActivitiesResponse(
    List<UserTrailActivityDto> Activities
);
