using Moq;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Locations.Commands.CreateLocation;
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
}
