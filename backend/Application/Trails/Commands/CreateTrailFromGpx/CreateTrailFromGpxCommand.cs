using MediatR;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;
using System.Xml.Linq;

namespace Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;

public record CreateTrailFromGpxCommand(string? Name, string GpxXml) : IRequest<Guid>;

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
        var trail = ProcessGpx(request.Name, request.GpxXml);

        _context.Trails.Add(trail);
        await _context.SaveChangesWithAuditAsync("system"); // Could pass user if available
        
        return trail.Id;
    }

    public Trail ProcessGpx(string? name, string gpxXml)
    {
        XDocument doc;
        try
        {
            doc = XDocument.Parse(gpxXml);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Failed to parse GPX XML: {ex.Message}");
            throw new Exception("Invalid GPX XML format", ex);
        }
        XNamespace ns = doc.Root?.GetDefaultNamespace() ?? "http://www.topografix.com/GPX/1/1";

        // Try to extract name if not provided
        if (string.IsNullOrWhiteSpace(name))
        {
            var nameElement = doc.Descendants(ns + "metadata").Elements(ns + "name").FirstOrDefault()
                             ?? doc.Descendants(ns + "name").FirstOrDefault();
            name = nameElement?.Value?.Trim();
            
            if (string.IsNullOrWhiteSpace(name))
            {
                name = "Unnamed Trail";
            }
        }

        var points = doc.Descendants(ns + "trkpt")
            .Select(p => {
                var latStr = p.Attribute("lat")?.Value ?? "0";
                var lonStr = p.Attribute("lon")?.Value ?? "0";
                // Try getting ele with default namespace or any namespace
                var eleElement = p.Element(ns + "ele") ?? p.Elements().FirstOrDefault(e => e.Name.LocalName == "ele");
                var eleStr = eleElement?.Value ?? "0";
                
                if (!double.TryParse(latStr, System.Globalization.CultureInfo.InvariantCulture, out var lat)) lat = 0;
                if (!double.TryParse(lonStr, System.Globalization.CultureInfo.InvariantCulture, out var lon)) lon = 0;
                if (!double.TryParse(eleStr, System.Globalization.CultureInfo.InvariantCulture, out var ele)) ele = 0;

                return new
                {
                    Lat = lat,
                    Lon = lon,
                    Ele = ele
                };
            })
            .ToList();

        // Check for any ele elements regardless of where they are in the tree
        var totalEleInDoc = doc.Descendants().Count(e => e.Name.LocalName == "ele");
        Console.WriteLine($"[DEBUG_LOG] GPX parsing. Found {points.Count} trkpt points. Total <ele> elements in doc: {totalEleInDoc}");
        
        var pointsWithEle = points.Count(p => p.Ele != 0);
        Console.WriteLine($"[DEBUG_LOG] Points with non-zero elevation: {pointsWithEle}");

        if (points.Count == 0)
        {
            throw new Exception("No points found in GPX");
        }

        var coordinates = points.Select(p => new CoordinateZ(p.Lon, p.Lat, p.Ele)).ToArray();
        // Create LineString with Z dimension explicitly
        var lineString = _geometryFactory.CreateLineString(coordinates);
        
        // Log coordinates for verification
        Console.WriteLine($"[DEBUG_LOG] Created LineString with {coordinates.Length} points. Geometry Dimension: {lineString.Dimension}, HasZ: {lineString.Coordinates.Any(c => !double.IsNaN(c.Z))}");
        if (coordinates.Length > 0)
        {
            Console.WriteLine($"[DEBUG_LOG] First point: X={coordinates[0].X}, Y={coordinates[0].Y}, Z={coordinates[0].Z}");
            Console.WriteLine($"[DEBUG_LOG] Last point: X={coordinates[^1].X}, Y={coordinates[^1].Y}, Z={coordinates[^1].Z}");
        }
        
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
        
        Console.WriteLine($"[DEBUG_LOG] Calculated stats: Length={length:F2}m, Gain={gain:F2}m, Loss={loss:F2}m");

        // Force 3D if not already recognized by NTS as 3D
        if (lineString.Dimension < Dimension.Surface && !lineString.Coordinates.Any(c => !double.IsNaN(c.Z)))
        {
            Console.WriteLine("[DEBUG_LOG] Warning: LineString does not seem to have Z coordinates despite being created with CoordinateZ.");
        }

        // Generate slug - simple version for now
        string slug = name.ToLower()
            .Replace(" ", "-")
            .Replace("á", "a")
            .Replace("é", "e")
            .Replace("í", "i")
            .Replace("ó", "o")
            .Replace("ú", "u")
            .Replace("ý", "y")
            .Replace("þ", "th")
            .Replace("æ", "ae")
            .Replace("ö", "o")
            .Replace("ð", "d");
        
        // Remove other special characters
        slug = new string(slug.Where(c => char.IsLetterOrDigit(c) || c == '-').ToArray());

        return new Trail
        {
            Name = name,
            Slug = slug,
            GpxData = lineString,
            Length = length,
            ElevationGain = gain,
            ElevationLoss = loss,
            Status = TrailStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };
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
