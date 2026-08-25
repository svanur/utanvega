using Utanvega.Backend.Core;
using Xunit;

namespace Utanvega.Backend.Tests.Services;

public class BuildInfoTests
{
    [Fact]
    public void Version_HasNoSourceRevisionSuffix()
    {
        // The SDK appends "+<commit>" to InformationalVersion when it can see
        // the repository, which is not something to show in a health response.
        Assert.DoesNotContain('+', BuildInfo.Version);
    }

    [Fact]
    public void Version_IsNotThePaddedFourPartForm()
    {
        // Assembly.GetName().Version reports "1.1.1.0"; the csproj <Version> is
        // "1.1.1". Reading the informational version is what keeps them equal.
        Assert.Equal(2, BuildInfo.Version.Split('.').Length - 1);
    }

    [Fact]
    public void Version_MatchesCsprojVersion()
    {
        Assert.Matches(@"^\d+\.\d+\.\d+$", BuildInfo.Version);
    }

    [Fact]
    public void GitHash_FallsBackToUnknown_WhenNotSupplied()
    {
        // Docker copies the source without .git, so the SDK cannot infer the
        // commit inside the image — CI passes it explicitly via --build-arg.
        // Absent that, "unknown" is the honest answer rather than a stale value.
        var expected = Environment.GetEnvironmentVariable("GIT_HASH") is { Length: > 0 } hash
            ? hash
            : "unknown";
        Assert.Equal(expected, BuildInfo.GitHash);
    }
}
