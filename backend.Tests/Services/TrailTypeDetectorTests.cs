using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Services;

public class TrailTypeDetectorTests
{
    private static readonly GeometryFactory Factory = new(new PrecisionModel(), 4326);

    /// <summary>
    /// Helper: calculate Haversine total length in meters for a set of coordinates.
    /// </summary>
    private static double TotalLength(Coordinate[] coords)
    {
        double length = 0;
        for (var i = 1; i < coords.Length; i++)
        {
            var lat1 = coords[i - 1].Y * Math.PI / 180;
            var lat2 = coords[i].Y * Math.PI / 180;
            var dLat = (coords[i].Y - coords[i - 1].Y) * Math.PI / 180;
            var dLon = (coords[i].X - coords[i - 1].X) * Math.PI / 180;
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(lat1) * Math.Cos(lat2) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            length += 6371000.0 * 2.0 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        }
        return length;
    }

    // ─── Point to Point ───

    [Fact]
    public void PointToPoint_WhenStartAndEndFarApart()
    {
        // A straight line from Reykjavik (64.13, -21.90) to Akureyri (65.68, -18.09)
        var coords = new[]
        {
            new Coordinate(-21.90, 64.13),
            new Coordinate(-21.50, 64.30),
            new Coordinate(-20.80, 64.60),
            new Coordinate(-20.00, 65.00),
            new Coordinate(-19.20, 65.40),
            new Coordinate(-18.09, 65.68),
        };
        var lineString = Factory.CreateLineString(coords);
        var length = TotalLength(coords);

        var result = TrailTypeDetector.Detect(lineString, length);

        Assert.Equal(TrailType.PointToPoint, result);
    }

    // ─── Loop ───

    [Fact]
    public void Loop_WhenCircularRoute()
    {
        // A square-ish loop around a point — start and end are same, path doesn't retrace
        // Roughly 1km x 1km square near Reykjavik
        var baseLat = 64.13;
        var baseLon = -21.90;
        var offset = 0.01; // ~1km at this latitude

        var coords = new[]
        {
            new Coordinate(baseLon, baseLat),
            new Coordinate(baseLon + offset, baseLat),
            new Coordinate(baseLon + offset, baseLat + offset),
            new Coordinate(baseLon, baseLat + offset),
            new Coordinate(baseLon - offset, baseLat + offset),
            new Coordinate(baseLon - offset, baseLat),
            new Coordinate(baseLon, baseLat), // back to start
        };
        var lineString = Factory.CreateLineString(coords);
        var length = TotalLength(coords);

        var result = TrailTypeDetector.Detect(lineString, length);

        Assert.Equal(TrailType.Loop, result);
    }

    // ─── Out and Back ───

    [Fact]
    public void OutAndBack_WhenPathRetracesItself()
    {
        // Go out 5km north, then come back along the same path
        var baseLat = 64.13;
        var baseLon = -21.90;
        var step = 0.005; // ~500m latitude steps

        var outbound = Enumerable.Range(0, 11)
            .Select(i => new Coordinate(baseLon, baseLat + i * step))
            .ToArray();

        // Return along (nearly) the same path with tiny GPS jitter
        var inbound = Enumerable.Range(0, 11)
            .Select(i => new Coordinate(baseLon + 0.00005, baseLat + (10 - i) * step))
            .ToArray();

        var coords = outbound.Concat(inbound).ToArray();
        var lineString = Factory.CreateLineString(coords);
        var length = TotalLength(coords);

        var result = TrailTypeDetector.Detect(lineString, length);

        Assert.Equal(TrailType.OutAndBack, result);
    }

    // ─── Edge Cases ───

    [Fact]
    public void NullGeometry_ReturnsLoop()
    {
        var result = TrailTypeDetector.Detect(null, 0);
        Assert.Equal(TrailType.Loop, result);
    }

    [Fact]
    public void TooFewPoints_ReturnsLoop()
    {
        var coords = new[]
        {
            new Coordinate(-21.90, 64.13),
            new Coordinate(-21.89, 64.14),
            new Coordinate(-21.88, 64.15),
        };
        var lineString = Factory.CreateLineString(coords);
        var length = TotalLength(coords);

        var result = TrailTypeDetector.Detect(lineString, length);

        Assert.Equal(TrailType.Loop, result);
    }

    [Fact]
    public void TrailOverload_Works()
    {
        // A straight line trail (PointToPoint)
        var coords = new[]
        {
            new Coordinate(-21.90, 64.13),
            new Coordinate(-21.50, 64.30),
            new Coordinate(-20.80, 64.60),
            new Coordinate(-20.00, 65.00),
            new Coordinate(-18.09, 65.68),
        };
        var lineString = Factory.CreateLineString(coords);
        var length = TotalLength(coords);

        var trail = new Trail
        {
            GpxData = lineString,
            Length = length,
            Name = "Test Trail",
            Slug = "test-trail"
        };

        var result = TrailTypeDetector.Detect(trail);

        Assert.Equal(TrailType.PointToPoint, result);
    }
}
