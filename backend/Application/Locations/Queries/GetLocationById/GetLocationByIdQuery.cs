using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;
using Utanvega.Backend.Application.Locations.Queries.GetLocations;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Locations.Queries.GetLocationById;

/// <summary>
/// Admin-only lookup of a single Location by id (#1729). Resolves the record a detail page edits
/// without pulling the entire unfiltered admin locations list via GetLocationsQuery just to find
/// one row by id.
/// </summary>
public record GetLocationByIdQuery(Guid Id) : IRequest<LocationDto?>;

public class GetLocationByIdQueryHandler : IRequestHandler<GetLocationByIdQuery, LocationDto?>
{
    private readonly UtanvegaDbContext _context;

    public GetLocationByIdQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<LocationDto?> Handle(GetLocationByIdQuery request, CancellationToken cancellationToken)
    {
        var raw = await _context.Locations
            .AsNoTracking()
            .Where(l => l.Id == request.Id)
            .Select(l => new {
                l.Id, l.Name, l.NameEn, l.Slug, l.Description, l.DescriptionEn,
                Type = l.Type.ToString(),
                l.ParentId,
                ParentName = l.Parent != null ? l.Parent.Name : null,
                ParentNameEn = l.Parent != null ? l.Parent.NameEn : null,
                Latitude = l.Center != null ? l.Center.Y : (double?)null,
                Longitude = l.Center != null ? l.Center.X : (double?)null,
                l.Radius,
                ChildrenCount = l.Children.Count,
                TrailsCount = l.TrailLocations.Count,
                l.TranslationHashes,
                l.Boundary,
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (raw is null)
            return null;

        // Boundary is a Polygon — can't convert to GeoJSON inside the EF projection above, so
        // it's done here in memory (same two-pass approach as GetLocationsQueryHandler).
        var geoJsonWriter = new GeoJsonWriter();
        return new LocationDto(
            raw.Id, raw.Name, raw.NameEn, raw.Slug, raw.Description, raw.DescriptionEn,
            raw.Type, raw.ParentId, raw.ParentName, raw.ParentNameEn, raw.Latitude, raw.Longitude, raw.Radius,
            raw.ChildrenCount, raw.TrailsCount,
            raw.TranslationHashes == null ? null : JsonSerializer.Deserialize<Dictionary<string, string>>(raw.TranslationHashes),
            raw.Boundary == null ? null : geoJsonWriter.Write(raw.Boundary)
        );
    }
}
