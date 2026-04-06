using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Core.Services;

public record DetectedLocation(Guid Id, string Name, string Type, double DistanceMeters);

public record DetectedLocationWithRole(
    Guid Id, string Name, string Type, TrailLocationRole Role, double DistanceMeters);

public class LocationDetector
{
    private const int SampleCount = 12;
    private readonly UtanvegaDbContext _context;

    public LocationDetector(UtanvegaDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Find all locations whose center is within their radius of the given point.
    /// Returns matches sorted by distance (closest first).
    /// </summary>
    public async Task<List<DetectedLocation>> DetectLocationsAsync(
        double lat, double lng, CancellationToken ct = default)
    {
        var locations = await GetAllLocationCenters(ct);

        return locations
            .Select(l => new { l.Id, l.Name, l.Type, Distance = HaversineMeters(lat, lng, l.CenterY, l.CenterX), l.Radius })
            .Where(l => l.Distance <= l.Radius)
            .OrderBy(l => l.Distance)
            .Select(l => new DetectedLocation(l.Id, l.Name, l.Type.ToString(), Math.Round(l.Distance, 0)))
            .ToList();
    }

    /// <summary>
    /// Sample points along the entire GPX route and detect locations with role assignment.
    /// Roles: BelongsTo (≥50% of samples), Start (first point), End (last point), PassingThrough (rest).
    /// </summary>
    public async Task<List<DetectedLocationWithRole>> DetectAlongRouteAsync(
        Trail trail, CancellationToken ct = default)
    {
        if (trail.GpxData == null || trail.GpxData.Coordinates.Length == 0)
            return [];

        var coords = trail.GpxData.Coordinates;
        var samplePoints = SampleRoute(coords, SampleCount);
        var locations = await GetAllLocationCenters(ct);

        // For each sample point, find which locations contain it
        var locationHits = new Dictionary<Guid, LocationHitInfo>();

        for (int i = 0; i < samplePoints.Count; i++)
        {
            var (lat, lng) = samplePoints[i];
            var hits = locations
                .Select(l => new { l.Id, l.Name, l.Type, Distance = HaversineMeters(lat, lng, l.CenterY, l.CenterX), l.Radius })
                .Where(l => l.Distance <= l.Radius);

            foreach (var hit in hits)
            {
                if (!locationHits.TryGetValue(hit.Id, out var info))
                {
                    info = new LocationHitInfo(hit.Id, hit.Name, hit.Type.ToString(), hit.Distance);
                    locationHits[hit.Id] = info;
                }
                info.SampleIndices.Add(i);
                if (hit.Distance < info.MinDistance)
                    info.MinDistance = hit.Distance;
            }
        }

        if (locationHits.Count == 0)
            return [];

        int lastIndex = samplePoints.Count - 1;
        var results = new List<DetectedLocationWithRole>();

        foreach (var (id, info) in locationHits)
        {
            double hitRatio = (double)info.SampleIndices.Count / samplePoints.Count;
            bool isAtStart = info.SampleIndices.Contains(0);
            bool isAtEnd = info.SampleIndices.Contains(lastIndex);

            TrailLocationRole role;
            if (hitRatio >= 0.5)
                role = TrailLocationRole.BelongsTo;
            else if (isAtStart && isAtEnd)
                role = TrailLocationRole.BelongsTo;
            else if (isAtStart)
                role = TrailLocationRole.Start;
            else if (isAtEnd)
                role = TrailLocationRole.End;
            else
                role = TrailLocationRole.PassingThrough;

            results.Add(new DetectedLocationWithRole(
                info.Id, info.Name, info.Type, role, Math.Round(info.MinDistance, 0)));
        }

        return results.OrderBy(r => r.Role).ThenBy(r => r.DistanceMeters).ToList();
    }

    /// <summary>
    /// Auto-link a trail to all detected locations using route sampling for smarter role assignment.
    /// Replaces any existing auto-detected links. Returns the detected locations with roles.
    /// </summary>
    public async Task<List<DetectedLocationWithRole>> DetectAndLinkAsync(
        Trail trail, CancellationToken ct = default)
    {
        var detected = await DetectAlongRouteAsync(trail, ct);

        int order = 0;
        foreach (var loc in detected)
        {
            var exists = await _context.TrailLocations
                .AnyAsync(tl => tl.TrailId == trail.Id && tl.LocationId == loc.Id, ct);

            if (!exists)
            {
                _context.TrailLocations.Add(new TrailLocation
                {
                    TrailId = trail.Id,
                    LocationId = loc.Id,
                    Role = loc.Role,
                    Order = order++
                });
            }
        }

        return detected;
    }

    /// <summary>
    /// Re-detect and update location links for a trail, removing old auto-links and creating new ones.
    /// </summary>
    public async Task<List<DetectedLocationWithRole>> RedetectAndRelinkAsync(
        Trail trail, CancellationToken ct = default)
    {
        // Remove existing links
        var existingLinks = await _context.TrailLocations
            .Where(tl => tl.TrailId == trail.Id)
            .ToListAsync(ct);
        _context.TrailLocations.RemoveRange(existingLinks);

        var detected = await DetectAlongRouteAsync(trail, ct);

        int order = 0;
        foreach (var loc in detected)
        {
            _context.TrailLocations.Add(new TrailLocation
            {
                TrailId = trail.Id,
                LocationId = loc.Id,
                Role = loc.Role,
                Order = order++
            });
        }

        return detected;
    }

    /// <summary>
    /// Sample N evenly-spaced points along a coordinate array.
    /// Always includes the first and last points.
    /// </summary>
    internal static List<(double Lat, double Lng)> SampleRoute(
        NetTopologySuite.Geometries.Coordinate[] coords, int count)
    {
        if (coords.Length <= count)
            return coords.Select(c => (c.Y, c.X)).ToList();

        var points = new List<(double Lat, double Lng)>(count);
        for (int i = 0; i < count; i++)
        {
            int idx = (int)Math.Round((double)i * (coords.Length - 1) / (count - 1));
            points.Add((coords[idx].Y, coords[idx].X));
        }
        return points;
    }

    internal static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private async Task<List<LocationCenter>> GetAllLocationCenters(CancellationToken ct)
    {
        return await _context.Locations
            .AsNoTracking()
            .Where(l => l.Center != null && l.Radius != null && l.Radius > 0)
            .Select(l => new LocationCenter(l.Id, l.Name, l.Type, l.Center!.Y, l.Center!.X, l.Radius!.Value))
            .ToListAsync(ct);
    }

    private record LocationCenter(Guid Id, string Name, LocationType Type, double CenterY, double CenterX, double Radius);

    private class LocationHitInfo
    {
        public Guid Id { get; }
        public string Name { get; }
        public string Type { get; }
        public double MinDistance { get; set; }
        public HashSet<int> SampleIndices { get; } = [];

        public LocationHitInfo(Guid id, string name, string type, double distance)
        {
            Id = id;
            Name = name;
            Type = type;
            MinDistance = distance;
        }
    }
}
