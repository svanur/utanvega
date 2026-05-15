namespace Utanvega.Backend.Application.Activities.Commands.UpdateUserTrailActivity;

using MediatR;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

public class UpdateUserTrailActivityHandler : IRequestHandler<UpdateUserTrailActivityCommand, UpdateUserTrailActivityResponse>
{
    private readonly UtanvegaDbContext _dbContext;
    private readonly ICacheInvalidator _cacheInvalidator;

    public UpdateUserTrailActivityHandler(UtanvegaDbContext dbContext, ICacheInvalidator cacheInvalidator)
    {
        _dbContext = dbContext;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<UpdateUserTrailActivityResponse> Handle(UpdateUserTrailActivityCommand request, CancellationToken cancellationToken)
    {
        var activity = await _dbContext.UserTrailActivities.FindAsync(new object[] { request.Id }, cancellationToken: cancellationToken);
        if (activity == null)
            throw new InvalidOperationException($"Activity with ID {request.Id} not found");

        if (activity.UserId != request.UserId)
            throw new UnauthorizedAccessException("You do not have permission to update this activity");

        var isPublicityChanged = activity.IsPublic != request.IsPublic;
        var wasPublic = activity.IsPublic;

        activity.LogDate = request.LogDate;
        activity.TimeInSeconds = request.TimeInSeconds;
        activity.Distance = request.Distance;
        activity.ElevationGain = request.ElevationGain;
        activity.Notes = request.Notes;
        activity.IsPublic = request.IsPublic;
        activity.UpdatedAt = DateTimeOffset.UtcNow;

        _dbContext.UserTrailActivities.Update(activity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Invalidate leaderboard cache if activity was/is public or changed publicity status
        if (wasPublic || activity.IsPublic || isPublicityChanged)
        {
            _cacheInvalidator.InvalidateLeaderboard(activity.TrailSlug);
        }

        return new UpdateUserTrailActivityResponse(
            activity.Id,
            activity.UserId,
            activity.TrailSlug,
            activity.LogDate,
            activity.TimeInSeconds,
            activity.Distance,
            activity.ElevationGain,
            activity.Notes,
            activity.IsPublic,
            activity.LoggedAt,
            activity.UpdatedAt,
            activity.CreatedAt
        );
    }
}
