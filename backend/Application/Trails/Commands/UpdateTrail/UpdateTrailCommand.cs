using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.UpdateTrail;

public record TrailLocationUpdateDto(
    Guid LocationId,
    string Role,
    int Order
);

public record UpdateTrailCommand(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string ActivityType,
    string Status,
    string Type,
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
        {
            trail.ActivityTypeId = activityType;
        }
        else
        {
            Console.WriteLine($"[DEBUG_LOG] Failed to parse ActivityType: '{request.ActivityType}'");
            // If the value is "TrailRunnin" or similar, we want to match it to TrailRunning
            if (request.ActivityType.StartsWith("TrailRunnin", StringComparison.OrdinalIgnoreCase))
            {
                trail.ActivityTypeId = ActivityType.TrailRunning;
            }
        }
            
        if (Enum.TryParse<TrailStatus>(request.Status, true, out var status))
            trail.Status = status;
            
        if (Enum.TryParse<Difficulty>(request.Difficulty, true, out var difficulty))
            trail.Difficulty = difficulty;
            
        if (Enum.TryParse<Visibility>(request.Visibility, true, out var visibility))
            trail.Visibility = visibility;
            
        if (Enum.TryParse<TrailType>(request.Type, true, out var trailType))
            trail.Type = trailType;
            
        trail.UpdatedBy = request.UpdatedBy;
        trail.UpdatedAt = DateTime.UtcNow;

        // Sync Locations
        if (request.Locations != null)
        {
            var currentLocations = trail.TrailLocations.ToList();
            var requestedLocations = request.Locations.ToList();

            // Remove locations not in the request
            foreach (var current in currentLocations)
            {
                var roleString = current.Role.ToString();
                if (!requestedLocations.Any(r => r.LocationId == current.LocationId && string.Equals(r.Role, roleString, StringComparison.OrdinalIgnoreCase)))
                {
                    _context.TrailLocations.Remove(current);
                }
            }

            // Add or Update locations
            foreach (var requested in requestedLocations)
            {
                if (Enum.TryParse<TrailLocationRole>(requested.Role, true, out var role))
                {
                    var existing = currentLocations.FirstOrDefault(c => c.LocationId == requested.LocationId && c.Role == role);
                    if (existing != null)
                    {
                        existing.Order = requested.Order;
                    }
                    else
                    {
                        var newTL = new TrailLocation
                        {
                            TrailId = trail.Id,
                            LocationId = requested.LocationId,
                            Role = role,
                            Order = requested.Order
                        };
                        _context.TrailLocations.Add(newTL);
                    }
                }
            }
        }

        await _context.SaveChangesWithAuditAsync(request.UpdatedBy);
        return true;
    }
}
