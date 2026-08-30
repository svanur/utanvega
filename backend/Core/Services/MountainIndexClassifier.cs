using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Core.Services;

/// <summary>
/// Classifies a trail's terrain ("Mountain Index") from its raw stats — climb ratio, maximum
/// altitude, and total elevation gain. High-latitude (Iceland) thresholds: east-fjord trails in
/// particular climb hard from sea level without ever reaching high absolute altitude, so total
/// gain is treated as an independent signal alongside the altitude/ratio rules.
///
/// This is the single source of truth for terrain classification — both the persisting
/// `detect-terrain-types` admin endpoint and the `classify-terrain` preview endpoint (used by the
/// admin UI's Auto suggest button, which may be classifying an unsaved edit) call this class
/// rather than reimplementing the thresholds. The FAQ text in `frontend/i18n/en.json` /
/// `is.json` (`faq.terrainType.a`) must describe these exact thresholds — see
/// `MountainIndexClassifierTests.FaqThresholds_MatchCodeThresholds` for the test that keeps them
/// in sync.
/// </summary>
public static class MountainIndexClassifier
{
    /// <summary>Below this climb ratio (m gain per km), a trail is always Flat.</summary>
    public const double FlatRatioThreshold = 20;

    /// <summary>Above this altitude, a moderate climb ratio is enough to promote to Mountainous.</summary>
    public const double HighAltitudeThreshold = 600;

    /// <summary>Climb ratio required for the high-altitude promotion above <see cref="HighAltitudeThreshold"/>.</summary>
    public const double HighAltitudeRatioThreshold = 30;

    /// <summary>Any trail climbing at or above this ratio is Mountainous, regardless of altitude.</summary>
    public const double SteepRatioThreshold = 50;

    /// <summary>
    /// Total elevation gain (metres) at or above which a trail is Mountainous regardless of
    /// ratio or altitude — catches long, heavy-climbing trails (e.g. Austur Ultra) that dilute
    /// to a low ratio over distance without ever reaching high absolute altitude.
    /// </summary>
    public const double GainThreshold = 600;

    /// <summary>
    /// Classifies a trail from its raw stats.
    /// </summary>
    /// <param name="lengthMeters">Trail length in metres.</param>
    /// <param name="elevationGainMeters">Total elevation gain in metres.</param>
    /// <param name="maxAltitudeMeters">Highest sampled elevation in metres above sea level.</param>
    public static TerrainType Classify(double lengthMeters, double elevationGainMeters, double maxAltitudeMeters)
    {
        var climbRatio = elevationGainMeters / (lengthMeters / 1000.0);

        if (climbRatio < FlatRatioThreshold)
            return TerrainType.Flat;

        if (maxAltitudeMeters > HighAltitudeThreshold && climbRatio >= HighAltitudeRatioThreshold)
            return TerrainType.Mountainous;

        if (climbRatio >= SteepRatioThreshold)
            return TerrainType.Mountainous;

        if (elevationGainMeters >= GainThreshold)
            return TerrainType.Mountainous;

        return TerrainType.Hilly;
    }
}
