using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

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

        // NetTopologySuite's GeoJsonWriter needs to be explicitly told to include Z if it exists.
        // We use the Write method that takes an IGeometry and provides options if available,
        // or ensure the writer handles the dimension properly.
        var writer = new NetTopologySuite.IO.GeoJsonWriter();
        
        // Log if we have Z coordinates
        var pointsWithZ = geometry.Coordinates.Count(c => !double.IsNaN(c.Z));
        
        // Use a serializer with a geometry factory that explicitly handles Z.
        var factory = NetTopologySuite.NtsGeometryServices.Instance.CreateGeometryFactory(geometry.SRID);
        var serializer = NetTopologySuite.IO.GeoJsonSerializer.Create(new Newtonsoft.Json.JsonSerializerSettings(), factory);
        
        // Ensure the serializer includes the Z dimension.
        serializer.Converters.Add(new NetTopologySuite.IO.Converters.GeometryConverter(factory, 3));
        
        using var stringWriter = new StringWriter();
        serializer.Serialize(stringWriter, geometry);
        var json = stringWriter.ToString();

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
