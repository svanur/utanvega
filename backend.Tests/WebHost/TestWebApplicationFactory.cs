using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Tests.WebHost;

/// <summary>
/// Boots the real <c>Program.cs</c> minimal-API pipeline (auth middleware, MediatR, EF Core, all
/// endpoints) for endpoint-level tests, via <see cref="WebApplicationFactory{TEntryPoint}"/> —
/// see #591. This is the thing to reach for when a test needs to prove something about the
/// *endpoint*, not just the MediatR handler behind it — most commonly, the pattern seen 23 times
/// across <c>Program.cs</c> where the endpoint overrides a client-supplied audit field with the
/// JWT-derived user id (<c>command with { CreatedBy = GetAuthenticatedUserId(httpContext) }</c>).
/// A handler-level test (see <c>TestDbContextFactory</c>, used throughout <c>Handlers/</c>) can
/// only prove the handler persists whatever it's given — it can never prove the endpoint extracts
/// the right value instead of trusting client input, because it never goes through the endpoint.
///
/// <para><b>How a new test uses this:</b></para>
/// <code>
/// public class SomeEndpointTests : IDisposable
/// {
///     private readonly TestWebApplicationFactory _factory = new();
///     public void Dispose() =&gt; _factory.Dispose();
///
///     [Fact]
///     public async Task Endpoint_OverridesClientSuppliedActorId_WithAuthenticatedUserId()
///     {
///         // Seed via _factory.CreateDbContext() — same SQLite connection the running host uses.
///         using (var db = _factory.CreateDbContext()) { /* db.Xyz.Add(...); await db.SaveChangesAsync(); */ }
///
///         // Authenticates every request on this client as "auth-user", role "admin".
///         var client = _factory.CreateAuthenticatedClient("auth-user");
///
///         var response = await client.PostAsJsonAsync("/api/v1/admin/...", new { ActorUserId = "someone-else" });
///
///         // Assert against the persisted row via _factory.CreateDbContext() again — the endpoint
///         // should have discarded "someone-else" in favor of "auth-user".
///     }
/// }
/// </code>
/// Use a plain <see cref="WebApplicationFactory{TEntryPoint}.CreateClient"/> (no fake-auth headers)
/// to exercise the anonymous path — <c>[Authorize]</c> endpoints should reject it with 401.
/// </summary>
/// <remarks>
/// Declared <c>internal</c>, not <c>public</c>: its base class, <c>WebApplicationFactory&lt;Program&gt;</c>,
/// is only as accessible as <c>Program</c> itself, which is the compiler-generated (and therefore
/// <c>internal</c>) top-level-statements class in <c>backend/Program.cs</c> — reachable here only
/// via the <c>InternalsVisibleTo</c> in <c>backend.csproj</c>. A <c>public</c> class can't derive
/// from a less-accessible base, so this has to be <c>internal</c> too; that's fine, since it's only
/// ever used from other classes in this same test assembly.
/// </remarks>
internal class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly TestDbContextFactory _dbFactory = new();

    public TestWebApplicationFactory()
    {
        // Program.cs's top-level statements read these directly via builder.Configuration /
        // builder.Environment the instant WebApplication.CreateBuilder(args) runs — before
        // ConfigureWebHost below gets a chance to touch anything. Setting them as real process
        // environment variables (rather than through ConfigureAppConfiguration, which only takes
        // effect once WebApplicationFactory composes the final host) is the only way to reach code
        // that executes that early.
        //
        // None of these values are ever exercised — ConfigureWebHost swaps the DbContext and the
        // default auth scheme before either is used. They exist purely to satisfy Program.cs's
        // "must be configured outside Development" guards (SUPABASE_URL, SUPABASE_JWT_SECRET,
        // IP_HASH_SALT) without flipping the environment to Development, which would also trigger
        // its Postgres-only auto-migrate-on-startup block against our SQLite connection.
        Environment.SetEnvironmentVariable("SUPABASE_URL", "https://test.invalid");
        Environment.SetEnvironmentVariable("SUPABASE_JWT_SECRET", "test-harness-unused-jwt-secret");
        Environment.SetEnvironmentVariable("IP_HASH_SALT", "test-harness-unused-salt");
        Environment.SetEnvironmentVariable(
            "ConnectionStrings__DefaultConnection",
            "Host=unused;Database=unused;Username=unused;Password=unused");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remove the real Npgsql-backed pool (Program.cs:296, AddDbContextPool<UtanvegaDbContext>),
            // then replace it with the in-memory SQLite context every other test in this project
            // already uses — see TestDbContextFactory's class doc for why the model is built
            // differently for SQLite (no PostGIS, WKB round-tripping for geometry, etc). Don't
            // restructure that logic here; reuse it as-is via _dbFactory.
            //
            // AddDbContextPool also registers internal pooling services (DbContextPool<T>,
            // IDbContextPool<T>, IScopedDbContextLease<T>) that aren't public EF Core API and so
            // can't be matched by typeof(...) here — but WebApplicationFactory's TestServer host
            // always runs with ServiceProviderOptions.ValidateOnBuild = true regardless of the
            // app's own environment, and those internal services still depend on
            // DbContextOptions<UtanvegaDbContext>, which we're about to remove. Left in place,
            // that dependency would fail validation at Build() before a single test runs. Matching
            // on "any service closed over UtanvegaDbContext" catches all of them without needing
            // to name the internal types.
            var dbDescriptors = services.Where(d =>
                d.ServiceType == typeof(UtanvegaDbContext) ||
                (d.ServiceType.IsGenericType && d.ServiceType.GetGenericArguments().Contains(typeof(UtanvegaDbContext)))
            ).ToList();
            foreach (var descriptor in dbDescriptors)
                services.Remove(descriptor);

            services.AddScoped<UtanvegaDbContext>(_ => _dbFactory.CreateContext());

            // Fake auth: register the "Test" scheme (TestAuthHandler) and make it the default.
            // Program.cs already called AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            // for the real app — this runs after it (ConfigureServices delegates queued via
            // ConfigureWebHost apply once WebApplicationFactory composes the host, i.e. after
            // Program.cs's own eager builder.Services.AddX(...) calls have already run), so its
            // DefaultScheme assignment is the one that sticks.
            services.AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
        });
    }

    /// <summary>
    /// Opens a new <see cref="UtanvegaDbContext"/> backed by the same in-memory SQLite connection
    /// the running test host uses — for seeding data before a request, or asserting on it after.
    /// </summary>
    public UtanvegaDbContext CreateDbContext() => _dbFactory.CreateContext();

    /// <summary>
    /// An <see cref="HttpClient"/> that authenticates as <paramref name="userId"/> with
    /// <paramref name="role"/> (default <c>"admin"</c>, matching the <c>AdminOnly</c> policy) on
    /// every request it sends — the fake-JWT equivalent of a Supabase-issued bearer token, without
    /// validating a real one. See <see cref="TestAuthHandler"/> for what it reads.
    /// </summary>
    public HttpClient CreateAuthenticatedClient(string userId, string role = "admin")
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserIdHeader, userId);
        if (!string.IsNullOrEmpty(role))
            client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
        return client;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
            _dbFactory.Dispose();
    }
}
