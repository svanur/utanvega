using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Locations;
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
    string? UpdatedBy,
    string? NameEn = null,
    string? DescriptionEn = null,
    Dictionary<string, string>? TranslationHashes = null,
    // #1705: patch-if-provided, unlike Center/Radius above — omitting it must leave an
    // already-set Boundary untouched (see UpdateLocationCommandHandler), not null it out.
    string? BoundaryGeoJson = null
) : IRequest;

public class UpdateLocationCommandHandler : IRequestHandler<UpdateLocationCommand>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public UpdateLocationCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
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

        var oldSlug = location.Slug;
        location.Name = request.Name;
        location.NameEn = request.NameEn;
        location.Slug = request.Slug;
        location.Description = request.Description;
        location.DescriptionEn = request.DescriptionEn;
        location.Type = type;
        location.ParentId = request.ParentId;
        location.Center = center;
        location.Radius = request.Radius;
        // #1705: patch-if-provided — a request that omits BoundaryGeoJson must leave an
        // already-set Boundary alone, unlike Center/Radius above which are always recomputed from
        // Lat/Lon. The validator has already rejected a malformed/non-Polygon/self-intersecting
        // value by the time the handler runs, so TryParse here is only expected to fail on null.
        if (request.BoundaryGeoJson != null &&
            LocationBoundaryParser.TryParse(request.BoundaryGeoJson, out var parsedBoundary, out _))
        {
            location.Boundary = parsedBoundary;
            var centroid = (Point)parsedBoundary!.Centroid;
            centroid.SRID = 4326;
            location.Center = centroid;
        }
        if (request.TranslationHashes != null)
            location.TranslationHashes = JsonSerializer.Serialize(request.TranslationHashes);
        location.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesWithAuditAsync(request.UpdatedBy);
        _cacheInvalidator.InvalidateLocation(oldSlug);
        if (oldSlug != request.Slug)
            _cacheInvalidator.InvalidateLocation(request.Slug);
    }
}
