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
        Guid photographerId, string eventSlug, EventStatus eventStatus, int? editionYear, DateOnly? editionDate, string galleryUrl)
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
