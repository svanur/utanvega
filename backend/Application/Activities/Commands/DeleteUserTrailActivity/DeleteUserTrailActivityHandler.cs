namespace Utanvega.Backend.Application.Activities.Commands.DeleteUserTrailActivity;

using MediatR;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

public class DeleteUserTrailActivityHandler : IRequestHandler<DeleteUserTrailActivityCommand, Unit>
{
    private readonly UtanvegaDbContext _dbContext;
    private readonly ICacheInvalidator _cacheInvalidator;

    public DeleteUserTrailActivityHandler(UtanvegaDbContext dbContext, ICacheInvalidator cacheInvalidator)
    {
        _dbContext = dbContext;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<Unit> Handle(DeleteUserTrailActivityCommand request, CancellationToken cancellationToken)
    {
        var activity = await _dbContext.UserTrailActivities.FindAsync(new object[] { request.Id }, cancellationToken: cancellationToken);
        if (activity == null)
            throw new InvalidOperationException($"Activity with ID {request.Id} not found");

        if (activity.UserId != request.UserId)
            throw new UnauthorizedAccessException("You do not have permission to delete this activity");

        _dbContext.UserTrailActivities.Remove(activity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Invalidate leaderboard cache if activity was public
        if (activity.IsPublic)
        {
            _cacheInvalidator.InvalidateLeaderboard(activity.TrailSlug);
        }

        return Unit.Value;
    }
}
