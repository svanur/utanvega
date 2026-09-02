using FluentValidation.TestHelper;
using Microsoft.EntityFrameworkCore;
using Moq;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.PhotoGalleries;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class PhotoGalleryHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly ICacheInvalidator _cacheInvalidator = new Mock<ICacheInvalidator>().Object;

    public PhotoGalleryHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private async Task<EventEdition> SeedEdition()
    {
        using var db = _factory.CreateContext();
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "Test Event",
            Slug = $"test-event-{Guid.NewGuid():N}",
            Type = EventType.Race,
            Status = EventStatus.Confirmed,
        };
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            RegistrationStatus = RegistrationStatus.Open,
        };
        db.Events.Add(ev);
        db.EventEditions.Add(edition);
        await db.SaveChangesAsync();

        // Fix up the navigation explicitly rather than relying on EF's in-memory change tracker
        // fixup — callers need edition.Event.Slug available without a separate Include roundtrip.
        edition.Event = ev;
        return edition;
    }

    private async Task<Photographer> SeedPhotographer()
    {
        using var db = _factory.CreateContext();
        var photographer = new Photographer
        {
            Id = Guid.NewGuid(),
            Name = "Jón Jónsson",
            Slug = $"jon-jonsson-{Guid.NewGuid():N}",
        };
        db.Photographers.Add(photographer);
        await db.SaveChangesAsync();
        return photographer;
    }

    // ─── CreatePhotoGalleryCommand ───

    [Fact]
    public async Task Create_PhotoGallery_Succeeds()
    {
        var edition = await SeedEdition();

        using var ctx = _factory.CreateContext();
        var handler = new CreatePhotoGalleryCommandHandler(ctx, _cacheInvalidator);

        var id = await handler.Handle(new CreatePhotoGalleryCommand(
            EventEditionId: edition.Id,
            Url: "https://photos.example.com/gallery",
            PhotographerId: null,
            Title: "Race day",
            TitleEn: "Race day",
            SortOrder: 0
        ), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);

        using var verifyCtx = _factory.CreateContext();
        var gallery = await verifyCtx.PhotoGalleries.FindAsync(id);
        Assert.NotNull(gallery);
        Assert.Equal(edition.Id, gallery!.EventEditionId);
        Assert.Equal("https://photos.example.com/gallery", gallery.Url);
        Assert.Null(gallery.PhotographerId);
        Assert.Equal("Race day", gallery.Title);
    }

    [Fact]
    public async Task Create_PhotoGallery_AcceptsPhotographerId()
    {
        var edition = await SeedEdition();
        var photographer = await SeedPhotographer();

        using var ctx = _factory.CreateContext();
        var handler = new CreatePhotoGalleryCommandHandler(ctx, _cacheInvalidator);

        var id = await handler.Handle(new CreatePhotoGalleryCommand(
            EventEditionId: edition.Id,
            Url: "https://photos.example.com/gallery-2",
            PhotographerId: photographer.Id,
            Title: null
        ), CancellationToken.None);

        using var verifyCtx = _factory.CreateContext();
        var gallery = await verifyCtx.PhotoGalleries.FindAsync(id);
        Assert.NotNull(gallery);
        Assert.Equal(photographer.Id, gallery!.PhotographerId);
    }

    [Fact]
    public async Task Create_PhotoGallery_InvalidatesEventCache_WithEventSlug()
    {
        // #559 — the event page and editions history page cache the gallery list, so adding one
        // must invalidate the owning event's public cache, not just write the row.
        var edition = await SeedEdition();
        var cacheInvalidator = new Mock<ICacheInvalidator>();

        using var ctx = _factory.CreateContext();
        var handler = new CreatePhotoGalleryCommandHandler(ctx, cacheInvalidator.Object);

        await handler.Handle(new CreatePhotoGalleryCommand(
            EventEditionId: edition.Id,
            Url: "https://photos.example.com/invalidate-on-create",
            PhotographerId: null,
            Title: null
        ), CancellationToken.None);

        cacheInvalidator.Verify(c => c.InvalidateEvent(edition.Event.Slug), Times.Once);
    }

    // ─── UpdatePhotoGalleryCommand ───

    [Fact]
    public async Task Update_PhotoGallery_Persists()
    {
        var edition = await SeedEdition();
        Guid galleryId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotoGalleryCommandHandler(ctx, _cacheInvalidator);
            galleryId = await handler.Handle(new CreatePhotoGalleryCommand(
                EventEditionId: edition.Id,
                Url: "https://photos.example.com/old",
                PhotographerId: null,
                Title: "Old title"
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdatePhotoGalleryCommandHandler(ctx, _cacheInvalidator);
            var success = await handler.Handle(new UpdatePhotoGalleryCommand(
                Id: galleryId,
                Url: "https://photos.example.com/new",
                PhotographerId: null,
                Title: "New title",
                SortOrder: 2
            ), CancellationToken.None);
            Assert.True(success);
        }

        using var verifyCtx = _factory.CreateContext();
        var gallery = await verifyCtx.PhotoGalleries.FindAsync(galleryId);
        Assert.NotNull(gallery);
        Assert.Equal("https://photos.example.com/new", gallery!.Url);
        Assert.Equal("New title", gallery.Title);
        Assert.Equal(2, gallery.SortOrder);
    }

    [Fact]
    public async Task Update_PhotoGallery_Returns_False_ForUnknownId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new UpdatePhotoGalleryCommandHandler(ctx, _cacheInvalidator);
        var success = await handler.Handle(new UpdatePhotoGalleryCommand(
            Id: Guid.NewGuid(),
            Url: "https://photos.example.com/ghost",
            PhotographerId: null,
            Title: null
        ), CancellationToken.None);
        Assert.False(success);
    }

    [Fact]
    public async Task Update_PhotoGallery_InvalidatesEventCache_WithEventSlug()
    {
        var edition = await SeedEdition();
        Guid galleryId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotoGalleryCommandHandler(ctx, _cacheInvalidator);
            galleryId = await handler.Handle(new CreatePhotoGalleryCommand(
                EventEditionId: edition.Id,
                Url: "https://photos.example.com/before-update",
                PhotographerId: null,
                Title: null
            ), CancellationToken.None);
        }

        var cacheInvalidator = new Mock<ICacheInvalidator>();
        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdatePhotoGalleryCommandHandler(ctx, cacheInvalidator.Object);
            await handler.Handle(new UpdatePhotoGalleryCommand(
                Id: galleryId,
                Url: "https://photos.example.com/after-update",
                PhotographerId: null,
                Title: null
            ), CancellationToken.None);
        }

        cacheInvalidator.Verify(c => c.InvalidateEvent(edition.Event.Slug), Times.Once);
    }

    [Fact]
    public async Task Update_PhotoGallery_UnknownId_DoesNotInvalidateCache()
    {
        var cacheInvalidator = new Mock<ICacheInvalidator>();
        using var ctx = _factory.CreateContext();
        var handler = new UpdatePhotoGalleryCommandHandler(ctx, cacheInvalidator.Object);

        await handler.Handle(new UpdatePhotoGalleryCommand(
            Id: Guid.NewGuid(),
            Url: "https://photos.example.com/ghost",
            PhotographerId: null,
            Title: null
        ), CancellationToken.None);

        cacheInvalidator.Verify(c => c.InvalidateEvent(It.IsAny<string>()), Times.Never);
    }

    // ─── DeletePhotoGalleryCommand ───

    [Fact]
    public async Task Delete_PhotoGallery_Removes()
    {
        var edition = await SeedEdition();
        Guid galleryId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotoGalleryCommandHandler(ctx, _cacheInvalidator);
            galleryId = await handler.Handle(new CreatePhotoGalleryCommand(
                EventEditionId: edition.Id,
                Url: "https://photos.example.com/to-delete",
                PhotographerId: null,
                Title: null
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeletePhotoGalleryCommandHandler(ctx, _cacheInvalidator);
            var success = await handler.Handle(new DeletePhotoGalleryCommand(galleryId), CancellationToken.None);
            Assert.True(success);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Null(await verifyCtx.PhotoGalleries.FindAsync(galleryId));
    }

    [Fact]
    public async Task Delete_PhotoGallery_Returns_False_ForUnknownId()
    {
        using var ctx = _factory.CreateContext();
        var handler = new DeletePhotoGalleryCommandHandler(ctx, _cacheInvalidator);
        var success = await handler.Handle(new DeletePhotoGalleryCommand(Guid.NewGuid()), CancellationToken.None);
        Assert.False(success);
    }

    [Fact]
    public async Task Delete_PhotoGallery_InvalidatesEventCache_WithEventSlug()
    {
        var edition = await SeedEdition();
        Guid galleryId;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotoGalleryCommandHandler(ctx, _cacheInvalidator);
            galleryId = await handler.Handle(new CreatePhotoGalleryCommand(
                EventEditionId: edition.Id,
                Url: "https://photos.example.com/before-delete",
                PhotographerId: null,
                Title: null
            ), CancellationToken.None);
        }

        var cacheInvalidator = new Mock<ICacheInvalidator>();
        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeletePhotoGalleryCommandHandler(ctx, cacheInvalidator.Object);
            await handler.Handle(new DeletePhotoGalleryCommand(galleryId), CancellationToken.None);
        }

        cacheInvalidator.Verify(c => c.InvalidateEvent(edition.Event.Slug), Times.Once);
    }

    [Fact]
    public async Task Delete_PhotoGallery_UnknownId_DoesNotInvalidateCache()
    {
        var cacheInvalidator = new Mock<ICacheInvalidator>();
        using var ctx = _factory.CreateContext();
        var handler = new DeletePhotoGalleryCommandHandler(ctx, cacheInvalidator.Object);

        await handler.Handle(new DeletePhotoGalleryCommand(Guid.NewGuid()), CancellationToken.None);

        cacheInvalidator.Verify(c => c.InvalidateEvent(It.IsAny<string>()), Times.Never);
    }

    // ─── GetPhotoGalleriesByEditionQuery ───

    [Fact]
    public async Task GetPhotoGalleriesByEdition_Returns_OrderedBySortOrder()
    {
        var edition = await SeedEdition();

        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotoGalleryCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new CreatePhotoGalleryCommand(
                EventEditionId: edition.Id, Url: "https://photos.example.com/third",
                PhotographerId: null, Title: null, SortOrder: 2
            ), CancellationToken.None);
            await handler.Handle(new CreatePhotoGalleryCommand(
                EventEditionId: edition.Id, Url: "https://photos.example.com/first",
                PhotographerId: null, Title: null, SortOrder: 0
            ), CancellationToken.None);
            await handler.Handle(new CreatePhotoGalleryCommand(
                EventEditionId: edition.Id, Url: "https://photos.example.com/second",
                PhotographerId: null, Title: null, SortOrder: 1
            ), CancellationToken.None);
        }

        using var ctx2 = _factory.CreateContext();
        var queryHandler = new GetPhotoGalleriesByEditionQueryHandler(ctx2);
        var result = await queryHandler.Handle(new GetPhotoGalleriesByEditionQuery(edition.Id), CancellationToken.None);

        Assert.Equal(3, result.Count);
        Assert.Equal(
            new[] { "https://photos.example.com/first", "https://photos.example.com/second", "https://photos.example.com/third" },
            result.Select(g => g.Url).ToArray());
    }

    [Fact]
    public async Task GetPhotoGalleriesByEdition_ExcludesGalleries_FromOtherEditions()
    {
        var edition1 = await SeedEdition();
        var edition2 = await SeedEdition();

        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotoGalleryCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new CreatePhotoGalleryCommand(
                EventEditionId: edition1.Id, Url: "https://photos.example.com/mine",
                PhotographerId: null, Title: null
            ), CancellationToken.None);
            await handler.Handle(new CreatePhotoGalleryCommand(
                EventEditionId: edition2.Id, Url: "https://photos.example.com/theirs",
                PhotographerId: null, Title: null
            ), CancellationToken.None);
        }

        using var ctx2 = _factory.CreateContext();
        var queryHandler = new GetPhotoGalleriesByEditionQueryHandler(ctx2);
        var result = await queryHandler.Handle(new GetPhotoGalleriesByEditionQuery(edition1.Id), CancellationToken.None);

        var url = Assert.Single(result).Url;
        Assert.Equal("https://photos.example.com/mine", url);
    }

    [Fact]
    public async Task GetPhotoGalleriesByEdition_IncludesPhotographerName_WhenAttributed()
    {
        var edition = await SeedEdition();
        var photographer = await SeedPhotographer();

        using (var ctx = _factory.CreateContext())
        {
            var handler = new CreatePhotoGalleryCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new CreatePhotoGalleryCommand(
                EventEditionId: edition.Id, Url: "https://photos.example.com/attributed",
                PhotographerId: photographer.Id, Title: null
            ), CancellationToken.None);
        }

        using var ctx2 = _factory.CreateContext();
        var queryHandler = new GetPhotoGalleriesByEditionQueryHandler(ctx2);
        var result = await queryHandler.Handle(new GetPhotoGalleriesByEditionQuery(edition.Id), CancellationToken.None);

        var gallery = Assert.Single(result);
        Assert.Equal(photographer.Id, gallery.PhotographerId);
        Assert.Equal("Jón Jónsson", gallery.PhotographerName);
    }

    // ─── Validators ───

    [Fact]
    public void CreatePhotoGallery_ValidCommand_Passes()
    {
        var validator = new CreatePhotoGalleryCommandValidator();
        var cmd = new CreatePhotoGalleryCommand(
            EventEditionId: Guid.NewGuid(),
            Url: "https://photos.example.com/valid",
            PhotographerId: null,
            Title: null
        );

        var result = validator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreatePhotoGallery_MalformedUrl_Fails()
    {
        var validator = new CreatePhotoGalleryCommandValidator();
        var cmd = new CreatePhotoGalleryCommand(
            EventEditionId: Guid.NewGuid(),
            Url: "not-a-url",
            PhotographerId: null,
            Title: null
        );

        var result = validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Url);
    }

    [Fact]
    public void CreatePhotoGallery_EmptyUrl_Fails()
    {
        var validator = new CreatePhotoGalleryCommandValidator();
        var cmd = new CreatePhotoGalleryCommand(
            EventEditionId: Guid.NewGuid(),
            Url: "",
            PhotographerId: null,
            Title: null
        );

        var result = validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Url);
    }

    [Fact]
    public void UpdatePhotoGallery_MalformedUrl_Fails()
    {
        var validator = new UpdatePhotoGalleryCommandValidator();
        var cmd = new UpdatePhotoGalleryCommand(
            Id: Guid.NewGuid(),
            Url: "definitely not a url",
            PhotographerId: null,
            Title: null
        );

        var result = validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Url);
    }

    // ─── PublicPhotoGalleryDto shape (#548) ───

    [Fact]
    public void PublicPhotoGalleryDto_DoesNotExposeAdminOnlyFields()
    {
        // The public projection must withhold everything an anonymous visitor has no business
        // seeing: the row Id, the FK back to the edition, the raw PhotographerId, and auditing
        // fields (CreatedAt/CreatedBy) — mirrors the admin-only fields PhotoGalleryDto carries.
        var propertyNames = typeof(PublicPhotoGalleryDto).GetProperties().Select(p => p.Name).ToHashSet();

        Assert.DoesNotContain("Id", propertyNames);
        Assert.DoesNotContain("EventEditionId", propertyNames);
        Assert.DoesNotContain("PhotographerId", propertyNames);
        Assert.DoesNotContain("CreatedAt", propertyNames);
        Assert.DoesNotContain("CreatedBy", propertyNames);

        var expected = new[] { "Url", "Title", "TitleEn", "PhotographerName", "PhotographerSlug", "SortOrder" };
        Assert.Equal(expected.Length, propertyNames.Count);
        foreach (var name in expected)
            Assert.Contains(name, propertyNames);
    }

    [Fact]
    public void ToPublicDtos_OrdersBySortOrder_AndMapsPhotographerNameAndSlug()
    {
        var photographer = new Photographer { Id = Guid.NewGuid(), Name = "Jón Jónsson", Slug = "jon-jonsson" };
        var galleries = new List<PhotoGallery>
        {
            new() { Url = "https://photos.example.com/third", SortOrder = 2 },
            new() { Url = "https://photos.example.com/first", SortOrder = 0, Photographer = photographer },
            new() { Url = "https://photos.example.com/second", SortOrder = 1 },
        };

        var result = galleries.ToPublicDtos();

        Assert.Equal(
            new[] { "https://photos.example.com/first", "https://photos.example.com/second", "https://photos.example.com/third" },
            result.Select(g => g.Url).ToArray());
        Assert.Equal("Jón Jónsson", result[0].PhotographerName);
        Assert.Equal("jon-jonsson", result[0].PhotographerSlug);
        Assert.Null(result[1].PhotographerName);
    }

    [Fact]
    public void ToPublicDtos_EmptyCollection_ReturnsEmptyList_NeverNull()
    {
        var result = new List<PhotoGallery>().ToPublicDtos();

        Assert.NotNull(result);
        Assert.Empty(result);
    }
}
