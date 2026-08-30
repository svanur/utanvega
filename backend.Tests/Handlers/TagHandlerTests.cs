using Utanvega.Backend.Application.Tags;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class TagHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;

    public TagHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    // ─── CreateTagCommand ───

    [Fact]
    public async Task Create_Tag_Succeeds()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateTagCommandHandler(ctx);

        var (id, slug) = await handler.Handle(new CreateTagCommand(
            Name: "Fjallahlaup",
            Color: "#ff0000",
            NameEn: "Mountain running"
        ), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);
        Assert.Equal("fjallahlaup", slug);

        using var verifyCtx = _factory.CreateContext();
        var tag = await verifyCtx.Tags.FindAsync(id);
        Assert.NotNull(tag);
        Assert.Equal("Fjallahlaup", tag!.Name);
        Assert.Equal("Mountain running", tag.NameEn);
        Assert.Equal("fjallahlaup", tag.Slug);
        Assert.Equal("#ff0000", tag.Color);
    }

    [Fact]
    public async Task Create_Tag_AutoGeneratesSlug_ForIcelandicName()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateTagCommandHandler(ctx);

        var (_, slug) = await handler.Handle(new CreateTagCommand(
            Name: "Þverun áa",
            Color: null
        ), CancellationToken.None);

        Assert.Equal("thverun-aa", slug);
    }

    [Fact]
    public async Task Create_Tag_WritesChangeLogEntry_WithActorUserId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateTagCommandHandler(ctx);

        var (id, _) = await handler.Handle(new CreateTagCommand(
            Name: "Audit Tag",
            Color: null,
            ActorUserId: "admin-user"
        ), CancellationToken.None);

        var entry = ctx.ChangeLogs.Single(c => c.EntityId == id.ToString());
        Assert.Equal(nameof(Tag), entry.EntityName);
        Assert.Equal("admin-user", entry.UserId);
        Assert.Equal("Create", entry.Action);
    }

    // ─── UpdateTagCommand ───

    [Fact]
    public async Task Update_Tag_Succeeds()
    {
        Guid tagId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateTagCommandHandler(ctx);
            (tagId, _) = await handler.Handle(new CreateTagCommand(
                Name: "Old Name", Color: "#000000"
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateTagCommandHandler(ctx);
            var success = await handler.Handle(new UpdateTagCommand(
                Id: tagId, Name: "New Name", Color: "#ffffff", NameEn: "New Name En"
            ), CancellationToken.None);
            Assert.True(success);
        }

        using var verifyCtx = _factory.CreateContext();
        var tag = await verifyCtx.Tags.FindAsync(tagId);
        Assert.NotNull(tag);
        Assert.Equal("New Name", tag!.Name);
        Assert.Equal("New Name En", tag.NameEn);
        Assert.Equal("#ffffff", tag.Color);
        Assert.Equal("old-name", tag.Slug);
    }

    [Fact]
    public async Task Update_Tag_UsesExplicitSlug()
    {
        Guid tagId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateTagCommandHandler(ctx);
            (tagId, _) = await handler.Handle(new CreateTagCommand(
                Name: "Test Tag", Color: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateTagCommandHandler(ctx);
            await handler.Handle(new UpdateTagCommand(
                Id: tagId, Name: "Test Tag", Color: null, Slug: "my-custom-slug"
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var tag = await verifyCtx.Tags.FindAsync(tagId);
        Assert.Equal("my-custom-slug", tag!.Slug);
    }

    [Fact]
    public async Task Update_Tag_DoesNotRegenerateSlug_WhenNameChanges_AndSlugOmitted()
    {
        // Regression test for #420/#428: renaming a tag must never silently regenerate the slug
        // from the new name when no explicit slug was supplied — that breaks any link or bookmark
        // that points at the old slug.
        Guid tagId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateTagCommandHandler(ctx);
            (tagId, _) = await handler.Handle(new CreateTagCommand(
                Name: "Original Name", Color: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateTagCommandHandler(ctx);
            await handler.Handle(new UpdateTagCommand(
                Id: tagId, Name: "Þórsmörk Trail Running", Color: null, Slug: null
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var tag = await verifyCtx.Tags.FindAsync(tagId);
        Assert.Equal("Þórsmörk Trail Running", tag!.Name);
        Assert.Equal("original-name", tag.Slug);
    }

    [Fact]
    public async Task Update_Tag_PreservesSlug_WhenSlugIsBlank()
    {
        Guid tagId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateTagCommandHandler(ctx);
            (tagId, _) = await handler.Handle(new CreateTagCommand(
                Name: "Blank Slug Tag", Color: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateTagCommandHandler(ctx);
            await handler.Handle(new UpdateTagCommand(
                Id: tagId, Name: "Renamed Tag", Color: null, Slug: "   "
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var tag = await verifyCtx.Tags.FindAsync(tagId);
        Assert.Equal("Renamed Tag", tag!.Name);
        Assert.Equal("blank-slug-tag", tag.Slug);
    }

    [Fact]
    public async Task Update_Tag_SavesTranslationHashes()
    {
        Guid tagId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateTagCommandHandler(ctx);
            (tagId, _) = await handler.Handle(new CreateTagCommand(
                Name: "Translated Tag", Color: null
            ), CancellationToken.None);
        }

        var hashes = new Dictionary<string, string> { ["name"] = "abc123" };

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateTagCommandHandler(ctx);
            await handler.Handle(new UpdateTagCommand(
                Id: tagId, Name: "Translated Tag", Color: null, TranslationHashes: hashes
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var tag = await verifyCtx.Tags.FindAsync(tagId);
        Assert.Equal("{\"name\":\"abc123\"}", tag!.TranslationHashes);
    }

    [Fact]
    public async Task Update_Tag_Returns_False_ForUnknownId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new UpdateTagCommandHandler(ctx);
        var success = await handler.Handle(new UpdateTagCommand(
            Id: Guid.NewGuid(), Name: "Ghost", Color: null
        ), CancellationToken.None);
        Assert.False(success);
    }

    [Fact]
    public async Task Update_Tag_WritesChangeLogEntry_WithActorUserId()
    {
        Guid tagId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateTagCommandHandler(ctx);
            (tagId, _) = await handler.Handle(new CreateTagCommand(
                Name: "Audit Update Tag", Color: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateTagCommandHandler(ctx);
            await handler.Handle(new UpdateTagCommand(
                Id: tagId, Name: "Audit Update Tag Renamed", Color: null, ActorUserId: "admin-user"
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var entry = verifyCtx.ChangeLogs.Single(c => c.EntityId == tagId.ToString() && c.Action == "Update");
        Assert.Equal("admin-user", entry.UserId);
    }

    // ─── DeleteTagCommand ───

    [Fact]
    public async Task Delete_Tag_Succeeds()
    {
        Guid tagId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateTagCommandHandler(ctx);
            (tagId, _) = await handler.Handle(new CreateTagCommand(
                Name: "To Delete", Color: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteTagCommandHandler(ctx);
            var success = await handler.Handle(new DeleteTagCommand(tagId), CancellationToken.None);
            Assert.True(success);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Null(await verifyCtx.Tags.FindAsync(tagId));
    }

    [Fact]
    public async Task Delete_Tag_RemovesDependentTrailTags()
    {
        Guid tagId;
        Guid trailId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateTagCommandHandler(ctx);
            (tagId, _) = await handler.Handle(new CreateTagCommand(
                Name: "Linked Tag", Color: null
            ), CancellationToken.None);

            var trail = new Trail { Name = "Test Trail", Slug = "test-trail" };
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
            trailId = trail.Id;

            ctx.TrailTags.Add(new TrailTag { TrailId = trailId, TagId = tagId });
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteTagCommandHandler(ctx);
            await handler.Handle(new DeleteTagCommand(tagId), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Empty(verifyCtx.TrailTags.Where(tt => tt.TagId == tagId));
        Assert.NotNull(await verifyCtx.Trails.FindAsync(trailId));
    }

    [Fact]
    public async Task Delete_Tag_Returns_False_ForUnknownId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new DeleteTagCommandHandler(ctx);
        var success = await handler.Handle(new DeleteTagCommand(Guid.NewGuid()), CancellationToken.None);
        Assert.False(success);
    }

    [Fact]
    public async Task Delete_Tag_WritesChangeLogEntry_WithActorUserId()
    {
        Guid tagId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateTagCommandHandler(ctx);
            (tagId, _) = await handler.Handle(new CreateTagCommand(
                Name: "Audit Delete Tag", Color: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteTagCommandHandler(ctx);
            await handler.Handle(new DeleteTagCommand(tagId, ActorUserId: "admin-user"), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var entry = verifyCtx.ChangeLogs.Single(c => c.EntityId == tagId.ToString() && c.Action == "Delete");
        Assert.Equal("admin-user", entry.UserId);
    }

    // ─── GetTagsQuery ───

    [Fact]
    public async Task GetTags_Returns_OrderedByName()
    {
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateTagCommandHandler(ctx);
            foreach (var name in new[] { "Zebra Tag", "Alpha Tag", "Middle Tag" })
            {
                await handler.Handle(new CreateTagCommand(Name: name, Color: null), CancellationToken.None);
            }
        }

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetTagsQueryHandler(ctx2);
        var result = await handler2.Handle(new GetTagsQuery(), CancellationToken.None);

        var names = result.Select(t => t.Name).ToList();
        Assert.Equal(new[] { "Alpha Tag", "Middle Tag", "Zebra Tag" }, names);
    }

    [Fact]
    public async Task GetTags_IncludesCorrectTrailCount()
    {
        Guid tagId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateTagCommandHandler(ctx);
            (tagId, _) = await handler.Handle(new CreateTagCommand(
                Name: "Counted Tag", Color: null
            ), CancellationToken.None);

            var trailA = new Trail { Name = "Trail A", Slug = "trail-a" };
            var trailB = new Trail { Name = "Trail B", Slug = "trail-b" };
            ctx.Trails.AddRange(trailA, trailB);
            await ctx.SaveChangesAsync();

            ctx.TrailTags.Add(new TrailTag { TrailId = trailA.Id, TagId = tagId });
            ctx.TrailTags.Add(new TrailTag { TrailId = trailB.Id, TagId = tagId });
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetTagsQueryHandler(ctx2);
        var result = await handler2.Handle(new GetTagsQuery(), CancellationToken.None);

        var tag = result.Single(t => t.Id == tagId);
        Assert.Equal(2, tag.TrailCount);
    }
}
