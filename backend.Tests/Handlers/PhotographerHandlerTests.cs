using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Photographers;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class PhotographerHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;

    public PhotographerHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    // ─── CreatePhotographerCommand ───

    [Fact]
    public async Task Create_Photographer_Succeeds()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreatePhotographerCommandHandler(ctx);

        var (id, slug) = await handler.Handle(new CreatePhotographerCommand(
            Name: "Jón Jónsson",
            Website: "https://jonjonsson.is",
            Email: "jon@jonsson.is",
            Description: "A landscape photographer",
            DescriptionEn: "A landscape photographer"
        ), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);
        Assert.Equal("jon-jonsson", slug);

        using var verifyCtx = _factory.CreateContext();
        var photographer = await verifyCtx.Photographers.FindAsync(id);
        Assert.NotNull(photographer);
        Assert.Equal("Jón Jónsson", photographer!.Name);
        Assert.Equal("jon-jonsson", photographer.Slug);
        Assert.Equal("https://jonjonsson.is", photographer.Website);
        Assert.Equal("jon@jonsson.is", photographer.Email);
        Assert.Equal("A landscape photographer", photographer.Description);
    }

    [Fact]
    public async Task Create_Photographer_AutoGeneratesSlug_ForIcelandicName()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreatePhotographerCommandHandler(ctx);

        var (_, slug) = await handler.Handle(new CreatePhotographerCommand(
            Name: "Þórunn Æsudóttir",
            Website: null, Email: null, Description: null
        ), CancellationToken.None);

        Assert.Equal("thorunn-aesudottir", slug);
    }

    // ─── UpdatePhotographerCommand ───

    [Fact]
    public async Task Update_Photographer_Succeeds()
    {
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Old Name", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdatePhotographerCommandHandler(ctx);
            var success = await handler.Handle(new UpdatePhotographerCommand(
                Id: photographerId, Name: "New Name", Website: "https://new.is",
                Email: "new@email.is", Description: "Updated"
            ), CancellationToken.None);
            Assert.True(success);
        }

        using var verifyCtx = _factory.CreateContext();
        var photographer = await verifyCtx.Photographers.FindAsync(photographerId);
        Assert.NotNull(photographer);
        Assert.Equal("New Name", photographer!.Name);
        Assert.Equal("old-name", photographer.Slug);
        Assert.Equal("https://new.is", photographer.Website);
        Assert.Equal("new@email.is", photographer.Email);
        Assert.Equal("Updated", photographer.Description);
    }

    [Fact]
    public async Task Update_Photographer_UsesExplicitSlug()
    {
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Test Photographer", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdatePhotographerCommandHandler(ctx);
            await handler.Handle(new UpdatePhotographerCommand(
                Id: photographerId, Name: "Test Photographer", Website: null, Email: null,
                Description: null, Slug: "my-custom-slug"
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var photographer = await verifyCtx.Photographers.FindAsync(photographerId);
        Assert.Equal("my-custom-slug", photographer!.Slug);
    }

    [Fact]
    public async Task Update_Photographer_PreservesSlug_WhenSlugNotProvided()
    {
        // Regression test for the #420/#428 bug family: renaming Name alone must not
        // regenerate the slug from the new name — see UpdatePhotographerCommandHandler,
        // which only overwrites Slug when the request explicitly supplies one.
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Original Name", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdatePhotographerCommandHandler(ctx);
            await handler.Handle(new UpdatePhotographerCommand(
                Id: photographerId, Name: "Þórsmörk Photography", Website: null, Email: null,
                Description: null, Slug: null
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var photographer = await verifyCtx.Photographers.FindAsync(photographerId);
        Assert.Equal("Þórsmörk Photography", photographer!.Name);
        Assert.Equal("original-name", photographer.Slug);
    }

    [Fact]
    public async Task Update_Photographer_PreservesSlug_WhenSlugIsBlank()
    {
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Blank Slug Photographer", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdatePhotographerCommandHandler(ctx);
            await handler.Handle(new UpdatePhotographerCommand(
                Id: photographerId, Name: "Renamed Photographer", Website: null, Email: null,
                Description: null, Slug: "   "
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var photographer = await verifyCtx.Photographers.FindAsync(photographerId);
        Assert.Equal("Renamed Photographer", photographer!.Name);
        Assert.Equal("blank-slug-photographer", photographer.Slug);
    }

    [Fact]
    public async Task Update_Photographer_CollidingSlug_ThrowsDbUpdateException()
    {
        // #587 — Update endpoints have no test coverage for the outer try/catch in Program.cs
        // (that block only fires on a real PostgresException, which SQLite's in-memory test DB
        // can't produce — the Create-side equivalent left the same gap in #586). This confirms
        // the precondition the endpoint's catch relies on: IX_Photographers_Slug's unique index
        // does reject a colliding slug at SaveChangesAsync, surfacing as a DbUpdateException,
        // exactly like the Create path already covers.
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            await handler.Handle(new CreatePhotographerCommand(
                Name: "Jón Jónsson", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        Guid otherId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (otherId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Some Other Photographer", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        using var updateCtx = _factory.CreateContext();
        var updateHandler = new UpdatePhotographerCommandHandler(updateCtx);
        // Explicit Slug mirrors "Jon Jonsson" (no diacritics) normalizing to the same slug as
        // "Jón Jónsson" — the exact ambiguity #561/#586 fixed on the Create side.
        await Assert.ThrowsAsync<DbUpdateException>(() => updateHandler.Handle(new UpdatePhotographerCommand(
            Id: otherId, Name: "Some Other Photographer", Website: null, Email: null,
            Description: null, Slug: "jon-jonsson"
        ), CancellationToken.None));
    }

    [Fact]
    public async Task Update_Photographer_Returns_False_ForUnknownId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new UpdatePhotographerCommandHandler(ctx);
        var success = await handler.Handle(new UpdatePhotographerCommand(
            Id: Guid.NewGuid(), Name: "Ghost", Website: null, Email: null, Description: null
        ), CancellationToken.None);
        Assert.False(success);
    }

    [Fact]
    public async Task Update_Photographer_SavesSocialLinks()
    {
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Social Photographer", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        var links = new List<SocialLink>
        {
            new() { Type = "Instagram", Url = "https://instagram.com/socialphotographer" },
            new() { Type = "Facebook", Url = "https://facebook.com/socialphotographer" },
        };

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdatePhotographerCommandHandler(ctx);
            await handler.Handle(new UpdatePhotographerCommand(
                Id: photographerId, Name: "Social Photographer", Website: null, Email: null,
                Description: null, SocialLinks: links
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var photographer = await verifyCtx.Photographers.FindAsync(photographerId);
        Assert.NotNull(photographer!.SocialLinks);
        Assert.Equal(2, photographer.SocialLinks!.Count);
        Assert.Equal("Instagram", photographer.SocialLinks[0].Type);
        Assert.Equal("https://instagram.com/socialphotographer", photographer.SocialLinks[0].Url);
    }

    [Fact]
    public async Task Update_Photographer_ClearsSocialLinks_WhenNull()
    {
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Photographer With Links", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var photographer = await ctx.Photographers.FindAsync(photographerId);
            photographer!.SocialLinks = [new SocialLink { Type = "Facebook", Url = "https://facebook.com/x" }];
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdatePhotographerCommandHandler(ctx);
            await handler.Handle(new UpdatePhotographerCommand(
                Id: photographerId, Name: "Photographer With Links", Website: null, Email: null,
                Description: null, SocialLinks: null
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var updated = await verifyCtx.Photographers.FindAsync(photographerId);
        Assert.Null(updated!.SocialLinks);
    }

    // ─── DeletePhotographerCommand ───

    [Fact]
    public async Task Delete_Photographer_Succeeds()
    {
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "To Delete", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeletePhotographerCommandHandler(ctx);
            var success = await handler.Handle(new DeletePhotographerCommand(photographerId), CancellationToken.None);
            Assert.True(success);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Null(await verifyCtx.Photographers.FindAsync(photographerId));
    }

    [Fact]
    public async Task Delete_Photographer_Returns_False_ForUnknownId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new DeletePhotographerCommandHandler(ctx);
        var success = await handler.Handle(new DeletePhotographerCommand(Guid.NewGuid()), CancellationToken.None);
        Assert.False(success);
    }

    [Fact]
    public async Task Delete_Photographer_WithoutReassignment_LeavesGalleriesUnattributed()
    {
        // No ReassignToPhotographerId — the DB-level SetNull rule on PhotoGallery.PhotographerId
        // handles this with no manual clearing needed in the handler.
        var (photographerId, _, galleryId) = await SeedPhotographerWithGallery();

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeletePhotographerCommandHandler(ctx);
            var success = await handler.Handle(new DeletePhotographerCommand(photographerId), CancellationToken.None);
            Assert.True(success);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Null(await verifyCtx.Photographers.FindAsync(photographerId));
        var gallery = await verifyCtx.PhotoGalleries.FindAsync(galleryId);
        Assert.NotNull(gallery);
        Assert.Null(gallery!.PhotographerId);
    }

    [Fact]
    public async Task Delete_Photographer_WithReassignment_MovesAllGalleries_ThenDeletes()
    {
        var (photographerId, _, _) = await SeedPhotographerWithGallery(galleryCount: 3);

        Guid targetId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (targetId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Reassignment Target", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeletePhotographerCommandHandler(ctx);
            var success = await handler.Handle(new DeletePhotographerCommand(photographerId, targetId), CancellationToken.None);
            Assert.True(success);
        }

        // Both halves of the operation must be visible together: the source photographer is gone
        // and every one of its galleries — not some subset — now points at the target. There's no
        // literal mid-transaction fault injected here (per existing test conventions in this repo),
        // but asserting all three galleries moved together is the closest black-box equivalent of
        // "no partial state": a handler that reassigned only some rows before failing would fail
        // this count assertion just as visibly as one that left the photographer un-deleted.
        using var verifyCtx = _factory.CreateContext();
        Assert.Null(await verifyCtx.Photographers.FindAsync(photographerId));
        var movedCount = await verifyCtx.PhotoGalleries.CountAsync(g => g.PhotographerId == targetId);
        Assert.Equal(3, movedCount);
        var remainingOnSource = await verifyCtx.PhotoGalleries.CountAsync(g => g.PhotographerId == photographerId);
        Assert.Equal(0, remainingOnSource);
    }

    [Fact]
    public async Task Delete_Photographer_ReassignToSelf_IsTreatedAsNoTarget()
    {
        // Defensive guard: a reassign-to-self request (shouldn't happen via the admin picker, which
        // excludes the photographer being deleted) must not leave galleries pointing at a
        // now-deleted photographer — it falls back to the same SetNull behaviour as no target.
        var (photographerId, _, galleryId) = await SeedPhotographerWithGallery();

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeletePhotographerCommandHandler(ctx);
            var success = await handler.Handle(new DeletePhotographerCommand(photographerId, photographerId), CancellationToken.None);
            Assert.True(success);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Null(await verifyCtx.Photographers.FindAsync(photographerId));
        var gallery = await verifyCtx.PhotoGalleries.FindAsync(galleryId);
        Assert.NotNull(gallery);
        Assert.Null(gallery!.PhotographerId);
    }

    private async Task<(Guid PhotographerId, Guid EditionId, Guid GalleryId)> SeedPhotographerWithGallery(int galleryCount = 1)
    {
        using var ctx = _factory.CreateContext();
        var photographer = new Photographer { Name = "Gallery Owner", Slug = $"gallery-owner-{Guid.NewGuid():N}" };
        ctx.Photographers.Add(photographer);

        var ev = new Event
        {
            Name = "Gallery Event", Slug = $"gallery-event-{Guid.NewGuid():N}",
            Type = EventType.Race, Status = EventStatus.Confirmed,
        };
        ctx.Events.Add(ev);
        await ctx.SaveChangesAsync();

        var edition = new EventEdition
        {
            EventId = ev.Id,
            RegistrationStatus = RegistrationStatus.NotRequired,
        };
        ctx.EventEditions.Add(edition);
        await ctx.SaveChangesAsync();

        Guid firstGalleryId = Guid.Empty;
        for (var i = 0; i < galleryCount; i++)
        {
            var gallery = new PhotoGallery
            {
                EventEditionId = edition.Id,
                PhotographerId = photographer.Id,
                Url = $"https://photos.example.com/gallery-{i}",
            };
            ctx.PhotoGalleries.Add(gallery);
            if (i == 0) firstGalleryId = gallery.Id;
        }
        await ctx.SaveChangesAsync();

        return (photographer.Id, edition.Id, firstGalleryId);
    }

    // ─── GetPhotographersQuery ───

    [Fact]
    public async Task GetPhotographers_Returns_OrderedByName()
    {
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            foreach (var name in new[] { "Zebra Photography", "Alpha Photography", "Middle Photography" })
            {
                await handler.Handle(new CreatePhotographerCommand(
                    Name: name, Website: null, Email: null, Description: null
                ), CancellationToken.None);
            }
        }

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetPhotographersQueryHandler(ctx2);
        var result = await handler2.Handle(new GetPhotographersQuery(), CancellationToken.None);

        var names = result.Select(p => p.Name).ToList();
        Assert.Equal(new[] { "Alpha Photography", "Middle Photography", "Zebra Photography" }, names);
    }

    [Fact]
    public async Task GetPhotographers_GalleryCount_IsZero_ForPhotographerWithNoGalleries()
    {
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            await handler.Handle(new CreatePhotographerCommand(
                Name: "No Galleries Photographer", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetPhotographersQueryHandler(ctx2);
        var result = await handler2.Handle(new GetPhotographersQuery(), CancellationToken.None);

        var photographer = result.Single(p => p.Name == "No Galleries Photographer");
        Assert.Equal(0, photographer.GalleryCount);
    }

    [Fact]
    public async Task GetPhotographers_IncludesCorrectGalleryCount()
    {
        var (photographerId, _, _) = await SeedPhotographerWithGallery(galleryCount: 2);

        using var ctx = _factory.CreateContext();
        var handler = new GetPhotographersQueryHandler(ctx);
        var result = await handler.Handle(new GetPhotographersQuery(), CancellationToken.None);

        var photographer = result.Single(p => p.Id == photographerId);
        Assert.Equal(2, photographer.GalleryCount);
    }

    // ─── GetPhotographerBySlugQuery ───

    [Fact]
    public async Task GetPhotographerBySlug_Returns_Photographer()
    {
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Slugged Photographer", Website: "https://slugged.is", Email: null,
                Description: "A description"
            ), CancellationToken.None);
        }

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetPhotographerBySlugQueryHandler(ctx2);
        var photographer = await handler2.Handle(new GetPhotographerBySlugQuery("slugged-photographer"), CancellationToken.None);

        Assert.NotNull(photographer);
        Assert.Equal(photographerId, photographer!.Id);
        Assert.Equal("Slugged Photographer", photographer.Name);
        Assert.Equal("slugged-photographer", photographer.Slug);
        Assert.Equal("https://slugged.is", photographer.Website);
        Assert.Equal("A description", photographer.Description);
        Assert.Equal(0, photographer.GalleryCount);
    }

    [Fact]
    public async Task GetPhotographerBySlug_IncludesCorrectGalleryCount()
    {
        var (photographerId, _, _) = await SeedPhotographerWithGallery(galleryCount: 4);

        using var ctx = _factory.CreateContext();
        var slug = (await ctx.Photographers.FindAsync(photographerId))!.Slug;

        using var ctx2 = _factory.CreateContext();
        var handler = new GetPhotographerBySlugQueryHandler(ctx2);
        var photographer = await handler.Handle(new GetPhotographerBySlugQuery(slug), CancellationToken.None);

        Assert.NotNull(photographer);
        Assert.Equal(4, photographer!.GalleryCount);
    }

    [Fact]
    public async Task GetPhotographerBySlug_Returns_Null_ForUnknownSlug()
    {
        using var ctx = _factory.CreateContext();
        var handler = new GetPhotographerBySlugQueryHandler(ctx);
        var result = await handler.Handle(new GetPhotographerBySlugQuery("does-not-exist"), CancellationToken.None);
        Assert.Null(result);
    }

    // ─── PhotographerPublicDto shape (#494) ───

    [Fact]
    public void PhotographerPublicDto_DoesNotExposeAdminOnlyFields()
    {
        // The public projection must withhold everything an anonymous visitor has no business
        // seeing: Id, Email, TranslationHashes and auditing fields — mirrors OrganizerPublicDto's
        // treatment of Organizer's admin-only fields.
        var propertyNames = typeof(PhotographerPublicDto).GetProperties().Select(p => p.Name).ToHashSet();

        Assert.DoesNotContain("Id", propertyNames);
        Assert.DoesNotContain("Email", propertyNames);
        Assert.DoesNotContain("TranslationHashes", propertyNames);
        Assert.DoesNotContain("CreatedAt", propertyNames);
        Assert.DoesNotContain("UpdatedAt", propertyNames);

        var expected = new[] { "Name", "Slug", "Website", "Description", "DescriptionEn", "Galleries", "SocialLinks" };
        Assert.Equal(expected.Length, propertyNames.Count);
        foreach (var name in expected)
            Assert.Contains(name, propertyNames);
    }

    // ─── GetPhotographerPublicBySlugQuery ───

    private async Task<(Guid PhotographerId, Guid EventId, Guid EditionId)> SeedGalleryFixture(
        Guid photographerId, string eventSlug, EventStatus eventStatus, int? editionYear, DateOnly? editionDate, string galleryUrl,
        EditionStatus editionStatus = EditionStatus.Active)
    {
        using var ctx = _factory.CreateContext();
        var ev = new Event
        {
            Name = eventSlug, Slug = eventSlug,
            Type = EventType.Race, Status = eventStatus,
        };
        ctx.Events.Add(ev);
        await ctx.SaveChangesAsync();

        var edition = new EventEdition
        {
            EventId = ev.Id,
            Year = editionYear,
            Date = editionDate,
            Status = editionStatus,
            RegistrationStatus = RegistrationStatus.NotRequired,
        };
        ctx.EventEditions.Add(edition);
        await ctx.SaveChangesAsync();

        ctx.PhotoGalleries.Add(new PhotoGallery
        {
            EventEditionId = edition.Id,
            PhotographerId = photographerId,
            Url = galleryUrl,
        });
        await ctx.SaveChangesAsync();

        return (photographerId, ev.Id, edition.Id);
    }

    [Fact]
    public async Task GetPhotographerPublicBySlug_Returns_PublicFieldsOnly()
    {
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Public Photographer", Website: "https://public.is",
                Email: "secret@public.is", Description: "A description"
            ), CancellationToken.None);
        }

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetPhotographerPublicBySlugQueryHandler(ctx2);
        var result = await handler2.Handle(new GetPhotographerPublicBySlugQuery("public-photographer"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Public Photographer", result!.Name);
        Assert.Equal("public-photographer", result.Slug);
        Assert.Equal("https://public.is", result.Website);
        Assert.Equal("A description", result.Description);
        Assert.Empty(result.Galleries);
    }

    [Fact]
    public async Task GetPhotographerPublicBySlug_Returns_Null_ForUnknownSlug()
    {
        using var ctx = _factory.CreateContext();
        var handler = new GetPhotographerPublicBySlugQueryHandler(ctx);
        var result = await handler.Handle(new GetPhotographerPublicBySlugQuery("does-not-exist"), CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task GetPhotographerPublicBySlug_WithNoGalleries_DoesNotThrow()
    {
        // Regression guard: a photographer with zero attributed galleries must render an empty
        // list, not throw or 500 — the frontend page's empty state depends on this.
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Empty Photographer", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetPhotographerPublicBySlugQueryHandler(ctx2);
        var result = await handler2.Handle(new GetPhotographerPublicBySlugQuery("empty-photographer"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.NotNull(result!.Galleries);
        Assert.Empty(result.Galleries);
    }

    [Fact]
    public async Task GetPhotographerPublicBySlug_Excludes_HiddenAndUnlistedEvents()
    {
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Filtered Photographer", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        await SeedGalleryFixture(photographerId, "visible-event", EventStatus.Confirmed, 2025, new DateOnly(2025, 6, 1), "https://photos.example.com/visible");
        await SeedGalleryFixture(photographerId, "hidden-event", EventStatus.Hidden, 2025, new DateOnly(2025, 5, 1), "https://photos.example.com/hidden");
        await SeedGalleryFixture(photographerId, "unlisted-event", EventStatus.Unlisted, 2025, new DateOnly(2025, 4, 1), "https://photos.example.com/unlisted");

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetPhotographerPublicBySlugQueryHandler(ctx2);
        var result = await handler2.Handle(new GetPhotographerPublicBySlugQuery("filtered-photographer"), CancellationToken.None);

        var gallery = Assert.Single(result!.Galleries);
        Assert.Equal("https://photos.example.com/visible", gallery.GalleryUrl);
    }

    [Fact]
    public async Task GetPhotographerPublicBySlug_Excludes_IndividuallyHiddenEdition()
    {
        // An admin can hide a single edition while its parent event stays public (e.g. one
        // cancelled/retired year of an otherwise ongoing race) — the edition-level filter must
        // catch that case even though Event.Status alone would let it through.
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Edition Filtered Photographer", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        await SeedGalleryFixture(photographerId, "visible-edition-event", EventStatus.Confirmed, 2025, new DateOnly(2025, 6, 1), "https://photos.example.com/visible-edition");
        await SeedGalleryFixture(photographerId, "hidden-edition-event", EventStatus.Confirmed, 2024, new DateOnly(2024, 6, 1), "https://photos.example.com/hidden-edition", EditionStatus.Hidden);

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetPhotographerPublicBySlugQueryHandler(ctx2);
        var result = await handler2.Handle(new GetPhotographerPublicBySlugQuery("edition-filtered-photographer"), CancellationToken.None);

        var gallery = Assert.Single(result!.Galleries);
        Assert.Equal("https://photos.example.com/visible-edition", gallery.GalleryUrl);
    }

    [Fact]
    public async Task GetPhotographerPublicBySlug_Sorts_NewestEditionFirst()
    {
        Guid photographerId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotographerCommandHandler(ctx);
            (photographerId, _) = await handler.Handle(new CreatePhotographerCommand(
                Name: "Sorted Photographer", Website: null, Email: null, Description: null
            ), CancellationToken.None);
        }

        await SeedGalleryFixture(photographerId, "oldest-event", EventStatus.Confirmed, 2022, new DateOnly(2022, 6, 1), "https://photos.example.com/2022");
        await SeedGalleryFixture(photographerId, "newest-event", EventStatus.Confirmed, 2025, new DateOnly(2025, 6, 1), "https://photos.example.com/2025");
        await SeedGalleryFixture(photographerId, "middle-event", EventStatus.Confirmed, 2023, new DateOnly(2023, 6, 1), "https://photos.example.com/2023");

        using var ctx2 = _factory.CreateContext();
        var handler2 = new GetPhotographerPublicBySlugQueryHandler(ctx2);
        var result = await handler2.Handle(new GetPhotographerPublicBySlugQuery("sorted-photographer"), CancellationToken.None);

        Assert.Equal(
            new[] { "https://photos.example.com/2025", "https://photos.example.com/2023", "https://photos.example.com/2022" },
            result!.Galleries.Select(g => g.GalleryUrl).ToArray());
    }
}
