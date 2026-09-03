using Microsoft.EntityFrameworkCore;
using Moq;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Organizers;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class OrganizerHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly ICacheInvalidator _cacheInvalidator = new Mock<ICacheInvalidator>().Object;

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
            var handler = new UpdateOrganizerCommandHandler(ctx, _cacheInvalidator);
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
        Assert.Equal("old-name", org.Slug);
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
            var handler = new UpdateOrganizerCommandHandler(ctx, _cacheInvalidator);
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
    public async Task Update_Organizer_PreservesSlug_WhenSlugNotProvided()
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
            var handler = new UpdateOrganizerCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new UpdateOrganizerCommand(
                Id: orgId, Name: "Þórsmörk Running Club", Kennitala: null, Phone: null,
                Email: null, Website: null, Description: null, ContactName: null,
                Slug: null
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var org = await verifyCtx.Organizers.FindAsync(orgId);
        Assert.Equal("Þórsmörk Running Club", org!.Name);
        Assert.Equal("original-name", org.Slug);
    }

    [Fact]
    public async Task Update_Organizer_PreservesSlug_WhenSlugIsBlank()
    {
        Guid orgId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await handler.Handle(new CreateOrganizerCommand(
                Name: "Blank Slug Org", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateOrganizerCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new UpdateOrganizerCommand(
                Id: orgId, Name: "Renamed Org", Kennitala: null, Phone: null,
                Email: null, Website: null, Description: null, ContactName: null,
                Slug: "   "
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var org = await verifyCtx.Organizers.FindAsync(orgId);
        Assert.Equal("Renamed Org", org!.Name);
        Assert.Equal("blank-slug-org", org.Slug);
    }

    [Fact]
    public async Task Update_Organizer_InvalidatesCache_ForCurrentSlug()
    {
        // Regression test: GetOrganizerBySlugQuery caches for 60 minutes and nothing was evicting
        // it on update, so the public organizer page could serve stale data for up to an hour after
        // any edit — found live while verifying #430's social links feature against the real cache.
        Guid orgId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await handler.Handle(new CreateOrganizerCommand(
                Name: "Cache Org", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        var cacheInvalidator = new Mock<ICacheInvalidator>();
        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateOrganizerCommandHandler(ctx, cacheInvalidator.Object);
            await handler.Handle(new UpdateOrganizerCommand(
                Id: orgId, Name: "Cache Org Updated", Kennitala: null, Phone: null,
                Email: null, Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        cacheInvalidator.Verify(c => c.InvalidateOrganizer("cache-org"), Times.Once);
    }

    [Fact]
    public async Task Update_Organizer_InvalidatesCache_ForBothOldAndNewSlug_WhenSlugChanges()
    {
        Guid orgId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await handler.Handle(new CreateOrganizerCommand(
                Name: "Rename Cache Org", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        var cacheInvalidator = new Mock<ICacheInvalidator>();
        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateOrganizerCommandHandler(ctx, cacheInvalidator.Object);
            await handler.Handle(new UpdateOrganizerCommand(
                Id: orgId, Name: "Rename Cache Org", Kennitala: null, Phone: null,
                Email: null, Website: null, Description: null, ContactName: null,
                Slug: "renamed-cache-org"
            ), CancellationToken.None);
        }

        cacheInvalidator.Verify(c => c.InvalidateOrganizer("renamed-cache-org"), Times.Once);
        cacheInvalidator.Verify(c => c.InvalidateOrganizer("rename-cache-org"), Times.Once);
    }

    [Fact]
    public async Task Update_Organizer_CollidingSlug_ThrowsDbUpdateException()
    {
        // #587 — Update endpoints have no test coverage for the outer try/catch in Program.cs
        // (that block only fires on a real PostgresException, which SQLite's in-memory test DB
        // can't produce — the Create-side equivalent left the same gap in #586). This confirms
        // the precondition the endpoint's catch relies on: IX_Organizers_Slug's unique index
        // does reject a colliding slug at SaveChangesAsync, surfacing as a DbUpdateException,
        // exactly like the Create path already covers.
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            await handler.Handle(new CreateOrganizerCommand(
                Name: "Jón Jónsson", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        Guid otherId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            (otherId, _) = await handler.Handle(new CreateOrganizerCommand(
                Name: "Some Other Club", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        using var updateCtx = _factory.CreateContext();
        var updateHandler = new UpdateOrganizerCommandHandler(updateCtx, _cacheInvalidator);
        // Explicit Slug mirrors "Jon Jonsson" (no diacritics) normalizing to the same slug as
        // "Jón Jónsson" — the exact ambiguity #561/#586 fixed on the Create side.
        await Assert.ThrowsAsync<DbUpdateException>(() => updateHandler.Handle(new UpdateOrganizerCommand(
            Id: otherId, Name: "Some Other Club", Kennitala: null, Phone: null,
            Email: null, Website: null, Description: null, ContactName: null,
            Slug: "jon-jonsson"
        ), CancellationToken.None));
    }

    [Fact]
    public async Task Update_Organizer_Returns_False_ForUnknownId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new UpdateOrganizerCommandHandler(ctx, _cacheInvalidator);
        var success = await handler.Handle(new UpdateOrganizerCommand(
            Id: Guid.NewGuid(), Name: "Ghost", Kennitala: null, Phone: null,
            Email: null, Website: null, Description: null, ContactName: null
        ), CancellationToken.None);
        Assert.False(success);
    }

    [Fact]
    public async Task Update_Organizer_SavesSocialLinks()
    {
        Guid orgId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await handler.Handle(new CreateOrganizerCommand(
                Name: "Social Org", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        var links = new List<SocialLink>
        {
            new() { Type = "Instagram", Url = "https://instagram.com/socialorg" },
            new() { Type = "Facebook", Url = "https://facebook.com/socialorg" },
        };

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateOrganizerCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new UpdateOrganizerCommand(
                Id: orgId, Name: "Social Org", Kennitala: null, Phone: null,
                Email: null, Website: null, Description: null, ContactName: null,
                SocialLinks: links
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var org = await verifyCtx.Organizers.FindAsync(orgId);
        Assert.NotNull(org!.SocialLinks);
        Assert.Equal(2, org.SocialLinks!.Count);
        Assert.Equal("Instagram", org.SocialLinks[0].Type);
        Assert.Equal("https://instagram.com/socialorg", org.SocialLinks[0].Url);
    }

    [Fact]
    public async Task Update_Organizer_ClearsSocialLinks_WhenNull()
    {
        Guid orgId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await handler.Handle(new CreateOrganizerCommand(
                Name: "Org With Links", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var org = await ctx.Organizers.FindAsync(orgId);
            org!.SocialLinks = [new SocialLink { Type = "Facebook", Url = "https://facebook.com/x" }];
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateOrganizerCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new UpdateOrganizerCommand(
                Id: orgId, Name: "Org With Links", Kennitala: null, Phone: null,
                Email: null, Website: null, Description: null, ContactName: null,
                SocialLinks: null
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var updated = await verifyCtx.Organizers.FindAsync(orgId);
        Assert.Null(updated!.SocialLinks);
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
    public async Task Delete_Organizer_ClearsOrganizerNameOnLinkedEvents()
    {
        Guid orgId;
        Guid eventId;
        using (var ctx = _factory.CreateContext())
        {
            var orgHandler = new CreateOrganizerCommandHandler(ctx);
            (orgId, _) = await orgHandler.Handle(new CreateOrganizerCommand(
                Name: "Acme Running", Kennitala: null, Phone: null, Email: null,
                Website: null, Description: null, ContactName: null
            ), CancellationToken.None);

            var ev = new Event
            {
                Name = "Acme Race", Slug = "acme-race",
                Type = EventType.Race, Status = EventStatus.Confirmed,
                OrganizerId = orgId,
                OrganizerName = "Acme Running",
                OrganizerWebsite = "https://acme.is",
            };
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
            eventId = ev.Id;
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteOrganizerCommandHandler(ctx);
            await handler.Handle(new DeleteOrganizerCommand(orgId), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var updated = await verifyCtx.Events.FindAsync(eventId);
        Assert.NotNull(updated);
        Assert.Null(updated!.OrganizerId);
        Assert.Null(updated.OrganizerName);
        Assert.Null(updated.OrganizerWebsite);
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
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreateOrganizerCommandHandler(ctx);
            await handler.Handle(new CreateOrganizerCommand(
                Name: "Slugged Org", Kennitala: null, Phone: null, Email: null,
                Website: "https://slugged.is", Description: "A description", ContactName: "Sigríður"
            ), CancellationToken.None);
        }

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetOrganizerBySlugQueryHandler(ctx2);
        var org = await handler2.Handle(new GetOrganizerBySlugQuery("slugged-org"), CancellationToken.None);

        Assert.NotNull(org);
        Assert.Equal("Slugged Org", org!.Name);
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
