using Utanvega.Backend.Application.Trails.Queries.GetTrails;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class TrailQueryHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;

    public TrailQueryHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private Trail CreateTrail(string name, TrailStatus status = TrailStatus.Published, ActivityType activity = ActivityType.Hiking)
    {
        return new Trail
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Length = 5000,
            ElevationGain = 200,
            ElevationLoss = 180,
            ActivityTypeId = activity,
            Status = status,
            Type = TrailType.Loop,
            Difficulty = Difficulty.Easy,
            Visibility = Visibility.Public,
        };
    }

    [Fact]
    public async Task GetTrails_ExcludesDeletedByDefault()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(CreateTrail("Active Trail", TrailStatus.Published));
            ctx.Trails.Add(CreateTrail("Deleted Trail", TrailStatus.Deleted));
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(), CancellationToken.None);
            Assert.Single(result);
            Assert.Equal("Active Trail", result[0].Name);
        }
    }

    [Fact]
    public async Task GetTrails_IncludeDeleted_ReturnsAll()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(CreateTrail("Active", TrailStatus.Published));
            ctx.Trails.Add(CreateTrail("Deleted", TrailStatus.Deleted));
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(IncludeDeleted: true), CancellationToken.None);
            Assert.Equal(2, result.Count);
        }
    }

    [Fact]
    public async Task GetTrails_PublishedOnly_FiltersDrafts()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(CreateTrail("Published", TrailStatus.Published));
            ctx.Trails.Add(CreateTrail("Draft", TrailStatus.Draft));
            ctx.Trails.Add(CreateTrail("Flagged", TrailStatus.Flagged));
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(PublishedOnly: true), CancellationToken.None);
            Assert.Single(result);
            Assert.Equal("Published", result[0].Name);
        }
    }

    [Fact]
    public async Task GetTrails_ReturnsCorrectDtoFields()
    {
        var trail = CreateTrail("Mountain Loop", TrailStatus.Published, ActivityType.TrailRunning);
        trail.Description = "A scenic trail";
        trail.Length = 12500;
        trail.ElevationGain = 450;
        trail.ElevationLoss = 430;
        trail.Type = TrailType.Loop;
        trail.Difficulty = Difficulty.Moderate;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(), CancellationToken.None);
            var dto = result.Single();

            Assert.Equal("Mountain Loop", dto.Name);
            Assert.Equal("mountain-loop", dto.Slug);
            Assert.Equal("A scenic trail", dto.Description);
            Assert.Equal(12500, dto.Length);
            Assert.Equal(450, dto.ElevationGain);
            Assert.Equal(430, dto.ElevationLoss);
            Assert.Equal("Published", dto.Status);
            Assert.Equal("TrailRunning", dto.ActivityType);
            Assert.Equal("Loop", dto.TrailType);
            Assert.Equal("Moderate", dto.Difficulty);
        }
    }

    [Fact]
    public async Task GetTrails_IncludesLocationsAndTags()
    {
        var trail = CreateTrail("Tagged Trail");
        var location = new Location { Id = Guid.NewGuid(), Name = "Öskjuhlíð", Slug = "oskjuhlid", Type = LocationType.Area };
        var tag = new Tag { Id = Guid.NewGuid(), Name = "Scenic", Slug = "scenic", Color = "#4caf50" };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            ctx.Locations.Add(location);
            ctx.Tags.Add(tag);
            await ctx.SaveChangesAsync();

            ctx.TrailLocations.Add(new TrailLocation
            {
                TrailId = trail.Id,
                LocationId = location.Id,
                Role = TrailLocationRole.BelongsTo,
                Order = 0
            });
            ctx.TrailTags.Add(new TrailTag { TrailId = trail.Id, TagId = tag.Id });
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(), CancellationToken.None);
            var dto = result.Single();

            Assert.Single(dto.Locations);
            Assert.Equal("Öskjuhlíð", dto.Locations[0].Name);
            Assert.Equal("oskjuhlid", dto.Locations[0].Slug);

            Assert.Single(dto.Tags);
            Assert.Equal("Scenic", dto.Tags[0].Name);
            Assert.Equal("#4caf50", dto.Tags[0].Color);
        }
    }

    [Fact]
    public async Task GetTrails_EmptyDatabase_ReturnsEmptyList()
    {
        using var ctx = _factory.CreateContext();
        var handler = new GetTrailsQueryHandler(ctx);
        var result = await handler.Handle(new GetTrailsQuery(), CancellationToken.None);
        Assert.Empty(result);
    }
}
