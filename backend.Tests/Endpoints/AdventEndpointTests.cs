using System.Net;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Tests.WebHost;

namespace Utanvega.Backend.Tests.Endpoints;

/// <summary>
/// Endpoint-level test for <c>GET /api/v1/admin/advent/entries/export</c> (#1875) — goes through
/// the real minimal-API pipeline via <see cref="TestWebApplicationFactory"/> so it actually proves
/// the <c>[Authorize(Policy = "AdminOnly")]</c> attribute rejects an unauthenticated/non-admin
/// caller, the way <see cref="LocationEndpointTests"/> does for the admin location routes — a
/// handler-level test (see <c>Handlers/AdventHandlerTests.cs</c>) can't prove that, since it never
/// goes through the endpoint's auth middleware at all.
/// </summary>
[Collection(TestWebApplicationFactoryCollection.Name)]
public class AdventEndpointTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task ExportEntries_Unauthenticated_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/admin/advent/entries/export");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ExportEntries_NonAdminRole_ReturnsForbidden()
    {
        var client = _factory.CreateAuthenticatedClient("some-user", role: "member");
        var response = await client.GetAsync("/api/v1/admin/advent/entries/export");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ExportEntries_Admin_ReturnsDeduplicatedPlainTextEmailList()
    {
        using (var db = _factory.CreateDbContext())
        {
            db.AdventEntries.AddRange(
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Answer, CreatedAt = DateTime.UtcNow },
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Share, CreatedAt = DateTime.UtcNow },
                new AdventEntry { Id = Guid.NewGuid(), Email = "b@example.com", Day = 2, Source = AdventEntrySource.Answer, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient("admin-user");
        var response = await client.GetAsync("/api/v1/admin/advent/entries/export");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadAsStringAsync();
        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        Assert.Equal(["a@example.com", "b@example.com"], lines);
    }
}
