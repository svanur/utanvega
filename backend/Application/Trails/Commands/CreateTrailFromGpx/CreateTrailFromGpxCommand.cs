using MediatR;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;

namespace Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;

public record CreateTrailFromGpxResult(Guid Id, string Slug, string Name, List<TrailSimilarityMatch> Matches, List<DetectedLocationResult> DetectedLocations);

public record TrailSimilarityMatch(Guid TrailId, string TrailName, double MatchPercentage);

public record DetectedLocationResult(Guid Id, string Name, string Type, double DistanceMeters);

public record CreateTrailFromGpxCommand(string? Name, string GpxXml) : IRequest<CreateTrailFromGpxResult>;

public class CreateTrailFromGpxCommandHandler : IRequestHandler<CreateTrailFromGpxCommand, CreateTrailFromGpxResult>
{
    private readonly UtanvegaDbContext _context;
    private readonly GeometryFactory _geometryFactory;
    private readonly LocationDetector _locationDetector;

    public CreateTrailFromGpxCommandHandler(UtanvegaDbContext context, LocationDetector locationDetector)
    {
        _context = context;
        _locationDetector = locationDetector;
        // DotSpatialAffineCoordinateSequenceFactory may include M (Measure) dimension, which PostGIS column (LineStringZ) rejects.
        // We use CoordinateArraySequenceFactory for standard XYZ support.
        _geometryFactory = new GeometryFactory(new PrecisionModel(), 4326); // WGS 84, default factory uses CoordinateArraySequenceFactory
    }

    public async Task<CreateTrailFromGpxResult> Handle(CreateTrailFromGpxCommand request, CancellationToken cancellationToken)
    {
        var trail = ProcessGpx(request.Name, request.GpxXml);

        var matches = await CheckSimilarityAsync(trail, cancellationToken);

        // Ensure slug is unique
        while (await _context.Trails.AnyAsync(t => t.Slug == trail.Slug, cancellationToken))
        {
            trail.Slug += "-" + Guid.NewGuid().ToString()[..4];
        }

        _context.Trails.Add(trail);

        // Auto-detect and link locations based on trail start point
        var detectedLocations = await _locationDetector.DetectAndLinkAsync(trail, cancellationToken);

        await _context.SaveChangesWithAuditAsync("system");
        
        return new CreateTrailFromGpxResult(
            trail.Id, trail.Slug, trail.Name, matches,
            detectedLocations.Select(d => new DetectedLocationResult(d.Id, d.Name, d.Type, d.DistanceMeters)).ToList()
        );
    }

    public async Task<List<TrailSimilarityMatch>> CheckSimilarityAsync(Trail trail, CancellationToken cancellationToken)
    {
        var matches = new List<TrailSimilarityMatch>();
        
        if (trail.GpxData == null) return matches;

        // Simple buffer-based overlap check
        // We'll consider a trail a match if it's within 20 meters of the new trail
        // This is a rough estimation of "part of this trail exists"
        // Note: 0.0002 is approx 20m in degrees. For better precision, use ST_Transform to a local SRID or use geography.
        var buffer = trail.GpxData.Buffer(0.0002); 
        
        var trailLength = trail.GpxData.Length;
        Console.WriteLine($"[DEBUG_LOG] Similarity check for '{trail.Name}'. New Trail GpxData Length: {trailLength:F6}");
        
        if (trailLength > 0)
        {
            var existingTrails = await _context.Trails
                .Where(t => t.GpxData != null && t.GpxData.Intersects(buffer))
                .Select(t => new { t.Id, t.Name, t.GpxData })
                .ToListAsync(cancellationToken);

            Console.WriteLine($"[DEBUG_LOG] Found {existingTrails.Count} existing trails intersecting with buffer.");

            foreach (var existing in existingTrails)
            {
                if (existing.GpxData == null) continue;

                // Calculate overlap percentage
                // Intersection(existing, buffer) / trail.GpxData.Length (percentage of NEW trail that's in existing)
                var intersection = existing.GpxData.Intersection(buffer);
                var matchPercentage = (intersection.Length / trailLength) * 100;

                Console.WriteLine($"[DEBUG_LOG] Candidate '{existing.Name}': Intersection Length: {intersection.Length:F6}, Match: {matchPercentage:F1}%");

                if (matchPercentage > 5) // Threshold to report match
                {
                    matches.Add(new TrailSimilarityMatch(
                        existing.Id,
                        existing.Name,
                        Math.Round(matchPercentage, 0)
                    ));
                }
            }
        }

        return matches;
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
        // Create LineString with Z dimension explicitly. CoordinateZ ensures XYZ.
        // We use a factory that we know handles Z.
        var lineString = _geometryFactory.CreateLineString(coordinates);
        
        // Final check: if the geometry created doesn't have Z despite CoordinateZ being used,
        // it might be the factory's sequence factory. But we checked that.
        // Let's ensure NTS treats it as 3D.
        if (lineString.Coordinates.Length > 0 && double.IsNaN(lineString.Coordinates[0].Z))
        {
             Console.WriteLine("[DEBUG_LOG] CRITICAL: Created LineString has NaN for Z! Points might be lost.");
        }
        
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

        var slug = SlugGenerator.Generate(name);

        return new Trail
        {
            Name = name,
            Slug = slug,
            GpxData = lineString,
            Length = length,
            ElevationGain = gain,
            ElevationLoss = loss,
            Difficulty = DifficultyCalculator.Calculate(length, gain, ActivityType.TrailRunning),
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
