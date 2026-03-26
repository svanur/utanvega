using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.UpdateTrail;

public record TrailLocationUpdateDto(
    Guid LocationId,
    string Role
);

public record UpdateTrailCommand(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string ActivityType,
    string Status,
    string Difficulty,
    string Visibility,
    string? UpdatedBy,
    List<TrailLocationUpdateDto>? Locations = null
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
        var trail = await _context.Trails
            .Include(t => t.TrailLocations)
            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);
        
        if (trail == null) return false;

        trail.Name = request.Name;
        trail.Slug = request.Slug;
        trail.Description = request.Description;
        
        if (Enum.TryParse<ActivityType>(request.ActivityType, true, out var activityType))
            trail.ActivityTypeId = activityType;
            
        if (Enum.TryParse<TrailStatus>(request.Status, true, out var status))
            trail.Status = status;
            
        if (Enum.TryParse<Difficulty>(request.Difficulty, true, out var difficulty))
            trail.Difficulty = difficulty;
            
        if (Enum.TryParse<Visibility>(request.Visibility, true, out var visibility))
            trail.Visibility = visibility;
            
        trail.UpdatedBy = request.UpdatedBy;
        trail.UpdatedAt = DateTime.UtcNow;

        // Sync Locations
        if (request.Locations != null)
        {
            _context.TrailLocations.RemoveRange(trail.TrailLocations);
            
            foreach (var locDto in request.Locations)
            {
                if (Enum.TryParse<TrailLocationRole>(locDto.Role, true, out var role))
                {
                    trail.TrailLocations.Add(new TrailLocation
                    {
                        TrailId = trail.Id,
                        LocationId = locDto.LocationId,
                        Role = role
                    });
                }
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
