using Moq;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Trails.Commands.UpdateTrail;
using Utanvega.Backend.Application.Trails.Commands.DeleteTrail;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class TrailCommandHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly ICacheInvalidator _cacheInvalidator = new Mock<ICacheInvalidator>().Object;

    public TrailCommandHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private Trail CreateTestTrail(string name = "Test Trail", TrailStatus status = TrailStatus.Draft)
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
            Status = status,
            Type = TrailType.Loop,
            Difficulty = Difficulty.Easy,
            Visibility = Visibility.Public,
        };
    }

    // ─── UpdateTrailCommandHandler ───

    [Fact]
    public async Task Update_ExistingTrail_UpdatesFields()
    {
        var trail = CreateTestTrail();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateTrailCommandHandler(ctx, _cacheInvalidator);
            var command = new UpdateTrailCommand(
                Id: trail.Id,
                Name: "Updated Name",
                Slug: "updated-name",
                Description: "New description",
                ActivityType: "Running",
                Status: "Published",
                Type: "OutAndBack",
                Difficulty: "Moderate",
                Visibility: "Public",
                UpdatedBy: "test-user"
            );

            var result = await handler.Handle(command, CancellationToken.None);
            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            var updated = ctx.Trails.First();
            Assert.Equal("Updated Name", updated.Name);
            Assert.Equal("updated-name", updated.Slug);
            Assert.Equal("New description", updated.Description);
            Assert.Equal(ActivityType.Running, updated.ActivityTypeId);
            Assert.Equal(TrailStatus.Published, updated.Status);
            Assert.Equal(TrailType.OutAndBack, updated.Type);
            Assert.Equal(Difficulty.Moderate, updated.Difficulty);
            Assert.Equal("test-user", updated.UpdatedBy);
            Assert.NotNull(updated.UpdatedAt);
        }
    }

    [Fact]
    public async Task Update_NonExistentTrail_ReturnsFalse()
    {
        using var ctx = _factory.CreateContext();
        var handler = new UpdateTrailCommandHandler(ctx, _cacheInvalidator);
        var command = new UpdateTrailCommand(
            Id: Guid.NewGuid(),
            Name: "Doesn't exist",
            Slug: "doesnt-exist",
            Description: null,
            ActivityType: "Hiking",
            Status: "Draft",
            Type: "Loop",
            Difficulty: "Easy",
            Visibility: "Public",
            UpdatedBy: "test"
        );

        var result = await handler.Handle(command, CancellationToken.None);
        Assert.False(result);
    }

    [Fact]
    public async Task Update_WithTags_SyncsTagsCorrectly()
    {
        var trail = CreateTestTrail();
        var tag1 = new Tag { Id = Guid.NewGuid(), Name = "Scenic", Slug = "scenic" };
        var tag2 = new Tag { Id = Guid.NewGuid(), Name = "Family", Slug = "family" };
        var tag3 = new Tag { Id = Guid.NewGuid(), Name = "Expert", Slug = "expert" };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            ctx.Tags.AddRange(tag1, tag2, tag3);
            ctx.TrailTags.Add(new TrailTag { TrailId = trail.Id, TagId = tag1.Id });
            ctx.TrailTags.Add(new TrailTag { TrailId = trail.Id, TagId = tag2.Id });
            await ctx.SaveChangesAsync();
        }

        // Update: remove tag1, keep tag2, add tag3
        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateTrailCommandHandler(ctx, _cacheInvalidator);
            var command = new UpdateTrailCommand(
                Id: trail.Id,
                Name: trail.Name,
                Slug: trail.Slug,
                Description: null,
                ActivityType: "Hiking",
                Status: "Draft",
                Type: "Loop",
                Difficulty: "Easy",
                Visibility: "Public",
                UpdatedBy: "test",
                TagIds: [tag2.Id, tag3.Id]
            );
            await handler.Handle(command, CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var tags = ctx.TrailTags.Where(tt => tt.TrailId == trail.Id).ToList();
            Assert.Equal(2, tags.Count);
            Assert.Contains(tags, t => t.TagId == tag2.Id);
            Assert.Contains(tags, t => t.TagId == tag3.Id);
            Assert.DoesNotContain(tags, t => t.TagId == tag1.Id);
        }
    }

    // ─── DeleteTrailCommandHandler ───

    [Fact]
    public async Task Delete_ExistingTrail_SoftDeletes()
    {
        var trail = CreateTestTrail(status: TrailStatus.Published);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteTrailCommandHandler(ctx, _cacheInvalidator);
            var result = await handler.Handle(new DeleteTrailCommand(trail.Id), CancellationToken.None);
            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            var deleted = ctx.Trails.First();
            Assert.Equal(TrailStatus.Deleted, deleted.Status);
            Assert.NotNull(deleted.UpdatedAt);
        }
    }

    [Fact]
    public async Task Delete_NonExistentTrail_ReturnsFalse()
    {
        using var ctx = _factory.CreateContext();
        var handler = new DeleteTrailCommandHandler(ctx, _cacheInvalidator);
        var result = await handler.Handle(new DeleteTrailCommand(Guid.NewGuid()), CancellationToken.None);
        Assert.False(result);
    }

    [Fact]
    public async Task Delete_DoesNotRemoveFromDatabase()
    {
        var trail = CreateTestTrail();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteTrailCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new DeleteTrailCommand(trail.Id), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            // Trail should still exist in DB (soft delete)
            Assert.Equal(1, ctx.Trails.Count());
        }
    }
}
