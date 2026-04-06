using Utanvega.Backend.Application.Locations.Queries.GetLocationTree;
using Utanvega.Backend.Application.Locations.Queries.GetLocationBySlug;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class LocationQueryHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;

    public LocationQueryHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private Location CreateLocation(string name, LocationType type, Guid? parentId = null)
    {
        return new Location
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Type = type,
            ParentId = parentId
        };
    }

    private Trail CreatePublishedTrail(string name)
    {
        return new Trail
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Length = 5000,
            ElevationGain = 200,
            ElevationLoss = 180,
            ActivityTypeId = ActivityType.Hiking,
            Status = TrailStatus.Published,
            Type = TrailType.Loop,
            Difficulty = Difficulty.Easy,
            Visibility = Visibility.Public,
        };
    }

    // --- GetLocationTree tests ---

    [Fact]
    public async Task GetLocationTree_ReturnsEmptyForNoLocations()
    {
        using var ctx = _factory.CreateContext();
        var handler = new GetLocationTreeQueryHandler(ctx);
        var result = await handler.Handle(new GetLocationTreeQuery(), CancellationToken.None);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetLocationTree_ReturnsFlatListForRootsOnly()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(CreateLocation("Iceland", LocationType.Country));
            ctx.Locations.Add(CreateLocation("Norway", LocationType.Country));
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetLocationTreeQueryHandler(ctx);
            var result = await handler.Handle(new GetLocationTreeQuery(), CancellationToken.None);
            Assert.Equal(2, result.Count);
            Assert.Equal("Iceland", result[0].Name);
            Assert.Equal("Norway", result[1].Name);
            Assert.Empty(result[0].Children);
        }
    }

    [Fact]
    public async Task GetLocationTree_NestsChildrenUnderParent()
    {
        var iceland = CreateLocation("Iceland", LocationType.Country);
        var south = CreateLocation("South Iceland", LocationType.Region, iceland.Id);
        var vik = CreateLocation("Vik", LocationType.Place, south.Id);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.AddRange(iceland, south, vik);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetLocationTreeQueryHandler(ctx);
            var result = await handler.Handle(new GetLocationTreeQuery(), CancellationToken.None);

            Assert.Single(result); // Only Iceland at root
            var icelandNode = result[0];
            Assert.Equal("Iceland", icelandNode.Name);
            Assert.Single(icelandNode.Children);

            var southNode = icelandNode.Children[0];
            Assert.Equal("South Iceland", southNode.Name);
            Assert.Single(southNode.Children);
            Assert.Equal("Vik", southNode.Children[0].Name);
        }
    }

    [Fact]
    public async Task GetLocationTree_TotalTrailsCount_IncludesDescendants()
    {
        var iceland = CreateLocation("Iceland", LocationType.Country);
        var south = CreateLocation("South Iceland", LocationType.Region, iceland.Id);
        var vik = CreateLocation("Vik", LocationType.Place, south.Id);
        var trail1 = CreatePublishedTrail("Trail in Vik");
        var trail2 = CreatePublishedTrail("Trail in South");

        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.AddRange(iceland, south, vik);
            ctx.Trails.AddRange(trail1, trail2);
            await ctx.SaveChangesAsync();

            ctx.TrailLocations.Add(new TrailLocation
            {
                TrailId = trail1.Id,
                LocationId = vik.Id,
                Role = TrailLocationRole.BelongsTo
            });
            ctx.TrailLocations.Add(new TrailLocation
            {
                TrailId = trail2.Id,
                LocationId = south.Id,
                Role = TrailLocationRole.BelongsTo
            });
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetLocationTreeQueryHandler(ctx);
            var result = await handler.Handle(new GetLocationTreeQuery(), CancellationToken.None);

            var icelandNode = result[0];
            Assert.Equal(0, icelandNode.TrailsCount);    // No direct trails
            Assert.Equal(2, icelandNode.TotalTrailsCount); // 2 via descendants

            var southNode = icelandNode.Children[0];
            Assert.Equal(1, southNode.TrailsCount);       // 1 direct
            Assert.Equal(2, southNode.TotalTrailsCount);  // 1 direct + 1 in Vik

            var vikNode = southNode.Children[0];
            Assert.Equal(1, vikNode.TrailsCount);
            Assert.Equal(1, vikNode.TotalTrailsCount);
        }
    }

    // --- GetLocationBySlug ancestor-aware tests ---

    [Fact]
    public async Task GetLocationBySlug_IncludesTrailsFromDescendants()
    {
        var region = CreateLocation("South Iceland", LocationType.Region);
        var place = CreateLocation("Vik", LocationType.Place, region.Id);
        var trail1 = CreatePublishedTrail("Trail in Vik");
        var trail2 = CreatePublishedTrail("Trail in South");

        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.AddRange(region, place);
            ctx.Trails.AddRange(trail1, trail2);
            await ctx.SaveChangesAsync();

            ctx.TrailLocations.Add(new TrailLocation
            {
                TrailId = trail1.Id,
                LocationId = place.Id,
                Role = TrailLocationRole.BelongsTo
            });
            ctx.TrailLocations.Add(new TrailLocation
            {
                TrailId = trail2.Id,
                LocationId = region.Id,
                Role = TrailLocationRole.BelongsTo
            });
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetLocationBySlugQueryHandler(ctx);
            var result = await handler.Handle(
                new GetLocationBySlugQuery("south-iceland"), CancellationToken.None);

            Assert.NotNull(result);
            // Should include both direct trail AND trail from child location Vik
            Assert.Equal(2, result.Trails.Count);
        }
    }

    [Fact]
    public async Task GetLocationBySlug_IncludesChildLocations()
    {
        var region = CreateLocation("South Iceland", LocationType.Region);
        var place1 = CreateLocation("Vik", LocationType.Place, region.Id);
        var place2 = CreateLocation("Thorsmork", LocationType.Place, region.Id);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.AddRange(region, place1, place2);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetLocationBySlugQueryHandler(ctx);
            var result = await handler.Handle(
                new GetLocationBySlugQuery("south-iceland"), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(2, result.ChildLocations.Count);
            Assert.Contains(result.ChildLocations, c => c.Name == "Vik");
            Assert.Contains(result.ChildLocations, c => c.Name == "Thorsmork");
        }
    }

    [Fact]
    public async Task GetLocationBySlug_ExcludesDeletedTrails()
    {
        var location = CreateLocation("Vik", LocationType.Place);
        var published = CreatePublishedTrail("Good Trail");
        var deleted = CreatePublishedTrail("Deleted Trail");
        deleted.Status = TrailStatus.Deleted;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Locations.Add(location);
            ctx.Trails.AddRange(published, deleted);
            await ctx.SaveChangesAsync();

            ctx.TrailLocations.Add(new TrailLocation
            {
                TrailId = published.Id,
                LocationId = location.Id,
                Role = TrailLocationRole.BelongsTo
            });
            ctx.TrailLocations.Add(new TrailLocation
            {
                TrailId = deleted.Id,
                LocationId = location.Id,
                Role = TrailLocationRole.BelongsTo
            });
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetLocationBySlugQueryHandler(ctx);
            var result = await handler.Handle(
                new GetLocationBySlugQuery("vik"), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Single(result.Trails);
            Assert.Equal("Good Trail", result.Trails[0].Name);
        }
    }

    [Fact]
    public async Task GetLocationBySlug_ReturnsNullForMissing()
    {
        using var ctx = _factory.CreateContext();
        var handler = new GetLocationBySlugQueryHandler(ctx);
        var result = await handler.Handle(
            new GetLocationBySlugQuery("nonexistent"), CancellationToken.None);

        Assert.Null(result);
    }
}
