using MediatR;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Locations.Commands.CreateLocation;

public record CreateLocationCommand(
    string Name,
    string? Slug,
    string? Description,
    string Type,
    Guid? ParentId,
    double? Latitude,
    double? Longitude,
    double? Radius,
    string? CreatedBy
) : IRequest<Guid>;

public class CreateLocationCommandHandler : IRequestHandler<CreateLocationCommand, Guid>
{
    private readonly UtanvegaDbContext _context;

    public CreateLocationCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<Guid> Handle(CreateLocationCommand request, CancellationToken cancellationToken)
    {
        var slug = request.Slug ?? SlugGenerator.Generate(request.Name);
        
        Enum.TryParse<LocationType>(request.Type, true, out var type);

        Point? center = null;
        if (request.Latitude.HasValue && request.Longitude.HasValue)
        {
            center = new Point(request.Longitude.Value, request.Latitude.Value) { SRID = 4326 };
        }

        var location = new Utanvega.Backend.Core.Entities.Location
        {
            Name = request.Name,
            Slug = slug,
            Description = request.Description,
            Type = type,
            ParentId = request.ParentId,
            Center = center,
            Radius = request.Radius,
            CreatedBy = request.CreatedBy,
            CreatedAt = DateTime.UtcNow
        };

        _context.Locations.Add(location);
        await _context.SaveChangesAsync(cancellationToken);

        return location.Id;
    }
}
