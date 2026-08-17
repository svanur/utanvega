using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Organizers;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class OrganizerHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;

    public OrganizerHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    // ─── CreateOrganizerCommand ───

    [Fact]
    public async Task Create_Organizer_Succeeds()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateOrganizerCommandHandler(ctx);

        var (id, slug) = await handler.Handle(new CreateOrganizerCommand(
            Name: "Reykjavík Marathon Club",
            Kennitala: "123456-7890",
            Phone: "5551234",
            Email: "info@rmc.is",
            Website: "https://rmc.is",
            Description: "A running club",
            ContactName: "Jón Jónsson",
            DescriptionEn: "A running club"
        ), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);
        Assert.Equal("reykjavik-marathon-club", slug);

        using var verifyCtx = _factory.CreateContext();
        var org = await verifyCtx.Organizers.FindAsync(id);
        Assert.NotNull(org);
        Assert.Equal("Reykjavík Marathon Club", org!.Name);
        Assert.Equal("reykjavik-marathon-club", org.Slug);
        Assert.Equal("123456-7890", org.Kennitala);
        Assert.Equal("5551234", org.Phone);
        Assert.Equal("info@rmc.is", org.Email);
        Assert.Equal("https://rmc.is", org.Website);
        Assert.Equal("A running club", org.Description);
        Assert.Equal("Jón Jónsson", org.ContactName);
    }

    [Fact]
    public async Task Create_Organizer_AutoGeneratesSlug_ForIcelandicName()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateOrganizerCommandHandler(ctx);

        var (_, slug) = await handler.Handle(new CreateOrganizerCommand(
            Name: "Íþróttafélag Reykjavíkur",
            Kennitala: null, Phone: null, Email: null,
            Website: null, Description: null, ContactName: null
        ), CancellationToken.None);

        Assert.Equal("ithrottafelag-reykjavikur", slug);
    }

    // ─── UpdateOrganizerCommand ───

    [Fact]
    public async Task Update_Organizer_Succeeds()
    {
        Guid orgId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await handler.Handle(new CreateOrganizerCommand(
                Name: "Old Name", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateOrganizerCommandHandler(ctx);
            var success = await handler.Handle(new UpdateOrganizerCommand(
                Id: orgId, Name: "New Name", Kennitala: null, Phone: "5559999",
                Email: "new@email.is", Website: null, Description: "Updated", ContactName: "Anna"
            ), CancellationToken.None);
            Assert.True(success);
        }

        using var verifyCtx = _factory.CreateContext();
        var org = await verifyCtx.Organizers.FindAsync(orgId);
        Assert.NotNull(org);
        Assert.Equal("New Name", org!.Name);
        Assert.Equal("new-name", org.Slug);
        Assert.Equal("5559999", org.Phone);
        Assert.Equal("new@email.is", org.Email);
        Assert.Equal("Updated", org.Description);
        Assert.Equal("Anna", org.ContactName);
    }

    [Fact]
    public async Task Update_Organizer_UsesExplicitSlug()
    {
        Guid orgId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await handler.Handle(new CreateOrganizerCommand(
                Name: "Test Org", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateOrganizerCommandHandler(ctx);
            await handler.Handle(new UpdateOrganizerCommand(
                Id: orgId, Name: "Test Org", Kennitala: null, Phone: null,
                Email: null, Website: null, Description: null, ContactName: null,
                Slug: "my-custom-slug"
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var org = await verifyCtx.Organizers.FindAsync(orgId);
        Assert.Equal("my-custom-slug", org!.Slug);
    }

    [Fact]
    public async Task Update_Organizer_AutoGeneratesSlug_WhenSlugNotProvided()
    {
        Guid orgId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await handler.Handle(new CreateOrganizerCommand(
                Name: "Original Name", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateOrganizerCommandHandler(ctx);
            await handler.Handle(new UpdateOrganizerCommand(
                Id: orgId, Name: "Þórsmörk Running Club", Kennitala: null, Phone: null,
                Email: null, Website: null, Description: null, ContactName: null,
                Slug: null
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var org = await verifyCtx.Organizers.FindAsync(orgId);
        Assert.Equal("thorsmork-running-club", org!.Slug);
    }

    [Fact]
    public async Task Update_Organizer_Returns_False_ForUnknownId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new UpdateOrganizerCommandHandler(ctx);
        var success = await handler.Handle(new UpdateOrganizerCommand(
            Id: Guid.NewGuid(), Name: "Ghost", Kennitala: null, Phone: null,
            Email: null, Website: null, Description: null, ContactName: null
        ), CancellationToken.None);
        Assert.False(success);
    }

    // ─── DeleteOrganizerCommand ───

    [Fact]
    public async Task Delete_Organizer_Succeeds()
    {
        Guid orgId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await handler.Handle(new CreateOrganizerCommand(
                Name: "To Delete", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteOrganizerCommandHandler(ctx);
            var success = await handler.Handle(new DeleteOrganizerCommand(orgId), CancellationToken.None);
            Assert.True(success);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Null(await verifyCtx.Organizers.FindAsync(orgId));
    }

    [Fact]
    public async Task Delete_Organizer_Returns_False_ForUnknownId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new DeleteOrganizerCommandHandler(ctx);
        var success = await handler.Handle(new DeleteOrganizerCommand(Guid.NewGuid()), CancellationToken.None);
        Assert.False(success);
    }

    // ─── GetOrganizersQuery ───

    [Fact]
    public async Task GetOrganizers_Returns_OrderedByName()
    {
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            foreach (var name in new[] { "Zebra Club", "Alpha Club", "Middle Club" })
            {
                await handler.Handle(new CreateOrganizerCommand(
                    Name: name, Kennitala: null, Phone: null, Email: null,
                    Website: null, Description: null, ContactName: null
                ), CancellationToken.None);
            }
        }

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetOrganizersQueryHandler(ctx2);
        var result = await handler2.Handle(new GetOrganizersQuery(), CancellationToken.None);

        var names = result.Select(o => o.Name).ToList();
        Assert.Equal(new[] { "Alpha Club", "Middle Club", "Zebra Club" }, names);
    }

    [Fact]
    public async Task GetOrganizers_IncludesCorrectEventCount()
    {
        Guid orgId;
        using (var ctx = _factory.CreateContext())
        {
            var orgHandler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await orgHandler.Handle(new CreateOrganizerCommand(
                Name: "Counted Org", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);

            ctx.Events.Add(new Event
            {
                Name = "Event A", Slug = "event-a",
                Type = EventType.Race, Status = EventStatus.Confirmed,
                OrganizerId = orgId,
            });
            ctx.Events.Add(new Event
            {
                Name = "Event B", Slug = "event-b",
                Type = EventType.Race, Status = EventStatus.Confirmed,
                OrganizerId = orgId,
            });
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handler = new GetOrganizersQueryHandler(ctx2);
        var result = await handler.Handle(new GetOrganizersQuery(), CancellationToken.None);

        var org = result.Single(o => o.Id == orgId);
        Assert.Equal(2, org.EventCount);
    }

    // ─── GetOrganizerBySlugQuery ───

    [Fact]
    public async Task GetOrganizerBySlug_Returns_Organizer()
    {
        Guid orgId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await handler.Handle(new CreateOrganizerCommand(
                Name: "Slugged Org", Kennitala: null, Phone: null, Email: null,
                Website: "https://slugged.is", Description: "A description", ContactName: "Sigríður"
            ), CancellationToken.None);
        }

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetOrganizerBySlugQueryHandler(ctx2);
        var org = await handler2.Handle(new GetOrganizerBySlugQuery("slugged-org"), CancellationToken.None);

        Assert.NotNull(org);
        Assert.Equal(orgId, org!.Id);
        Assert.Equal("Slugged Org", org.Name);
        Assert.Equal("slugged-org", org.Slug);
        Assert.Equal("https://slugged.is", org.Website);
        Assert.Equal("A description", org.Description);
        Assert.Equal("Sigríður", org.ContactName);
    }

    [Fact]
    public async Task GetOrganizerBySlug_Returns_Null_ForUnknownSlug()
    {
        using var ctx = _factory.CreateContext();
        var handler = new GetOrganizerBySlugQueryHandler(ctx);
        var result = await handler.Handle(new GetOrganizerBySlugQuery("does-not-exist"), CancellationToken.None);
        Assert.Null(result);
    }
}
