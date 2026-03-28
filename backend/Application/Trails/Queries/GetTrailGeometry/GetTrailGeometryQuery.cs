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

        // Using NetTopologySuite GeoJsonWriter
        var writer = new NetTopologySuite.IO.GeoJsonWriter();
        
        // Ensure the writer includes Z if any coordinate has it
        // Note: NTS GeoJsonWriter should handle this automatically if geometry.HasZ is true,
        // but it doesn't hurt to check if there's a setting in newer NTS.
        
        // Log if we have Z coordinates
        var pointsWithZ = geometry.Coordinates.Count(c => !double.IsNaN(c.Z));
        Console.WriteLine($"[DEBUG_LOG] Geometry {request.Slug} has {geometry.Coordinates.Length} points. Points with Z: {pointsWithZ}");
        
        // If we have points but none have Z, and we expect them to, this is where the issue lies.
        
        return writer.Write(geometry);
    }
}
