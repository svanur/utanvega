using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Services;

public class LocationDetectorTests : IDisposable
{
    // ─── DetectLocationsAsync: real-DB round trip via TestDbContext (#583) ───
    // Location.Center is an NTS Point; TestDbContext now round-trips it through WKB
    // (see TestDbContextFactory.cs) instead of ignoring it, so DetectLocationsAsync's
    // GetAllLocationCenters query (which filters on Center != null && Radius != null)
    // actually sees seeded locations rather than silently returning an empty list.
    private readonly TestDbContextFactory _factory = new();
    private readonly IMemoryCache _memoryCache = new MemoryCache(new MemoryCacheOptions());

    public void Dispose()
    {
        _factory.Dispose();
        _memoryCache.Dispose();
    }

    [Fact]
    public async Task DetectLocationsAsync_SeededLocationWithinRadius_IsReturned()
    {
        // Öskjuhlíð-ish center, radius covers a point ~200m away.
        var location = new Core.Entities.Location
        {
            Name = "Öskjuhlíð",
            Slug = "oskjuhlid",
            Type = LocationType.Place,
            Center = new Point(-21.9174, 64.1286) { SRID = 4326 },
            Radius = 500, // meters
        };

        using (var seedCtx = _factory.CreateContext())
        {
            seedCtx.Locations.Add(location);
            await seedCtx.SaveChangesAsync();
        }

        using var ctx = _factory.CreateContext();
        var detector = new LocationDetector(ctx, _memoryCache);

        var results = await detector.DetectLocationsAsync(64.1270, -21.9200);

        var hit = Assert.Single(results);
        Assert.Equal(location.Id, hit.Id);
        Assert.Equal("Öskjuhlíð", hit.Name);
    }

    [Fact]
    public async Task DetectLocationsAsync_SeededLocationOutsideRadius_IsNotReturned()
    {
        var location = new Core.Entities.Location
        {
            Name = "Öskjuhlíð",
            Slug = "oskjuhlid-2",
            Type = LocationType.Place,
            Center = new Point(-21.9174, 64.1286) { SRID = 4326 },
            Radius = 100, // meters — the ~250m query point below is well outside this
        };

        using (var seedCtx = _factory.CreateContext())
        {
            seedCtx.Locations.Add(location);
            await seedCtx.SaveChangesAsync();
        }

        using var ctx = _factory.CreateContext();
        var detector = new LocationDetector(ctx, _memoryCache);

        var results = await detector.DetectLocationsAsync(64.1270, -21.9200);

        Assert.Empty(results);
    }

    [Fact]
    public async Task DetectLocationsAsync_LocationWithNullCenter_IsExcluded()
    {
        // Confirms GetAllLocationCenters' `Center != null` filter still works now that
        // Center round-trips via WKB, rather than the pre-#583 behaviour where every
        // location was excluded regardless of Center being set.
        var location = new Core.Entities.Location
        {
            Name = "No Center",
            Slug = "no-center",
            Type = LocationType.Place,
            Center = null,
            Radius = null,
        };

        using (var seedCtx = _factory.CreateContext())
        {
            seedCtx.Locations.Add(location);
            await seedCtx.SaveChangesAsync();
        }

        using var ctx = _factory.CreateContext();
        var detector = new LocationDetector(ctx, _memoryCache);

        var results = await detector.DetectLocationsAsync(64.1270, -21.9200);

        Assert.Empty(results);
    }

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

    // ─── PruneAncestorLocations ───

    private static DetectedLocationWithRole MakeDetected(Guid id, string name, TrailLocationRole role = TrailLocationRole.BelongsTo)
        => new(id, name, "region", role, 0);

    [Fact]
    public void PruneAncestors_SingleItem_ReturnedUnchanged()
    {
        var id = Guid.NewGuid();
        var detected = new List<DetectedLocationWithRole> { MakeDetected(id, "Ísland") };
        var parentMap = new Dictionary<Guid, Guid?> { [id] = null };
        var result = LocationDetector.PruneAncestorLocations(detected, parentMap);
        Assert.Single(result);
        Assert.Equal(id, result[0].Id);
    }

    [Fact]
    public void PruneAncestors_ParentAndChild_RemovesParent()
    {
        // Hafnarfjörður (child) → Ísland (parent)
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var detected = new List<DetectedLocationWithRole>
        {
            MakeDetected(parentId, "Ísland"),
            MakeDetected(childId, "Hafnarfjörður"),
        };
        var parentMap = new Dictionary<Guid, Guid?>
        {
            [parentId] = null,
            [childId] = parentId,
        };
        var result = LocationDetector.PruneAncestorLocations(detected, parentMap);
        Assert.Single(result);
        Assert.Equal(childId, result[0].Id);
    }

    [Fact]
    public void PruneAncestors_GrandparentChain_RemovesBothAncestors()
    {
        // City → Region → Country: only City survives
        var countryId = Guid.NewGuid();
        var regionId = Guid.NewGuid();
        var cityId = Guid.NewGuid();
        var detected = new List<DetectedLocationWithRole>
        {
            MakeDetected(countryId, "Ísland"),
            MakeDetected(regionId, "Suðurnes"),
            MakeDetected(cityId, "Hafnarfjörður"),
        };
        var parentMap = new Dictionary<Guid, Guid?>
        {
            [countryId] = null,
            [regionId] = countryId,
            [cityId] = regionId,
        };
        var result = LocationDetector.PruneAncestorLocations(detected, parentMap);
        Assert.Single(result);
        Assert.Equal(cityId, result[0].Id);
    }

    [Fact]
    public void PruneAncestors_TwoCitiesSameCountry_BothSurvive()
    {
        // Hafnarfjörður (Start) and Reykjavík (End) share parent Ísland
        // — Ísland removed, both cities survive
        var countryId = Guid.NewGuid();
        var city1Id = Guid.NewGuid();
        var city2Id = Guid.NewGuid();
        var detected = new List<DetectedLocationWithRole>
        {
            MakeDetected(countryId, "Ísland"),
            MakeDetected(city1Id, "Hafnarfjörður", TrailLocationRole.Start),
            MakeDetected(city2Id, "Reykjavík", TrailLocationRole.End),
        };
        var parentMap = new Dictionary<Guid, Guid?>
        {
            [countryId] = null,
            [city1Id] = countryId,
            [city2Id] = countryId,
        };
        var result = LocationDetector.PruneAncestorLocations(detected, parentMap);
        Assert.Equal(2, result.Count);
        Assert.DoesNotContain(result, r => r.Id == countryId);
        Assert.Contains(result, r => r.Id == city1Id);
        Assert.Contains(result, r => r.Id == city2Id);
    }

    [Fact]
    public void PruneAncestors_NoParentRelationship_NothingRemoved()
    {
        // Two sibling cities with no common detected ancestor
        var city1Id = Guid.NewGuid();
        var city2Id = Guid.NewGuid();
        var detected = new List<DetectedLocationWithRole>
        {
            MakeDetected(city1Id, "Hafnarfjörður"),
            MakeDetected(city2Id, "Reykjavík"),
        };
        var parentMap = new Dictionary<Guid, Guid?>
        {
            [city1Id] = null,
            [city2Id] = null,
        };
        var result = LocationDetector.PruneAncestorLocations(detected, parentMap);
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public void PruneAncestors_EmptyList_ReturnsEmpty()
    {
        var result = LocationDetector.PruneAncestorLocations([], []);
        Assert.Empty(result);
    }
}
