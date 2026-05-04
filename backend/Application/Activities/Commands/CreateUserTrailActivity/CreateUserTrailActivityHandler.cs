namespace Utanvega.Backend.Application.Activities.Commands.CreateUserTrailActivity;

using MediatR;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

public class CreateUserTrailActivityHandler : IRequestHandler<CreateUserTrailActivityCommand, CreateUserTrailActivityResponse>
{
    private readonly UtanvegaDbContext _dbContext;
    private readonly IMediator _mediator;

    public CreateUserTrailActivityHandler(UtanvegaDbContext dbContext, IMediator mediator)
    {
        _dbContext = dbContext;
        _mediator = mediator;
    }

    public async Task<CreateUserTrailActivityResponse> Handle(CreateUserTrailActivityCommand request, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        var activity = new UserTrailActivity
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            TrailSlug = request.TrailSlug,
            LogDate = request.LogDate,
            TimeInSeconds = request.TimeInSeconds,
            Distance = request.Distance,
            ElevationGain = request.ElevationGain,
            Notes = request.Notes,
            IsPublic = request.IsPublic,
            LoggedAt = now,
            CreatedAt = now
        };

        _dbContext.UserTrailActivities.Add(activity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new CreateUserTrailActivityResponse(
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
            activity.CreatedAt
        );
    }
}
