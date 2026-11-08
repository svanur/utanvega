using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Locations;
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
/// <c>Program.cs</c>'s <c>UpdateLocation</c> endpoint (Program.cs:1285-1292) discards whatever
/// <c>UpdatedBy</c> the client sent in the body and substitutes the JWT-derived user id
/// (<c>command with { UpdatedBy = GetAuthenticatedUserId(httpContext) }</c>) — a handler-level test
/// can't prove that override happens, because it never goes through the endpoint at all.
///
/// <c>CreateLocation</c> (Program.cs:1273-1283) also overrides the client-supplied <c>CreatedBy</c>
/// with the JWT-derived user id, and it lands on a real <see cref="Location.CreatedBy"/> column, so
/// that test asserts against the persisted <see cref="Location"/> row directly — see #829.
///
/// <c>DeleteLocation</c> (Program.cs:1294-1311) overrides the actor id the same way, but routes it
/// into <c>SaveChangesWithAuditAsync</c> instead of an entity column — there is no <c>DeletedBy</c>
/// field on <see cref="Location"/>, so that test asserts against the resulting <see cref="ChangeLog"/>
/// row (<c>EntityName == "Location"</c>) instead — see #690.
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
        const string clientSuppliedCreatedBy = "seed-user";

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
                CreatedBy = clientSuppliedCreatedBy,
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

        // #829: CreateLocation.CreatedBy is a real Location column (unlike DeleteLocation, which has
        // no DeletedBy column), so it must be asserted directly rather than via ChangeLog.
        var location = await db.Locations.FindAsync(body!.Id);
        Assert.NotNull(location);
        Assert.Equal(authenticatedUserId, location!.CreatedBy);
        Assert.NotEqual(clientSuppliedCreatedBy, location.CreatedBy);
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

    /// <summary>
    /// Endpoint-level test for <c>DELETE /api/v1/admin/locations/{id:guid}</c>
    /// (Program.cs:1306-1319) — see #1130, auditing the same bug class #1113/#1114/#1115/#1122
    /// covered elsewhere in the Trails/Locations family.
    ///
    /// Before #1129 (closing #1122), the endpoint's only <c>catch</c> blocks were
    /// <c>catch (InvalidOperationException ex)</c> and a generic <c>catch (Exception ex)</c>, with
    /// no preceding <c>catch (ValidationException ex)</c>, so a
    /// <see cref="Utanvega.Backend.Application.Locations.Commands.DeleteLocation.DeleteLocationCommandValidator"/>
    /// rejection (thrown by
    /// <see cref="Utanvega.Backend.Application.Validation.ValidationBehavior{TRequest,TResponse}"/>)
    /// would have fallen through to the generic handler and come back as an unstructured 500-shaped
    /// <c>Results.Problem()</c>, instead of the structured 400 the global middleware would have
    /// produced for the same exception. The route constraint <c>{id:guid}</c> accepts
    /// <see cref="Guid.Empty"/> as a syntactically valid GUID, so the request reaches the validator's
    /// <c>NotEmpty()</c> rule on <c>Id</c> rather than being rejected by routing.
    /// </summary>
    [Fact]
    public async Task DeleteLocation_EmptyGuidId_Returns400WithStructuredValidationBody()
    {
        var client = _factory.CreateAuthenticatedClient("admin-user");

        var response = await client.DeleteAsync(
            $"/api/v1/admin/locations/{Guid.Empty}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ValidationErrorBody>();
        Assert.NotNull(body);
        Assert.Equal("Validation failed", body!.Title);
        Assert.True(body.Errors.ContainsKey("Id"));
    }

    private async Task<Guid> SeedLocationWithBoundaryAsync()
    {
        const string boundaryGeoJson = """
            {"type":"Polygon","coordinates":[[[-21.95,64.10],[-21.90,64.10],[-21.90,64.15],[-21.95,64.15],[-21.95,64.10]]]}
            """;
        Assert.True(LocationBoundaryParser.TryParse(boundaryGeoJson, out var polygon, out _));

        using var db = _factory.CreateDbContext();
        var location = new Location
        {
            Name = "Bounded Location",
            Slug = $"bounded-location-{Guid.NewGuid():N}",
            Type = LocationType.Municipality,
            Boundary = polygon,
            CreatedBy = "seed-user",
        };
        db.Locations.Add(location);
        await db.SaveChangesAsync();
        return location.Id;
    }

    /// <summary>
    /// Endpoint-level test for <c>GET /api/v1/admin/locations/{id:guid}/boundary</c> (#1706) —
    /// proves a saved <see cref="Location.Boundary"/> round-trips back out as GeoJSON via
    /// <c>GetLocationBoundaryQuery</c>'s <c>GeoJsonWriter</c>, for the admin LocationDialog to load
    /// into an editable Geoman layer.
    /// </summary>
    [Fact]
    public async Task GetLocationBoundary_LocationWithBoundary_ReturnsBoundaryGeoJson()
    {
        var locationId = await SeedLocationWithBoundaryAsync();
        var client = _factory.CreateAuthenticatedClient("admin-user");

        var response = await client.GetAsync($"/api/v1/admin/locations/{locationId}/boundary");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<BoundaryResponse>();
        Assert.NotNull(body);
        Assert.NotNull(body!.BoundaryGeoJson);
        Assert.Contains("Polygon", body.BoundaryGeoJson);
    }

    [Fact]
    public async Task GetLocationBoundary_LocationWithoutBoundary_ReturnsNullBoundaryGeoJson()
    {
        var locationId = await SeedLocationAsync();
        var client = _factory.CreateAuthenticatedClient("admin-user");

        var response = await client.GetAsync($"/api/v1/admin/locations/{locationId}/boundary");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<BoundaryResponse>();
        Assert.NotNull(body);
        Assert.Null(body!.BoundaryGeoJson);
    }

    [Fact]
    public async Task GetLocationBoundary_AnonymousRequest_IsRejected()
    {
        var locationId = await SeedLocationAsync();
        var client = _factory.CreateClient();

        var response = await client.GetAsync($"/api/v1/admin/locations/{locationId}/boundary");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetLocationBoundary_NonAdminRole_IsForbidden()
    {
        var locationId = await SeedLocationAsync();
        var client = _factory.CreateAuthenticatedClient("some-user", role: "member");

        var response = await client.GetAsync($"/api/v1/admin/locations/{locationId}/boundary");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    /// <summary>
    /// #1706 review fix: before this, <c>UpdateLocationCommandHandler</c> only ever parsed a
    /// non-null <c>BoundaryGeoJson</c> and otherwise left <see cref="Location.Boundary"/> alone —
    /// so the admin dialog sending <c>boundaryGeoJson: null</c> after a Geoman removal (the only
    /// value it ever sent, since <c>JSON.stringify</c>'d removal state is <c>null</c>) silently
    /// left the stale Boundary in the DB. <c>""</c> (empty string) is now the explicit clear
    /// sentinel the handler acts on.
    /// </summary>
    [Fact]
    public async Task UpdateLocation_EmptyStringBoundaryGeoJson_ClearsExistingBoundary()
    {
        var locationId = await SeedLocationWithBoundaryAsync();
        var client = _factory.CreateAuthenticatedClient("admin-user");

        var response = await client.PutAsJsonAsync(
            $"/api/v1/admin/locations/{locationId}",
            new
            {
                Id = locationId,
                Name = "Bounded Location",
                Slug = $"bounded-location-{Guid.NewGuid():N}",
                Description = (string?)null,
                Type = "Municipality",
                ParentId = (Guid?)null,
                Latitude = (double?)null,
                Longitude = (double?)null,
                Radius = (double?)null,
                BoundaryGeoJson = "",
                UpdatedBy = "admin-user",
            });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var db = _factory.CreateDbContext();
        var location = await db.Locations.FindAsync(locationId);
        Assert.NotNull(location);
        Assert.Null(location!.Boundary);
    }

    /// <summary>
    /// Regression guard alongside the fix above: omitting <c>BoundaryGeoJson</c> entirely (binds to
    /// <c>null</c>) must still leave an already-set <see cref="Location.Boundary"/> untouched — the
    /// "" clear sentinel must not have widened to cover plain <c>null</c> too.
    /// </summary>
    [Fact]
    public async Task UpdateLocation_NullBoundaryGeoJson_LeavesExistingBoundaryUntouched()
    {
        var locationId = await SeedLocationWithBoundaryAsync();
        var client = _factory.CreateAuthenticatedClient("admin-user");

        var response = await client.PutAsJsonAsync(
            $"/api/v1/admin/locations/{locationId}",
            new
            {
                Id = locationId,
                Name = "Bounded Location",
                Slug = $"bounded-location-{Guid.NewGuid():N}",
                Description = (string?)null,
                Type = "Municipality",
                ParentId = (Guid?)null,
                Latitude = (double?)null,
                Longitude = (double?)null,
                Radius = (double?)null,
                UpdatedBy = "admin-user",
            });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        using var db = _factory.CreateDbContext();
        var location = await db.Locations.FindAsync(locationId);
        Assert.NotNull(location);
        Assert.NotNull(location!.Boundary);
    }

    private record BoundaryResponse(string? BoundaryGeoJson);

    private record CreatedLocationResponse(Guid Id);
}
