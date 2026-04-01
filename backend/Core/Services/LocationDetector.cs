using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Core.Services;

public record DetectedLocation(Guid Id, string Name, string Type, double DistanceMeters);

public class LocationDetector
{
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
        var locations = await _context.Locations
            .AsNoTracking()
            .Where(l => l.Center != null && l.Radius != null && l.Radius > 0)
            .Select(l => new { l.Id, l.Name, l.Type, CenterY = l.Center!.Y, CenterX = l.Center!.X, Radius = l.Radius!.Value })
            .ToListAsync(ct);

        return locations
            .Select(l => new { l.Id, l.Name, l.Type, Distance = HaversineMeters(lat, lng, l.CenterY, l.CenterX), l.Radius })
            .Where(l => l.Distance <= l.Radius)
            .OrderBy(l => l.Distance)
            .Select(l => new DetectedLocation(l.Id, l.Name, l.Type.ToString(), Math.Round(l.Distance, 0)))
            .ToList();
    }

    /// <summary>
    /// Auto-link a trail to all detected locations, creating TrailLocation entries with BelongsTo role.
    /// Returns the list of detected locations.
    /// </summary>
    public async Task<List<DetectedLocation>> DetectAndLinkAsync(
        Trail trail, CancellationToken ct = default)
    {
        if (trail.GpxData == null || trail.GpxData.Coordinates.Length == 0)
            return [];

        var startPoint = trail.GpxData.Coordinates[0];
        var detected = await DetectLocationsAsync(startPoint.Y, startPoint.X, ct);

        foreach (var loc in detected)
        {
            // Avoid duplicates if somehow already linked
            var exists = await _context.TrailLocations
                .AnyAsync(tl => tl.TrailId == trail.Id && tl.LocationId == loc.Id, ct);

            if (!exists)
            {
                _context.TrailLocations.Add(new TrailLocation
                {
                    TrailId = trail.Id,
                    LocationId = loc.Id,
                    Role = TrailLocationRole.BelongsTo,
                    Order = 0
                });
            }
        }

        return detected;
    }

    private static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
