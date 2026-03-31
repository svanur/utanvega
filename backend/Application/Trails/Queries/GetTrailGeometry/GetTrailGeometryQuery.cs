using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;
using NetTopologySuite.Geometries;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailGeometry;

public record GetTrailGeometryQuery(Guid? Id = null, string? Slug = null) : IRequest<string?>;

public class GetTrailGeometryQueryHandler : IRequestHandler<GetTrailGeometryQuery, string?>
{
    private readonly UtanvegaDbContext _context;

    public GetTrailGeometryQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<string?> Handle(GetTrailGeometryQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Trails.AsNoTracking();

        if (request.Id.HasValue)
        {
            query = query.Where(t => t.Id == request.Id.Value);
        }
        else if (!string.IsNullOrEmpty(request.Slug))
        {
            query = query.Where(t => t.Slug == request.Slug);
        }
        else
        {
            return null;
        }

        var geometry = await query
            .Select(t => t.GpxData)
            .FirstOrDefaultAsync(cancellationToken);

        if (geometry == null) return null;

        // Use GeoJsonWriter directly as it is more predictable for Z values than the Serializer/Converter combo.
        var writer = new NetTopologySuite.IO.GeoJsonWriter();
        
        // Ensure the writer is configured to include Z dimension
        // In NTS 2.x, GeoJsonWriter doesn't have a direct CoordinateDimension property like the old ones,
        // but it respects the geometry's dimensions if possible.
        
        // Log if we have Z coordinates
        var pointsWithZ = geometry.Coordinates.Count(c => !double.IsNaN(c.Z));
        
        var factory = new GeometryFactory(new PrecisionModel(), geometry.SRID);
        var serializer = NetTopologySuite.IO.GeoJsonSerializer.Create(new Newtonsoft.Json.JsonSerializerSettings(), factory);
        // Explicitly set the dimension to 3 in the converter
        serializer.Converters.Add(new NetTopologySuite.IO.Converters.GeometryConverter(factory, 3));
        
        using var stringWriter = new StringWriter();
        serializer.Serialize(stringWriter, geometry);
        var json = stringWriter.ToString();

        // Check if Z coordinates actually made it into the JSON
        // GeoJSON for 3D is [lon, lat, ele]. So a coordinate has 2 commas if it has Z.
        // We'll check if any coordinate in the JSON has 2 commas.
        bool jsonHasZ = json.Contains(",[") || (json.Count(f => f == ',') > geometry.Coordinates.Length * 2);
        
        if (pointsWithZ > 0 && !jsonHasZ)
        {
            Console.WriteLine($"[DEBUG_LOG] Warning: Serializer did not include Z despite {pointsWithZ} points having it. Trying fallback writer.");
            // Fallback: GeoJsonWriter might just work if we are lucky
            json = writer.Write(geometry);
        }

        Console.WriteLine($"[DEBUG_LOG] Geometry {request.Slug ?? request.Id.ToString()} has {geometry.Coordinates.Length} points. Points with Z: {pointsWithZ}");
        
        // Let's ensure the coordinates are actually treated as 3D if they have Z values.
        // If some points have Z but others don't, or if they are all 0, it might be an issue.
        if (pointsWithZ > 0)
        {
            Console.WriteLine($"[DEBUG_LOG] First 5 coordinates: {string.Join(", ", geometry.Coordinates.Take(5).Select(c => $"[{c.X}, {c.Y}, {c.Z}]"))}");
        }
        else
        {
             Console.WriteLine($"[DEBUG_LOG] No points with Z. Dimension: {geometry.Dimension}, GeometryType: {geometry.GeometryType}");
        }

        Console.WriteLine($"[DEBUG_LOG] GeoJSON output (first 200 chars): {json.Substring(0, Math.Min(200, json.Length))}");
        return json;
    }
}
