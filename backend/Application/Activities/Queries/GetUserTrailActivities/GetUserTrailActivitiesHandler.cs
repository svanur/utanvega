namespace Utanvega.Backend.Application.Activities.Queries.GetUserTrailActivities;

using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

public class GetUserTrailActivitiesHandler : IRequestHandler<GetUserTrailActivitiesQuery, GetUserTrailActivitiesResponse>
{
    private readonly UtanvegaDbContext _dbContext;

    public GetUserTrailActivitiesHandler(UtanvegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<GetUserTrailActivitiesResponse> Handle(GetUserTrailActivitiesQuery request, CancellationToken cancellationToken)
    {
        var activities = await _dbContext.UserTrailActivities
            .Where(a => a.UserId == request.UserId)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new UserTrailActivityDto(
                a.Id,
                a.UserId,
                a.TrailSlug,
                a.Time,
                a.Distance,
                a.ElevationGain,
                a.LogDate,
                a.Notes,
                a.IsPublic,
                a.LoggedAt,
                a.CreatedAt,
                a.UpdatedAt
            ))
            .ToListAsync(cancellationToken);

        return new GetUserTrailActivitiesResponse(activities);
    }
}
