using System.Reflection;

namespace Utanvega.Backend.Core;

/// <summary>
/// Identifies the running build, for health endpoints and diagnostics.
/// </summary>
public static class BuildInfo
{
    /// <summary>
    /// The release version, e.g. "1.1.1".
    ///
    /// <para>
    /// Read from <see cref="AssemblyInformationalVersionAttribute"/> rather than
    /// <c>Assembly.GetName().Version</c>, which pads to four parts and would
    /// report "1.1.1.0". The SDK appends the source revision to the
    /// informational version when available, so anything after a '+' is
    /// trimmed to leave the plain &lt;Version&gt; from the csproj.
    /// </para>
    /// </summary>
    public static string Version { get; } = ResolveVersion();

    /// <summary>
    /// Commit the running image was built from, or "unknown" when the build did
    /// not supply one. Set via the GIT_HASH build argument in the Dockerfile.
    /// </summary>
    public static string GitHash { get; } =
        Environment.GetEnvironmentVariable("GIT_HASH") is { Length: > 0 } hash ? hash : "unknown";

    private static string ResolveVersion()
    {
        var informational = typeof(BuildInfo).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion;

        if (!string.IsNullOrWhiteSpace(informational))
        {
            var plus = informational.IndexOf('+');
            return plus >= 0 ? informational[..plus] : informational;
        }

        return typeof(BuildInfo).Assembly.GetName().Version?.ToString() ?? "unknown";
    }
}
