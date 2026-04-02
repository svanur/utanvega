using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Services;

public class DifficultyCalculatorTests
{
    // ─── Trail Running thresholds: [12, 25, 50, 90] effort km ───

    [Theory]
    [InlineData(5000, 0, ActivityType.TrailRunning, Difficulty.Easy)]       // 5 km effort
    [InlineData(11000, 100, ActivityType.TrailRunning, Difficulty.Moderate)]  // 11 + 1 = 12, at boundary → Moderate
    [InlineData(12000, 0, ActivityType.TrailRunning, Difficulty.Moderate)]  // exactly 12 effort
    [InlineData(20000, 300, ActivityType.TrailRunning, Difficulty.Moderate)]// 20 + 3 = 23
    [InlineData(25000, 0, ActivityType.TrailRunning, Difficulty.Hard)]      // 25 effort
    [InlineData(40000, 500, ActivityType.TrailRunning, Difficulty.Hard)]    // 40 + 5 = 45
    [InlineData(50000, 0, ActivityType.TrailRunning, Difficulty.Expert)]    // 50 effort
    [InlineData(80000, 500, ActivityType.TrailRunning, Difficulty.Expert)]  // 80 + 5 = 85
    [InlineData(90000, 0, ActivityType.TrailRunning, Difficulty.Extreme)]   // 90 effort
    [InlineData(100000, 2000, ActivityType.TrailRunning, Difficulty.Extreme)]
    public void Calculate_TrailRunning_ReturnsExpectedDifficulty(
        double lengthM, double gainM, ActivityType activity, Difficulty expected)
    {
        Assert.Equal(expected, DifficultyCalculator.Calculate(lengthM, gainM, activity));
    }

    // ─── Road Running thresholds: [10, 21, 42, 100] distance km (no elevation) ───

    [Theory]
    [InlineData(5000, 0, Difficulty.Easy)]
    [InlineData(9999, 500, Difficulty.Easy)]        // elevation ignored for running
    [InlineData(10000, 0, Difficulty.Moderate)]
    [InlineData(21000, 0, Difficulty.Hard)]          // half marathon
    [InlineData(42000, 0, Difficulty.Expert)]         // full marathon
    [InlineData(100000, 0, Difficulty.Extreme)]       // ultra
    public void Calculate_Running_UsesDistanceOnly(
        double lengthM, double gainM, Difficulty expected)
    {
        Assert.Equal(expected, DifficultyCalculator.Calculate(lengthM, gainM, ActivityType.Running));
    }

    [Fact]
    public void Calculate_Running_IgnoresElevation()
    {
        // Same distance, different elevation → same difficulty
        var flat = DifficultyCalculator.Calculate(15000, 0, ActivityType.Running);
        var hilly = DifficultyCalculator.Calculate(15000, 2000, ActivityType.Running);
        Assert.Equal(flat, hilly);
    }

    // ─── Hiking thresholds: [8, 16, 30, 55] effort km ───

    [Theory]
    [InlineData(5000, 200, Difficulty.Easy)]       // 5 + 2 = 7
    [InlineData(8000, 0, Difficulty.Moderate)]      // 8 effort
    [InlineData(16000, 0, Difficulty.Hard)]          // 16 effort
    [InlineData(25000, 500, Difficulty.Expert)]       // 25 + 5 = 30, at boundary → Expert
    [InlineData(30000, 0, Difficulty.Expert)]        // 30 effort
    [InlineData(55000, 0, Difficulty.Extreme)]       // 55 effort
    public void Calculate_Hiking_ReturnsExpectedDifficulty(
        double lengthM, double gainM, Difficulty expected)
    {
        Assert.Equal(expected, DifficultyCalculator.Calculate(lengthM, gainM, ActivityType.Hiking));
    }

    // ─── Cycling thresholds: [30, 70, 140, 250] effort km ───

    [Theory]
    [InlineData(25000, 0, Difficulty.Easy)]        // 25 km
    [InlineData(30000, 0, Difficulty.Moderate)]     // 30 effort
    [InlineData(70000, 0, Difficulty.Hard)]          // 70 effort
    [InlineData(140000, 0, Difficulty.Expert)]       // 140 effort
    [InlineData(250000, 0, Difficulty.Extreme)]      // 250 effort
    public void Calculate_Cycling_ReturnsExpectedDifficulty(
        double lengthM, double gainM, Difficulty expected)
    {
        Assert.Equal(expected, DifficultyCalculator.Calculate(lengthM, gainM, ActivityType.Cycling));
    }

    // ─── Elevation gain contribution ───

    [Fact]
    public void Calculate_ElevationGain_IncreasesEffort()
    {
        // 11 km flat = Easy for trail running
        var flat = DifficultyCalculator.Calculate(11000, 0, ActivityType.TrailRunning);
        // 11 km + 1000m gain = 11 + 10 = 21 effort = Moderate
        var hilly = DifficultyCalculator.Calculate(11000, 1000, ActivityType.TrailRunning);
        Assert.Equal(Difficulty.Easy, flat);
        Assert.Equal(Difficulty.Moderate, hilly);
    }

    // ─── Trail entity overload ───

    [Fact]
    public void Calculate_FromTrailEntity_Works()
    {
        var trail = new Trail
        {
            Id = Guid.NewGuid(),
            Name = "Test Trail",
            Slug = "test-trail",
            Length = 5000,
            ElevationGain = 200,
            ActivityTypeId = ActivityType.Hiking,
        };

        var result = DifficultyCalculator.Calculate(trail);
        Assert.Equal(Difficulty.Easy, result); // 5 + 2 = 7 effort < 8
    }

    // ─── Boundary tests ───

    [Theory]
    [InlineData(0, 0, ActivityType.TrailRunning, Difficulty.Easy)]
    [InlineData(0, 0, ActivityType.Hiking, Difficulty.Easy)]
    public void Calculate_ZeroValues_ReturnsEasy(
        double lengthM, double gainM, ActivityType activity, Difficulty expected)
    {
        Assert.Equal(expected, DifficultyCalculator.Calculate(lengthM, gainM, activity));
    }
}
