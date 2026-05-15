namespace Utanvega.Backend.Application.Activities.Queries.GetTrailLeaderboard;

using MediatR;
using Utanvega.Backend.Application.Caching;

public record GetTrailLeaderboardQuery(string TrailSlug, int Limit = 10) : IRequest<GetTrailLeaderboardResponse>, ICacheable
{
    public string CacheKey => CacheKeys.Leaderboard(TrailSlug, Limit);
    public TimeSpan CacheDuration => TimeSpan.FromHours(1);
}

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
