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

            // Fail-fast guard (#678): re-scan with the same predicate after the removal loop above.
            // If a future EF Core / Microsoft.AspNetCore.Mvc.Testing bump changes what
            // AddDbContextPool<UtanvegaDbContext> registers internally — e.g. an additional
            // service type closed over UtanvegaDbContext that this predicate doesn't happen to
            // catch — this throws here, synchronously, with a message pointing straight back at
            // TestWebApplicationFactory.cs. Without this, the same leftover registration would
            // instead surface as an opaque ServiceProviderOptions.ValidateOnBuild exception naming
            // some internal EF Core type, inside TestServer.Build(), with nothing tying it back to
            // the reflection sweep above that was supposed to have removed it.
            ThrowIfUtanvegaDbContextStillRegistered(services);

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
    /// Throws if <paramref name="services"/> still contains a registration closed over
    /// <see cref="UtanvegaDbContext"/> — see #678 and the call site in <see cref="ConfigureWebHost"/>.
    /// Extracted as its own method (rather than inlined at the call site) purely so
    /// <c>TestWebApplicationFactoryGuardTests</c> can exercise the throw path directly against a
    /// minimal <see cref="ServiceCollection"/>, without needing to provoke an actual EF Core /
    /// Microsoft.AspNetCore.Mvc.Testing version regression to prove it fires.
    /// </summary>
    internal static void ThrowIfUtanvegaDbContextStillRegistered(IServiceCollection services)
    {
        var leftoverDbDescriptors = services.Where(d =>
            d.ServiceType == typeof(UtanvegaDbContext) ||
            (d.ServiceType.IsGenericType && d.ServiceType.GetGenericArguments().Contains(typeof(UtanvegaDbContext)))
        ).ToList();
        if (leftoverDbDescriptors.Count == 0)
            return;

        throw new InvalidOperationException(
            $"TestWebApplicationFactory.cs: {leftoverDbDescriptors.Count} service " +
            "registration(s) still closed over UtanvegaDbContext survived the removal " +
            "sweep in ConfigureWebHost (matched types: " +
            string.Join(", ", leftoverDbDescriptors.Select(d => d.ServiceType.FullName)) +
            "). That sweep matches on \"any service type closed over UtanvegaDbContext\" " +
            "rather than by internal EF Core type name, because AddDbContextPool<UtanvegaDbContext> " +
            "(Program.cs) also registers internal pooling services (DbContextPool<T>, " +
            "IDbContextPool<T>, IScopedDbContextLease<T>) that aren't public API and so can't " +
            "be named directly. A leftover match here means an EF Core / " +
            "Microsoft.AspNetCore.Mvc.Testing upgrade introduced a registration this " +
            "predicate no longer catches — left in place, it would otherwise fail later as " +
            "an opaque ServiceProviderOptions.ValidateOnBuild error inside TestServer.Build().");
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

/// <summary>
/// Every test class that constructs a <see cref="TestWebApplicationFactory"/> must be tagged
/// <c>[Collection(TestWebApplicationFactoryCollection.Name)]</c> — see #677.
///
/// The factory's constructor sets four environment variables (<c>SUPABASE_URL</c>,
/// <c>SUPABASE_JWT_SECRET</c>, <c>IP_HASH_SALT</c>, <c>ConnectionStrings__DefaultConnection</c>) as
/// real process-wide state, with no restore — see the constructor's comment for why they have to be
/// set that way. xUnit 2.9.2 (the version pinned in <c>backend.Tests.csproj</c>) has no
/// <c>xunit.runner.json</c> or other override in this project, so its SDK default applies: test
/// *collections* run in parallel with each other, though tests within the same collection run
/// sequentially. Left untagged, two endpoint-test classes building their own
/// <see cref="TestWebApplicationFactory"/> at the same time would race to set the same process-wide
/// variables against each other — inert today because only one class (<c>PhotoGalleryEndpointTests</c>)
/// uses this factory, but real as soon as a second one does.
///
/// <see cref="CollectionDefinitionAttribute.DisableParallelization"/> forces every class carrying
/// this collection's name onto one single-threaded lane, so only one <see cref="TestWebApplicationFactory"/>
/// is ever mid-construction/mid-host-build at a time — which also sidesteps a subtler problem a
/// capture-and-restore-in-<c>Dispose</c> approach would have had: <see cref="WebApplicationFactory{TEntryPoint}"/>
/// builds its host lazily (on first <c>CreateClient()</c>/<c>Server</c> access, not in the
/// constructor), so one instance's <c>Dispose</c> restoring/clearing a variable could still yank it
/// out from under another instance whose host hadn't finished booting yet.
/// </summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public class TestWebApplicationFactoryCollection
{
    public const string Name = "TestWebApplicationFactory (serial)";
}
