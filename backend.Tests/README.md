# backend.Tests

xUnit + Moq + SQLite in-memory. Two layers of test, pick the one that matches what you need to prove:

## Handler-level tests (`Handlers/`, `Services/`, `Validators/`, `Entities/`)

Most tests call a MediatR handler directly against `TestDbContextFactory` (`TestDbContextFactory.cs`)
— an in-memory SQLite `UtanvegaDbContext` that skips the Postgres-specific parts of the real model
(PostGIS extension, geometry column types) and round-trips geometry via WKB instead. This is fast and
is the right choice for anything that's really a property of the handler: validation, persistence,
cache invalidation, DTO shape.

```csharp
public class SomeHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Handler_Does_Thing()
    {
        using var ctx = _factory.CreateContext();
        var handler = new SomeCommandHandler(ctx, /* ... */);
        // ...
    }
}
```

What a handler-level test **cannot** prove: anything that happens in `Program.cs` before the handler
is invoked. The clearest example is the ~23 call sites of the pattern
`command with { CreatedBy = GetAuthenticatedUserId(httpContext) }` — the endpoint discards whatever
`CreatedBy`/`ActorUserId` the client sent and substitutes the JWT-validated user id. A test that
constructs the command directly and hands it to the handler only proves the handler *persists*
whatever it's given; it can never prove the endpoint performs that override, because it never goes
through the endpoint.

## Endpoint-level tests (`Endpoints/`)

For that, use `WebHost/TestWebApplicationFactory.cs` — a `WebApplicationFactory<Program>` that
boots the real `Program.cs` minimal-API pipeline (auth middleware, MediatR, EF Core, every endpoint)
against the same in-memory SQLite `UtanvegaDbContext` used above, with a fake `"Test"` authentication
scheme (`TestAuthHandler.cs`) standing in for Supabase's JWT.

```csharp
public class SomeEndpointTests : IDisposable
{
    private readonly TestWebApplicationFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Endpoint_OverridesClientSuppliedActorId_WithAuthenticatedUserId()
    {
        // Seed via the same SQLite connection the running host uses:
        using (var db = _factory.CreateDbContext())
        {
            // db.Xyz.Add(...); await db.SaveChangesAsync();
        }

        // Every request on this client authenticates as "auth-user", role "admin"
        // (AdminOnly-gated endpoints need the role; drop it for member-only routes).
        var client = _factory.CreateAuthenticatedClient("auth-user");

        var response = await client.PostAsJsonAsync(
            "/api/v1/admin/...",
            new { /* ... */ ActorUserId = "someone-else" });

        // Assert against the persisted row via _factory.CreateDbContext() again — the endpoint
        // should have discarded "someone-else" in favor of "auth-user".
    }

    [Fact]
    public async Task Endpoint_AnonymousRequest_IsRejected()
    {
        // A plain CreateClient() (no fake-auth headers) exercises the anonymous path.
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/admin/...", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
```

See `Endpoints/PhotoGalleryEndpointTests.cs` for a complete example (#591), including the
`CreatedBy`-override case, the anonymous-rejection case, and a non-admin-role-forbidden case.

Each test class gets its own `TestWebApplicationFactory` instance (own SQLite connection, own host)
— don't share one via `IClassFixture` unless you also take care of resetting state between tests,
matching the per-test-method isolation the handler-level tests already rely on.

Tag every such class `[Collection(TestWebApplicationFactoryCollection.Name)]` (see
`WebHost/TestWebApplicationFactory.cs`, bottom of the file). The factory's constructor sets four
environment variables as real process-wide state with no restore, and xUnit 2.9.2's SDK default runs
different test collections in parallel — without the shared, `DisableParallelization = true`
collection, two endpoint-test classes building their factories at the same time would race to set
the same variables. See #677 and `Endpoints/LocationEndpointTests.cs` for a second example.

### Why the factory sets environment variables in its constructor

`Program.cs`'s top-level statements read `SUPABASE_URL` / `SUPABASE_JWT_SECRET` / `IP_HASH_SALT` and
check `builder.Environment.IsDevelopment()` directly, as plain C# statements, before
`WebApplicationFactory`'s `ConfigureWebHost` customizations exist to intercept anything — those only
take effect once the factory composes the final host, by which point Program.cs has already either
thrown (`SUPABASE_JWT_SECRET must be configured in production`, etc.) or moved on. Setting real
process environment variables in the factory's constructor is the only way to reach code that runs
that early; flipping `ASPNETCORE_ENVIRONMENT` to `Development` instead was deliberately avoided
because it would also trigger `Program.cs`'s auto-migrate-on-startup block, which runs the real
Postgres migrations against the SQLite connection.
