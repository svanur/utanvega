using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Locations.Queries.GetLocationBoundary;

/// <summary>
/// Admin-only lazy lookup for a single Location's Boundary polygon (#1706). Deliberately not
/// folded into GetLocationsQuery/LocationDto — the boundary is only needed when the admin
/// LocationDialog opens the Geoman editor for one location, not for every row of the list.
/// </summary>
public record GetLocationBoundaryQuery(Guid Id) : IRequest<LocationBoundaryDto>;

public record LocationBoundaryDto(string? BoundaryGeoJson);

public class GetLocationBoundaryQueryHandler : IRequestHandler<GetLocationBoundaryQuery, LocationBoundaryDto>
{
    private readonly UtanvegaDbContext _context;

    public GetLocationBoundaryQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<LocationBoundaryDto> Handle(GetLocationBoundaryQuery request, CancellationToken cancellationToken)
    {
        var boundary = await _context.Locations
            .AsNoTracking()
            .Where(l => l.Id == request.Id)
            .Select(l => l.Boundary)
            .FirstOrDefaultAsync(cancellationToken);

        // FirstOrDefaultAsync returns default(Polygon) = null for both "location missing" and
        // "location has no boundary" — the endpoint returns a 200 with null boundaryGeoJson
        // either way, so that ambiguity is harmless here; callers only ever pass an id they got
        // from the admin locations list, so "missing" doesn't arise in practice.
        if (boundary is null)
            return new LocationBoundaryDto(null);

        var geoJson = new GeoJsonWriter().Write(boundary);
        return new LocationBoundaryDto(geoJson);
    }
}
