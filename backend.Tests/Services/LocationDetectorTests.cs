using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Services;

public class LocationDetectorTests
{
    // ─── Haversine distance formula ───

    [Fact]
    public void Haversine_SamePoint_ReturnsZero()
    {
        var distance = LocationDetector.HaversineMeters(64.1466, -21.9426, 64.1466, -21.9426);
        Assert.Equal(0, distance, precision: 1);
    }

    [Fact]
    public void Haversine_ReykjavikToAkureyri_ApproximatelyCorrect()
    {
        // Reykjavík (64.1466°N, 21.9426°W) to Akureyri (65.6835°N, 18.0878°W)
        // Straight-line distance is approximately 250 km
        var distance = LocationDetector.HaversineMeters(64.1466, -21.9426, 65.6835, -18.0878);
        Assert.InRange(distance, 230_000, 270_000);
    }

    [Fact]
    public void Haversine_ShortDistance_IsAccurate()
    {
        // Two points roughly 1 km apart in Reykjavík
        // Hallgrímskirkja (64.1418, -21.9268) to Harpa (64.1505, -21.9330)
        var distance = LocationDetector.HaversineMeters(64.1418, -21.9268, 64.1505, -21.9330);
        Assert.InRange(distance, 800, 1200);
    }

    [Fact]
    public void Haversine_IsSymmetric()
    {
        var d1 = LocationDetector.HaversineMeters(64.1466, -21.9426, 65.6835, -18.0878);
        var d2 = LocationDetector.HaversineMeters(65.6835, -18.0878, 64.1466, -21.9426);
        Assert.Equal(d1, d2, precision: 1);
    }

    [Fact]
    public void Haversine_AcrossEquator_Works()
    {
        // From just north of equator to just south
        var distance = LocationDetector.HaversineMeters(1.0, 0.0, -1.0, 0.0);
        // ~222 km (2 degrees of latitude)
        Assert.InRange(distance, 220_000, 225_000);
    }

    [Fact]
    public void Haversine_AcrossDateLine_Works()
    {
        // Points near the international date line
        var distance = LocationDetector.HaversineMeters(0.0, 179.0, 0.0, -179.0);
        // ~222 km (2 degrees of longitude at equator)
        Assert.InRange(distance, 220_000, 225_000);
    }

    [Fact]
    public void Haversine_Poles_Works()
    {
        // North pole to south pole = ~20,000 km (half earth circumference)
        var distance = LocationDetector.HaversineMeters(90.0, 0.0, -90.0, 0.0);
        Assert.InRange(distance, 19_900_000, 20_100_000);
    }

    // ─── Known Icelandic distances for sanity ───

    [Fact]
    public void Haversine_OskjuhlíðArea_WithinExpectedRadius()
    {
        // Perlan (center of Öskjuhlíð area) to a point on the Öskjuhlíð trail
        // Perlan: 64.1286, -21.9174. Point on trail: 64.1270, -21.9200
        var distance = LocationDetector.HaversineMeters(64.1286, -21.9174, 64.1270, -21.9200);
        // Should be within ~200m (Öskjuhlíð is a small area)
        Assert.True(distance < 500, $"Expected < 500m, got {distance:F0}m");
    }

    // ─── SampleRoute ───

    [Fact]
    public void SampleRoute_FewCoords_ReturnsAll()
    {
        var coords = new[]
        {
            new NetTopologySuite.Geometries.Coordinate(-21.0, 64.0),
            new NetTopologySuite.Geometries.Coordinate(-21.1, 64.1),
        };
        var result = LocationDetector.SampleRoute(coords, 12);
        Assert.Equal(2, result.Count);
        Assert.Equal(64.0, result[0].Lat);
        Assert.Equal(-21.0, result[0].Lng);
    }

    [Fact]
    public void SampleRoute_ManyCoords_ReturnsRequestedCount()
    {
        var coords = Enumerable.Range(0, 100)
            .Select(i => new NetTopologySuite.Geometries.Coordinate(-21.0 + i * 0.001, 64.0 + i * 0.001))
            .ToArray();
        var result = LocationDetector.SampleRoute(coords, 12);
        Assert.Equal(12, result.Count);
        // First point
        Assert.Equal(64.0, result[0].Lat);
        Assert.Equal(-21.0, result[0].Lng);
        // Last point
        Assert.Equal(coords[^1].Y, result[^1].Lat);
        Assert.Equal(coords[^1].X, result[^1].Lng);
    }

    [Fact]
    public void SampleRoute_IncludesFirstAndLastPoints()
    {
        var coords = Enumerable.Range(0, 50)
            .Select(i => new NetTopologySuite.Geometries.Coordinate(-21.0 + i * 0.01, 64.0 + i * 0.01))
            .ToArray();
        var result = LocationDetector.SampleRoute(coords, 5);
        Assert.Equal(5, result.Count);
        Assert.Equal((coords[0].Y, coords[0].X), result[0]);
        Assert.Equal((coords[^1].Y, coords[^1].X), result[^1]);
    }
}
