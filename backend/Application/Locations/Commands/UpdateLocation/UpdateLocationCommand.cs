using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Locations.Commands.UpdateLocation;

public record UpdateLocationCommand(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string Type,
    Guid? ParentId,
    double? Latitude,
    double? Longitude,
    double? Radius,
    string? UpdatedBy
) : IRequest;

public class UpdateLocationCommandHandler : IRequestHandler<UpdateLocationCommand>
{
    private readonly UtanvegaDbContext _context;

    public UpdateLocationCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task Handle(UpdateLocationCommand request, CancellationToken cancellationToken)
    {
        var location = await _context.Locations
            .FirstOrDefaultAsync(l => l.Id == request.Id, cancellationToken);

        if (location == null)
            throw new Exception("Location not found");

        // Force original values for change detection
        _context.Entry(location).OriginalValues.SetValues(await _context.Locations.AsNoTracking().FirstAsync(l => l.Id == request.Id, cancellationToken));

        Enum.TryParse<LocationType>(request.Type, true, out var type);

        Point? center = null;
        if (request.Latitude.HasValue && request.Longitude.HasValue)
        {
            center = new Point(request.Longitude.Value, request.Latitude.Value) { SRID = 4326 };
        }

        location.Name = request.Name;
        location.Slug = request.Slug;
        location.Description = request.Description;
        location.Type = type;
        location.ParentId = request.ParentId;
        location.Center = center;
        location.Radius = request.Radius;
        location.UpdatedBy = request.UpdatedBy;
        location.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesWithAuditAsync(request.UpdatedBy);
    }
}
