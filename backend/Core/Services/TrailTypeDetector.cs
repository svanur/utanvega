using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Core.Services;

/// <summary>
/// Detects trail type (Loop, OutAndBack, PointToPoint) from GPX geometry.
/// Uses start/end proximity and path-overlap analysis.
/// </summary>
public static class TrailTypeDetector
{
    // If start-end distance exceeds this fraction of total length → PointToPoint
    private const double PointToPointThreshold = 0.15;

    // Number of evenly-spaced sample points for overlap analysis
    private const int OverlapSamples = 20;

    // If median nearest-neighbor distance (between first/second half) is below
    // this fraction of total length → OutAndBack; otherwise → Loop
    private const double OverlapFractionThreshold = 0.05;

    // Absolute minimum overlap distance (meters) to avoid false positives on very short trails
    private const double MinOverlapDistanceMeters = 80;

    /// <summary>
    /// Detect trail type from the LineString geometry and pre-calculated trail length in meters.
    /// </summary>
    public static TrailType Detect(Geometry? gpxData, double totalLengthMeters)
    {
        if (gpxData is null || gpxData.Coordinates.Length < 4)
            return TrailType.Loop;

        var coords = gpxData.Coordinates;
        var start = coords[0];
        var end = coords[^1];

        var startEndDistance = HaversineMeters(start.Y, start.X, end.Y, end.X);

        // Far apart → Point to Point
        if (startEndDistance > totalLengthMeters * PointToPointThreshold)
            return TrailType.PointToPoint;

        // Start and end are close — distinguish Loop from OutAndBack
        // by checking how much the first half overlaps with the second half
        var medianDistance = CalculatePathOverlap(coords);

        var threshold = Math.Max(MinOverlapDistanceMeters, totalLengthMeters * OverlapFractionThreshold);

        return medianDistance < threshold ? TrailType.OutAndBack : TrailType.Loop;
    }

    /// <summary>
    /// Convenience overload that works directly on a Trail entity.
    /// </summary>
    public static TrailType Detect(Trail trail)
        => Detect(trail.GpxData, trail.Length);

    /// <summary>
    /// Samples points from the first half of the trail and finds their nearest
    /// neighbor in the second half (reversed). Returns the median distance in meters.
    /// Low median → high overlap → OutAndBack.
    /// </summary>
    private static double CalculatePathOverlap(Coordinate[] coords)
    {
        var midIndex = coords.Length / 2;

        // First half: coords[0..midIndex]
        var firstHalf = coords[..midIndex];
        // Second half reversed: coords[midIndex..end] reversed — so it "runs back" from end to mid
        var secondHalf = coords[midIndex..];
        Array.Reverse(secondHalf);

        if (firstHalf.Length < 2 || secondHalf.Length < 2)
            return double.MaxValue;

        // Sample evenly-spaced indices from the first half
        var sampleCount = Math.Min(OverlapSamples, firstHalf.Length);
        var distances = new double[sampleCount];

        for (var i = 0; i < sampleCount; i++)
        {
            var idx = (int)((long)i * (firstHalf.Length - 1) / (sampleCount - 1));
            var point = firstHalf[idx];

            // Find nearest point in second half
            var minDist = double.MaxValue;
            foreach (var candidate in secondHalf)
            {
                var dist = HaversineMeters(point.Y, point.X, candidate.Y, candidate.X);
                if (dist < minDist) minDist = dist;
            }

            distances[i] = minDist;
        }

        // Return the median
        Array.Sort(distances);
        return distances[distances.Length / 2];
    }

    private static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000.0;
        var dLat = (lat2 - lat1) * (Math.PI / 180.0);
        var dLon = (lon2 - lon1) * (Math.PI / 180.0);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2.0 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1.0 - a));
    }
}
