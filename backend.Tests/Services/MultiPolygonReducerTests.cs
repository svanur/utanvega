using NetTopologySuite.Geometries;
using Utanvega.Scripts.ImportLandsvaediRegions;

namespace Utanvega.Backend.Tests.Services;

// #1764: covers scripts/import-landsvaedi-regions/MultiPolygonReducer.cs, linked directly into
// this test assembly (see backend.Tests.csproj) rather than referenced via the standalone script
// project — same MultiPolygon → Polygon reduction algorithm scripts/import-municipality-boundaries
// uses for the 4 Greater Reykjavík municipalities, extracted here so it's unit-testable.
public class MultiPolygonReducerTests
{
    private static Polygon Square(double minX, double minY, double maxX, double maxY) =>
        new(new LinearRing(new[]
        {
            new Coordinate(minX, minY),
            new Coordinate(maxX, minY),
            new Coordinate(maxX, maxY),
            new Coordinate(minX, maxY),
            new Coordinate(minX, minY),
        }));

    [Fact]
    public void ReduceToMainlandPolygon_AlreadyAPolygon_ReturnsItUnchanged()
    {
        var polygon = Square(0, 0, 10, 10);

        var result = MultiPolygonReducer.ReduceToMainlandPolygon(
            polygon, "Test", referenceLng: 5, referenceLat: 5, out var log);

        Assert.Same(polygon, result);
        Assert.Contains("already a single Polygon", log);
    }

    [Fact]
    public void ReduceToMainlandPolygon_OverlappingParts_UnionCollapsesToSinglePolygon()
    {
        // Two overlapping squares — Union() should collapse them into one simply-connected shape,
        // not leave a MultiPolygon needing the reference-point fallback.
        var multi = new MultiPolygon(new[]
        {
            Square(0, 0, 10, 10),
            Square(5, 5, 15, 15),
        });

        var result = MultiPolygonReducer.ReduceToMainlandPolygon(
            multi, "Test", referenceLng: 7, referenceLat: 7, out var log);

        Assert.True(result.IsSimple);
        Assert.True(result.IsValid);
        Assert.Contains("Union() collapsed", log);
        // The union of two overlapping 10x10 squares (100 each, 25 overlap) covers 175 deg².
        Assert.Equal(175, result.Area, precision: 3);
    }

    [Fact]
    public void ReduceToMainlandPolygon_DisjointParts_KeepsThePartContainingTheReferencePoint()
    {
        // Mirrors IS8 Suðurland / IS6 Norðurland eystra: one large mainland part plus small
        // disjoint offshore parts the reference point is not inside.
        var mainland = Square(0, 0, 10, 10);
        var island1 = Square(20, 20, 21, 21);
        var island2 = Square(30, 30, 30.5, 30.5);
        var multi = new MultiPolygon(new[] { mainland, island1, island2 });

        var result = MultiPolygonReducer.ReduceToMainlandPolygon(
            multi, "Test region", referenceLng: 5, referenceLat: 5, out var log);

        Assert.Equal(mainland.Area, result.Area, precision: 6);
        Assert.Contains("3 disjoint parts", log);
        Assert.Contains("discarding 2 other part(s)", log);
    }

    [Fact]
    public void ReduceToMainlandPolygon_ReferencePointInsideNoPart_Throws()
    {
        var multi = new MultiPolygon(new[]
        {
            Square(0, 0, 10, 10),
            Square(20, 20, 21, 21),
        });

        var ex = Assert.Throws<InvalidOperationException>(() =>
            MultiPolygonReducer.ReduceToMainlandPolygon(
                multi, "Test region", referenceLng: 100, referenceLat: 100, out _));

        Assert.Contains("Test region", ex.Message);
        Assert.Contains("is not inside any", ex.Message);
    }
}
