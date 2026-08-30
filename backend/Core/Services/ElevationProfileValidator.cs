using System.Diagnostics.CodeAnalysis;

namespace Utanvega.Backend.Core.Services;

/// <summary>
/// Distinguishes a real elevation profile from a degenerate one — null/empty, all-zero, or
/// with fewer than 2 distinct sampled values. Real GPS/barometric elevation data almost never
/// repeats the exact same value across every sample, so a constant (or all-zero) profile is a
/// reliable signal that elevation was never actually captured for the trail.
///
/// Shared by the backfill-elevation-profiles and detect-terrain-types admin endpoints so a
/// degenerate profile is never stored, and never silently read back as a real MaxAltitude of 0.
/// </summary>
public static class ElevationProfileValidator
{
    /// <summary>
    /// True when <paramref name="elevationProfile"/> cannot represent genuine elevation data:
    /// null, empty, all-zero, or fewer than 2 distinct values.
    /// </summary>
    public static bool IsDegenerate([NotNullWhen(false)] double[]? elevationProfile)
    {
        if (elevationProfile == null || elevationProfile.Length == 0)
            return true;

        if (elevationProfile.All(z => z == 0))
            return true;

        return elevationProfile.Distinct().Count() < 2;
    }

    /// <summary>
    /// The highest sampled elevation, or null if the profile is degenerate (see <see cref="IsDegenerate"/>).
    /// </summary>
    public static double? GetMaxAltitude(double[]? elevationProfile) =>
        IsDegenerate(elevationProfile) ? null : elevationProfile.Max();
}
