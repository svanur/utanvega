namespace Utanvega.Backend.Application.Activities.Queries.GetTrailLeaderboard;

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

public class GetTrailLeaderboardHandler : IRequestHandler<GetTrailLeaderboardQuery, GetTrailLeaderboardResponse>
{
    private readonly UtanvegaDbContext _dbContext;

    public GetTrailLeaderboardHandler(UtanvegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<GetTrailLeaderboardResponse> Handle(GetTrailLeaderboardQuery request, CancellationToken cancellationToken)
    {
        var normalizedSlug = request.TrailSlug.Trim().ToLowerInvariant();
        var limit = Math.Clamp(request.Limit, 1, 1000);

        var totalEntries = await _dbContext.UserTrailActivities
            .AsNoTracking()
            .Where(a => a.TrailSlug == normalizedSlug && a.IsPublic)
            .Select(a => a.UserId)
            .Distinct()
            .CountAsync(cancellationToken);

        // Select only the top `limit` best-per-user rows at DB level.
        var bestByUser = await _dbContext.UserTrailActivities
            .FromSqlInterpolated($@"
                SELECT ranked.""UserId"",
                       ranked.""TimeInSeconds"",
                       ranked.""LogDate"",
                       ranked.""CreatedAt""
                FROM (
                    SELECT DISTINCT ON (""UserId"")
                        ""UserId"",
                        ""TimeInSeconds"",
                        ""LogDate"",
                        ""CreatedAt""
                    FROM ""UserTrailActivities""
                    WHERE ""TrailSlug"" = {normalizedSlug} AND ""IsPublic"" = true
                    ORDER BY ""UserId"",
                        ""TimeInSeconds"" ASC,
                        ""LogDate"" DESC NULLS LAST,
                        ""CreatedAt"" DESC
                ) AS ranked
                ORDER BY ranked.""TimeInSeconds"" ASC,
                         ranked.""LogDate"" DESC NULLS LAST,
                         ranked.""CreatedAt"" DESC
                LIMIT {limit}")
            .AsNoTracking()
            .Select(a => new
            {
                a.UserId,
                a.TimeInSeconds,
                a.LogDate,
                a.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var userIds = bestByUser.Select(a => a.UserId).ToList();
        var profiles = await _dbContext.Profiles
            .AsNoTracking()
            .Where(p => userIds.Contains(p.UserId))
            .ToDictionaryAsync(p => p.UserId, cancellationToken);

        var entries = new List<TrailLeaderboardEntryDto>(bestByUser.Count);
        var previousTime = -1;
        var rank = 0;

        for (var i = 0; i < bestByUser.Count; i++)
        {
            var activity = bestByUser[i];
            if (activity.TimeInSeconds != previousTime)
            {
                rank = i + 1;
                previousTime = activity.TimeInSeconds;
            }

            var hasProfile = profiles.TryGetValue(activity.UserId, out var profile);
            var displayName = hasProfile && !string.IsNullOrWhiteSpace(profile!.DisplayName)
                ? profile.DisplayName
                : $"Runner-{activity.UserId.ToString("N")[..6]}";

            entries.Add(new TrailLeaderboardEntryDto(
                rank,
                activity.UserId,
                displayName,
                profile?.AvatarUrl,
                activity.TimeInSeconds,
                activity.LogDate
            ));
        }

        return new GetTrailLeaderboardResponse(entries, totalEntries);
    }
}
