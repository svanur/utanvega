using System.Reflection;

namespace Utanvega.Backend.Core;

/// <summary>
/// Identifies the running build, for health endpoints and diagnostics.
/// </summary>
public static class BuildInfo
{
    /// <summary>Reported when the value cannot be determined.</summary>
    public const string Unknown = "unknown";

    /// <summary>
    /// The release version as major.minor.patch, e.g. "1.1.1", or "unknown".
    /// </summary>
    public static string Version { get; } = NormalizeVersion(
        typeof(BuildInfo).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion,
        typeof(BuildInfo).Assembly.GetName().Version);

    /// <summary>
    /// Commit the running image was built from, or "unknown" when the build did
    /// not supply one. Set via the GIT_HASH build argument in the Dockerfile.
    /// </summary>
    public static string GitHash { get; } =
        NormalizeGitHash(Environment.GetEnvironmentVariable("GIT_HASH"));

    /// <summary>
    /// Resolves the display version from the two sources the runtime offers.
    ///
    /// <para>
    /// The informational version is preferred: <c>Assembly.GetName().Version</c>
    /// pads to four parts and would report "1.1.1.0" for a &lt;Version&gt; of
    /// "1.1.1". The SDK appends the source revision to the informational
    /// version when it can see the repository, so anything after a '+' is
    /// dropped. The assembly-version fallback is trimmed to three parts too, so
    /// both paths produce the same shape.
    /// </para>
    ///
    /// <para>Pure and public so the branches can be tested directly.</para>
    /// </summary>
    public static string NormalizeVersion(string? informationalVersion, Version? assemblyVersion)
    {
        if (!string.IsNullOrWhiteSpace(informationalVersion))
        {
            var trimmed = informationalVersion.Trim();
            var plus = trimmed.IndexOf('+');
            return plus >= 0 ? trimmed[..plus] : trimmed;
        }

        return assemblyVersion is null
            ? Unknown
            : $"{assemblyVersion.Major}.{assemblyVersion.Minor}.{assemblyVersion.Build}";
    }

    /// <summary>
    /// Normalises the supplied commit, falling back to "unknown" when absent or
    /// blank. Pure and public so the branches can be tested directly.
    /// </summary>
    public static string NormalizeGitHash(string? raw) =>
        string.IsNullOrWhiteSpace(raw) ? Unknown : raw.Trim();
}
