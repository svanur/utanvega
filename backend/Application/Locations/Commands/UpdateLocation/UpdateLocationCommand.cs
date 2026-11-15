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
    // #1705/#1706: three-state, unlike Center/Radius above — null means "field omitted", and must
    // leave an already-set Boundary untouched (see UpdateLocationCommandHandler); "" (empty
    // string, not null) is the explicit "clear it" sentinel the admin UI sends after removing a
    // previously-saved boundary via Geoman's removal tool (#1706 review fix — the admin dialog
    // always sent boundaryGeoJson: null on removal, which was indistinguishable from "untouched"
    // and silently failed to delete the boundary); anything else is parsed and replaces Boundary.
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
        // #1705/#1706: patch-if-provided — null omits the field and leaves an already-set
        // Boundary alone, unlike Center/Radius above which are always recomputed from Lat/Lon.
        // "" (empty string) is the explicit clear sentinel: the admin UI sends it after a Geoman
        // removal, and a null Lat/Lon-derived Center from earlier in this method is left as-is
        // (the user's pin/radius inputs, not recomputed from the now-gone boundary). The validator
        // has already rejected a malformed/non-Polygon/self-intersecting non-empty value by the
        // time the handler runs, so TryParse here is only expected to fail on "".
        if (request.BoundaryGeoJson == string.Empty)
        {
            location.Boundary = null;
        }
        else if (!string.IsNullOrEmpty(request.BoundaryGeoJson) &&
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
