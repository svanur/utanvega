using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace Utanvega.Backend.Application.Advent;

/// <summary>
/// Staging-only testing override for the advent calendar's door-unlock gate (#1885). A singleton
/// computed once at startup in <c>Program.cs</c> via <see cref="FromConfiguration"/> — never
/// re-read per request, same as
/// <see cref="Utanvega.Backend.Infrastructure.Retention.TrailViewRetentionOptions"/> and friends.
/// </summary>
public sealed record AdventTestOverride(bool UnlockAllDoors)
{
    /// <summary>
    /// <see cref="UnlockAllDoors"/> is <c>true</c> only when <c>ADVENT_UNLOCK_ALL_DOORS</c> is set
    /// <b>and</b> <paramref name="environment"/> is not Production — that
    /// <see cref="IWebHostEnvironment.IsProduction"/> guard is load-bearing: even if the env var is
    /// ever set by mistake on the production Fly app, this still returns <c>false</c> there, so
    /// <c>AdventCalendar.IsDayUnlocked</c>'s real date gate is never bypassed in production.
    /// Extracted out of <c>Program.cs</c> as its own static method purely so this guard can be
    /// exercised directly against a mocked <see cref="IWebHostEnvironment"/>, without needing a
    /// full host boot to prove it.
    /// </summary>
    public static AdventTestOverride FromConfiguration(IConfiguration configuration, IWebHostEnvironment environment) =>
        new(!environment.IsProduction() && configuration.GetValue<bool>("ADVENT_UNLOCK_ALL_DOORS"));
}
