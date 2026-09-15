using Moq;
using Microsoft.EntityFrameworkCore;
using Npgsql;
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

    [Fact]
    public async Task Create_DuplicateDerivedSlug_ThrowsInvalidOperationException()
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

        await handler.Handle(command, CancellationToken.None);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            handler.Handle(command, CancellationToken.None));
        Assert.Contains("vik", ex.Message);
    }

    [Fact]
    public async Task Create_DuplicateExplicitSlug_ThrowsInvalidOperationException()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateLocationCommandHandler(ctx, _cacheInvalidator);

        await handler.Handle(new CreateLocationCommand(
            Name: "Vik",
            Slug: "custom-slug",
            Description: "A village",
            Type: "Place",
            ParentId: null,
            Latitude: null,
            Longitude: null,
            Radius: null,
            CreatedBy: "test-user"
        ), CancellationToken.None);

        var duplicateCommand = new CreateLocationCommand(
            Name: "Vik 2",
            Slug: "custom-slug",
            Description: "Another village",
            Type: "Place",
            ParentId: null,
            Latitude: null,
            Longitude: null,
            Radius: null,
            CreatedBy: "test-user"
        );

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            handler.Handle(duplicateCommand, CancellationToken.None));
        Assert.Contains("custom-slug", ex.Message);
    }

    [Fact]
    public async Task Create_ConcurrentDuplicateSlug_ThrowsInvalidOperationException()
    {
        // #880: the proactive AnyAsync check above only catches the common case. Under a genuine
        // race, two requests can both pass that check before either insert commits, and the loser's
        // insert fails at the DB with a Postgres unique-violation (23505) instead. The handler must
        // catch that at SaveChanges time and rethrow as InvalidOperationException so the admin
        // endpoint's existing `catch (InvalidOperationException) -> 409` path handles it, rather
        // than letting a raw DbUpdateException bubble up as an unhandled 500.
        // #885: the fabricated exception's ConstraintName must match the real Slug index name
        // (IX_Locations_Slug) — this is what proves the handler is keying off that specific index,
        // not any 23505 on the Locations table.
        using var ctx = TestDbContextFactory.CreateThrowingUniqueViolationContext("IX_Locations_Slug");
        var handler = new CreateLocationCommandHandler(ctx, _cacheInvalidator);
        var command = new CreateLocationCommand(
            Name: "Vik",
            Slug: "vik",
            Description: "A village",
            Type: "Place",
            ParentId: null,
            Latitude: null,
            Longitude: null,
            Radius: null,
            CreatedBy: "test-user"
        );

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            handler.Handle(command, CancellationToken.None));
        Assert.Contains("vik", ex.Message);
    }

    [Fact]
    public async Task Create_UnrelatedUniqueViolation_IsNotReportedAsSlugConflict()
    {
        // #885: a 23505 on the Locations table that isn't a Slug-index violation (e.g. a future
        // second unique constraint) must not be mislabeled as "slug already exists" — it should
        // propagate as-is so it surfaces as an unhandled 500 rather than a misleading 409.
        using var ctx = TestDbContextFactory.CreateThrowingUniqueViolationContext("IX_Locations_SomeOtherColumn");
        var handler = new CreateLocationCommandHandler(ctx, _cacheInvalidator);
        var command = new CreateLocationCommand(
            Name: "Vik",
            Slug: "vik",
            Description: "A village",
            Type: "Place",
            ParentId: null,
            Latitude: null,
            Longitude: null,
            Radius: null,
            CreatedBy: "test-user"
        );

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() =>
            handler.Handle(command, CancellationToken.None));
        Assert.IsType<PostgresException>(ex.InnerException);
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
