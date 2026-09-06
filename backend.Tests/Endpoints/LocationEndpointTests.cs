using System.Net;
using System.Net.Http.Json;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Tests.WebHost;

namespace Utanvega.Backend.Tests.Endpoints;

/// <summary>
/// Endpoint-level tests for the admin Locations routes, exercising the real minimal-API pipeline
/// (auth middleware, MediatR, EF Core) through <see cref="TestWebApplicationFactory"/> — see #591.
/// A second class alongside <see cref="PhotoGalleryEndpointTests"/> that constructs its own
/// <see cref="TestWebApplicationFactory"/>, deliberately added by #677 to exercise the fix for
/// process-wide env-var races between concurrently-constructed factories — see
/// <see cref="TestWebApplicationFactoryCollection"/>.
///
/// <c>Program.cs</c>'s <c>UpdateLocation</c> endpoint (Program.cs:1276-1283) discards whatever
/// <c>UpdatedBy</c> the client sent in the body and substitutes the JWT-derived user id
/// (<c>command with { UpdatedBy = GetAuthenticatedUserId(httpContext) }</c>) — a handler-level test
/// can't prove that override happens, because it never goes through the endpoint at all.
/// </summary>
[Collection(TestWebApplicationFactoryCollection.Name)]
public class LocationEndpointTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private async Task<Guid> SeedLocationAsync()
    {
        using var db = _factory.CreateDbContext();
        var location = new Location
        {
            Name = "Test Location",
            Slug = $"test-location-{Guid.NewGuid():N}",
            Type = LocationType.Place,
            CreatedBy = "seed-user",
        };
        db.Locations.Add(location);
        await db.SaveChangesAsync();
        return location.Id;
    }

    [Fact]
    public async Task UpdateLocation_OverridesClientSuppliedUpdatedBy_WithAuthenticatedUserId()
    {
        var locationId = await SeedLocationAsync();
        const string authenticatedUserId = "auth-user-real";
        const string clientSuppliedUpdatedBy = "someone-else-entirely";

        var client = _factory.CreateAuthenticatedClient(authenticatedUserId);

        var response = await client.PutAsJsonAsync(
            $"/api/v1/admin/locations/{locationId}",
            new
            {
                Id = locationId,
                Name = "Updated Name",
                Slug = $"updated-location-{Guid.NewGuid():N}",
                Description = (string?)null,
                Type = "Place",
                ParentId = (Guid?)null,
                Latitude = (double?)null,
                Longitude = (double?)null,
                Radius = (double?)null,
                UpdatedBy = clientSuppliedUpdatedBy,
            });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var db = _factory.CreateDbContext();
        var location = await db.Locations.FindAsync(locationId);
        Assert.NotNull(location);
        Assert.Equal(authenticatedUserId, location!.UpdatedBy);
        Assert.NotEqual(clientSuppliedUpdatedBy, location.UpdatedBy);
    }

    [Fact]
    public async Task UpdateLocation_AnonymousRequest_IsRejected()
    {
        // Proves the harness itself: an unauthenticated request never reaches the handler and
        // the AdminOnly policy's RequireAuthenticatedUser() rejects it with 401.
        var locationId = await SeedLocationAsync();
        var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/v1/admin/locations/{locationId}",
            new
            {
                Id = locationId,
                Name = "Updated Name",
                Slug = $"updated-location-{Guid.NewGuid():N}",
                Description = (string?)null,
                Type = "Place",
                ParentId = (Guid?)null,
                Latitude = (double?)null,
                Longitude = (double?)null,
                Radius = (double?)null,
                UpdatedBy = "anon",
            });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdateLocation_NonAdminRole_IsForbidden()
    {
        // Proves the harness carries the role claim correctly: authenticated but without the
        // "admin" role, the AdminOnly policy's RequireRole("admin") rejects it with 403.
        var locationId = await SeedLocationAsync();
        var client = _factory.CreateAuthenticatedClient("some-user", role: "member");

        var response = await client.PutAsJsonAsync(
            $"/api/v1/admin/locations/{locationId}",
            new
            {
                Id = locationId,
                Name = "Updated Name",
                Slug = $"updated-location-{Guid.NewGuid():N}",
                Description = (string?)null,
                Type = "Place",
                ParentId = (Guid?)null,
                Latitude = (double?)null,
                Longitude = (double?)null,
                Radius = (double?)null,
                UpdatedBy = "non-admin",
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
