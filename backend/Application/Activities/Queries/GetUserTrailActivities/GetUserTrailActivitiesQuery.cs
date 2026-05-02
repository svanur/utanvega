namespace Utanvega.Backend.Application.Activities.Queries.GetUserTrailActivities;

using MediatR;

public record GetUserTrailActivitiesQuery(Guid UserId) : IRequest<GetUserTrailActivitiesResponse>;

public record UserTrailActivityDto(
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

public record GetUserTrailActivitiesResponse(
    List<UserTrailActivityDto> Activities
);
