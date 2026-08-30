using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Services;

// See MountainIndexClassifier's doc comment: this is the single source of truth for terrain
// classification, called by both the persisting detect-terrain-types endpoint and the
// classify-terrain preview endpoint (backend/Program.cs) — there is no second copy of these
// thresholds anywhere else in the backend.
public class MountainIndexClassifierTests
{
    // ─── Rule 1: ratio < 20 → Flat, regardless of altitude ───

    [Theory]
    [InlineData(10000, 100, 300)]   // ratio 10
    [InlineData(10000, 199, 900)]   // ratio 19.9, high altitude doesn't rescue it
    public void Classify_LowRatio_ReturnsFlat(double lengthM, double gainM, double maxAlt)
    {
        Assert.Equal(TerrainType.Flat, MountainIndexClassifier.Classify(lengthM, gainM, maxAlt));
    }

    [Fact]
    public void Classify_RatioAtFlatBoundary_IsNotFlat()
    {
        // Exactly 20 m/km — boundary belongs to the next rule, not Flat.
        var result = MountainIndexClassifier.Classify(10000, 200, 300);
        Assert.NotEqual(TerrainType.Flat, result);
    }

    // ─── Rule 2: maxAlt > 600 && ratio >= 30 → Mountainous ───

    [Fact]
    public void Classify_HighAltitudeAndModerateRatio_ReturnsMountainous()
    {
        // 10 km, 300 m gain → ratio 30, max alt 601
        Assert.Equal(TerrainType.Mountainous, MountainIndexClassifier.Classify(10000, 300, 601));
    }

    [Fact]
    public void Classify_HighAltitudeButRatioBelow30_IsNotPromotedByAltitudeRule()
    {
        // ratio 29, max alt 700 — fails the altitude rule; still Hilly unless another rule fires
        var result = MountainIndexClassifier.Classify(10000, 290, 700);
        Assert.Equal(TerrainType.Hilly, result);
    }

    [Fact]
    public void Classify_AltitudeExactly600_DoesNotQualifyForHighAltitudeRule()
    {
        // maxAlt must be > 600, not >= 600
        var result = MountainIndexClassifier.Classify(10000, 300, 600);
        Assert.Equal(TerrainType.Hilly, result);
    }

    // ─── Rule 3: ratio >= 50 → Mountainous at ANY altitude (this is the rule the old code broke) ───

    [Fact]
    public void Classify_SteepRatio_ReturnsMountainous_EvenAtLowAltitude()
    {
        // Old code had `maxAltitude < 400 → Hilly` short-circuit before this check — removed.
        var result = MountainIndexClassifier.Classify(10000, 500, 100); // ratio 50, max alt 100
        Assert.Equal(TerrainType.Mountainous, result);
    }

    [Fact]
    public void Classify_RatioJustBelow50_IsNotPromotedBySteepRule()
    {
        var result = MountainIndexClassifier.Classify(10000, 499, 100); // ratio 49.9
        Assert.Equal(TerrainType.Hilly, result);
    }

    // ─── Rule 4 (new): total elevation gain >= 600 m → Mountainous, regardless of ratio/altitude ───

    [Fact]
    public void Classify_HighGainLowRatio_ReturnsMountainous()
    {
        // 25 km, 600 m gain → ratio 24 (would be Hilly on ratio/altitude alone — too low for the
        // steep-ratio or high-altitude rules) but the absolute gain rule promotes it. Ratio must
        // stay >= the Flat threshold (20) or the Flat rule fires first, per the documented rule order.
        var result = MountainIndexClassifier.Classify(25000, 600, 300);
        Assert.Equal(TerrainType.Mountainous, result);
    }

    [Fact]
    public void Classify_GainJustBelowThreshold_IsNotPromotedByGainRule()
    {
        // 25 km, 599 m gain → ratio ~24, below every other rule too
        var result = MountainIndexClassifier.Classify(25000, 599, 300);
        Assert.Equal(TerrainType.Hilly, result);
    }

    // ─── Named real-trail examples from issue #467 ───

    [Fact]
    public void Classify_AusturUltra_ReturnsMountainous_ViaGainRule()
    {
        // 16.6 km / 634 m gain / 270 m max altitude — ratio ~38, never rescued by any
        // altitude-based rule, but total climbing alone should promote it.
        var result = MountainIndexClassifier.Classify(16600, 634, 270);
        Assert.Equal(TerrainType.Mountainous, result);
    }

    [Fact]
    public void Classify_Myrdalshlaupid_ReturnsMountainous_ViaRatioRule()
    {
        // 10 km, ratio 52, max altitude 229 m — Hilly under the old maxAltitude < 400
        // short-circuit; Mountainous once that short-circuit is removed, matching the FAQ.
        var result = MountainIndexClassifier.Classify(10000, 520, 229);
        Assert.Equal(TerrainType.Mountainous, result);
    }

    [Fact]
    public void Classify_TypicalFellRun_ReturnsHilly()
    {
        // ~5 km / ~250 m gain / ~290 m max altitude — ratio 50, borderline. Correct today
        // and must remain correct: it is genuinely a short, steep hill, not a mountain.
        // Kept just under the steep-ratio threshold to stay Hilly.
        var result = MountainIndexClassifier.Classify(5000, 240, 290);
        Assert.Equal(TerrainType.Hilly, result);
    }
}
