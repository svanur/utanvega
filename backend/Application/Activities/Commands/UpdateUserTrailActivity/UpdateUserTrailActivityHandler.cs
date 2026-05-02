namespace Utanvega.Backend.Application.Activities.Commands.UpdateUserTrailActivity;

using MediatR;
using Utanvega.Backend.Infrastructure.Persistence;

public class UpdateUserTrailActivityHandler : IRequestHandler<UpdateUserTrailActivityCommand, UpdateUserTrailActivityResponse>
{
    private readonly UtanvegaDbContext _dbContext;

    public UpdateUserTrailActivityHandler(UtanvegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<UpdateUserTrailActivityResponse> Handle(UpdateUserTrailActivityCommand request, CancellationToken cancellationToken)
    {
        var activity = await _dbContext.UserTrailActivities.FindAsync(new object[] { request.Id }, cancellationToken: cancellationToken);
        if (activity == null)
            throw new InvalidOperationException($"Activity with ID {request.Id} not found");

        if (activity.UserId != request.UserId)
            throw new UnauthorizedAccessException("You do not have permission to update this activity");

        activity.Time = request.Time;
        activity.Distance = request.Distance;
        activity.ElevationGain = request.ElevationGain;
        activity.LogDate = request.LogDate;
        activity.Notes = request.Notes;
        activity.IsPublic = request.IsPublic;
        activity.UpdatedAt = DateTimeOffset.UtcNow;

        _dbContext.UserTrailActivities.Update(activity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new UpdateUserTrailActivityResponse(
            activity.Id,
            activity.UserId,
            activity.TrailSlug,
            activity.Time,
            activity.Distance,
            activity.ElevationGain,
            activity.LogDate,
            activity.Notes,
            activity.IsPublic,
            activity.LoggedAt,
            activity.CreatedAt,
            activity.UpdatedAt
        );
    }
}
