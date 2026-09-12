using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
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
///
/// <c>CreateLocation</c> (Program.cs:1269-1274) and <c>DeleteLocation</c> (Program.cs:1285-1302) do
/// the same override, but route the actor id into <c>SaveChangesWithAuditAsync</c> instead of an
/// entity column — there is no <c>CreatedBy</c>/<c>DeletedBy</c> field on <see cref="Location"/> for
/// either command, so those two tests assert against the resulting <see cref="ChangeLog"/> row
/// (<c>EntityName == "Location"</c>) rather than a <see cref="Location"/> field — see #690.
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

    [Fact]
    public async Task CreateLocation_OverridesClientSuppliedActorUserId_WithAuthenticatedUserId()
    {
        const string authenticatedUserId = "auth-user-real";
        const string clientSuppliedActorUserId = "someone-else-entirely";

        var client = _factory.CreateAuthenticatedClient(authenticatedUserId);

        var response = await client.PostAsJsonAsync(
            "/api/v1/admin/locations",
            new
            {
                Name = "New Location",
                Slug = $"new-location-{Guid.NewGuid():N}",
                Description = (string?)null,
                Type = "Place",
                ParentId = (Guid?)null,
                Latitude = (double?)null,
                Longitude = (double?)null,
                Radius = (double?)null,
                CreatedBy = "seed-user",
                ActorUserId = clientSuppliedActorUserId,
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<CreatedLocationResponse>();
        Assert.NotNull(body);

        using var db = _factory.CreateDbContext();
        var changeLog = await db.ChangeLogs.SingleOrDefaultAsync(c =>
            c.EntityName == "Location" && c.Action == "Create" && c.EntityId == body!.Id.ToString());
        Assert.NotNull(changeLog);
        Assert.Equal(authenticatedUserId, changeLog!.UserId);
        Assert.NotEqual(clientSuppliedActorUserId, changeLog.UserId);
    }

    [Fact]
    public async Task CreateLocation_AnonymousRequest_IsRejected()
    {
        // Proves the harness itself: an unauthenticated request never reaches the handler and
        // the AdminOnly policy's RequireAuthenticatedUser() rejects it with 401.
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/v1/admin/locations",
            new
            {
                Name = "New Location",
                Slug = $"new-location-{Guid.NewGuid():N}",
                Description = (string?)null,
                Type = "Place",
                ParentId = (Guid?)null,
                Latitude = (double?)null,
                Longitude = (double?)null,
                Radius = (double?)null,
                CreatedBy = "anon",
            });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateLocation_NonAdminRole_IsForbidden()
    {
        // Proves the harness carries the role claim correctly: authenticated but without the
        // "admin" role, the AdminOnly policy's RequireRole("admin") rejects it with 403.
        var client = _factory.CreateAuthenticatedClient("some-user", role: "member");

        var response = await client.PostAsJsonAsync(
            "/api/v1/admin/locations",
            new
            {
                Name = "New Location",
                Slug = $"new-location-{Guid.NewGuid():N}",
                Description = (string?)null,
                Type = "Place",
                ParentId = (Guid?)null,
                Latitude = (double?)null,
                Longitude = (double?)null,
                Radius = (double?)null,
                CreatedBy = "non-admin",
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteLocation_OverridesClientSuppliedActorUserId_WithAuthenticatedUserId()
    {
        // DeleteLocation doesn't accept an ActorUserId in the request body at all — the command is
        // built server-side from the route id and GetAuthenticatedUserId(httpContext), so there's no
        // client-supplied value to override. This proves the authenticated identity is what lands in
        // the ChangeLog row, which is the only place the actor id is persisted for a delete.
        var locationId = await SeedLocationAsync();
        const string authenticatedUserId = "auth-user-real";

        var client = _factory.CreateAuthenticatedClient(authenticatedUserId);

        var response = await client.DeleteAsync($"/api/v1/admin/locations/{locationId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var db = _factory.CreateDbContext();
        var changeLog = await db.ChangeLogs.SingleOrDefaultAsync(c =>
            c.EntityName == "Location" && c.Action == "Delete" && c.EntityId == locationId.ToString());
        Assert.NotNull(changeLog);
        Assert.Equal(authenticatedUserId, changeLog!.UserId);
    }

    [Fact]
    public async Task DeleteLocation_AnonymousRequest_IsRejected()
    {
        // Proves the harness itself: an unauthenticated request never reaches the handler and
        // the AdminOnly policy's RequireAuthenticatedUser() rejects it with 401.
        var locationId = await SeedLocationAsync();
        var client = _factory.CreateClient();

        var response = await client.DeleteAsync($"/api/v1/admin/locations/{locationId}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DeleteLocation_NonAdminRole_IsForbidden()
    {
        // Proves the harness carries the role claim correctly: authenticated but without the
        // "admin" role, the AdminOnly policy's RequireRole("admin") rejects it with 403.
        var locationId = await SeedLocationAsync();
        var client = _factory.CreateAuthenticatedClient("some-user", role: "member");

        var response = await client.DeleteAsync($"/api/v1/admin/locations/{locationId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private record CreatedLocationResponse(Guid Id);
}
