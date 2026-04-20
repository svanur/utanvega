using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.PatchTrail;

public record PatchTrailCommand(
    Guid Id,
    string? Name = null,
    string? Description = null,
    string? ActivityType = null,
    string? Difficulty = null,
    string? Status = null
) : IRequest<bool>;

public class PatchTrailCommandHandler : IRequestHandler<PatchTrailCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public PatchTrailCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(PatchTrailCommand request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails
            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

        if (trail == null) return false;

        if (request.Name is not null)
            trail.Name = request.Name;

        if (request.Description is not null)
            trail.Description = request.Description;

        if (request.ActivityType is not null && Enum.TryParse<Core.Entities.ActivityType>(request.ActivityType, out var activityType))
            trail.ActivityTypeId = activityType;

        if (request.Difficulty is not null && Enum.TryParse<Core.Entities.Difficulty>(request.Difficulty, out var difficulty))
            trail.Difficulty = difficulty;

        if (request.Status is not null && Enum.TryParse<TrailStatus>(request.Status, out var status))
            trail.Status = status;

        trail.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateTrail(trail.Slug);
        return true;
    }
}
