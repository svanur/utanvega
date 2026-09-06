using System.Net;
using System.Net.Http.Json;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Tests.WebHost;

namespace Utanvega.Backend.Tests.Endpoints;

/// <summary>
/// Endpoint-level tests for the admin PhotoGallery routes, exercising the real minimal-API
/// pipeline (auth middleware, MediatR, EF Core) through <see cref="TestWebApplicationFactory"/> —
/// see #591.
///
/// <c>PhotoGalleryHandlerTests.Create_PhotoGallery_PersistsCreatedBy</c> calls
/// <c>CreatePhotoGalleryCommandHandler</c> directly, which only proves the handler persists
/// whatever <c>CreatedBy</c> it's handed — it can't prove the endpoint (Program.cs:1978-1991)
/// discards a client-supplied value in favor of the JWT-derived one, since it never goes through
/// the endpoint at all. <see cref="CreatePhotoGallery_OverridesClientSuppliedCreatedBy_WithAuthenticatedUserId"/>
/// is that missing proof: it sends a real HTTP POST with a client-supplied <c>CreatedBy</c>
/// different from the fake-authenticated id, and asserts the persisted row has the
/// server-derived one.
/// </summary>
[Collection(TestWebApplicationFactoryCollection.Name)]
public class PhotoGalleryEndpointTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private async Task<Guid> SeedEditionAsync()
    {
        using var db = _factory.CreateDbContext();
        var ev = new Event
        {
            Name = "Test Event",
            Slug = $"test-event-{Guid.NewGuid():N}",
            Type = EventType.Race,
            Status = EventStatus.Confirmed,
        };
        var edition = new EventEdition
        {
            EventId = ev.Id,
            RegistrationStatus = RegistrationStatus.Open,
        };
        db.Events.Add(ev);
        db.EventEditions.Add(edition);
        await db.SaveChangesAsync();
        return edition.Id;
    }

    private record CreatedResponse(Guid Id);

    [Fact]
    public async Task CreatePhotoGallery_OverridesClientSuppliedCreatedBy_WithAuthenticatedUserId()
    {
        var editionId = await SeedEditionAsync();
        const string authenticatedUserId = "auth-user-real";
        const string clientSuppliedCreatedBy = "someone-else-entirely";

        var client = _factory.CreateAuthenticatedClient(authenticatedUserId);

        var response = await client.PostAsJsonAsync(
            $"/api/v1/admin/editions/{editionId}/photo-galleries",
            new
            {
                EventEditionId = editionId,
                Url = "https://photos.example.com/endpoint-test",
                PhotographerId = (Guid?)null,
                Title = (string?)null,
                CreatedBy = clientSuppliedCreatedBy,
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CreatedResponse>();
        Assert.NotNull(created);

        using var db = _factory.CreateDbContext();
        var gallery = await db.PhotoGalleries.FindAsync(created!.Id);
        Assert.NotNull(gallery);
        Assert.Equal(authenticatedUserId, gallery!.CreatedBy);
        Assert.NotEqual(clientSuppliedCreatedBy, gallery.CreatedBy);
    }

    [Fact]
    public async Task CreatePhotoGallery_AnonymousRequest_IsRejected()
    {
        // Proves the harness itself: an unauthenticated request never reaches the handler and
        // the AdminOnly policy's RequireAuthenticatedUser() rejects it with 401.
        var editionId = await SeedEditionAsync();
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/v1/admin/editions/{editionId}/photo-galleries",
            new { EventEditionId = editionId, Url = "https://photos.example.com/anon", PhotographerId = (Guid?)null, Title = (string?)null });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreatePhotoGallery_NonAdminRole_IsForbidden()
    {
        // Proves the harness carries the role claim correctly: authenticated but without the
        // "admin" role, the AdminOnly policy's RequireRole("admin") rejects it with 403.
        var editionId = await SeedEditionAsync();
        var client = _factory.CreateAuthenticatedClient("some-user", role: "member");

        var response = await client.PostAsJsonAsync(
            $"/api/v1/admin/editions/{editionId}/photo-galleries",
            new { EventEditionId = editionId, Url = "https://photos.example.com/non-admin", PhotographerId = (Guid?)null, Title = (string?)null });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
