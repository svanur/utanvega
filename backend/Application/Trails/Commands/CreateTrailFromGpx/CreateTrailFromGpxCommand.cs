using MediatR;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;
using System.Xml.Linq;

namespace Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;

public record CreateTrailFromGpxCommand(string Name, string GpxXml) : IRequest<Guid>;

public class CreateTrailFromGpxCommandHandler : IRequestHandler<CreateTrailFromGpxCommand, Guid>
{
    private readonly UtanvegaDbContext _context;
    private readonly GeometryFactory _geometryFactory;

    public CreateTrailFromGpxCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
        _geometryFactory = new GeometryFactory(new PrecisionModel(), 4326); // WGS 84
    }

    public async Task<Guid> Handle(CreateTrailFromGpxCommand request, CancellationToken cancellationToken)
    {
        var doc = XDocument.Parse(request.GpxXml);
        XNamespace ns = doc.Root?.GetDefaultNamespace() ?? "http://www.topografix.com/GPX/1/1";

        var points = doc.Descendants(ns + "trkpt")
            .Select(p => new
            {
                Lat = double.Parse(p.Attribute("lat")?.Value ?? "0", System.Globalization.CultureInfo.InvariantCulture),
                Lon = double.Parse(p.Attribute("lon")?.Value ?? "0", System.Globalization.CultureInfo.InvariantCulture),
                Ele = double.Parse(p.Element(ns + "ele")?.Value ?? "0", System.Globalization.CultureInfo.InvariantCulture)
            })
            .ToList();

        if (points.Count == 0)
        {
            throw new Exception("No points found in GPX");
        }

        var coordinates = points.Select(p => new Coordinate(p.Lon, p.Lat)).ToArray();
        var lineString = _geometryFactory.CreateLineString(coordinates);

        // Basic calculation for Length and Elevation
        double length = 0;
        double gain = 0;
        double loss = 0;

        for (var i = 1; i < points.Count; i++)
        {
            var p1 = points[i - 1];
            var p2 = points[i];

            // Use Haversine or simple Euclidean for length (Simplified for now)
            length += CalculateDistance(p1.Lat, p1.Lon, p2.Lat, p2.Lon);

            var diff = p2.Ele - p1.Ele;
            if (diff > 0) gain += diff;
            else loss += Math.Abs(diff);
        }

        var trail = new Trail
        {
            Name = request.Name,
            Slug = request.Name.ToLower().Replace(" ", "-"), // Basic slugification
            GpxData = lineString,
            Length = length,
            ElevationGain = gain,
            ElevationLoss = loss,
            Status = TrailStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };

        _context.Trails.Add(trail);
        await _context.SaveChangesWithAuditAsync("system"); // Could pass user if available
        
        return trail.Id;
    }

    private static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        var d1 = lat1 * (Math.PI / 180.0);
        var num1 = lon1 * (Math.PI / 180.0);
        var d2 = lat2 * (Math.PI / 180.0);
        var num2 = lon2 * (Math.PI / 180.0) - num1;
        var d3 = Math.Pow(Math.Sin((d2 - d1) / 2.0), 2.0) + Math.Cos(d1) * Math.Cos(d2) * Math.Pow(Math.Sin(num2 / 2.0), 2.0);
        return 6371000.0 * (2.0 * Math.Atan2(Math.Sqrt(d3), Math.Sqrt(1.0 - d3)));
    }
}
