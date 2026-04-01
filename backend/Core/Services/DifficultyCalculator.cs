using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Core.Services;

/// <summary>
/// Calculates trail difficulty based on distance, elevation gain, and activity type.
/// Uses an "effort distance" formula: effort_km = distance_km + (elevationGain_m / 100).
/// Thresholds are tuned per activity type.
/// </summary>
public static class DifficultyCalculator
{
    /// <summary>
    /// Calculate difficulty from raw trail stats.
    /// </summary>
    public static Difficulty Calculate(double lengthMeters, double elevationGainMeters, ActivityType activityType)
    {
        var distanceKm = lengthMeters / 1000.0;
        var effortKm = distanceKm + (elevationGainMeters / 100.0);

        return activityType switch
        {
            ActivityType.TrailRunning => FromEffort(effortKm, trailRunningThresholds),
            ActivityType.Running      => FromDistance(distanceKm, roadRunningThresholds),
            ActivityType.Hiking       => FromEffort(effortKm, hikingThresholds),
            ActivityType.Cycling      => FromEffort(effortKm, cyclingThresholds),
            _                         => FromEffort(effortKm, trailRunningThresholds),
        };
    }

    /// <summary>
    /// Calculate difficulty from a Trail entity.
    /// </summary>
    public static Difficulty Calculate(Trail trail)
        => Calculate(trail.Length, trail.ElevationGain, trail.ActivityTypeId);

    // Thresholds: [Easy ceiling, Moderate ceiling, Hard ceiling, Expert ceiling]
    // Anything above Expert ceiling = Extreme

    // Trail Running — elevation matters a lot, ultra distances for Expert/Extreme
    private static readonly double[] trailRunningThresholds = [12, 25, 50, 90];

    // Road Running — primarily distance-based (half, full, ultra, 100k+)
    private static readonly double[] roadRunningThresholds = [10, 21, 42, 100];

    // Hiking — slower pace, effort thresholds are lower
    private static readonly double[] hikingThresholds = [8, 16, 30, 55];

    // Cycling — much longer distances are normal, elevation still contributes
    private static readonly double[] cyclingThresholds = [30, 70, 140, 250];

    private static Difficulty FromEffort(double effortKm, double[] thresholds)
    {
        if (effortKm < thresholds[0]) return Difficulty.Easy;
        if (effortKm < thresholds[1]) return Difficulty.Moderate;
        if (effortKm < thresholds[2]) return Difficulty.Hard;
        if (effortKm < thresholds[3]) return Difficulty.Expert;
        return Difficulty.Extreme;
    }

    private static Difficulty FromDistance(double distanceKm, double[] thresholds)
    {
        if (distanceKm < thresholds[0]) return Difficulty.Easy;
        if (distanceKm < thresholds[1]) return Difficulty.Moderate;
        if (distanceKm < thresholds[2]) return Difficulty.Hard;
        if (distanceKm < thresholds[3]) return Difficulty.Expert;
        return Difficulty.Extreme;
    }
}
