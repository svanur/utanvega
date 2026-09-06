using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Utanvega.Backend.Tests.WebHost;

/// <summary>
/// Fake authentication scheme used by <see cref="TestWebApplicationFactory"/> instead of a real
/// Supabase-issued JWT. It trusts two request headers rather than validating a signed token:
/// <see cref="UserIdHeader"/> becomes the identity's "sub" claim — the same claim
/// <c>GetAuthenticatedUserId(HttpContext)</c> in <c>Program.cs</c> reads when overriding a
/// client-supplied audit field — and <see cref="RoleHeader"/> becomes the role claim that
/// <c>[Authorize(Policy = "AdminOnly")]</c>'s <c>RequireRole("admin")</c> checks.
///
/// A request with no <see cref="UserIdHeader"/> authenticates as nobody (<c>AuthenticateResult.NoResult()</c>),
/// which is what exercises the "anonymous request rejected" path for endpoints that require auth.
/// Don't set the header manually in a new test — use <see cref="TestWebApplicationFactory.CreateAuthenticatedClient"/>.
/// </summary>
public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";
    public const string UserIdHeader = "X-Test-User-Id";
    public const string RoleHeader = "X-Test-Role";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(UserIdHeader, out var userId) || string.IsNullOrWhiteSpace(userId))
            return Task.FromResult(AuthenticateResult.NoResult());

        // Both claim types are set to the same value: real Supabase JWTs surface the user id as
        // "sub", and GetAuthenticatedUserId's fallback chain checks NameIdentifier first — setting
        // both means a test's expected id matches regardless of which one the endpoint reads.
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId!),
            new("sub", userId!),
        };

        if (Request.Headers.TryGetValue(RoleHeader, out var role) && !string.IsNullOrWhiteSpace(role))
            claims.Add(new Claim(ClaimTypes.Role, role!));

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
