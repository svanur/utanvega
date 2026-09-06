using Moq;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Locations.Commands.CreateLocation;
using Utanvega.Backend.Application.Locations.Commands.DeleteLocation;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class LocationCommandHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly ICacheInvalidator _cacheInvalidator = new Mock<ICacheInvalidator>().Object;

    public LocationCommandHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    // ─── CreateLocationCommandHandler ───

    [Fact]
    public async Task Create_ValidLocation_ReturnsNewId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateLocationCommandHandler(ctx, _cacheInvalidator);
        var command = new CreateLocationCommand(
            Name: "Vik",
            Slug: null,
            Description: "A village",
            Type: "Place",
            ParentId: null,
            Latitude: null,
            Longitude: null,
            Radius: null,
            CreatedBy: "test-user"
        );

        var id = await handler.Handle(command, CancellationToken.None);
        Assert.NotEqual(Guid.Empty, id);

        var location = ctx.Locations.Single(l => l.Id == id);
        Assert.Equal("Vik", location.Name);
        Assert.Equal("vik", location.Slug);
        Assert.Equal("test-user", location.CreatedBy);
    }

    [Fact]
    public async Task Create_WritesChangeLogEntry()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateLocationCommandHandler(ctx, _cacheInvalidator);
        var command = new CreateLocationCommand(
            Name: "Vik",
            Slug: null,
            Description: "A village",
            Type: "Place",
            ParentId: null,
            Latitude: null,
            Longitude: null,
            Radius: null,
            CreatedBy: "test-user",
            ActorUserId: "admin-user"
        );

        var id = await handler.Handle(command, CancellationToken.None);

        var entry = ctx.ChangeLogs.Single(c => c.EntityId == id.ToString());
        Assert.Equal(nameof(Location), entry.EntityName);
        Assert.Equal("admin-user", entry.UserId);
        Assert.Equal("Create", entry.Action);
    }

    // ─── DeleteLocationCommandHandler ───

    [Fact]
    public async Task Delete_Location_ThrowsInvalidOperationException_ForUnknownId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new DeleteLocationCommandHandler(ctx, _cacheInvalidator);
        var unknownId = Guid.NewGuid();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            handler.Handle(new DeleteLocationCommand(unknownId), CancellationToken.None));
        Assert.Contains(unknownId.ToString(), ex.Message);
    }

    [Fact]
    public async Task Delete_Location_ThrowsInvalidOperationException_WhenItHasChildren()
    {
        Guid parentId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateLocationCommandHandler(ctx, _cacheInvalidator);
            parentId = await handler.Handle(new CreateLocationCommand(
                Name: "Parent",
                Slug: null,
                Description: "A parent location",
                Type: "Place",
                ParentId: null,
                Latitude: null,
                Longitude: null,
                Radius: null,
                CreatedBy: "test-user"
            ), CancellationToken.None);

            await handler.Handle(new CreateLocationCommand(
                Name: "Child",
                Slug: null,
                Description: "A child location",
                Type: "Place",
                ParentId: parentId,
                Latitude: null,
                Longitude: null,
                Radius: null,
                CreatedBy: "test-user"
            ), CancellationToken.None);
        }

        using var deleteCtx = _factory.CreateContext();
        var deleteHandler = new DeleteLocationCommandHandler(deleteCtx, _cacheInvalidator);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            deleteHandler.Handle(new DeleteLocationCommand(parentId), CancellationToken.None));
        Assert.Equal("Cannot delete a location that has children. Delete or move children first.", ex.Message);
    }
}
