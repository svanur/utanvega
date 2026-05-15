namespace Utanvega.Backend.Application.Activities.Queries.GetTrailLeaderboard;

using MediatR;

public record GetTrailLeaderboardQuery(string TrailSlug, int Limit = 10) : IRequest<GetTrailLeaderboardResponse>;

public record TrailLeaderboardEntryDto(
    int Rank,
    Guid UserId,
    string DisplayName,
    string? AvatarUrl,
    int TimeInSeconds,
    DateOnly? LogDate
);

public record GetTrailLeaderboardResponse(
    List<TrailLeaderboardEntryDto> Entries,
    int TotalEntries
);
