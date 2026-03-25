using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.UpdateTrail;

public record UpdateTrailCommand(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    ActivityType ActivityType,
    TrailStatus Status,
    Difficulty Difficulty,
    Visibility Visibility,
    string? UpdatedBy
) : IRequest<bool>;

public class UpdateTrailCommandHandler : IRequestHandler<UpdateTrailCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public UpdateTrailCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdateTrailCommand request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails.FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);
        if (trail == null) return false;

        trail.Name = request.Name;
        trail.Slug = request.Slug;
        trail.Description = request.Description;
        trail.ActivityTypeId = request.ActivityType;
        trail.Status = request.Status;
        trail.Difficulty = request.Difficulty;
        trail.Visibility = request.Visibility;
        trail.UpdatedBy = request.UpdatedBy;
        trail.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
