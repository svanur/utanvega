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
            ActivityType.TrailRunning    => FromEffort(effortKm, TrailRunningThresholds),
            ActivityType.Running         => FromDistance(distanceKm, RoadRunningThresholds),
            ActivityType.Hiking          => FromEffort(effortKm, HikingThresholds),
            ActivityType.Cycling         => FromEffort(effortKm, CyclingThresholds),
            ActivityType.FunRun          => FromDistance(distanceKm, funRunThresholds),
            ActivityType.ObstacleCourse  => FromDistance(distanceKm, obstacleCourseThresholds),
            _                            => FromEffort(effortKm, TrailRunningThresholds),
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
    private static readonly double[] TrailRunningThresholds = [12, 25, 50, 90];

    // Road Running — primarily distance-based (half, full, ultra, 100k+)
    private static readonly double[] RoadRunningThresholds = [10, 21, 42, 100];

    // Hiking — slower pace, effort thresholds are lower
    private static readonly double[] HikingThresholds = [8, 16, 30, 55];

    // Cycling — much longer distances are normal, elevation still contributes
    private static readonly double[] CyclingThresholds = [30, 70, 140, 250];

    // Fun Run — casual events, lower distance thresholds than road running
    private static readonly double[] funRunThresholds = [5, 10, 15, 30];

    // Obstacle Course — obstacles multiply difficulty, short distances are already hard
    private static readonly double[] obstacleCourseThresholds = [5, 10, 18, 30];

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
